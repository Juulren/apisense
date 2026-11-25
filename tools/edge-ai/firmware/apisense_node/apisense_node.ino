// Apisense hive node: listens with the INMP441, learns the hive's usual sound, judges each window and
// builds the 8-byte uplink. There is no radio yet: the message is printed over USB and
// apisense_audio/bridge.py can forward it to `lora-uplink`. When the LoRa module arrives, only
// sendUplink() changes (and the time comes from the network instead of the TIME command).
//
// Wiring, channel choice, gain and DC filter are the ones of capture_inmp441, so what the node hears
// is what the recordings used to develop the detector hear:
//     INMP441  SCK -> GPIO14   WS -> GPIO15   SD -> GPIO32   VDD -> 3V3   GND -> GND
//
// Two builds:
//   field (default)   60 s window every 10 min, 7 days of learning
//   bench (-DAPISENSE_BENCH)  5 s windows back to back, "1 day" of learning (about 3 minutes):
//                     ONLY to check that the chain works. It says nothing about detection.
//   quick (-DAPISENSE_QUICK)  60 s windows back to back, ready after 30 of them (about 31 minutes). A
//                     short first baseline of one part of one day: expect changes of the day to look different.
// Changing build erases what was learned (windows of different length are not comparable).
//
// Serial, 921600, text lines.
//   board -> PC   BOOT ... | CANAL ... | NEEDTIME | WINDOW key=value ... | UPLINK <16 hex> | INFO ... | ERROR ...
//   PC -> board   TIME <unix seconds> | RESET | STATUS
//
// Not done yet: deep sleep and power budget, temperature and battery sensors, the radio.
#include <ESP_I2S.h>
#include <Preferences.h>

#include "../apisense_edge/edge_payload.h"
#include "../apisense_edge/edge_storage.h"

#ifdef APISENSE_BENCH
static const uint32_t WINDOW_SECONDS = 5;
static const uint32_t CYCLE_SECONDS = 0;  // back to back
static const int LEARN_DAYS = 1;
static const int LEARN_STRIDE = 1;
static const char *MODE = "bench";
#elif defined(APISENSE_QUICK)
static const uint32_t WINDOW_SECONDS = 60;  // the field's window length
static const uint32_t CYCLE_SECONDS = 0;    // back to back: ready after 30 windows, about 31 minutes
static const int LEARN_DAYS = 1;
static const int LEARN_STRIDE = 1;
static const char *MODE = "rapido";
#else
static const uint32_t WINDOW_SECONDS = 60;
static const uint32_t CYCLE_SECONDS = 600;
static const int LEARN_DAYS = 7;
static const int LEARN_STRIDE = 2;  // 18 windows per slot and day; every 2nd one makes 63 in 7 days (64 fit)
static const char *MODE = "campo";
#endif

static const int PIN_SCK = 14;
static const int PIN_WS = 15;
static const int PIN_SD = 32;
static const int PREFERRED_CHANNEL = 1;
static const int BLOCK_SAMPLES = 256;
static const int GAIN_SHIFT = 14;       // as capture_inmp441
static const float DC_R = 0.995f;       // as capture_inmp441
// A dead line reads as digital silence (about -120 dB) and a floating one as one bit of noise (about -90 dB).
// The recordings made so far sit near -44 dB, far above this.
static const float DEAD_MIC_DB = -85.0f;
static const uint32_t FEATURE_VERSION = 1;  // raise it when the features or the audio path change
static const uint32_t TIME_MIN = 1700000000UL, TIME_MAX = 4102444800UL;  // 2023 .. 2100
static const int RMS_MEAN = 2 * apisense::kBands;  // index of rms_db_mean in the window features
static const int SAVE_EVERY = 12;       // windows between flash writes: a power cut costs at most this many

static I2SClass i2s;
static int channel = PREFERRED_CHANNEL;
static int32_t raw[BLOCK_SAMPLES * 2];
static int16_t block[BLOCK_SAMPLES];
static float prevX = 0.0f, prevY = 0.0f;
static bool primed = false;

static apisense::FrameAnalyzer analyzer;
static apisense::WindowAccumulator window;
static apisense::EdgeNode node(LEARN_DAYS, -6.0f, LEARN_STRIDE);  // Yucatan, UTC-6, no daylight saving
static apisense::EdgeStorage store;
static uint8_t uplinkCounter = 0;
static int sinceSave = 0;
static uint32_t lastStartMs = 0;
static bool first = true;

// One block from the microphone into block[]; returns the number of samples (0 on timeout).
static int readBlock() {
  const size_t got = i2s.readBytes((char *)raw, sizeof(raw));
  const int n = got / (2 * sizeof(int32_t));
  for (int i = 0; i < n; i++) {
    const float x = (float)(raw[i * 2 + channel] >> GAIN_SHIFT);
    if (!primed) {
      prevX = x;
      prevY = 0.0f;
      primed = true;
    }
    const float y = x - prevX + DC_R * prevY;
    prevX = x;
    prevY = y;
    int32_t s = (int32_t)y;
    if (s > 32767) s = 32767;
    if (s < -32768) s = -32768;
    block[i] = (int16_t)s;
  }
  return n;
}

static void startMic() {
  i2s.setPins(PIN_SCK, PIN_WS, -1, PIN_SD, -1);
  if (!i2s.begin(I2S_MODE_STD, apisense::kSampleRate, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO, I2S_STD_SLOT_BOTH)) {
    Serial.println("ERROR no se pudo iniciar I2S; reinicio en 30 s");
    delay(30000);
    ESP.restart();
  }
  double energy[2] = {0.0, 0.0};
  long counted = 0;
  for (int k = 0; k < 32; k++) {  // skip the start-up transient, then see which slot carries sound
    const size_t got = i2s.readBytes((char *)raw, sizeof(raw));
    if (k < 16) continue;
    const int pairs = got / (2 * sizeof(int32_t));
    for (int i = 0; i < pairs; i++) {
      for (int c = 0; c < 2; c++) {
        const double v = (double)(raw[i * 2 + c] >> GAIN_SHIFT);
        energy[c] += v * v;
      }
      counted++;
    }
  }
  const double rms0 = counted ? sqrt(energy[0] / counted) : 0.0;
  const double rms1 = counted ? sqrt(energy[1] / counted) : 0.0;
  if (rms0 > 4.0 * rms1) channel = 0;
  else if (rms1 > 4.0 * rms0) channel = 1;
  else channel = PREFERRED_CHANNEL;
  Serial.printf("CANAL izquierdo=%.1f derecho=%.1f usando=%s\n", rms0, rms1, channel == 0 ? "izquierdo" : "derecho");
}

static void printStatus() {
  Serial.printf("INFO modo=%s estado=%d fase=%d dias=%d/%d ventanas=%d franjas=%d umbral=%.3f reloj=%d pila_libre=%u memoria_libre=%u\n",
                MODE, (int)node.status(), (int)node.meta().phase, node.daysSeen(), LEARN_DAYS, node.learner().total(),
                node.learner().coveredSlots(), node.meta().phase == apisense::kReady ? node.baseline().threshold : 0.0f,
                node.hasClock() ? 1 : 0, (unsigned)uxTaskGetStackHighWaterMark(NULL), (unsigned)ESP.getFreeHeap());
}

static void handleCommands() {
  static char line[40];
  static size_t len = 0;
  while (Serial.available()) {
    const char c = (char)Serial.read();
    if (c != '\n' && c != '\r') {
      if (len < sizeof(line) - 1) line[len++] = c;
      continue;
    }
    line[len] = 0;
    len = 0;
    if (strncmp(line, "TIME ", 5) == 0) {
      const uint32_t t = strtoul(line + 5, NULL, 10);
      if (t > TIME_MIN && t < TIME_MAX) {  // refuse obviously wrong times (an overflow reads as 4294967295)
        const bool had = node.hasClock();
        node.setTime(t, millis());
        if (!had) Serial.println("INFO hora recibida");
      } else {
        Serial.println("ERROR hora no valida");
      }
    } else if (strcmp(line, "RESET") == 0) {
      node.resetLearning();
      store.wipe();
      sinceSave = 0;
      Serial.println("INFO aprendizaje reiniciado");
    } else if (strcmp(line, "STATUS") == 0) {
      printStatus();
    } else if (line[0]) {
      Serial.println("ERROR orden desconocida");
    }
  }
}

// The radio goes here (phase D, once there is a LoRa module).
static void sendUplink(const uint8_t message[apisense::kPayloadBytes]) {
  Serial.print("UPLINK ");
  for (size_t i = 0; i < apisense::kPayloadBytes; i++) Serial.printf("%02x", message[i]);
  Serial.println();
}

static void listenOnce() {
  // Audio that waited in the driver while the node was idle is old: throw half a second away.
  for (int k = 0; k < 32; k++) readBlock();
  window.reset();
  const uint32_t wanted = WINDOW_SECONDS * apisense::kSampleRate;
  uint32_t taken = 0, processing = 0;
  int silentReads = 0;
  const uint32_t t0 = millis();
  while (taken < wanted) {
    int n = readBlock();
    if (n <= 0) {
      if (++silentReads >= 3) break;  // the driver stopped delivering
      continue;
    }
    if (taken + n > wanted) n = wanted - taken;
    const uint32_t p0 = micros();
    window.feed(analyzer, block, n);
    processing += micros() - p0;
    taken += n;
  }
  // If the processing ever fell behind, the driver dropped audio and the window took longer than its length.
  const int32_t lostMs = (int32_t)(millis() - t0) - (int32_t)(taken / (apisense::kSampleRate / 1000));
  handleCommands();

  float features[apisense::kFeatures];
  window.result(features);
  const bool micFault = taken < wanted || window.frames() == 0 || features[RMS_MEAN] < DEAD_MIC_DB;
  // A window with a hole in it is not the sound of those seconds: more than 1 % (at least 500 ms) lost.
  const int32_t allowedMs = WINDOW_SECONDS > 50 ? (int32_t)(WINDOW_SECONDS * 10) : 500;
  const bool broken = lostMs > allowedMs;
  apisense::NodeResult r = {node.status(), 0, 0.0f, false, false};
  if (!micFault && !broken) {
    r = node.onWindow(features, millis());  // a broken microphone is never learned and never judged
  } else {
    r.status = apisense::kNoClock;  // sent as "not judging"
  }
  if (r.changed || (r.learned && ++sinceSave >= SAVE_EVERY)) {
    store.save(node, r.changed);
    sinceSave = 0;
  }
  const float threshold = node.meta().phase == apisense::kReady ? node.baseline().threshold : 0.0f;
  Serial.printf("WINDOW estado=%d alarma=%d puntaje=%.3f umbral=%.3f aprendida=%d dias=%d ventanas=%d rms_db=%.1f perdido_ms=%d proceso_ms=%u micro=%s pila_libre=%u memoria_libre=%u memoria_minima=%u\n",
                (int)(micFault || broken ? node.status() : r.status), r.alarm, r.score, threshold, r.learned ? 1 : 0, node.daysSeen(),
                node.learner().total(), window.frames() ? features[RMS_MEAN] : -120.0f, (int)lostMs,
                (unsigned)(processing / 1000), micFault ? "FALLA" : "ok", (unsigned)uxTaskGetStackHighWaterMark(NULL),
                (unsigned)ESP.getFreeHeap(), (unsigned)ESP.getMinFreeHeap());
  uint8_t message[apisense::kPayloadBytes];
  apisense::encodePayload(
      apisense::uplinkFor(r, threshold, uplinkCounter++, micFault ? apisense::kFlagMicFault : 0), message);
  sendUplink(message);
}

void setup() {
  Serial.setTxBufferSize(2048);
  Serial.begin(921600);
  delay(200);
  Serial.printf("\nBOOT apisense_node modo=%s ventana_s=%u ciclo_s=%u dias_aprendizaje=%d\n", MODE,
                (unsigned)WINDOW_SECONDS, (unsigned)CYCLE_SECONDS, LEARN_DAYS);
  if (!store.begin()) Serial.println("ERROR no se pudo abrir la memoria: lo aprendido no se conservara");
  Preferences build;
  if (build.begin("apinode", false)) {
    const uint32_t id = FEATURE_VERSION * 10000000UL + WINDOW_SECONDS * 1000 + LEARN_DAYS * 10 + LEARN_STRIDE;
    if (build.getUInt("build", 0) != id) {  // also on the first run: flash may hold test data
      store.wipe();
      Serial.println("INFO cambio de modo: se borra lo aprendido");
    }
    build.putUInt("build", id);
    build.end();
  }
  store.load(node);
  startMic();
  printStatus();
}

void loop() {
  handleCommands();
  static uint32_t askedAt = 0;
  if (!node.hasClock() && (askedAt == 0 || millis() - askedAt >= 5000)) {
    askedAt = millis();
    Serial.println("NEEDTIME");
    // Give the PC a moment before the first window, so it is not wasted without a clock.
    for (int i = 0; i < 100 && !node.hasClock(); i++) {
      handleCommands();
      delay(10);
    }
  }
  if (first || millis() - lastStartMs >= CYCLE_SECONDS * 1000UL) {
    first = false;
    lastStartMs = millis();
    listenOnce();
  } else {
    delay(20);
  }
}

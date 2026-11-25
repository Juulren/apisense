// Apisense edge-AI phase 0: raw audio capture for ESP32 DevKit V1 + INMP441.
//
// Streams 16 kHz, 16-bit mono PCM over USB serial (921600 baud) in small blocks
// with a sequence number and CRC-16, so the PC can detect and count any loss.
// The block format is documented in apisense_audio/framing.py and must stay
// identical:
//     0xA5 0x5A | seq u16 | n u16 | n x int16 | crc16 u16   (little endian)
//     CRC-16/CCITT-FALSE over seq, n and the samples.
//
// Wiring and channel are the ones of the local WiFi test that already worked
// (the microphone's data arrives on the RIGHT slot, "canal B"):
//     INMP441  SCK -> GPIO14   WS -> GPIO15   SD -> GPIO32
//              VDD -> 3V3      GND -> GND     L/R -> as in that test (the board
//              measures both slots at start-up and uses the one with sound)
// If you wire it differently, change the pins below.
//
// Built for Arduino-ESP32 core 3.x and 4.x with the ESP_I2S library (the legacy
// driver/i2s.h used by older sketches no longer exists in core 4.0). Compiled
// against esp32:esp32 4.0.0 for the "DOIT ESP32 DEVKIT V1" board.
//
// This measures relative level, not calibrated SPL. It records; it does not
// classify anything.
//
// On the first run, open the Serial Monitor at 921600 once to read the CANAL lines
// (then close it before recording), and check on the PC that the sidecar reports
// about 62.5 blocks/s. An I2S DMA overrun is not visible in the
// sequence number (that only counts loss on the USB side); the measured block
// rate is what reveals a stalled board.
#include <ESP_I2S.h>

static const int PIN_SCK = 14;
static const int PIN_WS = 15;
static const int PIN_SD = 32;
static I2SClass i2s;
// The slot with the microphone's data. The WiFi test read the RIGHT slot (index 1), but the
// slot order can differ between ESP32 core versions, so at start-up the sketch measures
// both slots and uses the one that carries sound. PREFERRED_CHANNEL breaks a tie.
static const int PREFERRED_CHANNEL = 1;
static int channel = PREFERRED_CHANNEL;

static const uint32_t SAMPLE_RATE = 16000;
static const int BLOCK_SAMPLES = 256;
// The INMP441 gives 24 bits left-aligned in a 32-bit slot. Hive sound is quiet:
// shifting by 14 instead of 16 gives 4x gain; samples are clamped to 16 bits.
static const int GAIN_SHIFT = 14;
// DC blocker (the same first-order filter as the WiFi test, ~13 Hz corner): it
// removes the constant offset and nothing of the hive's hum (100 Hz and up).
static const float DC_R = 0.995f;

static uint16_t crc16(const uint8_t *data, size_t len, uint16_t crc = 0xFFFF) {
  for (size_t i = 0; i < len; i++) {
    crc ^= (uint16_t)data[i] << 8;
    for (int b = 0; b < 8; b++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
  }
  return crc;
}

// Stereo frames (left, right) as the driver delivers them.
static int32_t raw[BLOCK_SAMPLES * 2];
static uint8_t packet[2 + 2 + 2 + BLOCK_SAMPLES * 2 + 2];
static uint16_t seq = 0;
static float prevX = 0.0f, prevY = 0.0f;
static bool primed = false;

void setup() {
  Serial.setTxBufferSize(8192);
  Serial.begin(921600);
  // If the driver or the pins fail, say so (the PC skips text) and stop: silence would look like a quiet hive.
  i2s.setPins(PIN_SCK, PIN_WS, -1, PIN_SD, -1);  // bclk, ws, dout (unused), din, mclk (unused)
  if (!i2s.begin(I2S_MODE_STD, SAMPLE_RATE, I2S_DATA_BIT_WIDTH_32BIT, I2S_SLOT_MODE_STEREO, I2S_STD_SLOT_BOTH)) {
    for (;;) {
      Serial.println("ERROR: no se pudo iniciar I2S");
      delay(1000);
    }
  }
  // The INMP441 needs about 260 ms to start and clicks while it does: read and throw away
  // ~0.5 s, measuring the energy of each slot on the way (values as in the sent samples).
  double energy[2] = {0.0, 0.0};
  long counted = 0;
  for (int k = 0; k < 32; k++) {
    const size_t got = i2s.readBytes((char *)raw, sizeof(raw));
    if (k < 16) continue;  // the first half second is the start-up transient
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
  // Text lines are skipped by the PC decoder; they tell you what the board found.
  Serial.print("CANAL izquierdo rms=");
  Serial.print(rms0, 1);
  Serial.print(" derecho rms=");
  Serial.println(rms1, 1);
  if (rms0 < 1.0 && rms1 < 1.0) {
    for (;;) {
      Serial.println("ERROR: ningun canal tiene senal (revisa SD, L/R y la alimentacion)");
      delay(1000);
    }
  }
  if (rms0 > 4.0 * rms1) channel = 0;
  else if (rms1 > 4.0 * rms0) channel = 1;
  else channel = PREFERRED_CHANNEL;
  Serial.print("Usando canal ");
  Serial.println(channel == 0 ? "izquierdo" : "derecho");
}

void loop() {
  const size_t got = i2s.readBytes((char *)raw, sizeof(raw));  // blocks until a block arrives (1 s timeout)
  const int n = got / (2 * sizeof(int32_t));
  if (n <= 0) return;
  size_t at = 0;
  packet[at++] = 0xA5;
  packet[at++] = 0x5A;
  const size_t bodyStart = at;
  packet[at++] = seq & 0xFF;
  packet[at++] = seq >> 8;
  packet[at++] = n & 0xFF;
  packet[at++] = n >> 8;
  for (int i = 0; i < n; i++) {
    const float x = (float)(raw[i * 2 + channel] >> GAIN_SHIFT);
    if (!primed) {  // no step transient from a filter that starts at zero
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
    packet[at++] = s & 0xFF;
    packet[at++] = (s >> 8) & 0xFF;
  }
  const uint16_t crc = crc16(packet + bodyStart, at - bodyStart);
  packet[at++] = crc & 0xFF;
  packet[at++] = crc >> 8;
  Serial.write(packet, at);
  seq++;
}

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
// Built for Arduino-ESP32 core 2.x (legacy driver/i2s.h). On core 3.x the same
// header still compiles with a deprecation warning.
//
// This measures relative level, not calibrated SPL. It records; it does not
// classify anything.
//
// On the first run, open the Serial Monitor at 921600 once to read the CANAL lines
// (then close it before recording), and check on the PC that the sidecar reports
// about 62.5 blocks/s. An I2S DMA overrun is not visible in the
// sequence number (that only counts loss on the USB side); the measured block
// rate is what reveals a stalled board.
#include <driver/i2s.h>

static const int PIN_SCK = 14;
static const int PIN_WS = 15;
static const int PIN_SD = 32;
static const i2s_port_t PORT = I2S_NUM_0;
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
  i2s_config_t config = {};
  config.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
  config.sample_rate = SAMPLE_RATE;
  config.bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT;
  config.channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT;
  config.communication_format = I2S_COMM_FORMAT_STAND_I2S;
  config.intr_alloc_flags = ESP_INTR_FLAG_LEVEL1;
  config.dma_buf_count = 8;
  config.dma_buf_len = BLOCK_SAMPLES;
  config.use_apll = false;
  i2s_pin_config_t pins = {};
  pins.bck_io_num = PIN_SCK;
  pins.ws_io_num = PIN_WS;
  pins.data_out_num = I2S_PIN_NO_CHANGE;
  pins.data_in_num = PIN_SD;
  // If the driver or the pins fail, say so (the PC skips text) and stop: silence would look like a quiet hive.
  if (i2s_driver_install(PORT, &config, 0, NULL) != ESP_OK || i2s_set_pin(PORT, &pins) != ESP_OK) {
    for (;;) {
      Serial.println("ERROR: no se pudo iniciar I2S");
      delay(1000);
    }
  }
  i2s_zero_dma_buffer(PORT);
  // The INMP441 needs about 260 ms to start and clicks while it does: read and throw away
  // ~0.5 s, measuring the energy of each slot on the way (values as in the sent samples).
  double energy[2] = {0.0, 0.0};
  long counted = 0;
  for (int k = 0; k < 32; k++) {
    size_t got = 0;
    i2s_read(PORT, raw, sizeof(raw), &got, portMAX_DELAY);
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
  size_t read = 0;
  i2s_read(PORT, raw, sizeof(raw), &read, portMAX_DELAY);
  const int n = read / (2 * sizeof(int32_t));
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

// Apisense edge-AI phase 0: raw audio capture for ESP32 DevKit V1 + INMP441.
//
// Streams 16 kHz, 16-bit mono PCM over USB serial (921600 baud) in small blocks
// with a sequence number and CRC-16, so the PC can detect and count any loss.
// The block format is documented in apisense_audio/framing.py and must stay
// identical:
//     0xA5 0x5A | seq u16 | n u16 | n x int16 | crc16 u16   (little endian)
//     CRC-16/CCITT-FALSE over seq, n and the samples.
//
// Wiring (change the pins below to match yours):
//     INMP441  VDD -> 3V3   GND -> GND   L/R -> GND (left channel)
//              SCK -> GPIO32   WS -> GPIO25   SD -> GPIO33
//
// Built for Arduino-ESP32 core 2.x (legacy driver/i2s.h). On core 3.x the same
// header still compiles with a deprecation warning.
//
// This measures relative level, not calibrated SPL. It records; it does not
// classify anything.
//
// Check on the first run: samples must not be all 0 or all -1 (a left/right swap
// on some core versions), and the PC sidecar must report about 62.5 blocks/s.
// An I2S DMA overrun is not visible in the sequence number (that only counts
// loss on the USB side); the measured block rate is what reveals a stalled board.
#include <driver/i2s.h>

static const int PIN_SCK = 32;
static const int PIN_WS = 25;
static const int PIN_SD = 33;
static const i2s_port_t PORT = I2S_NUM_0;

static const uint32_t SAMPLE_RATE = 16000;
static const int BLOCK_SAMPLES = 256;
// The INMP441 gives 24 bits left-aligned in a 32-bit slot. Hive sound is quiet:
// shifting by 14 instead of 16 gives 4x gain; samples are clamped to 16 bits.
static const int GAIN_SHIFT = 14;

static uint16_t crc16(const uint8_t *data, size_t len, uint16_t crc = 0xFFFF) {
  for (size_t i = 0; i < len; i++) {
    crc ^= (uint16_t)data[i] << 8;
    for (int b = 0; b < 8; b++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : (crc << 1);
  }
  return crc;
}

static int32_t raw[BLOCK_SAMPLES];
static uint8_t packet[2 + 2 + 2 + BLOCK_SAMPLES * 2 + 2];
static uint16_t seq = 0;

void setup() {
  Serial.setTxBufferSize(8192);
  Serial.begin(921600);
  i2s_config_t config = {};
  config.mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX);
  config.sample_rate = SAMPLE_RATE;
  config.bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT;
  config.channel_format = I2S_CHANNEL_FMT_ONLY_LEFT;
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
}

void loop() {
  size_t read = 0;
  i2s_read(PORT, raw, sizeof(raw), &read, portMAX_DELAY);
  const int n = read / sizeof(int32_t);
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
    int32_t s = raw[i] >> GAIN_SHIFT;
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

// Parity test: the PC sends audio, the board computes the window features with the real
// detector code (edge_features.h) and answers; apisense_audio/parity.py compares them with
// the Python features. This is how we know the C++ port gives the same numbers.
//
// Protocol (921600 baud, little endian):
//   PC -> board   A5 5C | n u32 | n x int16   (sent in chunks of 512 samples; the board
//                 answers one byte 'k' after each chunk, so the PC never overruns it)
//   board -> PC   A5 5D | frames u32 | micros u32 | 24 x float32
// Text lines (starting with something other than A5) are only messages.
#include "../apisense_edge/edge_features.h"

static apisense::FrameAnalyzer analyzer;
static apisense::WindowAccumulator window;
static const int CHUNK = 512;
static int16_t chunk[CHUNK];

static bool readExact(uint8_t *dst, size_t n) {
  size_t got = 0;
  while (got < n) {
    const size_t r = Serial.readBytes(dst + got, n - got);
    if (r == 0) return false;  // timeout
    got += r;
  }
  return true;
}

void setup() {
  Serial.setRxBufferSize(4096);
  Serial.begin(921600);
  Serial.setTimeout(3000);
  Serial.println("parity_test listo");
}

void loop() {
  if (Serial.available() < 2) return;
  if (Serial.read() != 0xA5) return;
  if (Serial.read() != 0x5C) return;
  uint32_t n = 0;
  if (!readExact(reinterpret_cast<uint8_t *>(&n), 4)) return;
  window.reset();
  const uint32_t t0 = micros();
  uint32_t left = n;
  while (left > 0) {
    const size_t take = left < CHUNK ? left : CHUNK;
    if (!readExact(reinterpret_cast<uint8_t *>(chunk), take * 2)) return;
    window.feed(analyzer, chunk, take);
    left -= take;
    Serial.write('k');
  }
  const uint32_t elapsed = micros() - t0;
  float out[apisense::kFeatures];
  window.result(out);
  const uint32_t frames = window.frames();
  const uint8_t head[2] = {0xA5, 0x5D};
  Serial.write(head, 2);
  Serial.write(reinterpret_cast<const uint8_t *>(&frames), 4);
  Serial.write(reinterpret_cast<const uint8_t *>(&elapsed), 4);
  Serial.write(reinterpret_cast<const uint8_t *>(out), sizeof(out));
}

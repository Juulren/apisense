// Phase C test bench: the PC sends window features (not audio) and the board runs the real
// on-node learning code (edge_learn.h, edge_node.h, edge_storage.h). apisense_audio/learn_parity.py
// compares the answers with the Python baseline and checks the behaviour (drift cap, learning
// period, no clock, reset, power-cut recovery). Little endian, 921600 baud.
//
//   record = 25 x float32: hour of day (or 0 when the timeline sets the time), then 24 features
//
//   PC -> board                                      board -> PC
//   A5 60 | n u32 | flags u32 | n x record           'k' per record, then STATE
//        (flags bit0: mark the node as ready after fitting)
//   A5 62 | n u32 | n x record                       'k' per record, then A5 63 | n | taken | n x (accepted, alarm) | n x score
//   A5 64                                            A5 65 | micros u32     (save to flash)
//   A5 66                                            STATE
//   A5 68 | unix u32 | n u32 | n x (ms u32, 24 f32)  'k' per record, then A5 69 | n | n x (status, alarm, learned, changed) | n x score
//        (unix 0 = the clock is never set)
//   A5 6A                                            'k'                    (reset command: forget and wipe flash)
//   A5 6C | class u8 | conf f32 | hasTemp u8 | temp f32 | hasBat u8 | bat f32 | counter u8 | flags u8   -> A5 6D | 8 bytes   (encoder)
//   A5 6E | status u8 | alarm u8 | score f32 | threshold f32 | counter u8 | extraFlags u8                -> A5 6D | 8 bytes   (verdict -> message)
//   STATE = A5 61 | status u8 | phase u8 | pad 2 | days u32 | total u32 | covered u32 | threshold f32 | 192 f32 centre | 192 f32 scale
#include "../apisense_edge/edge_payload.h"
#include "../apisense_edge/edge_storage.h"

static apisense::EdgeNode node(7, -6.0f);
static apisense::EdgeStorage store;

static bool readExact(void *dst, size_t n) {
  uint8_t *p = static_cast<uint8_t *>(dst);
  size_t got = 0;
  while (got < n) {
    const size_t r = Serial.readBytes(p + got, n - got);
    if (r == 0) return false;
    got += r;
  }
  return true;
}

#define put(v) Serial.write(reinterpret_cast<const uint8_t *>(&(v)), sizeof(v))

static void sendState() {
  const uint8_t head[2] = {0xA5, 0x61};
  Serial.write(head, 2);
  const uint8_t status = node.status(), phase = node.meta().phase, pad[2] = {0, 0};
  put(status);
  put(phase);
  Serial.write(pad, 2);
  const uint32_t days = node.daysSeen(), total = node.learner().total(), covered = node.learner().coveredSlots();
  put(days);
  put(total);
  put(covered);
  put(node.baseline().threshold);
  Serial.write(reinterpret_cast<const uint8_t *>(node.baseline().center), sizeof(node.baseline().center));
  Serial.write(reinterpret_cast<const uint8_t *>(node.baseline().scale), sizeof(node.baseline().scale));
}

void setup() {
  Serial.setRxBufferSize(4096);
  Serial.begin(921600);
  Serial.setTimeout(3000);
  store.begin();
  store.load(node);  // what survived the last power cut
  Serial.println("learn_test listo");
}

void loop() {
  if (Serial.available() < 2) return;
  if (Serial.read() != 0xA5) return;
  const int cmd = Serial.read();
  float rec[1 + apisense::kFeatures];
  uint32_t n = 0;
  switch (cmd) {
    case 0x60: {
      uint32_t flags = 0;
      if (!readExact(&n, 4) || !readExact(&flags, 4)) return;
      node.learner().reset();
      for (uint32_t i = 0; i < n; i++) {
        if (!readExact(rec, sizeof(rec))) return;
        node.learner().add(rec + 1, rec[0]);
        Serial.write('k');
      }
      node.learner().fit(node.baseline(), true);
      if (flags & 1) node.meta().phase = apisense::kReady;
      sendState();
      break;
    }
    case 0x62: {
      if (!readExact(&n, 4)) return;
      static apisense::Detector detector(node.baseline());
      detector.reset();
      static uint8_t flags[2 * 600];
      static float scores[600];
      if (n > 600) return;
      uint32_t taken = 0;
      for (uint32_t i = 0; i < n; i++) {
        if (!readExact(rec, sizeof(rec))) return;
        float s;
        const int alarm = detector.update(rec + 1, rec[0], &s);
        const bool got = node.learner().observe(node.baseline(), rec + 1, rec[0], s, detector.recentOver() > 0);
        taken += got;
        flags[2 * i] = got;
        flags[2 * i + 1] = alarm;
        scores[i] = s;
        Serial.write('k');
      }
      const uint8_t head[2] = {0xA5, 0x63};
      Serial.write(head, 2);
      put(n);
      put(taken);
      Serial.write(flags, 2 * n);
      Serial.write(reinterpret_cast<const uint8_t *>(scores), 4 * n);
      break;
    }
    case 0x64: {
      const uint32_t t0 = micros();
      store.save(node, true);
      const uint32_t dt = micros() - t0;
      const uint8_t head[2] = {0xA5, 0x65};
      Serial.write(head, 2);
      put(dt);
      break;
    }
    case 0x66:
      sendState();
      break;
    case 0x68: {
      uint32_t unixTime = 0;
      if (!readExact(&unixTime, 4) || !readExact(&n, 4)) return;
      if (n > 1200) return;
      if (unixTime) node.setTime(unixTime, 0);
      static uint8_t out[4 * 1200];
      static float scores[1200];
      int sinceSave = 0;
      for (uint32_t i = 0; i < n; i++) {
        uint32_t ms;
        float f[apisense::kFeatures];
        if (!readExact(&ms, 4) || !readExact(f, sizeof(f))) return;
        const apisense::NodeResult r = node.onWindow(f, ms);
        out[4 * i] = r.status;
        out[4 * i + 1] = r.alarm;
        out[4 * i + 2] = r.learned;
        out[4 * i + 3] = r.changed;
        scores[i] = r.score;
        if (r.changed || ++sinceSave >= 12) {  // a power cut costs at most 12 windows
          store.save(node, r.changed);
          sinceSave = 0;
        }
        Serial.write('k');
      }
      store.save(node, true);
      const uint8_t head[2] = {0xA5, 0x69};
      Serial.write(head, 2);
      put(n);
      Serial.write(out, 4 * n);
      Serial.write(reinterpret_cast<const uint8_t *>(scores), 4 * n);
      break;
    }
    case 0x6C: {
      uint8_t b[1 + 4 + 1 + 4 + 1 + 4 + 1 + 1];
      if (!readExact(b, sizeof(b))) return;
      apisense::UplinkInput in;
      in.classCode = b[0];
      memcpy(&in.confidence, b + 1, 4);
      in.hasTemperature = b[5];
      memcpy(&in.temperatureC, b + 6, 4);
      in.hasBattery = b[10];
      memcpy(&in.batteryV, b + 11, 4);
      in.counter = b[15];
      in.flags = b[16];
      uint8_t out[apisense::kPayloadBytes];
      apisense::encodePayload(in, out);
      const uint8_t head[2] = {0xA5, 0x6D};
      Serial.write(head, 2);
      Serial.write(out, sizeof(out));
      break;
    }
    case 0x6E: {
      uint8_t b[1 + 1 + 4 + 4 + 1 + 1];
      if (!readExact(b, sizeof(b))) return;
      apisense::NodeResult r = {static_cast<apisense::Status>(b[0]), b[1], 0.0f, false, false};
      float threshold;
      memcpy(&r.score, b + 2, 4);
      memcpy(&threshold, b + 6, 4);
      uint8_t out[apisense::kPayloadBytes];
      apisense::encodePayload(apisense::uplinkFor(r, threshold, b[10], b[11]), out);
      const uint8_t head[2] = {0xA5, 0x6D};
      Serial.write(head, 2);
      Serial.write(out, sizeof(out));
      break;
    }
    case 0x6A:
      node.resetLearning();
      store.wipe();
      Serial.write('k');
      break;
  }
}

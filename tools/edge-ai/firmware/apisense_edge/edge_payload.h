// The 8-byte uplink (format 1, class map 1), byte for byte what supabase/functions/_shared/edgePayload.ts
// decodes. Portable C++ (no Arduino).
//
//   byte 0  format version (high nibble) | class-map version (low nibble)   -> 0x11
//   byte 1  class code: 0 usual sound, 1 sound different from usual
//   byte 2  confidence 0..255 -> 0..1
//   byte 3-4 temperature, int16 big-endian, hundredths of a degree (0x8000 = no sensor)
//   byte 5  battery: 2.00 V + 10 mV x value (0xFF = unknown)
//   byte 6  counter (low nibble) | flags (high nibble)
//   byte 7  CRC-8 (polynomial 0x07, initial 0x00) of bytes 0..6
//
// Flags: 1 SD full, 2 microphone fault, 4 low battery, 8 NOT JUDGING (the node is still learning the hive's
// usual sound, or has no time yet). While bit 8 is set the class code is 0 and the confidence 0, and the
// app must not count the message as "usual sound".
#pragma once
#include "edge_node.h"

namespace apisense {

constexpr size_t kPayloadBytes = 8;
// Categories of class map 1. New ones go here and in edgeClassMaps (see docs/AMPLIAR_CATEGORIAS.md).
constexpr uint8_t kClassUsual = 0, kClassDifferent = 1;
constexpr uint8_t kFlagSdFull = 1, kFlagMicFault = 2, kFlagLowBattery = 4, kFlagNotJudging = 8;

inline uint8_t crc8(const uint8_t* p, size_t n) {
  uint8_t crc = 0;
  for (size_t i = 0; i < n; i++) {
    crc ^= p[i];
    for (int bit = 0; bit < 8; bit++) crc = (crc & 0x80) ? static_cast<uint8_t>((crc << 1) ^ 0x07) : static_cast<uint8_t>(crc << 1);
  }
  return crc;
}

struct UplinkInput {
  uint8_t classCode = 0;
  float confidence = 0.0f;  // 0..1 (not finite counts as 0)
  bool hasTemperature = false;
  float temperatureC = 0.0f;
  bool hasBattery = false;
  float batteryV = 0.0f;
  uint8_t counter = 0;  // only the low 4 bits travel
  uint8_t flags = 0;    // only the low 4 bits travel
};

// JavaScript's Math.round (halves go up), so the bytes equal the TypeScript encoder's.
inline int32_t roundHalfUp(float x) { return static_cast<int32_t>(floorf(x + 0.5f)); }

inline void encodePayload(const UplinkInput& in, uint8_t out[kPayloadBytes]) {
  out[0] = 0x11;
  out[1] = in.classCode;
  int32_t conf = isfinite(in.confidence) ? roundHalfUp(in.confidence * 255.0f) : 0;
  out[2] = static_cast<uint8_t>(conf < 0 ? 0 : conf > 255 ? 255 : conf);
  // The server rejects the whole message for a temperature outside -40..85 C (a loose probe reads -127), so an
  // impossible or non-finite reading is sent as "no sensor" instead of losing the verdict.
  const bool tempOk = in.hasTemperature && isfinite(in.temperatureC) && in.temperatureC >= -40.0f && in.temperatureC <= 85.0f;
  const uint16_t temp = tempOk ? static_cast<uint16_t>(roundHalfUp(in.temperatureC * 100.0f) & 0xFFFF) : 0x8000;
  out[3] = static_cast<uint8_t>(temp >> 8);
  out[4] = static_cast<uint8_t>(temp & 0xFF);
  const bool batOk = in.hasBattery && isfinite(in.batteryV);
  int32_t bat = batOk ? roundHalfUp((in.batteryV - 2.0f) * 100.0f) : 0;
  out[5] = batOk ? static_cast<uint8_t>(bat < 0 ? 0 : bat > 254 ? 254 : bat) : 0xFF;
  out[6] = static_cast<uint8_t>(((in.flags & 0x0F) << 4) | (in.counter & 0x0F));
  out[7] = crc8(out, 7);
}

// The node's message for what its brain just decided. `threshold` is the baseline's (used for the confidence).
// While learning or without a clock it says "not judging". Confidence is how far the score is from the
// threshold, as a share of it, mapped to 0.5..1: a margin, not a probability.
inline UplinkInput uplinkFor(const NodeResult& r, float threshold, uint8_t counter, uint8_t extraFlags = 0) {
  UplinkInput in;
  in.counter = counter;
  in.flags = extraFlags & 0x07;
  if (r.status != kReady) {
    in.flags |= kFlagNotJudging;
    return in;
  }
  in.classCode = r.alarm ? kClassDifferent : kClassUsual;
  float margin = threshold > 0.0f ? fabsf(r.score - threshold) / threshold : 0.0f;
  if (margin > 1.0f) margin = 1.0f;
  in.confidence = 0.5f + 0.5f * margin;
  return in;
}

}  // namespace apisense

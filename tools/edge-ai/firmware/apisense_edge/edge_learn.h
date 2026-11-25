// Learning a hive's usual sound ON THE NODE (phase C). Portable C++, no Arduino dependency.
//
// The same maths as apisense_audio/baseline.py (HiveBaseline.fit): per 3-hour slot and feature,
// centre = median and scale = 1.4826 x MAD (never below the feature's floor); a slot with fewer
// than 20 windows borrows the all-day row; threshold = 99.5 % quantile of the training scores x 1.25.
// To do it with fixed memory the node keeps the most recent kPerBucket windows of every slot (about
// 49 KB) instead of a streaming estimator: medians stay exact, and "learning slowly" is just the ring
// forgetting its oldest window. learn_parity.py checks the result against Python on the board.
//
// Slow drift, with a cap: once the baseline is ready, a window is only taken in when its score is
// at or under the threshold and none of the last `of` windows exceeded it (an intermittent problem
// is not learned in between). The threshold never moves, and the refitted centre stays within
// kDriftCap scales of the one learned at the end of the learning period while the spread never drops
// below kScaleKeep of it, so neither a slow change nor a ratchet can make a problem "usual".
// A real, lasting change of sound (new queen, a moved hive) needs the reset command and a new
// learning period.
#pragma once
#include <algorithm>
#include <string.h>

#include "edge_features.h"

namespace apisense {

constexpr int kPerBucket = 64;        // windows kept per 3-hour slot
constexpr int kMinBucketWindows = 20; // fewer than this: the slot uses the all-day row
constexpr int kMinWindows = 30;       // fewer than this in total: no baseline
constexpr float kThresholdQuantile = 0.995f;
constexpr float kThresholdMargin = 1.25f;
constexpr float kDriftCap = 3.0f;   // the centre may move this many reference scales at most
constexpr float kScaleKeep = 0.8f;  // and the scale may not fall below this share of the reference
constexpr int kRefitEvery = 8;        // refit the baseline after this many windows were taken in
constexpr float kBinHz = static_cast<float>(kSampleRate) / kFrame;

// The smallest spread worth trusting for feature slot i (0..23, mean/std interleaved), in its own unit.
// Same as baseline.scale_floor; slots 18..21 are centroid and dominant frequency, 22..23 flatness.
inline float scaleFloor(int i) {
  const int f = i / 2;
  const bool spread = (i & 1) != 0;
  if (f == 11) return spread ? 0.01f : 0.02f;
  if (f == 9 || f == 10) return (spread ? 1.0f : 2.0f) * kBinHz;
  return spread ? 0.5f : 1.0f;  // dB
}

inline uint32_t crc32(const uint8_t* p, size_t n) {
  uint32_t c = 0xFFFFFFFFu;
  for (size_t i = 0; i < n; i++) {
    c ^= p[i];
    for (int k = 0; k < 8; k++) c = (c >> 1) ^ (0xEDB88320u & (0u - (c & 1u)));
  }
  return ~c;
}

inline bool allFinite(const float* v, size_t n) {
  for (size_t i = 0; i < n; i++)
    if (!(fabsf(v[i]) < 1e30f)) return false;  // also false for NaN
  return true;
}

// The last kPerBucket windows of one slot.
struct BucketStore {
  uint16_t count = 0, next = 0;
  float w[kPerBucket][kFeatures];
  void clear() { count = next = 0; }
  void push(const float x[kFeatures]) {
    memcpy(w[next], x, sizeof(float) * kFeatures);
    next = (next + 1) % kPerBucket;
    if (count < kPerBucket) count++;
  }
};

constexpr size_t kBucketBlobSize = 4 + sizeof(BucketStore);   // crc32 + the store
constexpr size_t kBaselineBlobSize = 4 + 4 + 4 + 2 + 2 +      // magic, crc32, threshold, need, of
                                     2 * sizeof(float) * kHourBuckets * kFeatures;

class BaselineLearner {
 public:
  BaselineLearner() { reset(); }

  void reset() {
    for (int b = 0; b < kHourBuckets; b++) store_[b].clear();
    dirty_ = 0xFF;
    sinceFit_ = 0;
    hasRef_ = false;
  }

  void add(const float window[kFeatures], float hour) {
    const int b = bucketOf(hour);
    store_[b].push(window);
    dirty_ |= static_cast<uint8_t>(1u << b);
  }

  int total() const {
    int n = 0;
    for (int b = 0; b < kHourBuckets; b++) n += store_[b].count;
    return n;
  }
  int stored(int b) const { return store_[b].count; }
  // Slots with enough windows of their own.
  int coveredSlots() const {
    int n = 0;
    for (int b = 0; b < kHourBuckets; b++) n += store_[b].count >= kMinBucketWindows;
    return n;
  }

  // Fit centre and scale of every slot. With recalibrate, also set the threshold from the stored
  // windows' own scores. False if there are too few windows.
  bool fit(Baseline& out, bool recalibrate) {
    const int n = total();
    if (n < kMinWindows) return false;
    float gc[kFeatures], gs[kFeatures];
    for (int i = 0; i < kFeatures; i++) {
      int m = 0;
      for (int b = 0; b < kHourBuckets; b++)
        for (int j = 0; j < store_[b].count; j++) v_[m++] = store_[b].w[j][i];
      robust(m, scaleFloor(i), &gc[i], &gs[i]);
    }
    for (int b = 0; b < kHourBuckets; b++) {
      for (int i = 0; i < kFeatures; i++) {
        if (store_[b].count >= kMinBucketWindows) {
          for (int j = 0; j < store_[b].count; j++) v_[j] = store_[b].w[j][i];
          robust(store_[b].count, scaleFloor(i), &out.center[b][i], &out.scale[b][i]);
        } else {
          out.center[b][i] = gc[i];
          out.scale[b][i] = gs[i];
        }
      }
    }
    if (!recalibrate && hasRef_) {
      for (int b = 0; b < kHourBuckets; b++)
        for (int i = 0; i < kFeatures; i++) {
          const float cap = kDriftCap * ref_.scale[b][i];
          const float c = ref_.center[b][i];
          if (out.center[b][i] > c + cap) out.center[b][i] = c + cap;
          if (out.center[b][i] < c - cap) out.center[b][i] = c - cap;
          const float keep = kScaleKeep * ref_.scale[b][i];
          if (out.scale[b][i] < keep) out.scale[b][i] = keep;
        }
    }
    if (recalibrate) {
      int m = 0;
      for (int b = 0; b < kHourBuckets; b++)
        for (int j = 0; j < store_[b].count; j++) v_[m++] = scoreIn(out, store_[b].w[j], b);
      std::sort(v_, v_ + m);
      const double pos = static_cast<double>(kThresholdQuantile) * (m - 1);
      const int lo = static_cast<int>(pos);
      const int hi = lo + 1 < m ? lo + 1 : lo;
      const double q = v_[lo] + (v_[hi] - v_[lo]) * (pos - lo);
      out.threshold = static_cast<float>(q * kThresholdMargin);
      ref_ = out;  // the learning period's baseline: what the drift cap is measured from
      hasRef_ = true;
    }
    sinceFit_ = 0;
    return true;
  }

  // Once ready: offer a window that was just scored. Returns true if it was taken into the baseline.
  // `recentlyDifferent`: one of the last `of` windows exceeded the threshold (Detector::recentOver() > 0);
  // nothing is learned then, and never a window over the threshold itself.
  bool observe(Baseline& base, const float window[kFeatures], float hour, float score, bool recentlyDifferent) {
    if (recentlyDifferent || !(score <= base.threshold)) return false;
    add(window, hour);
    if (++sinceFit_ >= kRefitEvery) fit(base, false);
    return true;
  }

  // The baseline fitted at the end of the learning period (what flash keeps and the drift cap uses).
  const Baseline& reference() const { return ref_; }
  void setReference(const Baseline& b) {
    ref_ = b;
    hasRef_ = true;
  }
  bool hasReference() const { return hasRef_; }

  // Slots that changed since the last call (bit b = slot b) -- what has to be written to flash.
  uint8_t takeDirty() {
    const uint8_t d = dirty_;
    dirty_ = 0;
    return d;
  }

  // Flash record of one slot: crc32 of the store, then the store.
  void packBucket(int b, uint8_t* out) const {
    memcpy(out + 4, &store_[b], sizeof(BucketStore));
    const uint32_t c = crc32(out + 4, sizeof(BucketStore));
    memcpy(out, &c, 4);
  }
  bool unpackBucket(int b, const uint8_t* in, size_t size) {
    if (size != kBucketBlobSize) return false;
    uint32_t c;
    memcpy(&c, in, 4);
    if (c != crc32(in + 4, sizeof(BucketStore))) return false;
    // Checked in place: a copy of the store would not fit the 8 KB stack of the Arduino loop task.
    uint16_t count, next;
    memcpy(&count, in + 4, 2);
    memcpy(&next, in + 6, 2);
    if (count > kPerBucket || next >= kPerBucket) return false;
    const uint8_t* values = in + 4 + offsetof(BucketStore, w);
    for (size_t i = 0; i < static_cast<size_t>(kPerBucket) * kFeatures; i++) {
      float f;
      memcpy(&f, values + 4 * i, 4);
      if (!(fabsf(f) < 1e30f)) return false;
    }
    memcpy(&store_[b], in + 4, sizeof(BucketStore));
    return true;
  }

 private:
  // v_[0..n) -> centre = median, scale = max(1.4826 x MAD, floor). Reorders v_; uses d_.
  void robust(int n, float floorValue, float* center, float* scale) {
    const float c = median(v_, n);
    for (int j = 0; j < n; j++) d_[j] = fabsf(v_[j] - c);
    const float s = 1.4826f * median(d_, n);
    *center = c;
    *scale = s > floorValue ? s : floorValue;
  }
  static float median(float* x, int n) {
    std::sort(x, x + n);
    return (n & 1) ? x[n / 2] : 0.5f * (x[n / 2 - 1] + x[n / 2]);
  }

  BucketStore store_[kHourBuckets];
  float v_[kHourBuckets * kPerBucket], d_[kHourBuckets * kPerBucket];
  uint8_t dirty_ = 0xFF;
  int sinceFit_ = 0;
  Baseline ref_;
  bool hasRef_ = false;
};

// Flash record of a finished baseline (about 1.5 KB): magic, crc32 of what follows, threshold, need, of,
// then centre and scale.
inline void packBaseline(const Baseline& b, uint8_t* out) {
  const uint32_t magic = 0x31425041;  // "APB1"
  uint8_t* p = out + 8;
  memcpy(p, &b.threshold, 4);
  p += 4;
  const uint16_t need = static_cast<uint16_t>(b.need), of = static_cast<uint16_t>(b.of);
  memcpy(p, &need, 2);
  memcpy(p + 2, &of, 2);
  p += 4;
  memcpy(p, b.center, sizeof(b.center));
  memcpy(p + sizeof(b.center), b.scale, sizeof(b.scale));
  memcpy(out, &magic, 4);
  const uint32_t c = crc32(out + 8, kBaselineBlobSize - 8);
  memcpy(out + 4, &c, 4);
}

inline bool unpackBaseline(const uint8_t* in, size_t size, Baseline& b) {
  if (size != kBaselineBlobSize) return false;
  uint32_t magic, c;
  memcpy(&magic, in, 4);
  memcpy(&c, in + 4, 4);
  if (magic != 0x31425041 || c != crc32(in + 8, kBaselineBlobSize - 8)) return false;
  const uint8_t* p = in + 8;
  Baseline t;
  memcpy(&t.threshold, p, 4);
  uint16_t need, of;
  memcpy(&need, p + 4, 2);
  memcpy(&of, p + 6, 2);
  p += 8;
  memcpy(t.center, p, sizeof(t.center));
  memcpy(t.scale, p + sizeof(t.center), sizeof(t.scale));
  if (need < 1 || of < need || of > 8) return false;
  if (!(t.threshold > 0.0f) || !(t.threshold < 1e6f)) return false;
  if (!allFinite(&t.center[0][0], kHourBuckets * kFeatures)) return false;
  if (!allFinite(&t.scale[0][0], kHourBuckets * kFeatures)) return false;
  for (int k = 0; k < kHourBuckets; k++)
    for (int i = 0; i < kFeatures; i++)
      if (!(t.scale[k][i] > 0.0f)) return false;  // a zero scale would divide by zero
  t.need = need;
  t.of = of;
  b = t;
  return true;
}

// Local time of day from a time that was given once (LoRaWAN DeviceTimeReq, a command, an RTC).
// Keeps counting with the millisecond counter; folds whole seconds as it goes so the counter's
// 49-day wrap cannot matter.
class NodeClock {
 public:
  explicit NodeClock(float tzHours = -6.0f) : tzSeconds_(static_cast<int32_t>(tzHours * 3600.0f)) {}
  void set(uint32_t unixSeconds, uint32_t nowMs) {
    unix_ = unixSeconds;
    atMs_ = nowMs;
    valid_ = true;
  }
  bool valid() const { return valid_; }
  uint32_t unixNow(uint32_t nowMs) {
    const uint32_t seconds = (nowMs - atMs_) / 1000;
    unix_ += seconds;
    atMs_ += seconds * 1000;
    return unix_;
  }
  // Day number and hour of the day in local time.
  uint32_t localDay(uint32_t nowMs) {
    return static_cast<uint32_t>((static_cast<int64_t>(unixNow(nowMs)) + tzSeconds_) / 86400);
  }
  float hour(uint32_t nowMs) {
    const int64_t local = static_cast<int64_t>(unixNow(nowMs)) + tzSeconds_;
    return static_cast<float>(local % 86400) / 3600.0f;
  }

 private:
  int32_t tzSeconds_;
  uint32_t unix_ = 0, atMs_ = 0;
  bool valid_ = false;
};

}  // namespace apisense

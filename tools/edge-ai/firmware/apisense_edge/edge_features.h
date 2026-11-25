// Apisense edge detector: the same window features and decision rule as
// tools/edge-ai/apisense_audio (features.py and baseline.py), in plain C++ with no
// Arduino or ESP-IDF dependency, so it can be built for the ESP32 or for a PC.
//
// Any change here must keep the numbers equal to the Python ones: tools/edge-ai/
// apisense_audio/parity.py compares them on the board.
//
//   frame   1024 samples (64 ms at 16 kHz), hop 512, Hann window
//   window  mean and std (population) of 12 frame features -> 24 numbers,
//           ordered like FEATURE_NAMES: f0_mean, f0_std, f1_mean, f1_std, ...
#pragma once
#include <math.h>
#include <stddef.h>
#include <stdint.h>

namespace apisense {

constexpr int kSampleRate = 16000;
constexpr int kFrame = 1024;
constexpr int kHop = 512;
constexpr int kBands = 8;
constexpr int kFrameFeatures = kBands + 4;  // bands, rms_db, centroid_hz, dominant_hz, flatness
constexpr int kFeatures = 2 * kFrameFeatures;
constexpr int kHourBuckets = 8;
constexpr float kEps = 1e-12f;
constexpr float kZClip = 8.0f;

constexpr float kBandsHz[kBands][2] = {{20, 100},   {100, 200},   {200, 300},   {300, 450},
                                       {450, 700},  {700, 1500},  {1500, 4000}, {4000, 8000}};

// One frame of 1024 int16 samples -> kFrameFeatures floats. Holds its own tables and work buffers
// (about 14 KB); make one and reuse it.
class FrameAnalyzer {
 public:
  FrameAnalyzer() {
    const float pi = 3.14159265358979323846f;
    for (int n = 0; n < kFrame; n++) hann_[n] = 0.5f - 0.5f * cosf(2.0f * pi * n / (kFrame - 1));
    for (int k = 0; k < kFrame / 2; k++) {
      cos_[k] = cosf(2.0f * pi * k / kFrame);
      sin_[k] = -sinf(2.0f * pi * k / kFrame);
    }
    for (int b = 0; b < kBands; b++) {
      lo_[b] = binOf(kBandsHz[b][0]);
      hi_[b] = binOf(kBandsHz[b][1]);
    }
    hum_lo_ = binOf(50.0f);
    hum_hi_ = static_cast<int>(floorf(1000.0f * kFrame / kSampleRate));  // inclusive, freq <= 1000
  }

  void analyze(const int16_t* pcm, float out[kFrameFeatures]) {
    double sumsq = 0.0;  // rms of the raw (not windowed) signal
    for (int n = 0; n < kFrame; n++) {
      const float x = pcm[n] / 32768.0f;
      sumsq += static_cast<double>(x) * x;
      re_[n] = x * hann_[n];
      im_[n] = 0.0f;
    }
    fft();
    // power[k] = |X[k]|^2 / N for k = 0 .. N/2
    constexpr int bins = kFrame / 2 + 1;
    float total = 0.0f, weighted = 0.0f;
    float bandSum[kBands] = {0};
    float best = -1.0f;
    int bestBin = hum_lo_;
    double logSum = 0.0, powSum = 0.0;
    for (int k = 0; k < bins; k++) {
      const float p = (re_[k] * re_[k] + im_[k] * im_[k]) / kFrame;
      const float f = static_cast<float>(k) * kSampleRate / kFrame;
      total += p;
      weighted += p * f;
      logSum += logf(p + kEps);
      powSum += p;
      for (int b = 0; b < kBands; b++)
        if (k >= lo_[b] && k < hi_[b]) bandSum[b] += p;
      if (k >= hum_lo_ && k <= hum_hi_ && p > best) {
        best = p;
        bestBin = k;
      }
    }
    for (int b = 0; b < kBands; b++) out[b] = 10.0f * log10f(bandSum[b] + kEps);
    out[kBands] = 10.0f * log10f(static_cast<float>(sumsq / kFrame) + kEps);
    out[kBands + 1] = weighted / (total + kEps);
    out[kBands + 2] = static_cast<float>(bestBin) * kSampleRate / kFrame;
    out[kBands + 3] = expf(static_cast<float>(logSum / bins)) / (static_cast<float>(powSum / bins) + kEps);
  }

 private:
  // numpy: freqs >= lo is the first bin whose centre frequency is at or above lo.
  static int binOf(float hz) { return static_cast<int>(ceilf(hz * kFrame / kSampleRate - 1e-4f)); }

  void fft() {  // in-place radix-2 on re_/im_
    for (int i = 1, j = 0; i < kFrame; i++) {
      int bit = kFrame >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        const float tr = re_[i], ti = im_[i];
        re_[i] = re_[j];
        im_[i] = im_[j];
        re_[j] = tr;
        im_[j] = ti;
      }
    }
    for (int len = 2; len <= kFrame; len <<= 1) {
      const int half = len >> 1, step = kFrame / len;
      for (int i = 0; i < kFrame; i += len) {
        for (int k = 0; k < half; k++) {
          const float wr = cos_[k * step], wi = sin_[k * step];
          const int a = i + k, b = a + half;
          const float xr = re_[b] * wr - im_[b] * wi;
          const float xi = re_[b] * wi + im_[b] * wr;
          re_[b] = re_[a] - xr;
          im_[b] = im_[a] - xi;
          re_[a] += xr;
          im_[a] += xi;
        }
      }
    }
  }

  float hann_[kFrame];
  float cos_[kFrame / 2], sin_[kFrame / 2];
  float re_[kFrame], im_[kFrame];
  int lo_[kBands], hi_[kBands], hum_lo_, hum_hi_;
};

// Feeds samples as they arrive and keeps the running mean and spread of every frame feature.
class WindowAccumulator {
 public:
  WindowAccumulator() { reset(); }
  // Needs at least kFrame samples to produce a frame (Python pads a shorter signal with zeros; the node never
  // analyses a window that short, so frames() == 0 means "not enough audio").
  void reset() {
    filled_ = 0;
    pending_ = 0;
    frames_ = 0;
    for (int i = 0; i < kFrameFeatures; i++) mean_[i] = m2_[i] = 0.0;
  }

  void feed(FrameAnalyzer& analyzer, const int16_t* samples, size_t n) {
    for (size_t i = 0; i < n; i++) {
      ring_[filled_ < kFrame ? filled_ : head_] = samples[i];
      if (filled_ < kFrame) {
        filled_++;
        if (filled_ < kFrame) continue;
        head_ = 0;
        emit(analyzer);
        pending_ = 0;
        continue;
      }
      head_ = (head_ + 1) % kFrame;
      if (++pending_ == kHop) {
        pending_ = 0;
        emit(analyzer);
      }
    }
  }

  int frames() const { return frames_; }

  // out[2*i] = mean and out[2*i+1] = std (population) of frame feature i.
  void result(float out[kFeatures]) const {
    for (int i = 0; i < kFrameFeatures; i++) {
      out[2 * i] = static_cast<float>(mean_[i]);
      out[2 * i + 1] = frames_ > 0 ? static_cast<float>(sqrt(m2_[i] / frames_)) : 0.0f;
    }
  }

 private:
  void emit(FrameAnalyzer& analyzer) {
    int16_t frame[kFrame];
    for (int i = 0; i < kFrame; i++) frame[i] = ring_[(head_ + i) % kFrame];
    float f[kFrameFeatures];
    analyzer.analyze(frame, f);
    frames_++;
    for (int i = 0; i < kFrameFeatures; i++) {  // Welford
      const double d = f[i] - mean_[i];
      mean_[i] += d / frames_;
      m2_[i] += d * (f[i] - mean_[i]);
    }
  }

  int16_t ring_[kFrame];
  int head_ = 0, filled_ = 0, pending_ = 0, frames_ = 0;
  double mean_[kFrameFeatures], m2_[kFrameFeatures];
};

// A hive's usual sound: centre and spread per 3-hour slot and feature, and the alarm threshold.
// Generated by baseline.py (HiveBaseline.to_dict) or learned on the node (phase C).
struct Baseline {
  float center[kHourBuckets][kFeatures];
  float scale[kHourBuckets][kFeatures];
  float threshold;
  int need = 3, of = 4;  // alarm if `need` of the last `of` windows exceed the threshold
};

inline int bucketOf(float hour) {
  int h = static_cast<int>(floorf(fmodf(hour, 24.0f)));
  if (h < 0) h += 24;
  return h / (24 / kHourBuckets);
}

// How far a window is from the hive's usual sound in 3-hour slot `k` (0 = typical).
inline float scoreIn(const Baseline& b, const float window[kFeatures], int k) {
  double acc = 0.0;
  for (int i = 0; i < kFeatures; i++) {
    float z = (window[i] - b.center[k][i]) / b.scale[k][i];
    if (z > kZClip) z = kZClip;
    if (z < -kZClip) z = -kZClip;
    acc += static_cast<double>(z) * z;
  }
  return static_cast<float>(sqrt(acc / kFeatures));
}

// The same at a given hour of the day.
inline float score(const Baseline& b, const float window[kFeatures], float hour) {
  return scoreIn(b, window, bucketOf(hour));
}

// The node's one-number verdict: 0 usual, 1 different.
class Detector {
 public:
  // Keeps a reference: the Baseline must outlive the Detector.
  explicit Detector(const Baseline& b) : b_(b) {}
  void reset() { count_ = 0; }  // forget recent windows (call when time was not recorded in between)
  // How many of the last `of` windows exceeded the threshold (0 = all recent windows were usual).
  int recentOver() const {
    int n = count_ < b_.of ? count_ : b_.of;
    if (n > kMaxOf) n = kMaxOf;
    int over = 0;
    for (int i = 0; i < n; i++) over += history_[(head_ - 1 - i + kMaxOf) % kMaxOf];
    return over;
  }
  int update(const float window[kFeatures], float hour, float* scoreOut = nullptr) {
    const float s = score(b_, window, hour);
    if (scoreOut) *scoreOut = s;
    history_[head_] = s > b_.threshold;
    head_ = (head_ + 1) % kMaxOf;
    if (count_ < kMaxOf) count_++;
    int over = 0;
    int n = count_ < b_.of ? count_ : b_.of;
    if (n > kMaxOf) n = kMaxOf;  // `of` above 8 is not supported
    for (int i = 0; i < n; i++) over += history_[(head_ - 1 - i + kMaxOf) % kMaxOf];
    return over >= b_.need ? 1 : 0;
  }

 private:
  static constexpr int kMaxOf = 8;
  const Baseline& b_;
  bool history_[kMaxOf] = {false};
  int head_ = 0, count_ = 0;
};

}  // namespace apisense

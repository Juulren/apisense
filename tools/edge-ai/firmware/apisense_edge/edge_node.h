// The node's brain: learning period, then the 0/1 verdict, with the slow-drift rule and the
// no-clock case. Portable C++ (no Arduino); what has to survive a power cut is exposed through
// takeDirty(), meta and the pack/unpack functions of edge_learn.h, and edge_storage.h writes it.
//
//   no clock    -> nothing is learned or judged until a time was set (status kNoClock)
//   learning    -> every window is stored; ends after `learnDays` days that each had at least
//                  kMinDayWindows windows (a power cut does not count as a day) and enough windows
//   ready       -> each window gets a score and the detector's 0/1; usual windows slowly refresh the
//                  baseline (see edge_learn.h for the cap), different ones never do
#pragma once
#include <stdlib.h>

#include "edge_learn.h"

namespace apisense {

enum Status : uint8_t { kNoClock = 0, kLearning = 1, kReady = 2 };

constexpr int kMinDayWindows = 12;  // windows a day needs to count as a learning day

struct Meta {
  uint8_t phase = kLearning;
  uint8_t pad[3] = {0, 0, 0};
  uint32_t daysSeen = 0;
  uint32_t lastDay = 0;         // local day of the latest window
  uint32_t lastCountedDay = 0;  // latest day already counted: a reboot or a clock set back cannot count one twice
};
constexpr size_t kMetaBlobSize = 8 + sizeof(Meta);  // magic, crc32, meta

struct NodeResult {
  Status status;
  int alarm;       // 0 usual, 1 different (only meaningful when status == kReady)
  float score;     // distance from the usual sound (kReady only)
  bool learned;    // this window went into the baseline
  bool changed;    // meta or baseline changed: the storage layer should write them
};

class EdgeNode {
 public:
  explicit EdgeNode(int learnDays = 7, float tzHours = -6.0f) : learnDays_(learnDays), clock_(tzHours) {}
  EdgeNode(const EdgeNode&) = delete;
  EdgeNode& operator=(const EdgeNode&) = delete;

  void setTime(uint32_t unixSeconds, uint32_t nowMs) {
    // A small correction (a periodic time sync) must not drop an alarm in progress; a real jump does.
    const bool jump = !clock_.valid() || labs(static_cast<long>(clock_.unixNow(nowMs)) - static_cast<long>(unixSeconds)) > 120;
    clock_.set(unixSeconds, nowMs);
    if (jump) detector_.reset();
  }
  bool hasClock() const { return clock_.valid(); }

  // The reset command: forget everything and start a new learning period.
  void resetLearning() {
    learner_.reset();
    meta_ = Meta();
    dayWindows_ = 0;
    detector_.reset();
  }

  NodeResult onWindow(const float window[kFeatures], uint32_t nowMs) {
    NodeResult r = {kNoClock, 0, 0.0f, false, false};
    if (!clock_.valid()) return r;
    const float hour = clock_.hour(nowMs);
    if (meta_.phase == kLearning) {
      r.status = kLearning;
      const uint32_t day = clock_.localDay(nowMs);
      if (day != meta_.lastDay) {
        meta_.lastDay = day;
        dayWindows_ = 0;
        r.changed = true;
      }
      learner_.add(window, hour);
      r.learned = true;
      if (++dayWindows_ >= kMinDayWindows && (meta_.daysSeen == 0 || day > meta_.lastCountedDay)) {
        meta_.daysSeen++;
        meta_.lastCountedDay = day;
        r.changed = true;
      }
      if (static_cast<int>(meta_.daysSeen) >= learnDays_ && learner_.fit(base_, true)) {
        meta_.phase = kReady;
        detector_.reset();
        r.changed = true;
      }
      return r;
    }
    r.status = kReady;
    r.alarm = detector_.update(window, hour, &r.score);
    r.learned = learner_.observe(base_, window, hour, r.score, detector_.recentOver() > 0);
    return r;
  }

  Status status() const { return !clock_.valid() ? kNoClock : static_cast<Status>(meta_.phase); }
  Meta& meta() { return meta_; }
  Baseline& baseline() { return base_; }
  BaselineLearner& learner() { return learner_; }
  int daysSeen() const { return static_cast<int>(meta_.daysSeen); }

  // Called by the storage layer after loading from flash. The reference baseline (the one learned at
  // the end of the learning period, with the threshold) is what flash keeps; the working baseline is
  // rebuilt from it and from the stored windows, with the same drift cap as before the power cut.
  void restored(bool haveMeta, bool haveReference) {
    if (!haveMeta) meta_ = Meta();
    if (meta_.phase != kReady && meta_.phase != kLearning) meta_ = Meta();
    if (meta_.phase == kReady) {
      if (haveReference) {
        base_ = learner_.reference();
        learner_.fit(base_, false);  // false = keep the threshold; too few windows: the reference stands
      } else if (!learner_.fit(base_, true)) {
        meta_.phase = kLearning;  // nothing usable survived: learn again
      }
    }
    detector_.reset();
  }

 private:
  int learnDays_;
  NodeClock clock_;
  Meta meta_;
  int dayWindows_ = 0;
  BaselineLearner learner_;
  Baseline base_;
  Detector detector_{base_};  // after base_: it keeps a reference
};

inline void packMeta(const Meta& m, uint8_t* out) {
  const uint32_t magic = 0x314D5041;  // "APM1"
  memcpy(out, &magic, 4);
  memcpy(out + 8, &m, sizeof(Meta));
  const uint32_t c = crc32(out + 8, sizeof(Meta));
  memcpy(out + 4, &c, 4);
}
inline bool unpackMeta(const uint8_t* in, size_t size, Meta& m) {
  if (size != kMetaBlobSize) return false;
  uint32_t magic, c;
  memcpy(&magic, in, 4);
  memcpy(&c, in + 4, 4);
  if (magic != 0x314D5041 || c != crc32(in + 8, sizeof(Meta))) return false;
  Meta t;
  memcpy(&t, in + 8, sizeof(Meta));
  if (t.phase != kLearning && t.phase != kReady) return false;
  m = t;
  return true;
}

}  // namespace apisense

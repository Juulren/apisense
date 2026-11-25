// Keeps what the node learned across power cuts (Arduino-ESP32 only).
//   Preferences (NVS)   "apisense": meta (phase, learning days) and the reference baseline (1.5 KB)
//   LittleFS            /slot0.bin .. /slot7.bin: the learning windows, one 6 KB file per 3-hour
//                       slot, rewritten when that slot changed (8 per day at most)
// Every record has a magic/length and a CRC-32; a damaged one is ignored and the node falls back
// (rebuild from the windows, or learn again) instead of trusting it. A power cut in the middle of
// a slot's write loses only that slot's file (its CRC fails), never the others.
#pragma once
#include <LittleFS.h>
#include <Preferences.h>

#include "edge_node.h"

namespace apisense {

class EdgeStorage {
 public:
  bool begin() {
    ok_ = LittleFS.begin(true) && prefs_.begin("apisense", false);
    return ok_;
  }

  // Load everything that survived into the node. Returns false when it found a half-done wipe
  // (power cut during the reset command) and finished it: the node then starts from scratch.
  bool load(EdgeNode& node) {
    bool haveMeta = false, haveRef = false;
    if (ok_ && prefs_.getUChar("wipe", 0)) {
      wipe();
      node.learner().takeDirty();
      node.restored(false, false);
      return false;
    }
    if (ok_) {
      if (prefs_.getBytesLength("meta") == kMetaBlobSize) {
        prefs_.getBytes("meta", blob_, kMetaBlobSize);
        haveMeta = unpackMeta(blob_, kMetaBlobSize, node.meta());
      }
      if (prefs_.getBytesLength("ref") == kBaselineBlobSize) {
        prefs_.getBytes("ref", blob_, kBaselineBlobSize);
        Baseline ref;
        if (unpackBaseline(blob_, kBaselineBlobSize, ref)) {
          node.learner().setReference(ref);
          haveRef = true;
        }
      }
      for (int b = 0; b < kHourBuckets; b++) {
        File f = LittleFS.open(slotFile(b), "r");
        if (!f) continue;
        if (f.read(slot_, kBucketBlobSize) == static_cast<int>(kBucketBlobSize))
          node.learner().unpackBucket(b, slot_, kBucketBlobSize);
        f.close();
      }
    }
    node.learner().takeDirty();  // what was just loaded is already on flash
    node.restored(haveMeta, haveRef);
    return true;
  }

  // Write what changed. Call it with metaAndReference when the node says `changed`, and now and then
  // (every 12 windows is enough) for the learning windows.
  void save(EdgeNode& node, bool metaAndReference) {
    if (!ok_) return;
    if (metaAndReference) {
      packMeta(node.meta(), blob_);
      prefs_.putBytes("meta", blob_, kMetaBlobSize);
      if (node.meta().phase == kReady && node.learner().hasReference()) {
        packBaseline(node.learner().reference(), blob_);
        prefs_.putBytes("ref", blob_, kBaselineBlobSize);
      }
    }
    const uint8_t dirty = node.learner().takeDirty();
    for (int b = 0; b < kHourBuckets; b++) {
      if (!(dirty & (1u << b))) continue;
      node.learner().packBucket(b, slot_);
      File f = LittleFS.open(slotFile(b), "w");
      if (!f) continue;
      f.write(slot_, kBucketBlobSize);
      f.close();
    }
  }

  // The reset command: erase everything learned. The marker makes it safe against a power cut:
  // if it is still there at boot, the wipe is finished first.
  void wipe() {
    if (!ok_) return;
    prefs_.putUChar("wipe", 1);
    for (int b = 0; b < kHourBuckets; b++) LittleFS.remove(slotFile(b));
    prefs_.clear();  // also removes the marker
  }

 private:
  static const char* slotFile(int b) {
    static const char* names[kHourBuckets] = {"/slot0.bin", "/slot1.bin", "/slot2.bin", "/slot3.bin",
                                              "/slot4.bin", "/slot5.bin", "/slot6.bin", "/slot7.bin"};
    return names[b];
  }
  bool ok_ = false;
  Preferences prefs_;
  uint8_t slot_[kBucketBlobSize];
  uint8_t blob_[kBaselineBlobSize > kMetaBlobSize ? kBaselineBlobSize : kMetaBlobSize];  // not on the 8 KB task stack
};

}  // namespace apisense

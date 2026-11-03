import { expect, it } from "vitest";
import type { AudioSample } from "../db/types";
import { hiveReadings, selectedReading } from "./selectors";

const sample = (
  id: string,
  hive: string,
  time: string,
  deleted_at: string | null = null,
): AudioSample => ({
  id,
  hive_id: hive,
  recorded_at: time,
  device_id: "mic",
  duration_seconds: 5,
  dominant_freq_hz: 250,
  amplitude_db: -20,
  mfcc_features_json: "[]",
  local_audio_uri: null,
  audio_file_url: null,
  acoustic_classification: "unknown",
  confidence_score: 0,
  source: "ble",
  classifier_version: "rules:test",
  updated_at: time,
  synced_at: null,
  deleted_at,
  local_revision: 1,
});
it("shows only a hive's undeleted readings, newest first, without mutating state", () => {
  const readings = [
    sample("old", "A", "2026-10-01"),
    sample("other", "B", "2026-11-03"),
    sample("new", "A", "2026-11-01"),
    sample("deleted", "A", "2026-11-02", "2026-11-02"),
  ];
  expect(hiveReadings(readings, "A").map((s) => s.id)).toEqual(["new", "old"]);
  expect(readings[0]?.id).toBe("old");
});
it("opens the requested historical sample and never substitutes another hive or latest reading", () => {
  const readings = [
    sample("old", "A", "2026-10-01"),
    sample("other", "B", "2026-11-03"),
    sample("new", "A", "2026-11-01"),
  ];
  expect(selectedReading(readings, "A", "old")?.id).toBe("old");
  expect(selectedReading(readings, "A")?.id).toBe("new");
  expect(selectedReading(readings, "A", "other")).toBeUndefined();
  expect(selectedReading(readings, "A", "missing")).toBeUndefined();
});

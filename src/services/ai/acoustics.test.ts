import { describe, expect, it } from "vitest";
import { preprocess, powerSpectrum } from "./acoustics";
import { AcousticClassifier } from "./Classifier";
import {
  modelResult,
  normalizeMfcc,
  type ModelManifest,
} from "./ModelContract";
import {
  summarize,
  summaryWindow,
  uuidFromDigest,
} from "../../../supabase/functions/_shared/summary";
import type { TelemetryFrame } from "../iot/protocol";
const frame: TelemetryFrame = {
  version: 1,
  id: "unused",
  hive_id: "unused",
  device_id: "unused",
  recorded_at: "2026-10-20T12:00:00Z",
  duration_seconds: 1,
  sampling_rate_hz: 16000,
  dominant_freq_hz: 250,
  amplitude_db: -20,
  mfcc_features: new Array(13).fill(0),
  battery_level: 90,
};
const manifest: ModelManifest = {
  version: "test",
  inputName: "input",
  outputName: "output",
  mean: new Array(13).fill(1),
  std: new Array(13).fill(2),
  minimumScore: 0.8,
  sha256: "a".repeat(64),
};
const s = (
  classification = "healthy",
  score = 0.5,
  model = "experimental-rules-v1",
  source = "ble",
  frequency = 250,
) => ({
  acoustic_classification: classification,
  confidence_score: score,
  classifier_version: model,
  source,
  dominant_freq_hz: frequency,
  recorded_at: frame.recorded_at,
});
describe("Acoustics and summaries", () => {
  it("recovers a known sinusoid and returns finite thirteen-dimensional MFCC", () => {
    const pcm = Float32Array.from(
      { length: 16000 },
      (_, i) => 0.2 * Math.sin((2 * Math.PI * 250 * i) / 16000),
    );
    const result = preprocess(pcm, 16000);
    expect(Math.abs(result.dominantHz - 250)).toBeLessThanOrEqual(16000 / 2048);
    expect(result.amplitudeDb).toBeCloseTo(-16.99, 1);
    expect(result.mfcc).toHaveLength(13);
    expect(result.mfcc.every(Number.isFinite)).toBe(true);
    expect(result.flatness).toBeLessThan(0.01);
  });
  it("handles silence without NaN and rejects unsupported input", () => {
    const result = preprocess(new Float32Array(300), 16000);
    expect(result.mfcc.every(Number.isFinite)).toBe(true);
    expect(result.amplitudeDb).toBe(-160);
    expect(() => powerSpectrum(new Float32Array(30))).toThrow();
    expect(() => preprocess(new Float32Array([NaN]), 16000)).toThrow();
  });
  it("abstains when requested swarm and queenless frequency ranges overlap", async () => {
    const classifier = new AcousticClassifier();
    for (const hz of [400, 450, 500, 550])
      expect(
        (await classifier.classify({ ...frame, dominant_freq_hz: hz }))
          .classification,
      ).toBe("unknown");
    expect((await classifier.classify(frame)).confidence).toBeLessThan(0.8);
  });
  it("validates model normalization, abstention and probability tensors", () => {
    expect(normalizeMfcc(new Array(13).fill(3), manifest)[0]).toBe(1);
    expect(() => normalizeMfcc([1], manifest)).toThrow();
    expect(
      modelResult([0.1, 0.1, 0.1, 0.1, 0.6], manifest).classification,
    ).toBe("unknown");
    expect(
      modelResult([0.01, 0.01, 0.95, 0.01, 0.02], manifest).classification,
    ).toBe("queenless");
    expect(() => modelResult([9, 0, 0, 0, 0], manifest)).toThrow();
  });
  it("never declares a critical diagnosis from experimental rules or simulated data", () => {
    expect(
      summarize([
        s("queenless", 0.99),
        s("pest_disturbance", 0.99),
        s("queenless", 0.99),
      ]).overall_status,
    ).toBe("warning");
    const simulated = summarize([
      s("queenless", 0.99, "onnx:test", "simulator"),
      s("queenless", 0.99, "onnx:test", "simulator"),
      s("queenless", 0.99, "onnx:test", "simulator"),
    ]);
    expect(simulated.overall_status).toBe("warning");
    expect(simulated.summary_text).toContain("SIMULACIÓN");
  });
  it("requires repeated model evidence and keeps Spanish practical recommendations", () => {
    const result = summarize([
      s("queenless", 0.95, "onnx:test"),
      s("queenless", 0.95, "onnx:test"),
      s("queenless", 0.95, "onnx:test"),
    ]);
    expect(result.overall_status).toBe("critical");
    expect(result.recommended_action).toContain("inspección");
    expect(result.summary_text).toContain("no confirma");
    expect(() => summarize([])).toThrow();
  });
  it("derives stable periods from latest evidence and validates UUID digests", () => {
    const window = summaryWindow([s()], 15);
    expect(window).toEqual({
      period_start: "2026-10-20T11:45:00.001Z",
      period_end: "2026-10-20T12:00:00.001Z",
    });
    expect(uuidFromDigest("a".repeat(64))).toMatch(/^[a-f0-9-]{36}$/);
    expect(() => uuidFromDigest("x")).toThrow();
  });
});

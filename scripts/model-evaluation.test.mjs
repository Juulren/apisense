import { afterAll, beforeAll, expect, it } from "vitest";
import { mkdtemp, writeFile, readFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  prepareDataset,
  splitGroups,
  evaluatePredictions,
  classificationMetrics,
  sha256,
} from "./model-evaluation.mjs";
import { encodeWav, decodeWav } from "../src/services/iot/wav.ts";
import { preprocess } from "../src/services/ai/acoustics.ts";

let folder, config, prepared;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), "apisense-model-"));
  config = {
    schemaVersion: 1,
    name: "synthetic-test-only",
    license: "CC0 synthetic fixture",
    provenance: "Generated tones, no bee recording",
    synthetic: true,
    sampleRateHz: 16000,
    seed: "fixed-seed",
    groupBy: "apiary",
    clips: [],
  };
  for (let i = 0; i < 9; i++) {
    const pcm = Float32Array.from(
      { length: 4096 },
      (_, t) => 0.2 * Math.sin((2 * Math.PI * (200 + i * 35) * t) / 16000),
    );
    const bytes = encodeWav(pcm, 16000),
      wav = `clip-${i}.wav`;
    await writeFile(path.join(folder, wav), bytes);
    config.clips.push({
      id: `clip-${i}`,
      recordingId: `session-${Math.floor(i / 3)}`,
      apiaryId: `apiary-${Math.floor(i / 3)}`,
      hiveId: `hive-${Math.floor(i / 3)}`,
      deviceId: i % 2 ? "mic-A" : "mic-B",
      recordedAt: "2026-11-03T10:00:00Z",
      label: ["healthy", "swarming", "unknown"][i % 3],
      verifiedBy: "synthetic fixture generator",
      annotationMethod: "Assigned for tooling only",
      wav,
      sha256: sha256(bytes),
    });
  }
  prepared = await prepareDataset(config, folder);
});
afterAll(async () => {
  if (!folder) return;
  const resolved = await realpath(folder),
    parent = await realpath(tmpdir());
  if (
    path.dirname(resolved) !== parent ||
    !path.basename(resolved).startsWith("apisense-model-")
  )
    throw new Error("Unexpected temporary directory");
  await rm(resolved, { recursive: true });
});
const clone = (v) => structuredClone(v);
const manifest = () => ({
  contractVersion: 1,
  preprocessing: "apisense-mfcc-v1",
  sampleRateHz: 16000,
  classes: prepared.classes,
  version: "synthetic-test-only",
  inputName: "mfcc",
  outputName: "probabilities",
  mean: prepared.normalization.mean,
  std: prepared.normalization.std,
  minimumScore: 0.5,
  sha256: "a".repeat(64),
});
const predictions = () =>
  prepared.clips
    .filter((c) => c.split === "test")
    .map((c) => ({
      id: c.id,
      modelSha256: "a".repeat(64),
      probabilities:
        c.label === "healthy"
          ? [0.8, 0.05, 0.05, 0.05, 0.05]
          : c.label === "swarming"
            ? [0.05, 0.8, 0.05, 0.05, 0.05]
            : [0.05, 0.05, 0.05, 0.05, 0.8],
    }));

it("splits complete groups reproducibly, independent of input order, and rejects fewer than three", () => {
  expect([...splitGroups(["A", "B", "C", "A"], "seed")]).toEqual([
    ...splitGroups(["C", "A", "B"], "seed"),
  ]);
  expect(() => splitGroups(["A", "A", "B"], "seed")).toThrow("tres grupos");
  for (const group of new Set(prepared.clips.map((c) => c.group)))
    expect(
      new Set(
        prepared.clips.filter((c) => c.group === group).map((c) => c.split),
      ).size,
    ).toBe(1);
});
it("extracts the exact app MFCC and fits mean/std on training clips only", async () => {
  const wav = decodeWav(await readFile(path.join(folder, "clip-0.wav")));
  expect(prepared.clips.find((c) => c.id === "clip-0").mfcc).toEqual(
    preprocess(wav.pcm, wav.sampleRate).mfcc,
  );
  const train = prepared.clips.filter((c) => c.split === "train");
  expect(prepared.normalization.mean[0]).toBeCloseTo(
    train.reduce((s, c) => s + c.mfcc[0], 0) / train.length,
    12,
  );
  const changed = clone(config),
    testId = prepared.clips.find((c) => c.split === "test").id;
  const held = changed.clips.find((c) => c.id === testId),
    filename = path.join(folder, held.wav),
    original = await readFile(filename);
  const replacement = encodeWav(
    Float32Array.from(
      { length: 4096 },
      (_, i) => 0.8 * Math.sin((i * 2 * Math.PI * 3000) / 16000),
    ),
    16000,
  );
  held.sha256 = sha256(replacement);
  try {
    await writeFile(filename, replacement);
    const changedPrepared = await prepareDataset(changed, folder);
    expect(changedPrepared.clips.find((c) => c.id === testId).mfcc).not.toEqual(
      prepared.clips.find((c) => c.id === testId).mfcc,
    );
    expect(changedPrepared.normalization).toEqual(prepared.normalization);
  } finally {
    await writeFile(filename, original);
  }
  expect(prepared.warnings.some((w) => w.includes("SINTETICO"))).toBe(true);
});
it.each([
  [
    "duplicate ID",
    (c) => {
      c.clips[1].id = c.clips[0].id;
    },
    "duplicado",
  ],
  [
    "wrong hash",
    (c) => {
      c.clips[0].sha256 = "0".repeat(64);
    },
    "Hash",
  ],
  [
    "copied WAV",
    (c) => {
      c.clips[1].wav = c.clips[0].wav;
      c.clips[1].sha256 = c.clips[0].sha256;
    },
    "WAV duplicado",
  ],
  [
    "recording leakage",
    (c) => {
      c.clips[3].recordingId = c.clips[0].recordingId;
    },
    "fuga",
  ],
  [
    "hive relocation",
    (c) => {
      c.clips[3].hiveId = c.clips[0].hiveId;
    },
    "dos apiarios",
  ],
  [
    "unverified labels",
    (c) => {
      c.clips[0].verifiedBy = "";
    },
    "verifiedBy",
  ],
  [
    "unknown label",
    (c) => {
      c.clips[0].label = "queen-present";
    },
    "Etiqueta",
  ],
  [
    "different sample rate",
    (c) => {
      c.sampleRateHz = 8000;
    },
    "Tasa/duración",
  ],
  [
    "date without zone",
    (c) => {
      c.clips[0].recordedAt = "2026-11-03";
    },
    "Fecha",
  ],
  [
    "invalid civil date",
    (c) => {
      c.clips[0].recordedAt = "2026-02-30T12:00:00Z";
    },
    "Fecha",
  ],
  [
    "absolute WAV",
    (c) => {
      c.clips[0].wav = path.join(folder, "clip-0.wav");
    },
    "relativo",
  ],
])(
  "rejects %s before producing a training dataset",
  async (_, change, error) => {
    const c = clone(config);
    change(c);
    await expect(prepareDataset(c, folder)).rejects.toThrow(error);
  },
);
it("reports a known confusion matrix, undefined missing-class metrics, abstention and raw-output calibration", () => {
  const rows = [
    {
      label: "healthy",
      prediction: "healthy",
      probabilities: [0.8, 0.1, 0.05, 0.03, 0.02],
    },
    {
      label: "swarming",
      prediction: "healthy",
      probabilities: [0.6, 0.25, 0.05, 0.05, 0.05],
    },
    {
      label: "queenless",
      prediction: "unknown",
      probabilities: [0.3, 0.2, 0.4, 0.05, 0.05],
    },
    {
      label: "unknown",
      prediction: "unknown",
      probabilities: [0.02, 0.02, 0.03, 0.03, 0.9],
    },
  ];
  const m = classificationMetrics(rows);
  expect(m.confusionMatrix).toEqual([
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1],
  ]);
  expect(m.accuracy).toBe(0.5);
  expect(m.coverage).toBe(0.5);
  expect(m.selectiveAccuracy).toBe(0.5);
  expect(m.perClass[3]).toMatchObject({ support: 0, recall: null, f1: null });
  expect(m.macroF1Supported).toBeCloseTo(1 / 3);
  expect(m.logLoss).toBeCloseTo(-Math.log(0.8 * 0.25 * 0.4 * 0.9) / 4);
  expect(m.topLabelEce10).toBeCloseTo(0.375);
});
it("uses the shared threshold, accounts for every held-out clip and groups metrics by device", () => {
  const result = evaluatePredictions(prepared, predictions(), manifest());
  expect(result.status).toBe("synthetic-tooling-check-only");
  expect(result.metrics.count).toBe(3);
  expect(result.metrics.accuracy).toBe(1);
  expect(Object.values(result.perDevice).reduce((s, m) => s + m.count, 0)).toBe(
    3,
  );
  const p = predictions();
  p[0].probabilities = [0.3, 0.2, 0.2, 0.2, 0.1];
  expect(
    evaluatePredictions(prepared, p, manifest()).metrics.unknownRate,
  ).toBeGreaterThan(0);
});
it("reports no selective accuracy when every prediction is unknown", () => {
  const m = manifest();
  m.minimumScore = 0.99;
  const report = evaluatePredictions(prepared, predictions(), m);
  expect(report.metrics.coverage).toBe(0);
  expect(report.metrics.selectiveAccuracy).toBeNull();
  expect(report.metrics.unknownRate).toBe(1);
});
it("rejects normalization fitted on all data even when copied into the model manifest", () => {
  const data = clone(prepared),
    m = manifest();
  data.normalization.mean = data.normalization.mean.map((v) => v + 1);
  m.mean = data.normalization.mean;
  expect(() => evaluatePredictions(data, predictions(), m)).toThrow("train");
});
it.each([
  "missing",
  "duplicate",
  "extra",
  "model",
  "probabilities",
  "normalization",
  "split",
  "classes",
])("rejects incompatible evaluation input: %s", (kind) => {
  const data = clone(prepared),
    p = predictions(),
    m = manifest();
  if (kind === "missing") p.pop();
  if (kind === "duplicate") p.push(p[0]);
  if (kind === "extra") p.push({ ...p[0], id: "not-in-test" });
  if (kind === "model") p[0].modelSha256 = "b".repeat(64);
  if (kind === "probabilities") p[0].probabilities = [1, 1, 1, 1, 1];
  if (kind === "normalization") m.mean = m.mean.map((v) => v + 1);
  if (kind === "split")
    data.clips[0].split = data.clips[0].split === "test" ? "train" : "test";
  if (kind === "classes") data.classes = [...data.classes].reverse();
  expect(() => evaluatePredictions(data, p, m)).toThrow();
});
it("runs both CLI commands end to end and refuses to overwrite a report", async () => {
  const input = path.join(folder, "dataset.json"),
    output = path.join(folder, "prepared.json");
  await writeFile(input, JSON.stringify(config));
  const cli = path.resolve("scripts/model-evaluation-cli.mjs");
  execFileSync(process.execPath, [cli, "prepare", input, output], {
    timeout: 10000,
  });
  const saved = JSON.parse(await readFile(output, "utf8"));
  expect(saved.normalization).toEqual(prepared.normalization);
  await writeFile(
    path.join(folder, "predictions.ndjson"),
    predictions()
      .map((p) => JSON.stringify(p))
      .join("\n"),
  );
  await writeFile(path.join(folder, "model.json"), JSON.stringify(manifest()));
  const args = [
    cli,
    "evaluate",
    output,
    path.join(folder, "predictions.ndjson"),
    path.join(folder, "model.json"),
    path.join(folder, "report.json"),
  ];
  execFileSync(process.execPath, args, { timeout: 10000 });
  const report = JSON.parse(
    await readFile(path.join(folder, "report.json"), "utf8"),
  );
  expect(report.inputs.preparedSha256).toHaveLength(64);
  expect(report.metrics.accuracy).toBe(1);
  const before = await readFile(path.join(folder, "report.json"));
  const blocked = spawnSync(process.execPath, args, { timeout: 10000 });
  expect(blocked.status).toBe(1);
  expect(blocked.stderr.toString()).toContain("EEXIST");
  expect(await readFile(path.join(folder, "report.json"))).toEqual(before);
}, 30000);

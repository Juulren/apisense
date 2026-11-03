import { readFile, realpath, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { preprocess } from "../src/services/ai/acoustics.ts";
import { decodeWav } from "../src/services/iot/wav.ts";
import {
  modelClasses,
  MFCC_CONTRACT,
  modelResult,
  validateManifest,
} from "../src/services/ai/ModelContract.ts";

export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const fail = (message) => {
  throw new Error(message);
};
const text = (v, name) =>
  typeof v === "string" && v.trim() && v.length <= 1000
    ? v.trim()
    : fail(`Falta ${name}`);
const countClasses = (clips) =>
  Object.fromEntries(
    modelClasses.map((c) => [c, clips.filter((r) => r.label === c).length]),
  );

// Split whole groups, never individual windows/clips. Sorting hashes is deterministic.
export function splitGroups(groups, seed) {
  const unique = [...new Set(groups)].sort((a, b) => {
    const x = sha256(`${seed}:${a}`),
      y = sha256(`${seed}:${b}`);
    return x < y ? -1 : x > y ? 1 : a < b ? -1 : 1;
  });
  if (unique.length < 3)
    fail("Se requieren al menos tres grupos independientes");
  const held = Math.max(1, Math.floor(unique.length * 0.2));
  return new Map(
    unique.map((g, i) => [
      g,
      i < held ? "test" : i < held * 2 ? "validation" : "train",
    ]),
  );
}

export async function prepareDataset(config, baseDir) {
  if (
    config.schemaVersion !== 1 ||
    typeof config.synthetic !== "boolean" ||
    !["apiary", "hive"].includes(config.groupBy)
  )
    fail("Contrato de dataset incompatible");
  for (const key of ["name", "license", "provenance", "seed"])
    text(config[key], key);
  if (
    !Number.isInteger(config.sampleRateHz) ||
    config.sampleRateHz < 1000 ||
    config.sampleRateHz > 96000
  )
    fail("Tasa de muestreo inválida");
  if (
    !Array.isArray(config.clips) ||
    !config.clips.length ||
    config.clips.length > 100000
  )
    fail("Lista de clips vacía o demasiado grande");
  const root = await realpath(baseDir),
    ids = new Set(),
    hashes = new Set(),
    recordings = new Map(),
    hives = new Map();
  const clips = [];
  for (const input of config.clips) {
    const row = {};
    for (const key of [
      "id",
      "recordingId",
      "apiaryId",
      "hiveId",
      "deviceId",
      "verifiedBy",
      "annotationMethod",
      "recordedAt",
    ])
      row[key] = text(input[key], key);
    if (!modelClasses.includes(input.label))
      fail(`Etiqueta inválida: ${row.id}`);
    if (
      !/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(row.recordedAt) ||
      !Number.isFinite(Date.parse(row.recordedAt)) ||
      new Date(`${row.recordedAt.slice(0, 10)}T12:00:00Z`)
        .toISOString()
        .slice(0, 10) !== row.recordedAt.slice(0, 10)
    )
      fail(`Fecha sin zona o inválida: ${row.id}`);
    if (ids.has(row.id)) fail("ID de clip duplicado");
    ids.add(row.id);
    if (hives.has(row.hiveId) && hives.get(row.hiveId) !== row.apiaryId)
      fail("Una colmena no puede pertenecer a dos apiarios");
    hives.set(row.hiveId, row.apiaryId);
    const group = config.groupBy === "apiary" ? row.apiaryId : row.hiveId;
    if (
      recordings.has(row.recordingId) &&
      recordings.get(row.recordingId) !== group
    )
      fail("Una grabación comparte grupos: posible fuga");
    recordings.set(row.recordingId, group);
    const filename = text(input.wav, "wav");
    if (path.isAbsolute(filename)) fail("El WAV debe ser relativo al dataset");
    const resolved = await realpath(path.resolve(root, filename));
    const relative = path.relative(root, resolved);
    if (
      relative === ".." ||
      relative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relative)
    )
      fail("WAV fuera del directorio del dataset");
    if ((await stat(resolved)).size > 1048576) fail("WAV demasiado grande");
    const bytes = await readFile(resolved),
      hash = sha256(bytes);
    if (
      !/^[a-f0-9]{64}$/i.test(input.sha256 ?? "") ||
      hash !== input.sha256.toLowerCase()
    )
      fail(`Hash WAV no coincide: ${row.id}`);
    if (hashes.has(hash))
      fail("WAV duplicado: no contar copias como evidencia independiente");
    hashes.add(hash);
    const { pcm, sampleRate } = decodeWav(bytes);
    if (
      sampleRate !== config.sampleRateHz ||
      pcm.length / sampleRate < 0.01 ||
      pcm.length / sampleRate > 30
    )
      fail("Tasa/duración incompatible con la app");
    const mfcc = preprocess(pcm, sampleRate).mfcc;
    if (!mfcc.every(Number.isFinite)) fail("Características no finitas");
    clips.push({
      ...row,
      label: input.label,
      group,
      wavSha256: hash,
      durationSeconds: pcm.length / sampleRate,
      mfcc,
    });
  }
  const split = splitGroups(
    clips.map((c) => c.group),
    config.seed,
  );
  clips.forEach((c) => {
    c.split = split.get(c.group);
  });
  clips.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const train = clips.filter((c) => c.split === "train");
  const mean = Array.from(
    { length: 13 },
    (_, i) => train.reduce((s, c) => s + c.mfcc[i], 0) / train.length,
  );
  const constant = [];
  const std = mean.map((m, i) => {
    const value = Math.sqrt(
      train.reduce((s, c) => s + (c.mfcc[i] - m) ** 2, 0) / train.length,
    );
    if (value < 1e-12) {
      constant.push(i);
      return 1;
    }
    return value;
  });
  const coverage = Object.fromEntries(
    ["train", "validation", "test"].map((s) => [
      s,
      countClasses(clips.filter((c) => c.split === s)),
    ]),
  );
  const warnings = [];
  if (config.synthetic)
    warnings.push(
      "SINTETICO: comprueba herramientas; no es evidencia biológica ni de precisión",
    );
  if (config.groupBy === "hive")
    warnings.push(
      "Grupos por colmena: no acredita generalización a apiarios independientes",
    );
  if (constant.length)
    warnings.push(`MFCC constantes en train (std=1): ${constant.join(",")}`);
  for (const s of Object.keys(coverage))
    for (const c of modelClasses)
      if (!coverage[s][c]) warnings.push(`Sin clase ${c} en ${s}`);
  return {
    schemaVersion: 1,
    name: config.name,
    license: config.license,
    provenance: config.provenance,
    synthetic: config.synthetic,
    preprocessing: MFCC_CONTRACT,
    sampleRateHz: config.sampleRateHz,
    classes: modelClasses,
    seed: config.seed,
    groupBy: config.groupBy,
    normalization: { fittedOn: "train", mean, std },
    coverage,
    warnings,
    clips,
  };
}

export function classificationMetrics(rows) {
  if (!rows.length) fail("No hay predicciones para evaluar");
  const matrix = modelClasses.map(() => modelClasses.map(() => 0));
  let accepted = 0,
    acceptedCorrect = 0,
    logLoss = 0,
    brier = 0;
  const bins = Array.from({ length: 10 }, () => ({
    count: 0,
    confidence: 0,
    correct: 0,
  }));
  for (const r of rows) {
    const actual = modelClasses.indexOf(r.label),
      predicted = modelClasses.indexOf(r.prediction);
    if (actual < 0 || predicted < 0) fail("Clase desconocida");
    matrix[actual][predicted]++;
    if (r.prediction !== "unknown") {
      accepted++;
      if (actual === predicted) acceptedCorrect++;
    }
    const rawIndex = r.probabilities.indexOf(Math.max(...r.probabilities));
    const confidence = r.probabilities[rawIndex],
      bin = bins[Math.min(9, Math.floor(confidence * 10))];
    bin.count++;
    bin.confidence += confidence;
    bin.correct += Number(rawIndex === actual);
    logLoss -= Math.log(Math.max(1e-15, r.probabilities[actual]));
    brier += r.probabilities.reduce(
      (s, p, i) => s + (p - Number(i === actual)) ** 2,
      0,
    );
  }
  const perClass = modelClasses.map((label, i) => {
    const support = matrix[i].reduce((s, n) => s + n, 0),
      predicted = matrix.reduce((s, r) => s + r[i], 0),
      tp = matrix[i][i];
    const precision = predicted ? tp / predicted : null,
      recall = support ? tp / support : null;
    return {
      label,
      support,
      predicted,
      precision,
      recall,
      f1: support
        ? support + predicted
          ? (2 * tp) / (support + predicted)
          : 0
        : null,
    };
  });
  const supported = perClass.filter((c) => c.support);
  return {
    count: rows.length,
    classes: modelClasses,
    confusionMatrix: matrix,
    perClass,
    accuracy: matrix.reduce((s, r, i) => s + r[i], 0) / rows.length,
    macroF1Supported:
      supported.reduce((s, c) => s + c.f1, 0) / supported.length,
    coverage: accepted / rows.length,
    unknownRate: 1 - accepted / rows.length,
    selectiveAccuracy: accepted ? acceptedCorrect / accepted : null,
    logLoss: logLoss / rows.length,
    multiclassBrierSum: brier / rows.length,
    topLabelEce10:
      bins.reduce(
        (s, b) => s + (b.count ? Math.abs(b.correct - b.confidence) : 0),
        0,
      ) / rows.length,
    reliabilityBins: bins.map((b, i) => ({
      lower: i / 10,
      upper: (i + 1) / 10,
      count: b.count,
      confidence: b.count ? b.confidence / b.count : null,
      accuracy: b.count ? b.correct / b.count : null,
    })),
  };
}

export function evaluatePredictions(
  prepared,
  predictions,
  manifest,
  split = "test",
) {
  validateManifest(manifest);
  if (
    !["validation", "test"].includes(split) ||
    prepared.schemaVersion !== 1 ||
    prepared.preprocessing !== MFCC_CONTRACT ||
    prepared.sampleRateHz !== manifest.sampleRateHz ||
    typeof prepared.synthetic !== "boolean"
  )
    fail("Partición/contrato incompatible");
  if (
    !Array.isArray(prepared.classes) ||
    prepared.classes.join() !== modelClasses.join()
  )
    fail("Orden de clases incompatible");
  if (
    !["apiary", "hive"].includes(prepared.groupBy) ||
    prepared.normalization.fittedOn !== "train"
  )
    fail("Grupos/normalización incompatibles");
  const expectedSplits = splitGroups(
      prepared.clips.map((c) => c.group),
      prepared.seed,
    ),
    ids = new Set(),
    recordings = new Map(),
    hashes = new Set();
  for (const c of prepared.clips) {
    if (
      !modelClasses.includes(c.label) ||
      c.group !== (prepared.groupBy === "apiary" ? c.apiaryId : c.hiveId) ||
      !Array.isArray(c.mfcc) ||
      c.mfcc.length !== 13 ||
      !c.mfcc.every(Number.isFinite) ||
      ids.has(c.id) ||
      hashes.has(c.wavSha256) ||
      expectedSplits.get(c.group) !== c.split ||
      (recordings.has(c.recordingId) &&
        recordings.get(c.recordingId) !== c.group)
    )
      fail("Preparado modificado o con fuga/duplicados");
    ids.add(c.id);
    hashes.add(c.wavSha256);
    recordings.set(c.recordingId, c.group);
  }
  const train = prepared.clips.filter((c) => c.split === "train");
  for (let i = 0; i < 13; i++) {
    const mean = train.reduce((s, c) => s + c.mfcc[i], 0) / train.length;
    const deviation = Math.sqrt(
      train.reduce((s, c) => s + (c.mfcc[i] - mean) ** 2, 0) / train.length,
    );
    const std = deviation < 1e-12 ? 1 : deviation;
    if (
      Math.abs(prepared.normalization.mean[i] - mean) > 1e-12 ||
      Math.abs(prepared.normalization.std[i] - std) > 1e-12
    )
      fail("Normalización no ajustada sobre train");
  }
  if (
    manifest.mean.some((v, i) => v !== prepared.normalization.mean[i]) ||
    manifest.std.some((v, i) => v !== prepared.normalization.std[i])
  )
    fail("Normalización del modelo distinta de train");
  const clips = prepared.clips.filter((c) => c.split === split),
    byId = new Map(clips.map((c) => [c.id, c])),
    seen = new Set(),
    rows = [];
  for (const p of predictions) {
    const clip = byId.get(p.id);
    if (!clip || seen.has(p.id))
      fail("Predicción duplicada o ajena a la partición");
    if (p.modelSha256 !== manifest.sha256.toLowerCase())
      fail("Predicción de otro modelo");
    if (!Array.isArray(p.probabilities))
      fail("Probabilidades deben ser un array");
    const result = modelResult(p.probabilities, manifest);
    rows.push({
      ...clip,
      prediction: result.classification,
      probabilities: p.probabilities,
    });
    seen.add(p.id);
  }
  if (!clips.length || seen.size !== clips.length)
    fail("Faltan predicciones de la partición");
  const perDevice = Object.fromEntries(
    [...new Set(rows.map((r) => r.deviceId))]
      .sort()
      .map((id) => [
        id,
        classificationMetrics(rows.filter((r) => r.deviceId === id)),
      ]),
  );
  return {
    schemaVersion: 1,
    status: prepared.synthetic
      ? "synthetic-tooling-check-only"
      : "unreviewed-offline-evaluation",
    modelSha256: manifest.sha256,
    preprocessing: MFCC_CONTRACT,
    split,
    minimumScore: manifest.minimumScore,
    datasetName: prepared.name,
    synthetic: prepared.synthetic,
    warnings: prepared.warnings,
    metrics: classificationMetrics(rows),
    perDevice,
    limitations: [
      "Predicciones y hash del modelo declarados: no ejecuta ONNX ni verifica sus bytes",
      "No certifica veracidad de etiquetas, calibración ni aceptación científica",
      "unknown incluye la clase explícita y abstenciones por umbral; no se omiten del denominador",
      "ECE usa diez bins uniformes del máximo original; no es certificación de calibración",
      "Modelo y umbral se seleccionan con train/validation; test se reserva para evaluación final",
    ],
  };
}

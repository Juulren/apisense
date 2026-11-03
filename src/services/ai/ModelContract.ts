import type { AcousticClass } from "../../db/types";
import type { Classification } from "../iot/AudioIngestionService";
export const modelClasses = [
  "healthy",
  "swarming",
  "queenless",
  "pest_disturbance",
  "unknown",
] as const satisfies readonly AcousticClass[];
export const MFCC_CONTRACT = "apisense-mfcc-v1";
export interface ModelManifest {
  contractVersion: 1;
  preprocessing: typeof MFCC_CONTRACT;
  sampleRateHz: number;
  classes: readonly AcousticClass[];
  version: string;
  inputName: string;
  outputName: string;
  mean: number[];
  std: number[];
  minimumScore: number;
  sha256: string;
}
export function validateManifest(manifest: ModelManifest) {
  if (
    manifest.contractVersion !== 1 ||
    manifest.preprocessing !== MFCC_CONTRACT ||
    !Number.isInteger(manifest.sampleRateHz) ||
    manifest.sampleRateHz < 1000 ||
    manifest.sampleRateHz > 96000 ||
    !Array.isArray(manifest.classes) ||
    manifest.classes.length !== modelClasses.length ||
    !manifest.classes.every((value, index) => value === modelClasses[index]) ||
    typeof manifest.sha256 !== "string" ||
    !/^[0-9a-f]{64}$/i.test(manifest.sha256) ||
    typeof manifest.inputName !== "string" ||
    !manifest.inputName.trim() ||
    typeof manifest.outputName !== "string" ||
    !manifest.outputName.trim() ||
    typeof manifest.version !== "string" ||
    !manifest.version.trim() ||
    !Array.isArray(manifest.mean) ||
    manifest.mean.length !== 13 ||
    !Array.isArray(manifest.std) ||
    manifest.std.length !== 13 ||
    !manifest.mean.every(Number.isFinite) ||
    !manifest.std.every((v) => Number.isFinite(v) && v > 0) ||
    !Number.isFinite(manifest.minimumScore) ||
    manifest.minimumScore < 0 ||
    manifest.minimumScore > 1
  )
    throw new Error(
      "Contrato de modelo, clases o preprocesamiento incompatible",
    );
}
export function normalizeMfcc(
  mfcc: number[],
  manifest: ModelManifest,
): Float32Array {
  validateManifest(manifest);
  if (mfcc.length !== 13 || !mfcc.every(Number.isFinite))
    throw new Error("Manifiesto o MFCC incompatible");
  const normalized = Float32Array.from(
    mfcc,
    (v, i) => (v - (manifest.mean[i] ?? 0)) / (manifest.std[i] ?? 1),
  );
  if (!normalized.every(Number.isFinite))
    throw new Error("La normalización desborda float32");
  return normalized;
}
export function modelResult(
  output: ArrayLike<number>,
  manifest: ModelManifest,
): Classification {
  validateManifest(manifest);
  const values = Array.from(output);
  const total = values.reduce((a, b) => a + b, 0);
  if (
    values.length !== 5 ||
    !values.every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
    Math.abs(total - 1) > 0.01
  )
    throw new Error("El modelo debe emitir cinco probabilidades normalizadas");
  const index = values.indexOf(Math.max(...values)),
    confidence = values[index] ?? 0;
  return {
    classification:
      confidence >= manifest.minimumScore
        ? (modelClasses[index] ?? "unknown")
        : "unknown",
    confidence,
    version: `onnx:${manifest.version}`,
  };
}

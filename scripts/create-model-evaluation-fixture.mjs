import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { encodeWav } from "../src/services/iot/wav.ts";
import { modelClasses } from "../src/services/ai/ModelContract.ts";
import { sha256, prepareDataset } from "./model-evaluation.mjs";

async function main() {
  const folder = process.argv[2];
  if (!folder || process.argv.length !== 3)
    throw new Error("Uso: npm run model:fixture -- directorio-nuevo");
  // A pre-existing directory is an error; never replace a real dataset.
  await mkdir(folder);
  const config = {
    schemaVersion: 1,
    name: "synthetic-tooling-fixture-NO-BEE-DATA",
    license: "CC0 synthetic generated tones",
    provenance:
      "Generated tones and fabricated prediction vectors; no trained model or biological labels",
    synthetic: true,
    sampleRateHz: 16000,
    seed: "apisense-fixture-v1",
    groupBy: "apiary",
    clips: [],
  };
  for (let g = 0; g < 3; g++)
    for (let k = 0; k < 5; k++) {
      const id = `synthetic-${g}-${k}`,
        pcm = Float32Array.from(
          { length: 4096 },
          (_, i) =>
            0.2 * Math.sin((2 * Math.PI * (200 + g * 25 + k * 70) * i) / 16000),
        );
      const bytes = encodeWav(pcm, 16000),
        wav = `${id}.wav`;
      await writeFile(path.join(folder, wav), bytes, { flag: "wx" });
      config.clips.push({
        id,
        recordingId: `synthetic-recording-${g}`,
        apiaryId: `synthetic-apiary-${g}`,
        hiveId: `synthetic-hive-${g}`,
        deviceId: `synthetic-mic-${g}`,
        recordedAt: "2026-11-03T12:00:00Z",
        label: modelClasses[k],
        verifiedBy: "fixture generator, not an apicultural observation",
        annotationMethod: "fabricated for tooling regression",
        wav,
        sha256: sha256(bytes),
      });
    }
  const prepared = await prepareDataset(config, path.resolve(folder));
  const manifest = {
    contractVersion: 1,
    preprocessing: prepared.preprocessing,
    sampleRateHz: 16000,
    classes: modelClasses,
    version: "synthetic-fixture-NO-MODEL",
    inputName: "mfcc",
    outputName: "probabilities",
    mean: prepared.normalization.mean,
    std: prepared.normalization.std,
    minimumScore: 0.6,
    sha256: "a".repeat(64),
  };
  await writeFile(
    path.join(folder, "dataset.json"),
    JSON.stringify(config, null, 2) + "\n",
    { flag: "wx" },
  );
  await writeFile(
    path.join(folder, "model.synthetic.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    { flag: "wx" },
  );
  for (const split of ["validation", "test"]) {
    const rows = prepared.clips
      .filter((c) => c.split === split)
      .map((c, i) => ({
        id: c.id,
        modelSha256: manifest.sha256,
        probabilities:
          i === 1
            ? [0.3, 0.2, 0.2, 0.2, 0.1]
            : modelClasses.map((k) => (k === c.label ? 0.8 : 0.05)),
      }));
    await writeFile(
      path.join(folder, `predictions.${split}.ndjson`),
      rows.map((r) => JSON.stringify(r)).join("\n") + "\n",
      { flag: "wx" },
    );
  }
  console.log(
    "SINTETICO: tonos, etiquetas asignadas y predicciones fabricadas. El hash del manifiesto es ficticio; no existe un ONNX ni evidencia científica.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

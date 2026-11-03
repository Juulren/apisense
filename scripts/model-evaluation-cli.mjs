import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  prepareDataset,
  evaluatePredictions,
  sha256,
} from "./model-evaluation.mjs";

async function main() {
  const [command, input, arg3, arg4, arg5, split = "test"] =
    process.argv.slice(2);
  const json = async (file) => JSON.parse(await readFile(file, "utf8"));
  let result, output;
  if (command === "prepare" && input && arg3 && !arg4) {
    result = await prepareDataset(
      await json(input),
      path.dirname(path.resolve(input)),
    );
    result.datasetManifestSha256 = sha256(await readFile(input));
    output = arg3;
  } else if (command === "evaluate" && input && arg3 && arg4 && arg5) {
    const predictions = (await readFile(arg3, "utf8"))
      .split(/\r?\n/)
      .filter((s) => s.trim())
      .map((s) => JSON.parse(s));
    result = evaluatePredictions(
      await json(input),
      predictions,
      await json(arg4),
      split,
    );
    result.inputs = {
      preparedSha256: sha256(await readFile(input)),
      predictionsSha256: sha256(await readFile(arg3)),
      modelManifestSha256: sha256(await readFile(arg4)),
    };
    output = arg5;
  } else
    throw new Error(
      "Uso: model:prepare -- dataset.json preparado.json | model:evaluate -- preparado.json predicciones.ndjson modelo.json reporte.json [validation|test]",
    );
  // Fail rather than overwrite a previous experiment's report.
  await writeFile(output, JSON.stringify(result, null, 2) + "\n", {
    flag: "wx",
  });
  console.log(
    `${command}: resultado escrito. ${result.synthetic ? "SINTETICO: solo prueba de herramientas." : "Pendiente de revisión científica y validación Android."}`,
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

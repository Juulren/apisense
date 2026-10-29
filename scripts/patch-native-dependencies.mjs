import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const packagePath = require.resolve("onnxruntime-react-native/package.json");
const packageInfo = JSON.parse(await readFile(packagePath, "utf8"));
if (packageInfo.version !== "1.24.3")
  throw new Error(
    "Revisa la compatibilidad Gradle de ONNX antes de cambiar su versión.",
  );
const path = new URL("android/build.gradle", pathToFileURL(packagePath));
const source = await readFile(path, "utf8");
const previous =
  'if (VersionNumber.parse(REACT_NATIVE_VERSION) < VersionNumber.parse("0.71")) {';
const replacement = "if (REACT_NATIVE_MINOR_VERSION < 71) {";
if (source.includes(previous)) {
  await writeFile(path, source.replace(previous, replacement));
  console.log(
    "ONNX 1.24.3: comparación de versión compatible con Gradle 9 aplicada.",
  );
} else if (!source.includes(replacement)) {
  throw new Error("El build.gradle de ONNX cambió; revisa el parche nativo.");
}

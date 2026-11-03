import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

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

// query-string 7 is CommonJS; the security-fixed decoder is ESM. Keep the
// routing API and normalize just this import instead of overriding its major.
const queryPackagePath = require.resolve("query-string/package.json");
const queryInfo = JSON.parse(await readFile(queryPackagePath, "utf8"));
if (queryInfo.version !== "7.1.3")
  throw new Error(
    "Revisa el adaptador del decodificador antes de cambiar query-string.",
  );
const queryPath = new URL("index.js", pathToFileURL(queryPackagePath));
const querySource = await readFile(queryPath, "utf8");
const oldImport = "const decodeComponent = require('decode-uri-component');";
const newImport =
  "const decodeComponentModule = require('decode-uri-component');\nconst decodeComponent = decodeComponentModule.default ?? decodeComponentModule;";
const originalQuerySource = querySource.replace(newImport, oldImport);
if (
  createHash("sha256").update(originalQuerySource).digest("hex") !==
  "caa3f2c8b45dfe1e91db22ae10743af68de8d96f26515132bb52485ec0f037fa"
)
  throw new Error(
    "query-string cambió; revisa el adaptador antes de compilar.",
  );
if (querySource.includes(oldImport)) {
  await writeFile(queryPath, querySource.replace(oldImport, newImport));
  console.log(
    "query-string 7.1.3: importación del decodificador ESM corregida.",
  );
}

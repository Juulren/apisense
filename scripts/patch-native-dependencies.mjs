import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { patchGlobCancellation } from "./patch-glob-cancellation.mjs";

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

// Keep patches fail-closed and reproducible after a clean install or a rerun.
async function guardedPatch(filename, expectedHash, replacements) {
  const current = await readFile(filename, "utf8");
  let original = current;
  for (const [before, after] of replacements)
    original = original.replaceAll(after, before);
  if (createHash("sha256").update(original).digest("hex") !== expectedHash)
    throw new Error(`Cambió ${filename}; revisa el parche de seguridad.`);
  let patched = original;
  for (const [before, after, count = 1] of replacements) {
    if (patched.split(before).length !== count + 1)
      throw new Error(
        `La frontera esperada cambió en ${filename}: ${before} (${patched.split(before).length - 1}/${count})`,
      );
    patched = patched.replaceAll(before, after);
  }
  if (patched !== current) await writeFile(filename, patched);
}

const deepmergePackage = require.resolve("deepmerge/package.json");
if (JSON.parse(await readFile(deepmergePackage, "utf8")).version !== "4.3.1")
  throw new Error(
    "Revisa la escritura segura de deepmerge antes de actualizarlo.",
  );
const safeWrites = [
  "cloneUnlessOtherwiseSpecified(target[key], options)",
  "getMergeFunction(key, options)(target[key], source[key], options)",
  "cloneUnlessOtherwiseSpecified(source[key], options)",
].map((value) => [
  `destination[key] = ${value}`,
  `Object.defineProperty(destination, key, { value: ${value}, enumerable: true, configurable: true, writable: true })`,
]);
for (const [file, hash] of [
  [
    "index.js",
    "12440c84957c1990ea2d5e33dc0091722dc1dc1585c6d20e0c780e568ffa9d30",
  ],
  [
    "dist/cjs.js",
    "2e5160f84a1141bd927264afe4d15766f1e6cf07daef182b37ff53fea121de7d",
  ],
  [
    "dist/umd.js",
    "f33e6596482d1fb5c7c427f8ef92f2aa849eea9223acd974176b2fb27ddbf73a",
  ],
])
  await guardedPatch(
    new URL(file, pathToFileURL(deepmergePackage)),
    hash,
    safeWrites,
  );

const expoRequire = createRequire(require.resolve("expo/package.json"));
const cliPackage = expoRequire.resolve("@expo/cli/package.json");
if (JSON.parse(await readFile(cliPackage, "utf8")).version !== "57.0.31")
  throw new Error(
    "Revisa los límites de DevTools antes de actualizar la CLI de Expo.",
  );
const cliRequire = createRequire(cliPackage);
if (cliRequire("zod/package.json").version !== "4.6.6")
  throw new Error(
    "DevTools requiere Zod 4.6.6 con rechazo temprano de colecciones.",
  );
const cliFile = (file) =>
  new URL(`build/src/start/server/${file}`, pathToFileURL(cliPackage));
await guardedPatch(
  cliFile("DevToolsPlugin.schema.js"),
  "4da5edad8daa6eda49fecc646934d372008952004b2c19abc03e27bcffc904a5",
  [
    ["])).readonly()", "])).max(2).readonly()"],
    [
      "array(CommandParameterSchema).optional()",
      "array(CommandParameterSchema).max(64).optional()",
    ],
    ["array(CommandSchema).min(1)", "array(CommandSchema).max(128).min(1)"],
    [
      "array(DevToolsPluginOutputLinesSchema);",
      "array(DevToolsPluginOutputLinesSchema).max(1024);",
    ],
  ],
);
// The optional MCP tunnel serializes v3 schemas. Its generated inputs contain
// only scalar/object schemas, never the unbounded collection path above.
await guardedPatch(
  cliFile("createMCPDevToolsExtensionSchema.js"),
  "9feffc368c805c3188bb1a4dd88617a3986cd71a4f3358821a1ab6da8e44b10d",
  [['require("zod")', 'require("zod/v3")']],
);
console.log(
  "Herramientas Expo: escritura de propiedades y colecciones protegidas.",
);
await patchGlobCancellation(require, guardedPatch);

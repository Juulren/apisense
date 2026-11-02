import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, extname } from "node:path";
const values = Object.entries(process.env)
  .filter(([key, value]) => key.startsWith("MAESTRO_QA_") && value)
  .map(([, value]) => value);
function redact(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) redact(path);
    else if (
      [".log", ".xml", ".json", ".yaml", ".yml", ".txt"].includes(extname(path))
    ) {
      let text = readFileSync(path, "utf8");
      for (const value of values) text = text.replaceAll(value, "[redacted]");
      text = text.replace(
        /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
        "[redacted-jwt]",
      );
      writeFileSync(path, text);
    }
  }
}
if (existsSync(".artifacts")) redact(".artifacts");
console.log("Credenciales temporales eliminadas de los artefactos de texto.");

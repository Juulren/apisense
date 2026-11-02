import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { supabaseConfig } from "./supabase-config.mjs";

export function checkReleaseConfig(env = process.env) {
  if (env.EXPO_PUBLIC_DEMO_ONLY !== "0" || env.EXPO_PUBLIC_SECURITY_QA !== "0")
    throw new Error(
      "El build de campo debe desactivar explícitamente demo y QA.",
    );
  const { url } = supabaseConfig(env);
  if (new URL(url).protocol !== "https:")
    throw new Error("El build de campo requiere Supabase por HTTPS.");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    checkReleaseConfig();
    console.log("Configuración pública de distribución Android: OK");
  } catch (error) {
    // The shared validator emits only fixed messages, never configuration values.
    console.error(error.message);
    process.exitCode = 1;
  }
}

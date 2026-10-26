import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const platform = process.argv[2];
if (!["android", "ios"].includes(platform))
  throw new Error("Usa android o ios");
if (platform === "ios" && process.platform !== "darwin")
  throw new Error(
    "La compilación iOS requiere macOS y Xcode; usa el artefacto de simulador de GitHub Actions en un Mac.",
  );
const env = {
  ...process.env,
  EXPO_NO_DOTENV: "1",
  EXPO_PUBLIC_DEMO_ONLY: "1",
  EXPO_PUBLIC_SUPABASE_URL: "",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "",
  EXPO_PUBLIC_MQTT_URL: "",
  EXPO_PUBLIC_BLE_SERVICE_UUID: "",
  EXPO_PUBLIC_BLE_CHARACTERISTIC_UUID: "",
};
const cli = require.resolve("expo/bin/cli");
// Regenerate identifiers when switching between the field app and demo binary.
for (const args of [
  ["prebuild", "--platform", platform, "--no-install"],
  [
    platform === "android" ? "run:android" : "run:ios",
    platform === "android" ? "--variant" : "--configuration",
    platform === "android" ? "release" : "Release",
    "--no-bundler",
    ...process.argv.slice(3),
  ],
]) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

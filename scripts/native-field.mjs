import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { checkReleaseConfig } from "./check-release-config.mjs";

const require = createRequire(import.meta.url);
const platform = process.argv[2];
if (platform !== "android")
  throw new Error("El bloque actual desarrolla Android.");
if (existsSync(".env")) process.loadEnvFile(".env");
const env = {
  ...process.env,
  EXPO_PUBLIC_DEMO_ONLY: "0",
  EXPO_PUBLIC_SECURITY_QA: "0",
};
checkReleaseConfig(env);
const cli = require.resolve("expo/bin/cli");
for (const args of [
  ["prebuild", "--platform", "android", "--no-install"],
  [
    "run:android",
    "--variant",
    "release",
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

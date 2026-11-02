import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./supabase-config.mjs";
import { encodeWav } from "../src/services/iot/wav.ts";

// Run locally with .env/.env.backend. Only the temporary user credentials go to
// a test runner; the administrative key never leaves this local process.
const statePath = ".artifacts/native-field-fixtures.private.json";
const options = { auth: { persistSession: false, autoRefreshToken: false } };
function checked(result, operation) {
  if (result.error)
    throw new Error(`${operation}: ${result.error.code ?? "failed"}`);
  return result.data;
}
const { url, key } = supabaseConfig();
const secret = process.env.SUPABASE_TEST_SECRET_KEY;
if (!secret)
  throw new Error("Configura la credencial de pruebas solo en .env.backend");
const admin = createClient(url, secret, options);
function save(state) {
  mkdirSync(".artifacts", { recursive: true });
  writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
}
async function prepare() {
  if (existsSync(statePath) && !JSON.parse(readFileSync(statePath)).cleaned)
    throw new Error(
      "Limpia la ejecución temporal anterior antes de crear otra",
    );
  const run = { id: randomUUID(), users: [], cleaned: false };
  run.note = `QA-INSPECCION-${run.id}`;
  save(run);
  for (const suffix of ["a", "b"]) {
    const email = `apisense-native-${run.id}-${suffix}@example.com`;
    const password = `Qa!${randomUUID()}9z`;
    const data = checked(
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { apisense_native_run: run.id },
      }),
      "Crear cuenta temporal",
    );
    const user = {
      id: data.user.id,
      email,
      password,
      apiary: randomUUID(),
      hive: randomUUID(),
      mic: randomUUID(),
      sample: randomUUID(),
    };
    run.users.push(user);
    save(run);
    checked(
      await admin.from("apiaries").insert({
        id: user.apiary,
        user_id: user.id,
        name: `QA Android ${suffix.toUpperCase()}`,
        check_interval_minutes: 10080,
      }),
      "Preparar apiario temporal",
    );
    checked(
      await admin.from("hives").insert({
        id: user.hive,
        apiary_id: user.apiary,
        code: suffix === "a" ? "QA-CAMPO-15" : "B-PRIVADA-15",
        queen_status: "unknown",
      }),
      "Preparar colmena temporal",
    );
    if (suffix === "a") {
      checked(
        await admin.from("iot_microphones").insert({
          id: user.mic,
          hive_id: user.hive,
          mac_address: `fixture-${run.id}`,
          firmware_version: "qa-fixture-not-hardware",
          battery_level: 100,
          sampling_rate_hz: 16000,
          is_online: 0,
          calibration_db: 0,
        }),
        "Preparar metadatos temporales",
      );
      const pcm = Float32Array.from(
        { length: 160000 },
        (_, i) => 0.2 * Math.sin((2 * Math.PI * 250 * i) / 16000),
      );
      const wav = encodeWav(pcm, 16000);
      user.audioPath = `${user.id}/${user.hive}/${user.sample}.wav`;
      save(run);
      checked(
        await admin.storage
          .from("hive-audio")
          .upload(user.audioPath, wav, { contentType: "audio/wav" }),
        "Preparar WAV privado temporal",
      );
      checked(
        await admin.from("audio_samples").insert({
          id: user.sample,
          hive_id: user.hive,
          device_id: user.mic,
          recorded_at: new Date().toISOString(),
          duration_seconds: 10,
          dominant_freq_hz: 250,
          amplitude_db: -17,
          mfcc_features_json: "[]",
          audio_file_url: user.audioPath,
          acoustic_classification: "healthy",
          confidence_score: 0.5,
          source: "simulator",
          classifier_version: "native-integration-fixture",
        }),
        "Preparar lectura temporal",
      );
    }
  }
  console.log(
    "Dos cuentas temporales y audio privado preparados; no se enviaron correos.",
  );
}
async function verify(run) {
  const [a, b] = await Promise.all(
    run.users.map(async (user) => {
      const client = createClient(url, key, options);
      checked(
        await client.auth.signInWithPassword({
          email: user.email,
          password: user.password,
        }),
        "Verificar sesión temporal",
      );
      return client;
    }),
  );
  const mine = checked(
    await a
      .from("inspections")
      .select("id,notes")
      .eq("hive_id", run.users[0].hive)
      .eq("notes", run.note),
    "Verificar inspección Android en servidor",
  );
  if (mine.length !== 1)
    throw new Error("La inspección del APK no llegó una sola vez al servidor");
  const foreign = checked(
    await b.from("inspections").select("id").eq("hive_id", run.users[0].hive),
    "Verificar aislamiento de inspección",
  );
  if (foreign.length)
    throw new Error("La segunda cuenta accedió a una inspección ajena");
  console.log(
    "Inspección creada en APK sincronizada una vez; segunda cuenta aislada: OK",
  );
}
async function cleanup(run) {
  if (run.cleaned) {
    console.log("La ejecución ya se limpió.");
    return;
  }
  for (const user of run.users) {
    const found = await admin.auth.admin.getUserById(user.id);
    if (found.error?.code === "user_not_found") continue;
    const data = checked(found, "Comprobar propietario temporal");
    if (data.user.user_metadata.apisense_native_run !== run.id)
      throw new Error("Se rechazó la limpieza de una cuenta ajena al test");
    if (user.audioPath)
      checked(
        await admin.storage.from("hive-audio").remove([user.audioPath]),
        "Eliminar WAV temporal",
      );
    for (const table of [
      "inspections",
      "ai_summaries",
      "audio_samples",
      "iot_microphones",
      "hives",
      "apiaries",
    ]) {
      const column =
        table === "apiaries" || table === "hives" ? "id" : "hive_id";
      checked(
        await admin
          .from(table)
          .delete()
          .eq(column, table === "apiaries" ? user.apiary : user.hive),
        "Eliminar filas temporales",
      );
    }
    checked(
      await admin.auth.admin.deleteUser(user.id),
      "Eliminar cuenta temporal",
    );
  }
  // Erase passwords locally after remote cleanup; retain IDs for an audit trail.
  run.users = run.users.map(({ password, ...user }) => user);
  run.cleaned = true;
  save(run);
  console.log(
    "Cuentas, datos y audio temporales eliminados; claves de servidor nunca usadas en el APK.",
  );
}
try {
  const action = process.argv[2];
  if (action === "prepare") await prepare();
  else if (action === "verify" || action === "cleanup") {
    const run = JSON.parse(readFileSync(statePath));
    if (action === "verify") await verify(run);
    else await cleanup(run);
  } else throw new Error("Usa prepare, verify o cleanup");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

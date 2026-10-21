import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Repository } from "../../src/db/Repository";
import { SupabaseRemote } from "../../src/db/SupabaseRemote";
import { SyncEngine } from "../../src/db/SyncEngine";
import { TABLES, type SqlPort } from "../../src/db/types";
import { encodeWav } from "../../src/services/iot/wav";
import { supabaseConfig } from "../../scripts/supabase-config.mjs";

const runId = randomUUID();
const apiaryId = randomUUID(),
  hiveId = randomUUID(),
  micId = randomUUID();
const sampleId = randomUUID();
const users: string[] = [];
const wav = encodeWav(
  Float32Array.from(
    { length: 16000 },
    (_, i) => 0.2 * Math.sin((2 * Math.PI * 250 * i) / 16000),
  ),
  16000,
);
let admin: SupabaseClient, a: SupabaseClient, b: SupabaseClient;
let local: Repository, engine: SyncEngine;
let audioPath: string;
let url: string, key: string;
let summaryId: string;
function checked(
  error: { code?: string; name?: string } | null,
  operation: string,
) {
  if (error)
    throw new Error(`${operation}: ${error.code ?? error.name ?? "error"}`);
}
const options = { auth: { persistSession: false, autoRefreshToken: false } };
beforeAll(async () => {
  ({ url, key } = supabaseConfig());
  const secret = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!secret)
    throw new Error(
      "Falta SUPABASE_TEST_SECRET_KEY en .env.backend (solo servidor)",
    );
  admin = createClient(url, secret, options);
  const clients = [];
  for (const suffix of ["a", "b"]) {
    const email = `apisense-${runId}-${suffix}@example.com`;
    const password = `A!${randomUUID()}z9`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { apisense_test_run: runId },
    });
    checked(created.error, "Crear cuenta temporal");
    if (!created.data.user) throw new Error("No se creó la cuenta temporal");
    users.push(created.data.user.id);
    const client = createClient(url, key, options);
    checked(
      (await client.auth.signInWithPassword({ email, password })).error,
      "Acceder a cuenta temporal",
    );
    clients.push(client);
  }
  [a, b] = clients;
  audioPath = `${users[0]}/${hiveId}/${sampleId}.wav`;
  const sqlite = new DatabaseSync(":memory:");
  const port: SqlPort = {
    exec: async (sql) => {
      sqlite.exec(sql);
    },
    run: async (sql, params = []) => ({
      changes: Number(sqlite.prepare(sql).run(...params).changes),
    }),
    all: async <T>(sql: string, params: (string | number | null)[] = []) =>
      sqlite.prepare(sql).all(...params) as T[],
    close: async () => {
      sqlite.close();
    },
  };
  local = new Repository(port, randomUUID);
  await local.initialize();
  await local.save("apiaries", {
    id: apiaryId,
    user_id: users[0],
    name: `Integration ${runId}`,
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
  await local.save("hives", {
    id: hiveId,
    apiary_id: apiaryId,
    code: "TEST-ONLY",
    queen_status: "unknown",
    health_score: null,
    last_audio_check_at: null,
  });
  await local.save("iot_microphones", {
    id: micId,
    hive_id: hiveId,
    mac_address: `test-${runId}`,
    firmware_version: "integration-test",
    battery_level: 100,
    sampling_rate_hz: 16000,
    is_online: 0,
    last_seen_at: null,
    calibration_db: 0,
  });
  await local.save("audio_samples", {
    id: sampleId,
    hive_id: hiveId,
    device_id: micId,
    recorded_at: new Date().toISOString(),
    duration_seconds: 1,
    dominant_freq_hz: 250,
    amplitude_db: -17,
    mfcc_features_json: "[]",
    audio_file_url: null,
    local_audio_uri: "test:fixture",
    acoustic_classification: "healthy",
    confidence_score: 0.5,
    source: "ble",
    classifier_version: "integration-fixture",
  });
  await local.save("inspections", {
    hive_id: hiveId,
    inspected_at: new Date().toISOString(),
    notes: `Test ${runId}`,
    tags_json: "[]",
    queen_seen: 0,
  });
  let connect = (_online: boolean) => {};
  engine = new SyncEngine(
    local,
    new SupabaseRemote(a, async () => wav.buffer as ArrayBuffer),
    users[0],
    {
      subscribe(listener) {
        connect = listener;
        return () => {};
      },
    },
  );
  engine.start();
  expect(engine.snapshot().lastSyncedAt).toBeNull();
  connect(true);
  await engine.sync();
  const response = await a.functions.invoke("generate-hive-summary", {
    body: { hive_id: hiveId },
  });
  checked(response.error, "Generar resumen cloud");
  summaryId = response.data.summaries[0]?.id;
  if (!summaryId) throw new Error("La función no devolvió el resumen esperado");
  await engine.sync();
});

afterAll(async () => {
  await engine?.stop();
  await local?.close();
  if (!admin) return;
  if (audioPath)
    checked(
      (await admin.storage.from("hive-audio").remove([audioPath])).error,
      "Eliminar clip temporal",
    );
  for (const table of [...TABLES].reverse()) {
    const column = table === "apiaries" || table === "hives" ? "id" : "hive_id";
    const value = table === "apiaries" ? apiaryId : hiveId;
    checked(
      (await admin.from(table).delete().eq(column, value)).error,
      "Eliminar registros temporales",
    );
  }
  for (const id of users)
    checked(
      (await admin.auth.admin.deleteUser(id)).error,
      "Eliminar cuenta temporal",
    );
});

describe("Supabase real: isolated disposable fixtures", () => {
  it("syncs SQLite records and WAV before the sample row, then pulls a cloud summary", async () => {
    expect(engine.snapshot().status).toBe("idle");
    expect(await local.pending(new Date().toISOString())).toHaveLength(0);
    const sample = await a
      .from("audio_samples")
      .select("audio_file_url")
      .eq("id", sampleId)
      .single();
    checked(sample.error, "Leer muestra propia");
    expect(sample.data?.audio_file_url).toBe(audioPath);
    const summary = await local.list("ai_summaries");
    expect(summary.some((row) => row.id === summaryId)).toBe(true);
  });
  it("isolates all six tables, rejects foreign writes and protects the service-only queue", async () => {
    for (const table of TABLES) {
      const rows = await b.from(table).select("id");
      checked(rows.error, "Leer con segunda cuenta");
      expect(rows.data).toEqual([]);
    }
    const write = await b
      .from("hives")
      .insert({ id: randomUUID(), apiary_id: apiaryId, code: "FORBIDDEN" });
    expect(write.error?.code).toBe("42501");
    const claim = await a.rpc("claim_hive_summary_jobs", { batch_size: 1 });
    expect(claim.error?.code).toBe("42501");
  });
  it("serves a private clip only to its owner, including signed URL access", async () => {
    const own = await a.storage.from("hive-audio").download(audioPath);
    checked(own.error, "Descargar clip propio");
    expect(new Uint8Array(await own.data!.arrayBuffer())).toEqual(wav);
    expect(
      (await b.storage.from("hive-audio").download(audioPath)).error,
    ).not.toBeNull();
    expect(
      (await b.storage.from("hive-audio").createSignedUrl(audioPath, 30)).error,
    ).not.toBeNull();
    const signed = await a.storage
      .from("hive-audio")
      .createSignedUrl(audioPath, 30);
    checked(signed.error, "Firmar clip propio");
    expect((await fetch(signed.data!.signedUrl)).status).toBe(200);
    const publicPath = `${url}/storage/v1/object/public/hive-audio/${audioPath}`;
    expect((await fetch(publicPath)).ok).toBe(false);
  });
  it("authenticates the function, scopes it to the user and keeps repeat summaries idempotent", async () => {
    for (const headers of [
      {},
      { "x-cron-secret": "invalid" },
      { authorization: "Bearer invalid" },
    ]) {
      const response = await fetch(
        `${url}/functions/v1/generate-hive-summary`,
        {
          method: "POST",
          headers: {
            apikey: key,
            "Content-Type": "application/json",
            ...headers,
          },
          body: "{}",
        },
      );
      expect(response.status).toBe(401);
    }
    const foreign = await b.functions.invoke("generate-hive-summary", {
      body: { hive_id: hiveId },
    });
    checked(foreign.error, "Invocar con segunda cuenta");
    expect(foreign.data.summaries).toEqual([]);
    const repeated = await a.functions.invoke("generate-hive-summary", {
      body: { hive_id: hiveId },
    });
    checked(repeated.error, "Repetir resumen propio");
    expect(repeated.data.summaries[0].id).toBe(summaryId);
    const stored = await a
      .from("ai_summaries")
      .select("id")
      .eq("hive_id", hiveId);
    checked(stored.error, "Leer resúmenes propios");
    expect(stored.data).toHaveLength(1);
  });
  it("includes more than 1000 samples from the real PostgREST API", async () => {
    const recordedAt = new Date().toISOString();
    for (let offset = 0; offset < 1256; offset += 200) {
      const rows = Array.from({ length: Math.min(200, 1256 - offset) }, () => ({
        id: randomUUID(),
        hive_id: hiveId,
        device_id: micId,
        recorded_at: recordedAt,
        duration_seconds: 1,
        dominant_freq_hz: 250,
        amplitude_db: -17,
        mfcc_features_json: "[]",
        acoustic_classification: "healthy",
        confidence_score: 0.5,
        source: "ble",
        classifier_version: "integration-fixture",
      }));
      checked(
        (await a.from("audio_samples").insert(rows)).error,
        "Crear muestras temporales para paginación",
      );
    }
    const response = await a.functions.invoke("generate-hive-summary", {
      body: { hive_id: hiveId },
    });
    checked(response.error, "Generar resumen de más de 1000 muestras");
    const summary = await a
      .from("ai_summaries")
      .select("samples_analyzed_count")
      .eq("id", response.data.summaries[0].id)
      .single();
    checked(summary.error, "Leer conteo de muestras");
    expect(summary.data?.samples_analyzed_count).toBe(1257);
    await engine.sync();
    expect((await local.list("audio_samples")).length).toBe(1257);
  }, 60000);
  it("accepts the configured cron secret against the deployed queue", async () => {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new Error("Falta CRON_SECRET en .env.backend");
    const response = await fetch(`${url}/functions/v1/generate-hive-summary`, {
      method: "POST",
      headers: {
        apikey: key,
        "Content-Type": "application/json",
        "x-cron-secret": secret,
      },
      body: "{}",
    });
    expect(response.status).toBe(200);
    expect((await response.json()).failed).toBe(0);
  });
});

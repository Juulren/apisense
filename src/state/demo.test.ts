import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, expect, it, vi } from "vitest";
import { Repository } from "../db/Repository";
import type { SqlValue } from "../db/types";
import { AcousticClassifier } from "../services/ai/Classifier";
import { HiveSummaryEngine } from "../services/ai/HiveSummaryEngine";
import { AudioIngestionService } from "../services/iot/AudioIngestionService";
import { clips } from "../services/iot/ClipStore";
import { decodeWav } from "../services/iot/wav";
import { DEMO_USER, applyDemoWeatherDefault, seedDemo } from "./demo";
import { simulate } from "../services/iot/Simulator";
import { saveCycleStart } from "../services/BroodCycle";

vi.mock("expo-crypto", async () => {
  const { createHash, randomUUID } = await import("node:crypto");
  return {
    randomUUID,
    CryptoDigestAlgorithm: { SHA256: "SHA-256" },
    digestStringAsync: async (_algorithm: string, input: string) =>
      createHash("sha256").update(input).digest("hex"),
  };
});

const databases: DatabaseSync[] = [];
const folders: string[] = [];
function repository(file: string) {
  const db = new DatabaseSync(file);
  databases.push(db);
  return new Repository(
    {
      exec: async (sql) => {
        db.exec(sql);
      },
      run: async (sql, params = []) => ({
        changes: Number(db.prepare(sql).run(...params).changes),
      }),
      all: async <T>(sql: string, params: SqlValue[] = []) =>
        db.prepare(sql).all(...params) as T[],
      close: async () => {
        db.close();
        databases.splice(databases.indexOf(db), 1);
      },
    },
    randomUUID,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  for (const db of databases.splice(0)) db.close();
  for (const folder of folders.splice(0)) {
    // Only these known fixture files are removed; no recursive deletion.
    for (const suffix of ["", "-wal", "-shm"])
      rmSync(join(folder, `demo.db${suffix}`), { force: true });
    rmdirSync(folder);
  }
});

it("seeds eight demo hives offline, reads WAVs, and preserves inspections on reopen without reseeding", async () => {
  const fetch = vi.fn(() => {
    throw new Error("Demo must not use the network");
  });
  vi.stubGlobal("fetch", fetch);
  const folder = mkdtempSync(join(tmpdir(), "apisense-demo-"));
  folders.push(folder);
  const file = join(folder, "demo.db");
  const first = repository(file);
  await first.initialize();
  const classifier = new AcousticClassifier();
  const ingestion = new AudioIngestionService(
    first,
    clips,
    classifier.classify,
  );
  const summaries = new HiveSummaryEngine(first, true);
  await seedDemo(first, ingestion, summaries);

  expect((await first.list("apiaries")).map((a) => a.user_id)).toEqual([
    DEMO_USER,
  ]);
  const hives = await first.list("hives");
  expect(hives).toHaveLength(8);
  expect(await first.list("iot_microphones")).toHaveLength(8);
  const samples = await first.list("audio_samples");
  expect(samples).toHaveLength(8);
  expect(samples.every((s) => s.source === "simulator")).toBe(true);
  const micA = (await first.list("iot_microphones")).find(
    (m) => m.hive_id === hives[0]!.id,
  )!;
  const captured = simulate("healthy", {
    id: randomUUID(),
    hive_id: hives[0]!.id,
    device_id: micA.id,
  });
  await expect(
    ingestion.ingest(captured, "ble", {
      hiveId: hives[1]!.id,
      deviceId: micA.id,
    }),
  ).rejects.toThrow("vinculados");
  await expect(
    ingestion.ingest(captured, "ble", {
      hiveId: hives[0]!.id,
      deviceId: randomUUID(),
    }),
  ).rejects.toThrow("vinculados");
  expect(await first.get("audio_samples", captured.id)).toBeUndefined();
  const ownSample = samples.find((s) => s.device_id === micA.id)!;
  await expect(
    ingestion.ingest({ ...captured, id: ownSample.id }, "ble", {
      hiveId: hives[0]!.id,
      deviceId: micA.id,
    }),
  ).resolves.toEqual(ownSample);
  expect(await first.list("ai_summaries")).toHaveLength(8);
  const bytes = await clips.read(samples[0]!.local_audio_uri!);
  expect(decodeWav(new Uint8Array(bytes)).sampleRate).toBe(16000);

  const inspection = await first.save("inspections", {
    hive_id: hives[0]!.id,
    inspected_at: new Date().toISOString(),
    notes: "Observación sintética de la demo sin conexión.",
    tags_json: '["demo"]',
    queen_seen: 1,
  });
  const cycle = await saveCycleStart(
    first,
    hives[0]!.id,
    "2026-10-18",
    "Cuadro sintético",
    new Date("2026-11-02T12:00:00Z"),
  );
  await first.close();

  const reopened = repository(file);
  await reopened.initialize();
  await seedDemo(
    reopened,
    new AudioIngestionService(reopened, clips, classifier.classify),
    new HiveSummaryEngine(reopened, true),
  );
  expect(await reopened.get("inspections", inspection.id)).toMatchObject(
    inspection,
  );
  expect(await reopened.get("brood_cycles", cycle.id)).toMatchObject(cycle);
  expect((await reopened.list("audio_samples")).map((s) => s.id)).toEqual(
    samples.map((s) => s.id),
  );
  expect(await reopened.list("hives")).toHaveLength(8);
  expect(await reopened.list("ai_summaries")).toHaveLength(8);
  expect(fetch).not.toHaveBeenCalled();
  await reopened.close();
});

it("turns the demo weather on once, as an ordinary edit, and respects a later switch-off", async () => {
  const repo = repository(":memory:");
  await repo.initialize();
  const base = {
    user_id: DEMO_USER,
    latitude: 20.388 as number | null,
    longitude: -89.323 as number | null,
    check_interval_minutes: 15,
    weather_enabled: 0,
  };
  const located = await repo.save("apiaries", { ...base, name: "Con ubicación" });
  const unlocated = await repo.save("apiaries", {
    ...base,
    name: "Sin ubicación",
    latitude: null,
    longitude: null,
  });
  await applyDemoWeatherDefault(repo);
  expect((await repo.get("apiaries", located.id))?.weather_enabled).toBe(1);
  expect((await repo.get("apiaries", located.id))?.local_revision).toBe(2);
  expect((await repo.get("apiaries", unlocated.id))?.weather_enabled).toBe(0);
  // The user switches it off later: a second run must not turn it back on.
  await repo.save("apiaries", { ...located, weather_enabled: 0 });
  await applyDemoWeatherDefault(repo);
  expect((await repo.get("apiaries", located.id))?.weather_enabled).toBe(0);
});

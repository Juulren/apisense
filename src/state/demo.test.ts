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
import { DEMO_USER, seedDemo } from "./demo";

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
  expect((await reopened.list("audio_samples")).map((s) => s.id)).toEqual(
    samples.map((s) => s.id),
  );
  expect(await reopened.list("hives")).toHaveLength(8);
  expect(await reopened.list("ai_summaries")).toHaveLength(8);
  expect(fetch).not.toHaveBeenCalled();
  await reopened.close();
});

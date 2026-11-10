import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "../db/Repository";
import type { SqlValue } from "../db/types";
import { addHive, normalizeHiveCode, removeHive, renameHive } from "./Hives";

function setup() {
  const db = new DatabaseSync(":memory:");
  const repo = new Repository(
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
      },
    },
    randomUUID,
  );
  return { db, repo };
}
async function apiary(repo: Repository) {
  return repo.save("apiaries", {
    user_id: "owner",
    name: "Apiario",
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
}
async function fullHive(repo: Repository) {
  const a = await apiary(repo);
  const hive = await addHive(repo, a.id, "C-01");
  const mic = await repo.save("iot_microphones", {
    hive_id: hive.id,
    mac_address: "SIM-01",
    firmware_version: "sim",
    battery_level: 90,
    sampling_rate_hz: 8000,
    is_online: 1,
    last_seen_at: null,
    calibration_db: 0,
  });
  const sample = await repo.save("audio_samples", {
    hive_id: hive.id,
    device_id: mic.id,
    recorded_at: "2026-11-09T10:00:00.000Z",
    duration_seconds: 5,
    dominant_freq_hz: 250,
    amplitude_db: -30,
    mfcc_features_json: "[]",
    audio_file_url: null,
    local_audio_uri: null,
    acoustic_classification: "healthy",
    confidence_score: 0.4,
    source: "simulator",
    classifier_version: "experimental-rules-v1",
  });
  const summary = await repo.save("ai_summaries", {
    hive_id: hive.id,
    period_start: "2026-11-09T09:00:00.000Z",
    period_end: "2026-11-09T10:00:00.000Z",
    overall_status: "optimal",
    summary_text: "ok",
    recommended_action: "ok",
    samples_analyzed_count: 1,
    created_at: "2026-11-09T10:00:00.000Z",
    engine_version: "t",
  });
  const note = await repo.save("inspections", {
    hive_id: hive.id,
    inspected_at: "2026-11-09T10:00:00.000Z",
    notes: "Nota de prueba",
    tags_json: "[]",
    queen_seen: 0,
  });
  const cycle = await repo.save("brood_cycles", {
    hive_id: hive.id,
    cohort_label: "Cuadro",
    started_on: "2026-11-01",
    state: "active",
    observed_stage: "unknown",
    observed_at: null,
    ended_at: null,
  });
  return { a, hive, mic, sample, summary, note, cycle };
}

describe("hive management", () => {
  it("validates names when adding a hive", async () => {
    const { repo } = setup();
    await repo.initialize();
    const a = await apiary(repo);
    expect(() => normalizeHiveCode("   ")).toThrow("Escribe el nombre");
    expect(() => normalizeHiveCode("x".repeat(41))).toThrow("máximo 40");
    await addHive(repo, a.id, "  Colmena 1 ");
    expect((await repo.list("hives"))[0]?.code).toBe("Colmena 1");
    await expect(addHive(repo, a.id, "colmena 1")).rejects.toThrow(
      "ya existe",
    );
    await expect(addHive(repo, "no-existe", "Otra")).rejects.toThrow(
      "crea un apiario",
    );
  });

  it("renames a hive, allows keeping its own name, and rejects duplicates", async () => {
    const { repo } = setup();
    await repo.initialize();
    const a = await apiary(repo);
    const one = await addHive(repo, a.id, "A");
    await addHive(repo, a.id, "B");
    await expect(renameHive(repo, one.id, "b")).rejects.toThrow("ya existe");
    const same = await renameHive(repo, one.id, "a");
    expect(same.code).toBe("a");
    const renamed = await renameHive(repo, one.id, "Norte 1");
    expect(renamed).toMatchObject({ code: "Norte 1", apiary_id: a.id });
    expect(renamed.local_revision).toBeGreaterThan(one.local_revision);
  });

  it("removes a hive with its records atomically, keeps readings, queues every change", async () => {
    const { db, repo } = setup();
    await repo.initialize();
    const { hive, mic, sample, summary, note, cycle } = await fullHive(repo);
    await removeHive(repo, hive.id);
    for (const [table, id] of [
      ["hives", hive.id],
      ["iot_microphones", mic.id],
      ["inspections", note.id],
      ["brood_cycles", cycle.id],
    ] as const) {
      const row = db
        .prepare(`SELECT deleted_at, synced_at, local_revision FROM ${table} WHERE id=?`)
        .get(id) as { deleted_at: string | null; synced_at: string | null };
      expect(row.deleted_at, table).not.toBeNull();
      expect(row.synced_at, table).toBeNull();
    }
    // Readings and server-written summaries are not tombstoned with the hive.
    for (const [table, id] of [
      ["audio_samples", sample.id],
      ["ai_summaries", summary.id],
    ] as const)
      expect(
        (
          db.prepare(`SELECT deleted_at FROM ${table} WHERE id=?`).get(id) as {
            deleted_at: string | null;
          }
        ).deleted_at,
      ).toBeNull();
    expect(await repo.list("hives")).toHaveLength(0);
    const queued = db
      .prepare(
        "SELECT table_name, revision FROM sync_queue WHERE record_id IN (?,?,?,?)",
      )
      .all(hive.id, mic.id, note.id, cycle.id) as {
      table_name: string;
      revision: number;
    }[];
    expect(queued.map((q) => q.table_name).sort()).toEqual([
      "brood_cycles",
      "hives",
      "inspections",
      "iot_microphones",
    ]);
    expect(queued.every((q) => q.revision >= 2)).toBe(true);
    await expect(removeHive(repo, hive.id)).rejects.toThrow("ya no está");
  });

  it("never revives or edits a removed hive through the services", async () => {
    const { repo } = setup();
    await repo.initialize();
    const { hive } = await fullHive(repo);
    await removeHive(repo, hive.id);
    await expect(renameHive(repo, hive.id, "Nueva")).rejects.toThrow(
      "ya no está",
    );
    expect((await repo.get("hives", hive.id))?.deleted_at).not.toBeNull();
  });

  it("rolls everything back if one record cannot be removed", async () => {
    const { db, repo } = setup();
    await repo.initialize();
    const { hive, mic, note } = await fullHive(repo);
    db.exec(
      "CREATE TRIGGER fail_cycle BEFORE UPDATE ON brood_cycles WHEN NEW.deleted_at IS NOT NULL BEGIN SELECT RAISE(ABORT,'boom'); END",
    );
    await expect(removeHive(repo, hive.id)).rejects.toThrow("boom");
    expect((await repo.get("hives", hive.id))?.deleted_at).toBeNull();
    expect((await repo.get("iot_microphones", mic.id))?.deleted_at).toBeNull();
    expect((await repo.get("inspections", note.id))?.deleted_at).toBeNull();
    // The repository is still usable after the rollback.
    db.exec("DROP TRIGGER fail_cycle");
    await removeHive(repo, hive.id);
    expect((await repo.get("hives", hive.id))?.deleted_at).not.toBeNull();
  });
});

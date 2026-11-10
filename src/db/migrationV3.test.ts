import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "./Repository";
import { migrationV1, migrationV2, migrationV3, migrationV4 } from "./schema";
import type { SqlValue } from "./types";

function repo(db: DatabaseSync) {
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
      },
    },
    randomUUID,
  );
}

describe("local schema v3", () => {
  it("upgrades a v2 database that already has data without losing or altering it", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(migrationV1);
    db.exec(migrationV2);
    db.exec("PRAGMA foreign_keys = ON");
    const stamp = "2026-11-01T10:00:00.000Z";
    db.exec(`
      INSERT INTO apiaries(id,updated_at,user_id,name,latitude,longitude) VALUES ('a1','${stamp}','u','Apiario viejo',20.4,-89.3);
      INSERT INTO hives(id,updated_at,apiary_id,code) VALUES ('h1','${stamp}','a1','C-01');
      INSERT INTO inspections(id,updated_at,hive_id,inspected_at,notes,tags_json,queen_seen) VALUES ('i1','${stamp}','h1','${stamp}','Nota anterior conservada','[]',1);
      INSERT INTO brood_cycles(id,updated_at,hive_id,cohort_label,started_on,state,observed_stage) VALUES ('b1','${stamp}','h1','Cuadro 1','2026-10-20','active','unknown');
    `);
    const repository = repo(db);
    await repository.initialize();
    expect(db.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 5,
    });
    expect(await repository.get("apiaries", "a1")).toMatchObject({
      name: "Apiario viejo",
      latitude: 20.4,
      region_preset: null,
      seasons_json: null,
      // Nobody's weather choice is changed by a migration.
      weather_enabled: 0,
    });
    expect(await repository.get("inspections", "i1")).toMatchObject({
      notes: "Nota anterior conservada",
      queen_seen: 1,
      queen_state: null,
      eggs_state: null,
      queen_cells: null,
    });
    expect(await repository.get("apiaries", "a1")).toMatchObject({
      checkin_frequency: "weekly",
    });
    expect(await repository.get("inspections", "i1")).toMatchObject({
      activity: null,
      population: null,
      stores: null,
    });
    expect(await repository.get("brood_cycles", "b1")).toMatchObject({
      cohort_label: "Cuadro 1",
      state: "active",
    });
  });

  it("is idempotent, creates v3 from scratch, and refuses a newer database", async () => {
    const fresh = new DatabaseSync(":memory:");
    const repository = repo(fresh);
    await repository.initialize();
    await repository.initialize();
    expect(fresh.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 5,
    });
    const newer = new DatabaseSync(":memory:");
    newer.exec("PRAGMA user_version = 6");
    await expect(repo(newer).initialize()).rejects.toThrow(
      "versión más reciente",
    );
  });

  it("round-trips the new columns, rejects bad values, and keeps them when an older client omits them", async () => {
    const db = new DatabaseSync(":memory:");
    const repository = repo(db);
    await repository.initialize();
    const apiary = await repository.save("apiaries", {
      user_id: "u",
      name: "Apiario",
      latitude: null,
      longitude: null,
      check_interval_minutes: 15,
      region_preset: "yucatan",
      seasons_json: '{"flow":[12,1,2,3]}',
      weather_enabled: 1,
    });
    // An edit that does not mention the new columns (older writer) must not wipe them.
    await repository.save("apiaries", {
      id: apiary.id,
      user_id: "u",
      name: "Apiario renombrado",
      latitude: 1,
      longitude: 2,
      check_interval_minutes: 15,
    });
    expect(await repository.get("apiaries", apiary.id)).toMatchObject({
      name: "Apiario renombrado",
      region_preset: "yucatan",
      seasons_json: '{"flow":[12,1,2,3]}',
      weather_enabled: 1,
    });
    await expect(
      repository.save("apiaries", {
        user_id: "u",
        name: "Mal",
        latitude: null,
        longitude: null,
        check_interval_minutes: 15,
        weather_enabled: 2,
      }),
    ).rejects.toThrow();
    const hive = await repository.save("hives", {
      apiary_id: apiary.id,
      code: "C-01",
      queen_status: "unknown",
      health_score: null,
      last_audio_check_at: null,
    });
    await expect(
      repository.save("inspections", {
        hive_id: hive.id,
        inspected_at: "2026-11-09T10:00:00Z",
        notes: "Nota",
        tags_json: "[]",
        queen_seen: 0,
        eggs_state: "many" as never,
      }),
    ).rejects.toThrow();
    const note = await repository.save("inspections", {
      hive_id: hive.id,
      inspected_at: "2026-11-09T10:00:00Z",
      notes: "Huevos frescos vistos",
      tags_json: "[]",
      queen_seen: 0,
      queen_state: "not_seen",
      eggs_state: "fresh",
      queen_cells: "none",
      activity: "low",
      population: "down",
      stores: "medium",
    });
    expect(await repository.get("inspections", note.id)).toMatchObject({
      queen_state: "not_seen",
      eggs_state: "fresh",
      queen_cells: "none",
      activity: "low",
      population: "down",
      stores: "medium",
    });
    await expect(
      repository.save("apiaries", {
        id: apiary.id,
        user_id: "u",
        name: "Apiario renombrado",
        latitude: 1,
        longitude: 2,
        check_interval_minutes: 15,
        checkin_frequency: "hourly" as never,
      }),
    ).rejects.toThrow();
  });
});

describe("local schema v4 (reserved version)", () => {
  it("does not touch anybody's weather choice or queue anything", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(migrationV1);
    db.exec(migrationV2);
    const stamp = "2026-11-01T10:00:00.000Z";
    db.exec(`
      INSERT INTO apiaries(id,updated_at,user_id,name,latitude,longitude) VALUES ('with','${stamp}','u','Con ubicación',20.4,-89.3);
      INSERT INTO apiaries(id,updated_at,user_id,name) VALUES ('without','${stamp}','u','Sin ubicación');
    `);
    const repository = repo(db);
    await repository.initialize();
    const rows = db
      .prepare("SELECT id, weather_enabled, local_revision FROM apiaries ORDER BY id")
      .all();
    expect(rows).toEqual([
      { id: "with", weather_enabled: 0, local_revision: 0 },
      { id: "without", weather_enabled: 0, local_revision: 0 },
    ]);
    expect(db.prepare("SELECT count(*) AS n FROM sync_queue").get()).toEqual({ n: 0 });
  });
});

describe("local schema v5 (node verdicts and DevEUI)", () => {
  async function fixture() {
    const db = new DatabaseSync(":memory:");
    const repository = repo(db);
    await repository.initialize();
    const apiary = await repository.save("apiaries", {
      user_id: "u",
      name: "Apiario",
      latitude: null,
      longitude: null,
      check_interval_minutes: 15,
    });
    const hive = await repository.save("hives", {
      apiary_id: apiary.id,
      code: "C-01",
      queen_status: "unknown",
      health_score: null,
      last_audio_check_at: null,
    });
    const verdict = (extra: Record<string, unknown> = {}) => ({
      hive_id: hive.id,
      recorded_at: "2026-11-10T10:00:00.000Z",
      source: "lora" as const,
      format_version: 1,
      class_map_version: 1,
      class_code: 1,
      confidence: 0.8,
      ...extra,
    });
    return { db, repository, hive, verdict };
  }

  it("upgrades a v4 database with data and keeps it", async () => {
    const db = new DatabaseSync(":memory:");
    for (const m of [migrationV1, migrationV2, migrationV3, migrationV4]) db.exec(m);
    const stamp = "2026-11-01T10:00:00.000Z";
    db.exec(`
      INSERT INTO apiaries(id,updated_at,user_id,name) VALUES ('a1','${stamp}','u','A');
      INSERT INTO hives(id,updated_at,apiary_id,code) VALUES ('h1','${stamp}','a1','C-01');
      INSERT INTO iot_microphones(id,updated_at,hive_id,mac_address,firmware_version,battery_level,sampling_rate_hz,is_online) VALUES ('m1','${stamp}','h1','SIM-01','sim',90,16000,1);
    `);
    const repository = repo(db);
    await repository.initialize();
    expect(db.prepare("PRAGMA user_version").get()).toMatchObject({ user_version: 5 });
    expect(await repository.get("iot_microphones", "m1")).toMatchObject({
      mac_address: "SIM-01",
      dev_eui: null,
    });
    expect(await repository.list("edge_verdicts")).toEqual([]);
  });

  it("stores a verdict, keeps optional fields empty, and rejects impossible ones", async () => {
    const { repository, verdict } = await fixture();
    const saved = await repository.save("edge_verdicts", verdict());
    const row = await repository.get("edge_verdicts", saved.id);
    expect(row).toMatchObject({
      class_code: 1,
      confidence: 0.8,
      temperature_c: null,
      review: null,
      flags: 0,
    });
    await expect(repository.save("edge_verdicts", verdict({ confidence: 1.5 }))).rejects.toThrow();
    await expect(repository.save("edge_verdicts", verdict({ class_code: 300 }))).rejects.toThrow();
    await expect(repository.save("edge_verdicts", verdict({ source: "radio" as never }))).rejects.toThrow();
    await expect(repository.save("edge_verdicts", verdict({ temperature_c: 120 }))).rejects.toThrow();
    await expect(repository.save("edge_verdicts", verdict({ review: "seen" }))).rejects.toThrow();
    const reviewed = await repository.save("edge_verdicts", verdict({ review: "false_alarm", reviewed_at: "2026-11-10T11:00:00.000Z" }));
    expect(reviewed.review).toBe("false_alarm");
  });

  it("makes a retried uplink idempotent through the dedupe key, but allows many without one", async () => {
    const { repository, verdict } = await fixture();
    await repository.save("edge_verdicts", verdict({ dedupe_key: "70b3d57ed0000001:7:" }));
    await expect(
      repository.save("edge_verdicts", verdict({ dedupe_key: "70b3d57ed0000001:7:" })),
    ).rejects.toThrow();
    await repository.save("edge_verdicts", verdict());
    await repository.save("edge_verdicts", verdict());
    expect(await repository.list("edge_verdicts")).toHaveLength(3);
  });

  it("links a DevEUI to one node, and removing the hive frees it", async () => {
    const { repository, hive } = await fixture();
    const node = (code: string, dev_eui: string | null) => ({
      hive_id: hive.id,
      mac_address: code,
      firmware_version: "v1",
      battery_level: 90,
      sampling_rate_hz: 16000,
      is_online: 0,
      last_seen_at: null,
      calibration_db: 0,
      dev_eui,
    });
    await expect(repository.save("iot_microphones", node("A", "ZZZ"))).rejects.toThrow();
    await expect(repository.save("iot_microphones", node("A", "70B3D57ED0000001"))).rejects.toThrow();
    const first = await repository.save("iot_microphones", node("A", "70b3d57ed0000001"));
    await expect(repository.save("iot_microphones", node("B", "70b3d57ed0000001"))).rejects.toThrow();
    await repository.removeHive(hive.id);
    expect((await repository.get("iot_microphones", first.id))?.dev_eui).toBeNull();
  });

  it("always includes unreviewed alerts and each hive's latest verdict, whatever the date", async () => {
    const { repository, verdict } = await fixture();
    const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T10:00:00.000Z`;
    // Day 1: an old, still unreviewed alert. Day 3: an old reviewed alert.
    // Days 5-9: usual sounds. Day 8: a removed row.
    await repository.save("edge_verdicts", verdict({ recorded_at: at(1), class_code: 1 }));
    await repository.save(
      "edge_verdicts",
      verdict({ recorded_at: at(3), class_code: 1, review: "seen", reviewed_at: at(3) }),
    );
    for (const day of [5, 6, 7, 9])
      await repository.save("edge_verdicts", verdict({ recorded_at: at(day), class_code: 0 }));
    await repository.save("edge_verdicts", verdict({ recorded_at: at(8), deleted_at: at(8) }));
    const recent = await repository.recentVerdicts(at(4));
    // old unreviewed alert (day 1) + latest verdict of the hive (day 9); the old
    // reviewed alert, the older usual sounds and the removed row are left out.
    expect(recent.map((v) => v.recorded_at)).toEqual([at(9), at(1)]);
    // An earlier cut-off also brings the reviewed alert back.
    expect(await repository.recentVerdicts(at(2))).toHaveLength(3);
  });

  it("prunes only old, synced, unreviewed 'usual sound' verdicts", async () => {
    const { db, repository, verdict } = await fixture();
    const old = "2026-09-01T10:00:00.000Z";
    const keep = [
      await repository.save("edge_verdicts", verdict({ recorded_at: old, class_code: 1 })),
      await repository.save(
        "edge_verdicts",
        verdict({ recorded_at: old, class_code: 0, review: "seen", reviewed_at: old }),
      ),
      await repository.save(
        "edge_verdicts",
        verdict({ recorded_at: "2026-11-09T10:00:00.000Z", class_code: 0 }),
      ),
    ];
    const syncedOld = await repository.save("edge_verdicts", verdict({ recorded_at: old, class_code: 0 }));
    const unsyncedOld = await repository.save("edge_verdicts", verdict({ recorded_at: old, class_code: 0 }));
    db.prepare("UPDATE edge_verdicts SET synced_at = ? WHERE id = ?").run(old, syncedOld.id);
    for (const k of keep)
      db.prepare("UPDATE edge_verdicts SET synced_at = ? WHERE id = ?").run(old, k.id);
    expect(await repository.pruneVerdicts("2026-10-01T00:00:00.000Z")).toBe(1);
    const ids = (await repository.list("edge_verdicts")).map((v) => v.id);
    expect(ids).not.toContain(syncedOld.id);
    expect(ids).toContain(unsyncedOld.id);
    for (const k of keep) expect(ids).toContain(k.id);
  });

});

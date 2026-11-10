import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "./Repository";
import { migrationV1, migrationV2 } from "./schema";
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
      user_version: 3,
    });
    expect(await repository.get("apiaries", "a1")).toMatchObject({
      name: "Apiario viejo",
      latitude: 20.4,
      region_preset: null,
      seasons_json: null,
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
      user_version: 3,
    });
    const newer = new DatabaseSync(":memory:");
    newer.exec("PRAGMA user_version = 4");
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

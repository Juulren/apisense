import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "../db/Repository";
import { migrationV1 } from "../db/schema";
import type { SqlValue } from "../db/types";
import {
  cycleProgress,
  localDate,
  observeCycle,
  saveCycleStart,
  stopCycle,
} from "./BroodCycle";

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
async function hive(repository: Repository, code = "C-01") {
  const apiary = await repository.save("apiaries", {
    user_id: "owner",
    name: "A",
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
  return repository.save("hives", {
    apiary_id: apiary.id,
    code,
    queen_status: "unknown",
    health_score: null,
    last_audio_check_at: null,
  });
}
describe("Worker brood calendar", () => {
  it("computes phase boundaries, remaining days and overdue without auto-renewal", () => {
    for (const [date, day, stage] of [
      ["2026-10-18", 1, "egg"],
      ["2026-10-20", 3, "egg"],
      ["2026-10-21", 4, "larva"],
      ["2026-10-25", 8, "larva"],
      ["2026-10-26", 9, "capped"],
      ["2026-11-02", 16, "capped"],
      ["2026-11-07", 21, "emerged"],
    ] as const) {
      expect(cycleProgress("2026-10-18", date)).toMatchObject({
        day,
        stage,
        remaining: 21 - day,
        expectedOn: "2026-11-07",
      });
    }
    expect(cycleProgress("2026-10-18", "2026-12-01")).toMatchObject({
      day: 21,
      remaining: 0,
      due: true,
    });
  });
  it("uses civil dates across DST, leap days and local date boundaries", () => {
    expect(cycleProgress("2026-10-31", "2026-11-02")?.elapsed).toBe(2);
    expect(cycleProgress("2024-02-28", "2024-03-01")?.elapsed).toBe(2);
    expect(localDate(new Date(2026, 10, 2, 23, 59))).toBe("2026-11-02");
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-1-02",
      "not-a-date",
      "0000-01-01",
      "2027-01-01",
    ])
      expect(cycleProgress(bad, "2026-11-02")).toBeNull();
  });
  it("upgrades v1 without losing inspections and persists cycles in the sync queue", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(migrationV1);
    const repository = repo(db);
    const h = await hive(repository);
    const note = await repository.save("inspections", {
      hive_id: h.id,
      inspected_at: "2026-11-02T12:00:00Z",
      notes: "Observación anterior conservada",
      tags_json: "[]",
      queen_seen: 1,
    });
    await repository.initialize();
    expect(db.prepare("PRAGMA user_version").get()).toMatchObject({
      user_version: 2,
    });
    expect((await repository.get("inspections", note.id))?.notes).toBe(
      note.notes,
    );
    const cycle = await saveCycleStart(
      repository,
      h.id,
      "2026-10-18",
      " Cuadro 3 ",
      new Date("2026-11-02T12:00:00Z"),
    );
    expect(cycle.cohort_label).toBe("Cuadro 3");
    expect(cycle.state).toBe("active");
    expect(cycle.observed_stage).toBe("unknown");
    await repository.initialize();
    expect(await repository.get("brood_cycles", cycle.id)).toMatchObject({
      started_on: "2026-10-18",
      state: "active",
      observed_at: null,
    });
    expect(
      (await repository.pending(new Date("2099-01-01").toISOString())).find(
        (q) => q.record_id === cycle.id,
      )?.table_name,
    ).toBe("brood_cycles");
    // Passing day 21 calculates an estimate only; the stored state is still active.
    expect(cycleProgress(cycle.started_on, "2026-12-01")?.due).toBe(true);
    expect((await repository.get("brood_cycles", cycle.id))?.state).toBe(
      "active",
    );
    const other = await hive(repository, "C-02");
    await expect(
      saveCycleStart(
        repository,
        other.id,
        "2026-10-18",
        "wrong hive",
        new Date("2026-11-02"),
        cycle.id,
      ),
    ).rejects.toThrow("esta colmena");
    await observeCycle(
      repository,
      cycle.id,
      "capped",
      new Date("2026-11-02T13:00:00Z"),
    );
    expect((await repository.get("brood_cycles", cycle.id))?.state).toBe(
      "active",
    );
    await observeCycle(
      repository,
      cycle.id,
      "emerged",
      new Date("2026-11-07T13:00:00Z"),
    );
    expect(await repository.get("brood_cycles", cycle.id)).toMatchObject({
      state: "emerged",
      observed_stage: "emerged",
      ended_at: "2026-11-07T13:00:00.000Z",
    });
    await expect(observeCycle(repository, cycle.id, "egg")).rejects.toThrow(
      "cerrado",
    );
    await repository.close();
  });
  it("rejects invalid/future starts before writing and stops without claiming emergence", async () => {
    const repository = repo(new DatabaseSync(":memory:"));
    await repository.initialize();
    const h = await hive(repository);
    const now = new Date("2026-11-02T12:00:00Z");
    for (const date of ["2026-02-30", "2026-11-03"])
      await expect(
        saveCycleStart(repository, h.id, date, "Cuadro", now),
      ).rejects.toThrow("fecha válida");
    expect(await repository.list("brood_cycles")).toEqual([]);
    await expect(
      saveCycleStart(repository, h.id, "2026-10-20", " ", now),
    ).rejects.toThrow("Identifica");
    const cycle = await saveCycleStart(
      repository,
      h.id,
      "2026-10-20",
      "Cuadro",
      now,
    );
    await stopCycle(repository, cycle.id, now);
    expect(await repository.get("brood_cycles", cycle.id)).toMatchObject({
      state: "stopped",
      observed_stage: "unknown",
      ended_at: now.toISOString(),
    });
    expect((await repository.list("brood_cycles")).length).toBe(1);
    await repository.close();
  });
});

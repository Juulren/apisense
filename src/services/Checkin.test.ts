import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "../db/Repository";
import type { SqlValue } from "../db/types";
import { addHive, removeHive } from "./Hives";
import {
  checkinSummary,
  emptyCheckin,
  saveCheckin,
  validateCheckin,
} from "./Checkin";

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
  return repo;
}
async function hive(repo: Repository) {
  await repo.initialize();
  const apiary = await repo.save("apiaries", {
    user_id: "o",
    name: "A",
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
  return addHive(repo, apiary.id, "C-01");
}

describe("quick check-in rules", () => {
  it("accepts a short note or any chosen state, and rejects an empty one", () => {
    expect(() => validateCheckin(emptyCheckin)).toThrow("al menos 3");
    expect(() => validateCheckin({ ...emptyCheckin, notes: "  ab " })).toThrow(
      "al menos 3",
    );
    expect(validateCheckin({ ...emptyCheckin, notes: " ok! " }).notes).toBe(
      "ok!",
    );
    expect(
      validateCheckin({ ...emptyCheckin, stores: "low" }).notes,
    ).toBe("");
    expect(() =>
      validateCheckin({ ...emptyCheckin, notes: "x".repeat(5001) }),
    ).toThrow("Acorta");
    expect(
      validateCheckin({ ...emptyCheckin, notes: "ok!", tags: " a, ,b " }).labels,
    ).toEqual(["a", "b"]);
  });

  it("saves a state-only check-in without inventing a note or a queen sighting", async () => {
    const repo = setup();
    const h = await hive(repo);
    const row = await saveCheckin(
      repo,
      h.id,
      { ...emptyCheckin, activity: "low", stores: "medium", queen_state: "not_seen" },
      new Date("2026-11-09T15:00:00Z"),
    );
    expect(row).toMatchObject({
      notes: "",
      queen_seen: 0,
      activity: "low",
      stores: "medium",
      population: null,
      queen_state: "not_seen",
      inspected_at: "2026-11-09T15:00:00.000Z",
    });
    expect(checkinSummary(row)).toEqual([
      "Actividad baja",
      "Reservas medias",
      "Reina: no vista",
    ]);
  });

  it("keeps the older queen_seen flag in step with the new reina field", async () => {
    const repo = setup();
    const h = await hive(repo);
    const seen = await saveCheckin(repo, h.id, {
      ...emptyCheckin,
      queen_state: "seen",
    });
    const virgin = await saveCheckin(repo, h.id, {
      ...emptyCheckin,
      queen_state: "virgin_seen",
    });
    expect(seen.queen_seen).toBe(1);
    expect(virgin.queen_seen).toBe(0);
  });

  it("does not summarize what was not chosen and refuses removed or unknown hives", async () => {
    const repo = setup();
    const h = await hive(repo);
    const note = await saveCheckin(repo, h.id, {
      ...emptyCheckin,
      notes: "Revisé la piquera",
    });
    expect(checkinSummary(note)).toEqual([]);
    await removeHive(repo, h.id);
    await expect(
      saveCheckin(repo, h.id, { ...emptyCheckin, notes: "otra nota" }),
    ).rejects.toThrow("ya no está");
    await expect(
      saveCheckin(repo, "no-existe", { ...emptyCheckin, notes: "otra nota" }),
    ).rejects.toThrow("ya no está");
  });
});

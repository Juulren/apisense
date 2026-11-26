import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "../db/Repository";
import type { EdgeVerdict, SqlValue } from "../db/types";
import { addHive, removeHive } from "./Hives";
import {
  alertEpisodes,
  episodeCount,
  hivePending,
  reviewEpisode,
  reviewedGroups,
  timeText,
} from "./AlertEpisodes";
import { pendingAlerts } from "./EdgeVerdicts";

const at = (hhmm: string, day = 25) =>
  new Date(`2026-11-${day}T${hhmm}:00.000Z`).toISOString();
let n = 0;
const v = (hive_id: string, recorded_at: string, extra: Partial<EdgeVerdict> = {}) =>
  ({
    id: `v${++n}`,
    hive_id,
    recorded_at,
    source: "lora",
    class_map_version: 1,
    class_code: 1,
    confidence: 0.6,
    flags: 0,
    review: null,
    reviewed_at: null,
    review_note: null,
    ...extra,
  }) as EdgeVerdict;

describe("alertEpisodes", () => {
  it("makes one card of a hive's alerts less than two hours apart", () => {
    const [only, ...rest] = alertEpisodes([
      v("a", at("10:00")),
      v("a", at("10:01"), { confidence: 0.9, flags: 4 }),
      v("a", at("12:00")),
    ]);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ hive_id: "a", first: at("10:00"), last: at("12:00") });
    expect(only!.ids).toHaveLength(3);
    expect(only!.warnings).toEqual(["batería baja"]);
    expect(only!.latest.recorded_at).toBe(at("12:00"));
  });
  it("starts another after two hours without alerts, newest first, per hive", () => {
    const episodes = alertEpisodes([
      v("a", at("08:00")),
      v("a", at("10:01")),
      v("b", at("09:00")),
    ]);
    expect(episodes.map((e) => [e.hive_id, e.first])).toEqual([
      ["a", at("10:01")],
      ["b", at("09:00")],
      ["a", at("08:00")],
    ]);
  });
  it("leaves out usual sound, learning and what was already reviewed", () => {
    expect(
      alertEpisodes([
        v("a", at("10:00"), { class_code: 0 }),
        v("a", at("10:05"), { flags: 8 }),
        v("a", at("10:10"), { review: "seen" }),
      ]),
    ).toEqual([]);
  });
});

describe("hivePending", () => {
  it("adds up every pending episode of the hive", () => {
    const episodes = alertEpisodes([
      v("a", at("08:00"), { flags: 4 }),
      v("a", at("14:00")),
      v("a", at("14:05")),
      v("b", at("09:00")),
    ]);
    expect(hivePending(episodes, "a")).toMatchObject({
      count: 3,
      since: at("08:00"),
      warnings: ["batería baja"],
    });
    expect(hivePending(episodes, "a")!.latest.recorded_at).toBe(at("14:05"));
    expect(hivePending(episodes, "zz")).toBeUndefined();
  });
});

describe("texts", () => {
  it("counts in singular and plural", () => {
    expect(episodeCount(1)).toBe("1 aviso de sonido diferente");
    expect(episodeCount(20)).toBe("20 avisos de sonido diferente");
  });
  it("shows only the time for today and the date otherwise", () => {
    const now = new Date(2026, 10, 25, 23, 0);
    expect(timeText(new Date(2026, 10, 25, 22, 42).toISOString(), now)).toBe("22:42");
    expect(timeText(new Date(2026, 10, 24, 9, 5).toISOString(), now)).toBe("24/11 09:05");
  });
});

describe("reviewedGroups", () => {
  it("shows what was reviewed together as one line, latest review first", () => {
    const groups = reviewedGroups([
      v("a", at("08:00"), { review: "false_alarm", reviewed_at: at("11:00") }),
      v("a", at("08:01"), { review: "false_alarm", reviewed_at: at("11:00") }),
      v("b", at("09:00"), { review: "confirmed", reviewed_at: at("12:00"), review_note: "Hormigas" }),
    ]);
    expect(groups.map((g) => [g.hive_id, g.count, g.review, g.note])).toEqual([
      ["b", 1, "confirmed", "Hormigas"],
      ["a", 2, "false_alarm", null],
    ]);
  });
});

async function setup() {
  const db = new DatabaseSync(":memory:");
  let transactions = 0;
  const repo = new Repository(
    {
      exec: async (sql) => {
        if (sql.startsWith("COMMIT")) transactions++;
        db.exec(sql);
      },
      run: async (sql, params = []) => ({
        changes: Number(db.prepare(sql).run(...params).changes),
      }),
      all: async <T>(sql: string, params: SqlValue[] = []) =>
        db.prepare(sql).all(...params) as T[],
      close: async () => db.close(),
    },
    randomUUID,
  );
  await repo.initialize();
  const apiary = await repo.save("apiaries", {
    user_id: "o",
    name: "Apiario",
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
  const hive = await addHive(repo, apiary.id, "C-01");
  const verdict = (recorded_at: string) =>
    repo.save("edge_verdicts", {
      hive_id: hive.id,
      recorded_at,
      source: "lora",
      format_version: 1,
      class_map_version: 1,
      class_code: 1,
      confidence: 0.8,
    });
  return { repo, hive, verdict, commits: () => transactions };
}

describe("reviewEpisode", () => {
  const NOW = new Date(at("13:00"));
  it("saves the whole episode in one transaction and queues each row", async () => {
    const { repo, verdict, commits } = await setup();
    const a = await verdict(at("10:00"));
    const b = await verdict(at("10:01"));
    const later = await verdict(at("10:02"));
    const before = commits();
    expect(await reviewEpisode(repo, [a.id, b.id], "false_alarm", "  Lluvia ", NOW)).toBe(2);
    expect(commits()).toBe(before + 1);
    for (const id of [a.id, b.id])
      expect(await repo.get("edge_verdicts", id)).toMatchObject({
        review: "false_alarm",
        reviewed_at: NOW.toISOString(),
        review_note: "Lluvia",
        synced_at: null,
        local_revision: 2,
      });
    // An alert that arrived after the card was shown stays to be reviewed.
    const rows = await repo.list("edge_verdicts");
    expect(pendingAlerts(rows).map((r) => r.id)).toEqual([later.id]);
    const queued = await repo.pending(new Date(Date.now() + 60_000).toISOString());
    expect(queued.filter((q) => q.table_name === "edge_verdicts")).toHaveLength(3);
  });
  it("never overwrites a review that is already there", async () => {
    const { repo, verdict } = await setup();
    const a = await verdict(at("10:00"));
    const b = await verdict(at("10:01"));
    await reviewEpisode(repo, [a.id], "false_alarm", "Otro teléfono", NOW);
    expect(await reviewEpisode(repo, [a.id, b.id], "confirmed", "", NOW)).toBe(1);
    expect(await repo.get("edge_verdicts", a.id)).toMatchObject({
      review: "false_alarm",
      review_note: "Otro teléfono",
    });
    await expect(reviewEpisode(repo, [a.id, b.id], "confirmed")).rejects.toThrow("ya se revisó");
  });
  it("rejects a long note, nothing to review and a removed hive", async () => {
    const { repo, hive, verdict } = await setup();
    const a = await verdict(at("10:00"));
    await expect(reviewEpisode(repo, [a.id], "confirmed", "x".repeat(501))).rejects.toThrow("máximo 500");
    await expect(reviewEpisode(repo, ["nope"], "confirmed")).rejects.toThrow("ya no está");
    await removeHive(repo, hive.id);
    await expect(reviewEpisode(repo, [a.id], "confirmed")).rejects.toThrow("ya no está");
  });
});

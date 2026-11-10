import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "../db/Repository";
import type { SqlValue } from "../db/types";
import {
  parseLocation,
  saveApiaryProfile,
  type ApiaryProfile,
} from "./Apiaries";
import { calendarFor, yucatanCalendar, type Calendar } from "./Seasons";

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
const profile = (extra: Partial<ApiaryProfile> = {}): ApiaryProfile => ({
  name: "Apiario Flor",
  lat: "20.97",
  lon: "-89.62",
  checkin_frequency: "weekly",
  weather_enabled: false,
  region_preset: null,
  calendar: null,
  ...extra,
});
async function apiary(repo: Repository) {
  await repo.initialize();
  return repo.save("apiaries", {
    user_id: "owner",
    name: "Inicial",
    latitude: null,
    longitude: null,
    check_interval_minutes: 45,
  });
}

describe("location parsing", () => {
  it("accepts both coordinates or none, with comma decimals", () => {
    expect(parseLocation("", " ")).toEqual({ latitude: null, longitude: null });
    expect(parseLocation("20,97", "-89.62")).toEqual({
      latitude: 20.97,
      longitude: -89.62,
    });
  });
  it("rejects half, out-of-range and non-numeric values", () => {
    for (const [a, b] of [
      ["20", ""],
      ["", "-89"],
      ["91", "0"],
      ["0", "-181"],
      ["abc", "1"],
      ["Infinity", "1"],
    ])
      expect(() => parseLocation(a as string, b as string)).toThrow(
        "latitud y longitud",
      );
  });
});

describe("apiary profile", () => {
  it("saves name, location, frequency and weather, keeping the analysis interval", async () => {
    const repo = setup();
    const a = await apiary(repo);
    const saved = await saveApiaryProfile(
      repo,
      a.id,
      profile({ weather_enabled: true, checkin_frequency: "daily" }),
    );
    expect(saved).toMatchObject({
      name: "Apiario Flor",
      latitude: 20.97,
      longitude: -89.62,
      weather_enabled: 1,
      checkin_frequency: "daily",
      check_interval_minutes: 45,
      region_preset: null,
      seasons_json: null,
    });
  });
  it("validates the name and requires a location for weather", async () => {
    const repo = setup();
    const a = await apiary(repo);
    await expect(
      saveApiaryProfile(repo, a.id, profile({ name: " ab " })),
    ).rejects.toThrow("al menos 3");
    await expect(
      saveApiaryProfile(repo, a.id, profile({ name: "x".repeat(81) })),
    ).rejects.toThrow("máximo 80");
    await expect(
      saveApiaryProfile(
        repo,
        a.id,
        profile({ lat: "", lon: "", weather_enabled: true }),
      ),
    ).rejects.toThrow("indica la ubicación");
    expect((await repo.get("apiaries", a.id))?.name).toBe("Inicial");
  });
  it("stores the Yucatán calendar as a preset and an edited one in full", async () => {
    const repo = setup();
    const a = await apiary(repo);
    const preset = await saveApiaryProfile(
      repo,
      a.id,
      profile({ region_preset: "yucatan", calendar: yucatanCalendar }),
    );
    expect(preset).toMatchObject({ region_preset: "yucatan", seasons_json: null });
    expect(calendarFor(preset).source).toBe("regional");
    const edited: Calendar = yucatanCalendar.map((m, i) =>
      i === 4 && m ? { ...m, phase: "hard" as const } : m,
    );
    const custom = await saveApiaryProfile(
      repo,
      a.id,
      profile({ region_preset: "yucatan", calendar: edited }),
    );
    expect(custom.seasons_json).not.toBeNull();
    const resolved = calendarFor(custom);
    expect(resolved.source).toBe("custom");
    expect(resolved.calendar?.[4]?.phase).toBe("hard");
  });
  it("treats a custom preset with no months as no calendar", async () => {
    const repo = setup();
    const a = await apiary(repo);
    const saved = await saveApiaryProfile(
      repo,
      a.id,
      profile({
        region_preset: "custom",
        calendar: Array.from({ length: 12 }, () => null),
      }),
    );
    expect(saved.seasons_json).toBeNull();
    expect(calendarFor(saved).source).toBe("none");
  });
  it("refuses a removed or unknown apiary", async () => {
    const repo = setup();
    const a = await apiary(repo);
    await repo.save("apiaries", {
      id: a.id,
      user_id: "owner",
      name: "Inicial",
      latitude: null,
      longitude: null,
      check_interval_minutes: 45,
      deleted_at: "2026-11-09T00:00:00.000Z",
    });
    await expect(saveApiaryProfile(repo, a.id, profile())).rejects.toThrow(
      "ya no está",
    );
    await expect(saveApiaryProfile(repo, "nope", profile())).rejects.toThrow(
      "ya no está",
    );
  });
});

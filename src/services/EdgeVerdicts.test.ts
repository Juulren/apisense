import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Repository } from "../db/Repository";
import type { EdgeVerdict, SqlValue } from "../db/types";
import { addHive, removeHive } from "./Hives";
import {
  isAlert,
  latestVerdict,
  linkLoraNode,
  nodeWarnings,
  normalizeDevEui,
  pendingAlerts,
  reviewVerdict,
  simulateVerdict,
  verdictSince,
  verdictSummary,
} from "./EdgeVerdicts";

const NOW = new Date("2026-11-10T12:00:00.000Z");
async function setup() {
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
  await repo.initialize();
  const apiary = await repo.save("apiaries", {
    user_id: "o",
    name: "Apiario",
    latitude: null,
    longitude: null,
    check_interval_minutes: 15,
  });
  const hive = await addHive(repo, apiary.id, "C-01");
  const other = await addHive(repo, apiary.id, "C-02");
  const verdict = (hive_id: string, extra: Partial<EdgeVerdict> = {}) =>
    repo.save("edge_verdicts", {
      hive_id,
      recorded_at: NOW.toISOString(),
      source: "lora",
      format_version: 1,
      class_map_version: 1,
      class_code: 1,
      confidence: 0.8,
      ...extra,
    });
  return { repo, hive, other, verdict };
}

describe("DevEUI", () => {
  it("normalises pasted forms and rejects anything else", () => {
    expect(normalizeDevEui("70B3D57ED0000001")).toBe("70b3d57ed0000001");
    expect(normalizeDevEui(" 70:B3:D5:7E:D0:00:00:01 ")).toBe("70b3d57ed0000001");
    expect(normalizeDevEui("70-b3-d5-7e-d0-00-00-01")).toBe("70b3d57ed0000001");
    for (const bad of ["", "123", "70B3D57ED000000Z", "70B3D57ED00000011"])
      expect(() => normalizeDevEui(bad)).toThrow("16 caracteres");
  });
});

describe("what the app says about a verdict", () => {
  it("states only what the node reported, never a cause", async () => {
    const { verdict, hive } = await setup();
    const different = (await verdict(hive.id, {
      temperature_c: 27.4,
      battery_v: 3.86,
    })) as EdgeVerdict;
    const text = verdictSummary(
      {
        ...different,
        flags: 0,
        temperature_c: 27.4,
        battery_v: 3.86,
        recorded_at: "2026-11-10T11:48:00.000Z",
      },
      NOW,
    );
    expect(text).toBe(
      "Sonido diferente al habitual · confianza 80 % · 27,4 °C · batería 3,86 V · hace 12 min",
    );
    expect(text).not.toMatch(/reina|plaga|enjambr|ataque/i);
  });
  it("lists node warnings from the flags and recognises alerts", () => {
    expect(nodeWarnings({ flags: 0 } as EdgeVerdict)).toEqual([]);
    expect(nodeWarnings({ flags: 7 } as EdgeVerdict)).toEqual([
      "tarjeta SD llena",
      "falla del micrófono",
      "batería baja",
    ]);
    expect(isAlert({ class_code: 0 })).toBe(false);
    expect(isAlert({ class_code: 1 })).toBe(true);
    expect(isAlert({ class_code: 9 })).toBe(true);
  });
  it("keeps only unreviewed alerts, newest first, and finds the latest per hive", async () => {
    const { repo, verdict, hive, other } = await setup();
    const at = (h: number) => `2026-11-10T${String(h).padStart(2, "0")}:00:00.000Z`;
    await verdict(hive.id, { recorded_at: at(8) });
    await verdict(hive.id, { recorded_at: at(10), class_code: 0 });
    await verdict(other.id, { recorded_at: at(9) });
    await verdict(hive.id, {
      recorded_at: at(11),
      review: "seen",
      reviewed_at: at(11),
    });
    const all = await repo.recentVerdicts("2026-11-01T00:00:00.000Z");
    expect(pendingAlerts(all).map((v) => v.recorded_at)).toEqual([at(9), at(8)]);
    expect(latestVerdict(all, hive.id)?.recorded_at).toBe(at(11));
    expect(latestVerdict(all, "nope")).toBeUndefined();
    expect(verdictSince(NOW)).toBe("2026-10-27T12:00:00.000Z");
  });
});

describe("reviewing an alert", () => {
  it("records the decision with its time and a trimmed note, and allows changing it", async () => {
    const { repo, verdict, hive } = await setup();
    const v = await verdict(hive.id);
    const seen = await reviewVerdict(repo, v.id, "seen", "", NOW);
    expect(seen).toMatchObject({
      review: "seen",
      reviewed_at: NOW.toISOString(),
      review_note: null,
    });
    const later = new Date(NOW.getTime() + 3_600_000);
    const done = await reviewVerdict(repo, v.id, "false_alarm", "  Era la lluvia  ", later);
    expect(done).toMatchObject({
      review: "false_alarm",
      reviewed_at: later.toISOString(),
      review_note: "Era la lluvia",
    });
    expect((await repo.get("edge_verdicts", v.id))?.review).toBe("false_alarm");
  });
  it("rejects a long note, unknown alerts and removed hives", async () => {
    const { repo, verdict, hive } = await setup();
    const v = await verdict(hive.id);
    await expect(reviewVerdict(repo, v.id, "seen", "x".repeat(501))).rejects.toThrow("máximo 500");
    await expect(reviewVerdict(repo, "nope", "seen")).rejects.toThrow("ya no está");
    await removeHive(repo, hive.id);
    await expect(reviewVerdict(repo, v.id, "confirmed")).rejects.toThrow("ya no está");
  });
});

describe("linking a LoRaWAN node", () => {
  it("registers a node when the hive has none, and updates the existing one otherwise", async () => {
    const { repo, hive } = await setup();
    const created = await linkLoraNode(repo, hive.id, "70:B3:D5:7E:D0:00:00:01");
    expect(created).toMatchObject({
      dev_eui: "70b3d57ed0000001",
      firmware_version: "lorawan",
      mac_address: "LORA-000001",
      hive_id: hive.id,
    });
    const again = await linkLoraNode(repo, hive.id, "70b3d57ed0000009");
    expect(again.id).toBe(created.id);
    expect(again.dev_eui).toBe("70b3d57ed0000009");
    expect(await repo.list("iot_microphones")).toHaveLength(1);
  });
  it("refuses a DevEUI used by another hive and a removed hive, and frees it on removal", async () => {
    const { repo, hive, other } = await setup();
    await linkLoraNode(repo, hive.id, "70b3d57ed0000001");
    await expect(linkLoraNode(repo, other.id, "70b3d57ed0000001")).rejects.toThrow("otra colmena");
    await removeHive(repo, hive.id);
    const reused = await linkLoraNode(repo, other.id, "70b3d57ed0000001");
    expect(reused.hive_id).toBe(other.id);
    await removeHive(repo, other.id);
    await expect(linkLoraNode(repo, other.id, "70b3d57ed0000002")).rejects.toThrow("ya no está");
  });
});

describe("proving ownership of a node", () => {
  it("asks the server before linking, and links nothing if the proof fails", async () => {
    const { repo, hive } = await setup();
    const seen: string[] = [];
    await expect(
      linkLoraNode(repo, hive.id, "70:B3:D5:7E:D0:00:00:01", async (eui) => {
        seen.push(eui);
        throw new Error("código incorrecto");
      }),
    ).rejects.toThrow("código incorrecto");
    expect(seen).toEqual(["70b3d57ed0000001"]);
    expect(await repo.list("iot_microphones")).toHaveLength(0);
    await linkLoraNode(repo, hive.id, "70b3d57ed0000001", async () => {});
    expect((await repo.list("iot_microphones"))[0]?.dev_eui).toBe("70b3d57ed0000001");
  });
  it("does not even ask the server for a malformed DevEUI or a removed hive", async () => {
    const { repo, hive } = await setup();
    let asked = 0;
    const claim = async () => {
      asked++;
    };
    await expect(linkLoraNode(repo, hive.id, "123", claim)).rejects.toThrow("16 caracteres");
    await removeHive(repo, hive.id);
    await expect(linkLoraNode(repo, hive.id, "70b3d57ed0000001", claim)).rejects.toThrow("ya no está");
    expect(asked).toBe(0);
  });
});

describe("demo simulation", () => {
  it("goes through the same payload round trip and is labelled as simulated", async () => {
    const { repo, hive } = await setup();
    const usual = await simulateVerdict(repo, hive.id, "usual", NOW);
    const different = await simulateVerdict(repo, hive.id, "different", NOW);
    expect(usual).toMatchObject({ source: "simulator", class_code: 0, confidence: 0.929 });
    expect(different).toMatchObject({ source: "simulator", class_code: 1, temperature_c: 27.4, battery_v: 3.86 });
    await removeHive(repo, hive.id);
    await expect(simulateVerdict(repo, hive.id, "usual")).rejects.toThrow("ya no está");
  });
});

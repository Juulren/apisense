import { describe, expect, it } from "vitest";
import type { EdgeVerdict, Hive, Microphone } from "../db/types";
import {
  SILENT_AFTER_MS,
  dayLabel,
  nodeHiveStatus,
  nodeState,
  silentHives,
  silentText,
  timelineSummary,
  verdictDays,
  type DayStat,
} from "./NodeStatus";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const H = 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
let n = 0;
const verdict = (extra: Partial<EdgeVerdict> = {}): EdgeVerdict =>
  ({
    id: `v${n++}`,
    hive_id: "h1",
    recorded_at: ago(H),
    source: "lora",
    class_code: 0,
    confidence: 0.9,
    flags: 0,
    review: null,
    ...extra,
  }) as EdgeVerdict;
const mic = (updatedAgo: number) =>
  ({ dev_eui: "70b3d57ed0000001", updated_at: ago(updatedAgo) }) as Microphone;
const fresh = new Date(NOW.getTime() - H);

describe("node state", () => {
  it("is none without a node with a DevEUI, even if old messages exist", () => {
    expect(nodeState(undefined, [], "h1", NOW)).toEqual({ kind: "none" });
    expect(
      nodeState({ dev_eui: null, updated_at: ago(0) } as Microphone, [verdict()], "h1", NOW),
    ).toEqual({ kind: "none" });
  });
  it("waits for the first message of a freshly linked node, then flags silence", () => {
    expect(nodeState(mic(H), [], "h1", NOW)).toEqual({ kind: "waiting" });
    expect(nodeState(mic(SILENT_AFTER_MS + 1), [], "h1", NOW)).toEqual({
      kind: "silent",
      lastAt: null,
      hours: null,
    });
  });
  it("is ok within three hours and silent beyond, using the newest message", () => {
    const recent = verdict({ recorded_at: ago(2 * H) });
    const old = verdict({ recorded_at: ago(30 * H) });
    expect(nodeState(mic(99 * H), [old, recent], "h1", NOW).kind).toBe("ok");
    expect(nodeState(mic(99 * H), [old], "h1", NOW)).toEqual({
      kind: "silent",
      lastAt: old.recorded_at,
      hours: 30,
    });
  });
  it("counts only LoRa messages: not the demo simulator, Bluetooth or MQTT", () => {
    const m = mic(99 * H);
    for (const source of ["simulator", "ble", "mqtt"] as const) {
      expect(
        nodeState(m, [verdict({ source, recorded_at: ago(H) })], "h1", NOW).kind,
      ).toBe("silent");
    }
    expect(nodeState(m, [verdict({ hive_id: "h2" })], "h1", NOW).kind).toBe("silent");
  });
  it("does not accuse the node when this phone has not synced for hours", () => {
    const old = verdict({ recorded_at: ago(10 * H) });
    const stale = new Date(NOW.getTime() - 9 * H);
    expect(nodeState(mic(99 * H), [old], "h1", NOW, stale).kind).toBe("stale");
    expect(nodeState(mic(99 * H), [old], "h1", NOW, null).kind).toBe("stale");
    expect(nodeState(mic(99 * H), [old], "h1", NOW, "unknown").kind).toBe("stale");
    expect(nodeState(mic(99 * H), [old], "h1", NOW, fresh).kind).toBe("silent");
    // A recent message is "ok" whatever the sync state.
    expect(
      nodeState(mic(99 * H), [verdict({ recorded_at: ago(H) })], "h1", NOW, null).kind,
    ).toBe("ok");
  });
  it("words the silence without a cause", () => {
    expect(silentText({ kind: "silent", lastAt: null, hours: null })).toContain("aún no");
    expect(silentText({ kind: "silent", lastAt: "x", hours: 5 })).toBe(
      "Sin mensajes del nodo desde hace 5 h",
    );
    expect(silentText({ kind: "silent", lastAt: "x", hours: 72 })).toContain("3 días");
    expect(silentText({ kind: "silent", lastAt: "x", hours: 5 })).not.toMatch(/bater|reina|plaga/i);
  });
  it("lists only the hives whose node went quiet", () => {
    const hives = [{ id: "h1" }, { id: "h2" }, { id: "h3" }] as Hive[];
    const mics = [
      { hive_id: "h1", dev_eui: "a", updated_at: ago(99 * H) },
      { hive_id: "h2", dev_eui: "b", updated_at: ago(99 * H) },
    ] as Microphone[];
    const verdicts = [
      verdict({ hive_id: "h1", recorded_at: ago(H) }),
      verdict({ hive_id: "h2", recorded_at: ago(10 * H) }),
    ];
    expect(silentHives(hives, mics, verdicts, NOW, fresh).map((h) => h.id)).toEqual(["h2"]);
    expect(silentHives(hives, mics, verdicts, NOW, null)).toEqual([]);
  });
});

describe("verdict timeline", () => {
  const stats: DayStat[] = [
    { hive_id: "h1", day: "2026-11-20", total: 40, different: 0 },
    { hive_id: "h1", day: "2026-11-19", total: 96, different: 3 },
    { hive_id: "h1", day: "2026-11-18", total: 96, different: 0 },
    { hive_id: "h2", day: "2026-11-17", total: 5, different: 5 },
  ];
  it("builds one cell per day from the counts, oldest first, however many messages there were", () => {
    const days = verdictDays(stats, [], "h1", NOW, 14, 0);
    expect(days).toHaveLength(14);
    expect(days[13]).toMatchObject({ key: "2026-11-20", status: "usual", count: 40 });
    expect(days[12]).toMatchObject({ key: "2026-11-19", status: "different", count: 96, different: 3 });
    expect(days[11]).toMatchObject({ key: "2026-11-18", status: "usual", count: 96 });
    expect(days[10]).toMatchObject({ key: "2026-11-17", status: "none", count: 0 }); // other hive's data
    expect(days[0]).toMatchObject({ key: "2026-11-07", status: "none" });
  });
  it("lists a day's loaded messages newest first and only LoRa ones", () => {
    const a = verdict({ recorded_at: "2026-11-20T01:00:00.000Z", class_code: 1 });
    const b = verdict({ recorded_at: "2026-11-20T05:00:00.000Z", class_code: 1 });
    const fake = verdict({ recorded_at: "2026-11-20T06:00:00.000Z", source: "simulator", class_code: 1 });
    const day = verdictDays(stats, [a, b, fake], "h1", NOW, 1, 0)[0]!;
    expect(day.verdicts.map((v) => v.id)).toEqual([b.id, a.id]);
  });
  it("buckets the loaded messages in local time", () => {
    const a = verdict({ recorded_at: "2026-11-20T01:00:00.000Z" });
    // Mérida is UTC-6: 01:00Z on the 20th is still the 19th there.
    const merida = verdictDays([], [a], "h1", NOW, 2, -360);
    expect(merida[0]).toMatchObject({ key: "2026-11-19" });
    expect(merida[0]!.verdicts.map((v) => v.id)).toEqual([a.id]);
  });
  it("summarises the strip and formats day labels", () => {
    const days = verdictDays(stats, [], "h1", NOW, 3, 0);
    expect(timelineSummary(days)).toBe("1 día con sonido diferente · 0 sin datos");
    expect(timelineSummary(verdictDays([], [], "h1", NOW, 3, 0))).toBe(
      "0 días con sonido diferente · 3 sin datos",
    );
    expect(dayLabel("2026-11-09")).toBe("9/11");
  });
});

describe("what a hive's tile says because of its node", () => {
  const ok = { kind: "ok", lastAt: ago(H) } as const;
  const silent = { kind: "silent", lastAt: ago(5 * H), hours: 5 } as const;
  const status = (v: EdgeVerdict[], node: Parameters<typeof nodeHiveStatus>[2]) =>
    nodeHiveStatus(v, "h1", node, NOW);

  it("shows the node's usual sound and counts it as stable", () => {
    expect(status([verdict()], ok)).toMatchObject({ label: "Sonido habitual", tone: "green", stable: true });
  });
  it("puts an unreviewed alert first, even with a newer usual message or a silent node", () => {
    const old = verdict({ class_code: 1, recorded_at: ago(9 * H) });
    for (const node of [ok, silent]) {
      expect(status([verdict(), old], node)).toMatchObject({ label: "Por revisar", tone: "amber", stable: false });
    }
  });
  it("does not call a reviewed alert stable, nor paint it green", () => {
    expect(status([verdict({ class_code: 1, review: "seen" })], ok)).toMatchObject({ label: "Revisada", tone: "neutral", stable: false });
  });
  it("never reads a learning node as a usual sound", () => {
    expect(status([verdict({ flags: 8 })], ok)).toMatchObject({ label: "Aún no juzga", tone: "neutral", stable: false });
  });
  it("says when the node went quiet or this phone cannot tell, instead of the last usual sound", () => {
    expect(status([verdict()], silent)).toMatchObject({ label: "Sin reportar", tone: "amber", stable: false });
    expect(status([verdict()], { kind: "stale" })).toMatchObject({ label: "Sin sincronizar", tone: "neutral", stable: false });
  });
  it("does not let an old message speak for a hive without a linked node", () => {
    expect(status([verdict({ recorded_at: ago(30 * 24 * H) })], { kind: "none" })).toBeNull();
    expect(status([verdict()], { kind: "none" })).toMatchObject({ label: "Sonido habitual" });
  });
  it("waits for a linked node's first message", () => {
    expect(status([], { kind: "waiting" })).toMatchObject({ label: "Nodo vinculado", stable: false });
  });
  it("says nothing for a hive without a node or messages", () => {
    expect(status([], { kind: "none" })).toBeNull();
    // Another hive's alert is not this hive's.
    expect(status([verdict({ hive_id: "h2", class_code: 1 })], { kind: "none" })).toBeNull();
  });
});

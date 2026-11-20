import type { EdgeVerdict, Hive, Microphone } from "../db/types";
import { isAlert, verdictSummary } from "./EdgeVerdicts";

// The node reports every 10-15 minutes. Three hours of silence is long enough
// to be a real gap and short enough to act on during the same day.
export const SILENT_AFTER_MS = 3 * 3_600_000;
const HOUR = 3_600_000;

export type NodeState =
  | { kind: "none" }
  | { kind: "waiting" }
  | { kind: "ok"; lastAt: string }
  | { kind: "silent"; lastAt: string | null; hours: number | null }
  // This phone has not synced lately, so it cannot tell whether the node is quiet.
  | { kind: "stale" };

/** Real LoRa node messages only: the demo simulator and Bluetooth/MQTT are not the node's radio. */
const fromNode = (v: EdgeVerdict) => v.source === "lora";

/**
 * What the app knows about a hive's node. Never says why a node is silent.
 * `dataAsOf` is when this phone last synced; if that is older than the silence
 * threshold the answer is "stale", not "silent" (the server may have fresh messages).
 */
export function nodeState(
  mic: Pick<Microphone, "dev_eui" | "updated_at"> | undefined,
  verdicts: EdgeVerdict[],
  hiveId: string,
  now = new Date(),
  dataAsOf?: Date | null | "unknown",
): NodeState {
  if (!mic?.dev_eui) return { kind: "none" };
  const own = verdicts.filter((v) => v.hive_id === hiveId && fromNode(v));
  const last = own.reduce<EdgeVerdict | undefined>(
    (best, v) =>
      !best || v.recorded_at.localeCompare(best.recorded_at) > 0 ? v : best,
    undefined,
  );
  const gap = last
    ? now.getTime() - Date.parse(last.recorded_at)
    : now.getTime() - Date.parse(mic.updated_at);
  if (gap <= SILENT_AFTER_MS)
    return last ? { kind: "ok", lastAt: last.recorded_at } : { kind: "waiting" };
  if (
    dataAsOf !== undefined &&
    (dataAsOf === "unknown" ||
      dataAsOf === null ||
      now.getTime() - dataAsOf.getTime() > SILENT_AFTER_MS)
  )
    return { kind: "stale" };
  return last
    ? {
        kind: "silent",
        lastAt: last.recorded_at,
        hours: Math.max(1, Math.round(gap / HOUR)),
      }
    : { kind: "silent", lastAt: null, hours: null };
}

export function silentText(state: Extract<NodeState, { kind: "silent" }>) {
  if (state.hours === null) return "El nodo aún no ha enviado ningún mensaje";
  return state.hours >= 48
    ? `Sin mensajes del nodo desde hace ${Math.round(state.hours / 24)} días`
    : `Sin mensajes del nodo desde hace ${state.hours} h`;
}
export const staleText =
  "Este teléfono no ha sincronizado en las últimas horas: no se puede saber si el nodo reporta.";

/** Hives whose node has stopped reporting. */
export function silentHives(
  hives: Hive[],
  microphones: Microphone[],
  verdicts: EdgeVerdict[],
  now = new Date(),
  dataAsOf?: Date | null | "unknown",
) {
  return hives.filter(
    (h) =>
      nodeState(
        microphones.find((m) => m.hive_id === h.id),
        verdicts,
        h.id,
        now,
        dataAsOf,
      ).kind === "silent",
  );
}

/** Per hive and local day, how many node messages there were (from SQL, not from loaded rows). */
export interface DayStat {
  hive_id: string;
  day: string; // YYYY-MM-DD in the beekeeper's local time
  total: number;
  different: number;
}
export type DayStatus = "none" | "usual" | "different";
export interface VerdictDay {
  key: string;
  status: DayStatus;
  count: number;
  different: number;
  /** Messages the app has loaded for that day (all alerts and the latest message), newest first. */
  verdicts: EdgeVerdict[];
}

const dayKey = (iso: string, tzMinutes: number) =>
  new Date(Date.parse(iso) + tzMinutes * 60_000).toISOString().slice(0, 10);

/**
 * One cell per day, oldest first. Counts come from `stats` (every message, however
 * many there are); `verdicts` only supplies the lines shown when a day is opened.
 * `tzMinutes` is the offset from UTC (default: this device).
 */
export function verdictDays(
  stats: DayStat[],
  verdicts: EdgeVerdict[],
  hiveId: string,
  now = new Date(),
  days = 14,
  tzMinutes = -now.getTimezoneOffset(),
): VerdictDay[] {
  const own = verdicts
    .filter((v) => v.hive_id === hiveId && fromNode(v))
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
  const out: VerdictDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = dayKey(
      new Date(now.getTime() - i * 86_400_000).toISOString(),
      tzMinutes,
    );
    const stat = stats.find((s) => s.hive_id === hiveId && s.day === key);
    const count = stat?.total ?? 0;
    const different = stat?.different ?? 0;
    out.push({
      key,
      count,
      different,
      verdicts: own.filter((v) => dayKey(v.recorded_at, tzMinutes) === key),
      status: !count ? "none" : different ? "different" : "usual",
    });
  }
  return out;
}

export function timelineSummary(days: VerdictDay[]) {
  const different = days.filter((d) => d.status === "different").length;
  const none = days.filter((d) => d.status === "none").length;
  return `${different} ${different === 1 ? "día" : "días"} con sonido diferente · ${none} sin datos`;
}

export const dayLabel = (key: string) => {
  const [, m, d] = key.split("-");
  return `${Number(d)}/${Number(m)}`;
};

export { isAlert, verdictSummary };

import type { Repository } from "../db/Repository";
import type { EdgeVerdict, VerdictReview } from "../db/types";
import {
  decodeEdgePayload,
  edgeClassLabel,
  encodeEdgePayload,
} from "../../supabase/functions/_shared/edgePayload";

// The node's classifier says "usual" (code 0) or something else. The app shows
// what the node said, with its confidence, and asks the beekeeper to look: it
// never states why a sound is different.
export const reviewLabels: Record<VerdictReview, string> = {
  seen: "Vista",
  false_alarm: "Falsa alarma",
  confirmed: "Confirmada tras inspección",
};
export const MAX_REVIEW_NOTE = 500;
export const VERDICT_WINDOW_DAYS = 14;
const DAY = 86_400_000;

export const isAlert = (v: Pick<EdgeVerdict, "class_code">) =>
  v.class_code !== 0;
export const verdictLabel = (v: EdgeVerdict) =>
  edgeClassLabel(v.class_map_version, v.class_code);
export const verdictSince = (now = new Date()) =>
  new Date(now.getTime() - VERDICT_WINDOW_DAYS * DAY).toISOString();

const newest = (a: EdgeVerdict, b: EdgeVerdict) =>
  b.recorded_at.localeCompare(a.recorded_at) || b.id.localeCompare(a.id);
/** Alerts nobody has looked at yet, newest first. */
export const pendingAlerts = (verdicts: EdgeVerdict[]) =>
  verdicts.filter((v) => isAlert(v) && v.review === null).sort(newest);
export const latestVerdict = (verdicts: EdgeVerdict[], hiveId: string) =>
  verdicts.filter((v) => v.hive_id === hiveId).sort(newest)[0];

export function ageText(iso: string, now = new Date()) {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(iso)) / 60_000),
  );
  if (minutes < 2) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} días`;
}
/** One line for a hive or an alert; only facts the node reported. */
export function verdictSummary(v: EdgeVerdict, now = new Date()) {
  const parts = [
    verdictLabel(v),
    `confianza ${Math.round(v.confidence * 100)} %`,
  ];
  if (v.temperature_c !== null)
    parts.push(`${v.temperature_c.toFixed(1).replace(".", ",")} °C`);
  if (v.battery_v !== null)
    parts.push(`batería ${v.battery_v.toFixed(2).replace(".", ",")} V`);
  parts.push(ageText(v.recorded_at, now));
  return parts.join(" · ");
}
export function nodeWarnings(v: EdgeVerdict) {
  const warnings: string[] = [];
  if (v.flags & 1) warnings.push("tarjeta SD llena");
  if (v.flags & 2) warnings.push("falla del micrófono");
  if (v.flags & 4) warnings.push("batería baja");
  return warnings;
}

export async function reviewVerdict(
  repo: Repository,
  verdictId: string,
  review: VerdictReview,
  note = "",
  now = new Date(),
) {
  const trimmed = note.trim();
  if (trimmed.length > MAX_REVIEW_NOTE)
    throw new Error(`Usa máximo ${MAX_REVIEW_NOTE} caracteres en la nota`);
  const verdict = await repo.get("edge_verdicts", verdictId);
  if (!verdict || verdict.deleted_at)
    throw new Error("La alerta ya no está disponible");
  const hive = await repo.get("hives", verdict.hive_id);
  if (!hive || hive.deleted_at)
    throw new Error("La colmena ya no está disponible");
  return repo.save("edge_verdicts", {
    ...verdict,
    review,
    reviewed_at: now.toISOString(),
    review_note: trimmed || null,
  });
}

/** Normalises what a person types or pastes: "70:B3-D5 7E…" -> 16 lowercase hex. */
export function normalizeDevEui(input: string) {
  const value = input.replace(/[\s:-]/g, "").toLowerCase();
  if (!/^[0-9a-f]{16}$/.test(value))
    throw new Error("El DevEUI son 16 caracteres hexadecimales (0-9, A-F)");
  return value;
}

/**
 * Links a LoRaWAN node to a hive (the server maps uplinks by DevEUI). Reuses the
 * hive's microphone if it has one; otherwise registers a LoRaWAN node.
 */
export async function linkLoraNode(
  repo: Repository,
  hiveId: string,
  rawDevEui: string,
  /** Real accounts prove ownership on the server first; the demo has none. */
  claim?: (devEui: string) => Promise<void>,
) {
  const devEui = normalizeDevEui(rawDevEui);
  const hive = await repo.get("hives", hiveId);
  if (!hive || hive.deleted_at)
    throw new Error("La colmena ya no está disponible");
  const mics = await repo.list("iot_microphones");
  const taken = mics.find((m) => m.dev_eui === devEui && m.hive_id !== hiveId);
  if (taken) throw new Error("Ese DevEUI ya está vinculado a otra colmena");
  await claim?.(devEui);
  const own = mics.find((m) => m.hive_id === hiveId);
  if (own)
    return repo.save("iot_microphones", {
      id: own.id,
      hive_id: own.hive_id,
      mac_address: own.mac_address,
      firmware_version: own.firmware_version,
      battery_level: own.battery_level,
      sampling_rate_hz: own.sampling_rate_hz,
      is_online: own.is_online,
      last_seen_at: own.last_seen_at,
      calibration_db: own.calibration_db,
      dev_eui: devEui,
    });
  return repo.save("iot_microphones", {
    hive_id: hiveId,
    mac_address: `LORA-${devEui.slice(-6).toUpperCase()}`,
    firmware_version: "lorawan",
    battery_level: 0,
    sampling_rate_hz: 16000,
    is_online: 0,
    last_seen_at: null,
    calibration_db: 0,
    dev_eui: devEui,
  });
}

/**
 * DEMO ONLY: writes a verdict built exactly like a real uplink (encode, decode)
 * so the alerts screen can be tried without hardware. Labelled "simulator".
 */
export async function simulateVerdict(
  repo: Repository,
  hiveId: string,
  kind: "usual" | "different",
  now = new Date(),
) {
  const hive = await repo.get("hives", hiveId);
  if (!hive || hive.deleted_at)
    throw new Error("La colmena ya no está disponible");
  const decoded = decodeEdgePayload(
    encodeEdgePayload({
      classCode: kind === "usual" ? 0 : 1,
      confidence: kind === "usual" ? 0.93 : 0.81,
      temperatureC: 27.4,
      batteryV: 3.86,
      counter: now.getSeconds() % 16,
    }),
  );
  return repo.save("edge_verdicts", {
    hive_id: hiveId,
    recorded_at: now.toISOString(),
    source: "simulator",
    format_version: decoded.formatVersion,
    class_map_version: decoded.classMapVersion,
    class_code: decoded.classCode,
    confidence: decoded.confidence,
    temperature_c: decoded.temperatureC,
    battery_v: decoded.batteryV,
    flags: decoded.flags,
    uplink_counter: decoded.counter,
  });
}

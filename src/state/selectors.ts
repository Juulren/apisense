import type { AiSummary, AudioSample } from "../db/types";
export const latestSummary = (summaries: AiSummary[], hiveId: string) =>
  summaries
    .filter((s) => s.hive_id === hiveId)
    .sort((a, b) => b.period_end.localeCompare(a.period_end))[0];
export const latestSample = (samples: AudioSample[], hiveId: string) =>
  samples
    .filter((s) => s.hive_id === hiveId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))[0];
export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const statusLabel = (status: string | undefined) =>
  status === "optimal"
    ? "Tranquila"
    : status === "warning"
      ? "Atención sugerida"
      : status === "critical"
        ? "Revisar en campo"
        : "Sin lecturas";

export function parseTags(json: string): string[] {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

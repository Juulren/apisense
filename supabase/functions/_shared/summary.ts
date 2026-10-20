export const summaryVersion = "acoustic-summary-v1";
export interface SummarySample {
  acoustic_classification: string;
  confidence_score: number;
  classifier_version: string;
  source: string;
  dominant_freq_hz: number;
  recorded_at: string;
}
export function summarize(samples: SummarySample[]) {
  if (!samples.length) throw new Error("No hay muestras en este período");
  const simulated = samples.some((s) => s.source === "simulator");
  const credible = samples.filter(
    (s) =>
      s.classifier_version.startsWith("onnx:") && s.confidence_score >= 0.8,
  );
  const serious = credible.filter(
    (s) =>
      s.acoustic_classification === "queenless" ||
      s.acoustic_classification === "pest_disturbance",
  );
  const unusual = samples.filter(
    (s) =>
      s.dominant_freq_hz < 200 ||
      s.dominant_freq_hz > 300 ||
      s.acoustic_classification !== "healthy",
  );
  const critical =
    !simulated && serious.length >= 3 && serious.length / samples.length >= 0.5;
  const overall_status = critical
    ? ("critical" as const)
    : unusual.length
      ? ("warning" as const)
      : ("optimal" as const);
  const prefix = simulated ? "SIMULACIÓN. " : "";
  const summary_text =
    prefix +
    `${samples.length} ${samples.length === 1 ? "muestra analizada" : "muestras analizadas"}. ` +
    (critical
      ? "El modelo detecta de forma repetida patrones de alteración acústica."
      : unusual.length
        ? `${unusual.length} ${unusual.length === 1 ? "muestra presenta" : "muestras presentan"} un patrón fuera del rango estable de referencia o sin clasificación fiable.`
        : "El sonido se mantiene en el rango estable de referencia.") +
    " La acústica por sí sola no confirma salud, presencia de reina ni plagas.";
  const recommended_action = critical
    ? "Prioriza una inspección de campo para verificar reina, cría y posibles perturbaciones. No apliques tratamientos solo por el audio."
    : unusual.length
      ? "Verifica colocación y calibración del micrófono, ventilación y actividad de la piquera. Confirma reina y cría mediante inspección si el patrón persiste."
      : "Continúa el seguimiento y registra tus observaciones en la siguiente inspección programada.";
  return {
    overall_status,
    summary_text,
    recommended_action,
    samples_analyzed_count: samples.length,
    engine_version: summaryVersion,
  };
}
export function summaryWindow(
  samples: SummarySample[],
  intervalMinutes: number,
) {
  if (
    !samples.length ||
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes < 1 ||
    intervalMinutes > 10080
  )
    throw new Error("Período inválido");
  const end = Math.max(...samples.map((s) => Date.parse(s.recorded_at))) + 1;
  return {
    period_start: new Date(end - intervalMinutes * 60_000).toISOString(),
    period_end: new Date(end).toISOString(),
  };
}
export function uuidFromDigest(hex: string) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error("Digest inválido");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export const summaryIdentity = (hiveId: string, start: string, end: string) =>
  `${summaryVersion}:${hiveId}:${start}:${end}`;

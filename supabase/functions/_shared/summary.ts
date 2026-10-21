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
  const aggregate = new SummaryAccumulator();
  samples.forEach((sample) => aggregate.add(sample));
  return aggregate.result();
}
export class SummaryAccumulator {
  private count = 0;
  private simulated = false;
  private serious = 0;
  private unusual = 0;
  private latest = -Infinity;
  add(sample: SummarySample) {
    const at = Date.parse(sample.recorded_at);
    if (!Number.isFinite(at)) throw new Error("Fecha de muestra inválida");
    this.latest = Math.max(this.latest, at);
    this.count++;
    this.simulated ||= sample.source === "simulator";
    if (
      sample.classifier_version.startsWith("onnx:") &&
      sample.confidence_score >= 0.8 &&
      (sample.acoustic_classification === "queenless" ||
        sample.acoustic_classification === "pest_disturbance")
    )
      this.serious++;
    if (
      sample.dominant_freq_hz < 200 ||
      sample.dominant_freq_hz > 300 ||
      sample.acoustic_classification !== "healthy"
    )
      this.unusual++;
  }
  window(intervalMinutes: number) {
    return windowFromLatest(this.latest, intervalMinutes);
  }
  result() {
    const { count, simulated, serious, unusual } = this;
    if (!count) throw new Error("No hay muestras en este período");
    const critical = !simulated && serious >= 3 && serious / count >= 0.5;
    const overall_status = critical
      ? ("critical" as const)
      : unusual
        ? ("warning" as const)
        : ("optimal" as const);
    const prefix = simulated ? "SIMULACIÓN. " : "";
    const summary_text =
      prefix +
      `${count} ${count === 1 ? "muestra analizada" : "muestras analizadas"}. ` +
      (critical
        ? "El modelo detecta de forma repetida patrones de alteración acústica."
        : unusual
          ? `${unusual} ${unusual === 1 ? "muestra presenta" : "muestras presentan"} un patrón fuera del rango estable de referencia o sin clasificación fiable.`
          : "El sonido se mantiene en el rango estable de referencia.") +
      " La acústica por sí sola no confirma salud, presencia de reina ni plagas.";
    const recommended_action = critical
      ? "Prioriza una inspección de campo para verificar reina, cría y posibles perturbaciones. No apliques tratamientos solo por el audio."
      : unusual
        ? "Verifica colocación y calibración del micrófono, ventilación y actividad de la piquera. Confirma reina y cría mediante inspección si el patrón persiste."
        : "Continúa el seguimiento y registra tus observaciones en la siguiente inspección programada.";
    return {
      overall_status,
      summary_text,
      recommended_action,
      samples_analyzed_count: count,
      engine_version: summaryVersion,
    };
  }
}
export function summaryWindow(
  samples: SummarySample[],
  intervalMinutes: number,
) {
  let latest = -Infinity;
  for (const sample of samples) {
    const at = Date.parse(sample.recorded_at);
    if (!Number.isFinite(at)) throw new Error("Fecha de muestra inválida");
    latest = Math.max(latest, at);
  }
  return windowFromLatest(latest, intervalMinutes);
}
function windowFromLatest(latest: number, intervalMinutes: number) {
  if (
    !Number.isFinite(latest) ||
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes < 1 ||
    intervalMinutes > 10080
  )
    throw new Error("Período inválido");
  const end = latest + 1;
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

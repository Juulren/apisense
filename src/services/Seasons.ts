import type { Apiary, Inspection } from "../db/types";
import { localDate } from "./BroodCycle";

// A season calendar is a guide, never a promise. The only built-in calendar is
// Yucatán's, assembled from a few technical sources and beekeeper reports (see
// docs/PLAN_0.2.0_APIARIO_REAL.md). Anything else starts empty.
export type Phase = "flow" | "hard" | "reactivation" | "transition";
export type Confidence = "alta" | "media" | "baja";
export interface MonthInfo {
  phase: Phase;
  flora: string;
  note: string;
  confidence?: Confidence;
  single?: boolean;
}
export type Calendar = (MonthInfo | null)[];

export const phaseLabels: Record<Phase, string> = {
  flow: "Flujo (habitual)",
  hard: "Época difícil / poca floración",
  reactivation: "Reactivación",
  transition: "Transición",
};
export const monthShort = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
export const monthLong = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];
const PHASES = new Set<string>(Object.keys(phaseLabels));
export const MAX_NOTE = 200;
export const MAX_FLORA = 60;
export const MAX_CALENDAR_JSON = 8192;
const CONFIDENCES = new Set<string>(["alta", "media", "baja"]);

export const YUCATAN_REFERENCE = "referencia: centro-norte de Yucatán";
export const yucatanCalendar: Calendar = [
  {
    phase: "flow",
    flora: "Tajonal (inicia)",
    note: "Suele iniciar el tajonal. Los frentes fríos pueden marchitar la flor y frenar el pecoreo.",
    confidence: "media",
  },
  {
    phase: "flow",
    flora: "Tajonal, ts'its'ilché",
    note: "Temporada habitual de cosecha en la época seca.",
    confidence: "media",
  },
  {
    phase: "flow",
    flora: "Ts'its'ilché, jabín",
    note: "Floraciones de los meses secos.",
    confidence: "media",
  },
  {
    phase: "flow",
    flora: "Ts'its'ilché, jabín",
    note: "Mes seco y caluroso; el flujo seco va terminando.",
    confidence: "media",
  },
  {
    phase: "transition",
    flora: "Final del flujo seco",
    note: "Termina el flujo seco; hacia fines de mes suelen empezar las lluvias.",
    confidence: "media",
  },
  {
    phase: "hard",
    flora: "Poca floración",
    note: "En un estudio del centro-norte (Mocochá) junio fue el mes de menor flujo de néctar y polen. Inicia la temporada de huracanes (contexto, no predicción).",
    confidence: "alta",
  },
  {
    phase: "hard",
    flora: "Floraciones de lluvias",
    note: "Las lluvias se asocian con una época difícil para las colonias.",
    confidence: "media",
  },
  {
    phase: "hard",
    flora: "Floraciones de lluvias",
    note: "Mayor actividad ciclónica entre agosto y octubre (contexto, no predicción).",
    confidence: "media",
  },
  {
    phase: "hard",
    flora: "Floraciones de lluvias",
    note: "Suele ser el mes de más lluvia en Mérida.",
    confidence: "baja",
    single: true,
  },
  {
    phase: "reactivation",
    flora: "Enredaderas y anuales",
    note: "Las floraciones de la transición lluvias-secas fortalecen las colonias. Llegan los primeros frentes fríos.",
    confidence: "media",
  },
  {
    phase: "reactivation",
    flora: "Enredaderas, xtabentún",
    note: "Algunos apicultores hacen pre-cosecha o 'limpias'. La temporada de huracanes termina el 30 de noviembre.",
    confidence: "media",
  },
  {
    phase: "reactivation",
    flora: "Enredaderas; antes del tajonal",
    note: "Algunos apicultores reportan alimentar si las enredaderas fallan. Nortes frecuentes.",
    confidence: "baja",
    single: true,
  },
];
export const calendarDisclaimer =
  "Es una guía, no una promesa: las floraciones cambian de año en año y las sequías, los ciclones y los frentes fríos pueden desplazar o cancelar un flujo. Puede variar entre el norte, el oriente y el sur del estado.";

// Rough box around the state of Yucatán (and its neighbours on the peninsula).
export function suggestPreset(lat: number | null, lon: number | null) {
  if (lat === null || lon === null) return null;
  return lat >= 19.5 && lat <= 21.7 && lon >= -90.5 && lon <= -87.4
    ? ("yucatan" as const)
    : null;
}

/** Strict parser: exactly 12 entries, known phases, bounded text. Never throws. */
export function parseCalendar(json: string | null | undefined): Calendar | null {
  if (!json || json.length > MAX_CALENDAR_JSON) return null;
  try {
    const value: unknown = JSON.parse(json);
    if (
      typeof value !== "object" ||
      value === null ||
      (value as { v?: unknown }).v !== 1
    )
      return null;
    const months = (value as { months?: unknown }).months;
    if (!Array.isArray(months) || months.length !== 12) return null;
    const result: Calendar = [];
    for (const entry of months) {
      if (entry === null) {
        result.push(null);
        continue;
      }
      if (typeof entry !== "object") return null;
      const { phase, flora, note, confidence, single } = entry as Record<
        string,
        unknown
      >;
      if (
        typeof phase !== "string" ||
        !PHASES.has(phase) ||
        typeof flora !== "string" ||
        flora.length > MAX_FLORA ||
        typeof note !== "string" ||
        note.length > MAX_NOTE ||
        (confidence !== undefined &&
          (typeof confidence !== "string" || !CONFIDENCES.has(confidence))) ||
        (single !== undefined && typeof single !== "boolean")
      )
        return null;
      result.push({
        phase: phase as Phase,
        flora,
        note,
        ...(confidence ? { confidence: confidence as Confidence } : {}),
        ...(single ? { single: true } : {}),
      });
    }
    return result;
  } catch {
    return null;
  }
}
export function serializeCalendar(calendar: Calendar) {
  const json = JSON.stringify({
    v: 1,
    months: calendar.map((m) =>
      m
        ? {
            phase: m.phase,
            flora: m.flora,
            note: m.note,
            ...(m.confidence ? { confidence: m.confidence } : {}),
            ...(m.single ? { single: true } : {}),
          }
        : null,
    ),
  });
  if (json.length > MAX_CALENDAR_JSON)
    throw new Error("El calendario es demasiado largo");
  return json;
}

export type CalendarSource = "custom" | "yucatan" | "none";
export function calendarFor(
  apiary: Pick<Apiary, "region_preset" | "seasons_json"> | undefined,
): { calendar: Calendar | null; source: CalendarSource } {
  if (!apiary) return { calendar: null, source: "none" };
  const own = parseCalendar(apiary.seasons_json);
  if (own && own.some(Boolean)) return { calendar: own, source: "custom" };
  if (apiary.region_preset === "yucatan")
    return { calendar: yucatanCalendar, source: "yucatan" };
  return { calendar: null, source: "none" };
}

export interface PhasePosition {
  month: number; // 0-11
  info: MonthInfo | null;
  /** Months, counting the current one, with the same typical phase. */
  span: number;
  /** Months until the typical phase changes; null when it never does. */
  changesIn: number | null;
  next: MonthInfo | null;
}
export function phaseOn(calendar: Calendar | null, date: Date): PhasePosition {
  const month = date.getMonth();
  const info = calendar?.[month] ?? null;
  if (!calendar || !info)
    return { month, info: null, span: 0, changesIn: null, next: null };
  let ahead = 1;
  while (ahead < 12 && calendar[(month + ahead) % 12]?.phase === info.phase)
    ahead++;
  let behind = 0;
  while (
    behind < 12 - ahead &&
    calendar[(month - behind - 1 + 12) % 12]?.phase === info.phase
  )
    behind++;
  if (ahead + behind >= 12)
    return { month, info, span: 12, changesIn: null, next: null };
  return {
    month,
    info,
    span: ahead + behind,
    changesIn: ahead,
    next: calendar[(month + ahead) % 12] ?? null,
  };
}

// ---- Check-ins -----------------------------------------------------------

const DAY = 86_400_000;
/** Check-ins older than this produce no signals. */
export const FRESH_DAYS = 14;

const hasCheckin = (i: Inspection) =>
  Boolean(i.activity || i.population || i.stores || i.queen_cells);
const byNewest = (a: Inspection, b: Inspection) =>
  b.inspected_at.localeCompare(a.inspected_at);
const daysAgo = (iso: string, today: Date) =>
  Math.floor(
    (Date.parse(`${localDate(today)}T00:00:00Z`) -
      Date.parse(`${localDate(new Date(iso))}T00:00:00Z`)) /
      DAY,
  );

export interface Signal {
  tone: "attention" | "info";
  text: string;
}
/**
 * Plain restatements of what the beekeeper wrote, put next to the typical phase.
 * Never a diagnosis, never a measured trend, never feeding or treatment advice.
 */
export function seasonSignals(
  inspections: Inspection[],
  phase: Phase | null,
  today = new Date(),
): Signal[] {
  const marked = inspections.filter(hasCheckin).sort(byNewest);
  const latest = marked[0];
  if (!latest || daysAgo(latest.inspected_at, today) > FRESH_DAYS) return [];
  const signals: Signal[] = [];
  if (latest.queen_cells === "present")
    signals.push({
      tone: "attention",
      text: "Anotaste celdas reales: puede ser enjambrazón o reemplazo; no se puede saber desde la app.",
    });
  if (latest.stores === "low")
    signals.push({
      tone: "attention",
      text:
        phase === "hard"
          ? "Anotaste reservas bajas; en esta época suele haber poca floración. Considera revisarla."
          : "Anotaste reservas bajas en tu último registro. Considera revisarla.",
    });
  const populations = marked.filter((i) => i.population).slice(0, 2);
  if (
    populations.length === 2 &&
    populations.every((i) => i.population === "down")
  )
    signals.push({
      tone: "attention",
      text: "Anotaste población baja en tus 2 últimos registros.",
    });
  if (latest.activity === "low")
    signals.push({
      tone: "attention",
      text: "Anotaste actividad baja en tu último registro.",
    });
  if (phase === "hard" && latest.stores === "high")
    signals.push({
      tone: "info",
      text: "Tus registros muestran reservas altas aunque lo típico es poca floración: mandan tus registros.",
    });
  return signals.slice(0, 2);
}

export type Frequency = "daily" | "weekly" | "off";
export function checkinDue(
  frequency: Frequency,
  inspections: Inspection[],
  today = new Date(),
) {
  if (frequency === "off") return false;
  const latest = [...inspections].sort(byNewest)[0];
  if (!latest) return true;
  const age = daysAgo(latest.inspected_at, today);
  return frequency === "daily" ? age >= 1 : age >= 7;
}

/** One boolean per day, oldest first, ending today. Only marks what exists. */
export function recentDays(
  inspections: Inspection[],
  today = new Date(),
  days = FRESH_DAYS,
) {
  const present = new Set(
    inspections.map((i) => localDate(new Date(i.inspected_at))),
  );
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(today);
    day.setDate(today.getDate() - (days - 1 - index));
    return { date: localDate(day), done: present.has(localDate(day)) };
  });
}

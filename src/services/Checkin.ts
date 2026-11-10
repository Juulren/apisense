import type { Repository } from "../db/Repository";
import type {
  EggsState,
  Inspection,
  Level3,
  QueenCells,
  QueenState,
  StoresLevel,
  Trend,
} from "../db/types";

export const MIN_NOTE = 3;
export const MAX_NOTE = 5000;
export const MAX_TAGS = 300;

export const activityLabels: Record<Level3, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
};
export const storesLabels: Record<StoresLevel, string> = {
  low: "Bajas",
  medium: "Medias",
  high: "Altas",
};
export const populationLabels: Record<Trend, string> = {
  down: "Bajando",
  stable: "Estable",
  up: "Creciendo",
};
export const queenLabels: Record<QueenState, string> = {
  seen: "Vista",
  not_seen: "No vista",
  virgin_seen: "Reina virgen",
};
export const eggsLabels: Record<EggsState, string> = {
  none: "Ninguno",
  fresh: "Frescos",
  multiple: "Varios por celda",
};
export const cellsLabels: Record<QueenCells, string> = {
  none: "No hay",
  present: "Hay",
};

export interface CheckinInput {
  notes: string;
  tags: string;
  activity: Level3 | null;
  stores: StoresLevel | null;
  population: Trend | null;
  queen_state: QueenState | null;
  eggs_state: EggsState | null;
  queen_cells: QueenCells | null;
}
export const emptyCheckin: CheckinInput = {
  notes: "",
  tags: "",
  activity: null,
  stores: null,
  population: null,
  queen_state: null,
  eggs_state: null,
  queen_cells: null,
};

export const hasStructured = (input: CheckinInput) =>
  Boolean(
    input.activity ||
      input.stores ||
      input.population ||
      input.queen_state ||
      input.eggs_state ||
      input.queen_cells,
  );

/** A note of at least 3 characters, or at least one chosen state, is enough. */
export function validateCheckin(input: CheckinInput) {
  const notes = input.notes.trim();
  if (input.notes.length > MAX_NOTE || input.tags.length > MAX_TAGS)
    throw new Error("Acorta la nota o las etiquetas");
  if (!hasStructured(input) && notes.length < MIN_NOTE)
    throw new Error(
      "Escribe una nota de al menos 3 caracteres o elige cómo la ves",
    );
  const labels = input.tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return { notes, labels };
}

export async function saveCheckin(
  repo: Repository,
  hiveId: string,
  input: CheckinInput,
  now = new Date(),
) {
  const { notes, labels } = validateCheckin(input);
  const hive = await repo.get("hives", hiveId);
  // A removed hive must not receive new records.
  if (!hive || hive.deleted_at)
    throw new Error("La colmena ya no está disponible");
  return repo.save("inspections", {
    hive_id: hive.id,
    inspected_at: now.toISOString(),
    notes,
    tags_json: JSON.stringify(labels),
    queen_seen: input.queen_state === "seen" ? 1 : 0,
    queen_state: input.queen_state,
    eggs_state: input.eggs_state,
    queen_cells: input.queen_cells,
    activity: input.activity,
    population: input.population,
    stores: input.stores,
  });
}

/** Short phrases for the logbook, only for what the user actually chose. */
export function checkinSummary(row: Inspection) {
  const parts: string[] = [];
  if (row.activity) parts.push(`Actividad ${activityLabels[row.activity].toLowerCase()}`);
  if (row.stores) parts.push(`Reservas ${storesLabels[row.stores].toLowerCase()}`);
  if (row.population)
    parts.push(`Población ${populationLabels[row.population].toLowerCase()}`);
  if (row.queen_state) parts.push(`Reina: ${queenLabels[row.queen_state].toLowerCase()}`);
  if (row.eggs_state) parts.push(`Huevos: ${eggsLabels[row.eggs_state].toLowerCase()}`);
  if (row.queen_cells)
    parts.push(`Celdas reales: ${cellsLabels[row.queen_cells].toLowerCase()}`);
  return parts;
}

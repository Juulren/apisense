import type { Repository } from "../db/Repository";
import type { BroodCycle, BroodStage } from "../db/types";

export const broodStages: Record<BroodStage, string> = {
  unknown: "Sin observación",
  egg: "Huevos",
  larva: "Larvas",
  capped: "Cría operculada",
  emerged: "Emergencia observada",
};
export const WORKER_CYCLE_DAYS = 21;
const DAY = 86_400_000;
export function localDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function civilDay(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date.startsWith("0000")) return null;
  const value = Date.parse(`${date}T00:00:00Z`);
  if (
    !Number.isFinite(value) ||
    new Date(value).toISOString().slice(0, 10) !== date
  )
    return null;
  return value / DAY;
}
export function cycleProgress(startedOn: string, today = localDate()) {
  const start = civilDay(startedOn),
    current = civilDay(today);
  if (start === null || current === null || start > current) return null;
  const elapsed = current - start;
  const day = Math.min(WORKER_CYCLE_DAYS, elapsed + 1);
  const expectedOn = new Date((start + WORKER_CYCLE_DAYS - 1) * DAY)
    .toISOString()
    .slice(0, 10);
  const stage: BroodStage =
    day <= 3 ? "egg" : day <= 8 ? "larva" : day < 21 ? "capped" : "emerged";
  return {
    day,
    elapsed,
    expectedOn,
    remaining: Math.max(0, 21 - day),
    progress: day / 21,
    stage,
    due: elapsed >= 20,
  };
}
function validateStart(startedOn: string, label: string, now: Date) {
  if (!cycleProgress(startedOn, localDate(now)))
    throw new Error("Escribe una fecha válida AAAA-MM-DD, de hoy o anterior");
  const trimmed = label.trim();
  if (!trimmed || trimmed.length > 80)
    throw new Error("Identifica el cuadro o lote con entre 1 y 80 caracteres");
  return trimmed;
}
function input(cycle: BroodCycle) {
  const {
    id,
    hive_id,
    cohort_label,
    started_on,
    state,
    observed_stage,
    observed_at,
    ended_at,
  } = cycle;
  return {
    id,
    hive_id,
    cohort_label,
    started_on,
    state,
    observed_stage,
    observed_at,
    ended_at,
  };
}
export async function saveCycleStart(
  repo: Repository,
  hiveId: string,
  startedOn: string,
  label: string,
  now = new Date(),
  cycleId?: string,
) {
  const cohort_label = validateStart(startedOn, label, now);
  const hive = await repo.get("hives", hiveId);
  if (!hive || hive.deleted_at)
    throw new Error("La colmena ya no está disponible");
  if (cycleId) {
    const cycle = await repo.get("brood_cycles", cycleId);
    if (
      !cycle ||
      cycle.deleted_at ||
      cycle.hive_id !== hiveId ||
      cycle.state !== "active"
    )
      throw new Error("Selecciona un seguimiento activo de esta colmena");
    return repo.save("brood_cycles", {
      ...input(cycle),
      started_on: startedOn,
      cohort_label,
    });
  }
  return repo.save("brood_cycles", {
    hive_id: hiveId,
    started_on: startedOn,
    cohort_label,
    state: "active",
    observed_stage: "unknown",
    observed_at: null,
    ended_at: null,
  });
}
export async function observeCycle(
  repo: Repository,
  cycleId: string,
  stage: Exclude<BroodStage, "unknown">,
  now = new Date(),
) {
  if (!["egg", "larva", "capped", "emerged"].includes(stage))
    throw new Error("Selecciona la etapa que observaste");
  const cycle = await repo.get("brood_cycles", cycleId);
  if (!cycle || cycle.deleted_at || cycle.state !== "active")
    throw new Error("El seguimiento está cerrado o no está disponible");
  const stamp = now.toISOString();
  return repo.save("brood_cycles", {
    ...input(cycle),
    observed_stage: stage,
    observed_at: stamp,
    state: stage === "emerged" ? "emerged" : "active",
    ended_at: stage === "emerged" ? stamp : null,
  });
}
export async function stopCycle(
  repo: Repository,
  cycleId: string,
  now = new Date(),
) {
  const cycle = await repo.get("brood_cycles", cycleId);
  if (!cycle || cycle.deleted_at || cycle.state !== "active")
    throw new Error("El seguimiento ya está cerrado");
  return repo.save("brood_cycles", {
    ...input(cycle),
    state: "stopped",
    ended_at: now.toISOString(),
  });
}

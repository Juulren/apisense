import type { Repository } from "../db/Repository";

export const MAX_HIVE_CODE = 40;

export function normalizeHiveCode(code: string) {
  const value = code.trim();
  if (!value) throw new Error("Escribe el nombre o código de la colmena");
  if (value.length > MAX_HIVE_CODE)
    throw new Error(`Usa máximo ${MAX_HIVE_CODE} caracteres`);
  return value;
}

async function ensureUnique(
  repo: Repository,
  apiaryId: string,
  code: string,
  ignoreId?: string,
) {
  const hives = await repo.list("hives");
  if (
    hives.some(
      (h) =>
        h.id !== ignoreId &&
        h.apiary_id === apiaryId &&
        h.code.toLowerCase() === code.toLowerCase(),
    )
  )
    throw new Error("Ese nombre ya existe en el apiario");
}

export async function addHive(
  repo: Repository,
  apiaryId: string,
  rawCode: string,
) {
  const code = normalizeHiveCode(rawCode);
  const apiary = await repo.get("apiaries", apiaryId);
  if (!apiary || apiary.deleted_at) throw new Error("Primero crea un apiario");
  await ensureUnique(repo, apiaryId, code);
  return repo.save("hives", {
    apiary_id: apiaryId,
    code,
    queen_status: "unknown",
    health_score: null,
    last_audio_check_at: null,
  });
}

export async function renameHive(
  repo: Repository,
  hiveId: string,
  rawCode: string,
) {
  const code = normalizeHiveCode(rawCode);
  const hive = await repo.get("hives", hiveId);
  // A stale object must never revive or edit a removed hive.
  if (!hive || hive.deleted_at)
    throw new Error("La colmena ya no está disponible");
  await ensureUnique(repo, hive.apiary_id, code, hive.id);
  return repo.save("hives", {
    id: hive.id,
    apiary_id: hive.apiary_id,
    code,
    queen_status: hive.queen_status,
    health_score: hive.health_score,
    last_audio_check_at: hive.last_audio_check_at,
  });
}

export function removeHive(repo: Repository, hiveId: string) {
  return repo.removeHive(hiveId);
}

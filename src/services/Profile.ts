import type { Repository } from "../db/Repository";

export const MAX_NAME = 50;
export const MIN_NEW_PASSWORD = 10;

/** Mirrors `profiles_display_name_valid` in the database. Empty means "no name". */
export function cleanName(raw: string) {
  const name = raw.trim();
  if (name.length > MAX_NAME)
    throw new Error(`Usa máximo ${MAX_NAME} caracteres en el nombre`);
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f-\u009f]/.test(name))
    throw new Error("El nombre tiene caracteres no válidos");
  return name;
}

/** Rules for a password being created or changed (not for signing in). */
export function newPasswordProblem(password: string, email = "") {
  if (password.length < MIN_NEW_PASSWORD)
    return `La contraseña nueva debe tener al menos ${MIN_NEW_PASSWORD} caracteres`;
  if (email && password.toLowerCase() === email.trim().toLowerCase())
    return "La contraseña no puede ser tu correo";
  if (/^(.)\1+$/.test(password))
    return "Elige una contraseña menos repetitiva";
  return null;
}

export const isEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value.trim());
export const isRecoveryCode = (value: string) => /^\d{6}$/.test(value.trim());

/** What the app needs from the account's profile row; the server enforces ownership. */
export type ProfileRemote = {
  fetchName(userId: string): Promise<string | null>;
  pushName(userId: string, name: string | null): Promise<void>;
};

type Settings = Pick<Repository, "setting" | "setSetting">;

/**
 * The name is kept locally (the greeting works offline) and mirrored to the
 * profile. A change made offline stays flagged until it can be sent.
 */
export async function saveName(
  repo: Settings,
  remote: ProfileRemote | null,
  userId: string,
  raw: string,
) {
  const name = cleanName(raw);
  await repo.setSetting("name", name);
  if (!remote) return { synced: false };
  await repo.setSetting("name_pending", "1");
  try {
    await remote.pushName(userId, name || null);
    await repo.setSetting("name_pending", "0");
    return { synced: true };
  } catch {
    return { synced: false };
  }
}

/** On opening a session: send a pending change, otherwise adopt the profile's name. */
export async function reconcileName(
  repo: Settings,
  remote: ProfileRemote,
  userId: string,
) {
  const local = (await repo.setting("name")) ?? "";
  if ((await repo.setting("name_pending")) === "1") {
    await remote.pushName(userId, local || null);
    await repo.setSetting("name_pending", "0");
    return;
  }
  const server = await remote.fetchName(userId);
  if (server === null) {
    if (local) await remote.pushName(userId, local);
    return;
  }
  // The user may have saved a new name while the profile was being fetched.
  const now = (await repo.setting("name")) ?? "";
  if (now !== local || (await repo.setting("name_pending")) === "1") return;
  if (server !== local) await repo.setSetting("name", server);
}

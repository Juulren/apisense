import {
  ACCOUNT_MISMATCH,
  RETRIES_ALONE,
  type SyncState,
} from "../db/SyncEngine";

/** What the top bar has to say, or nothing: it only speaks up when something is off. */
export function headerStatus({
  demo,
  sync,
  offlineMode,
  pending,
}: {
  demo: boolean;
  sync: SyncState["status"];
  offlineMode: boolean;
  pending: number;
}): string | undefined {
  if (demo) return "Demo";
  const waiting = pending > 0 ? `${pending} sin enviar` : "";
  if (offlineMode || sync === "offline")
    return waiting ? `Sin conexión · ${waiting}` : "Sin conexión";
  if (sync === "error") return "No se actualizó";
  if (sync === "syncing") return undefined;
  return waiting || undefined;
}

/** What Ajustes says about a failed sync: no technical detail, only what to do. */
export function syncProblem(error: string | null): string {
  if (error === ACCOUNT_MISMATCH)
    return "La sesión no corresponde a los datos de este teléfono. Cierra sesión y vuelve a entrar.";
  if (error?.endsWith(RETRIES_ALONE))
    return "Algunos datos no se pudieron enviar. Se reintentará solo.";
  return "No se pudo actualizar. Desliza para reintentar.";
}

import type { SyncState } from "../db/SyncEngine";

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
  if (sync === "error") return "Sync pendiente";
  if (sync === "syncing") return undefined;
  return waiting || undefined;
}

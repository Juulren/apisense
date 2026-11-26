import { describe, expect, it } from "vitest";
import { ACCOUNT_MISMATCH, RETRIES_ALONE } from "../db/SyncEngine";
import { headerStatus, syncProblem } from "./HeaderStatus";

const ok = { demo: false, sync: "idle", offlineMode: false, pending: 0 } as const;

describe("headerStatus", () => {
  it("says nothing when all is well, even while syncing", () => {
    expect(headerStatus(ok)).toBeUndefined();
    expect(headerStatus({ ...ok, sync: "syncing", pending: 3 })).toBeUndefined();
  });
  it("names the demo, a failed sync and records waiting to be sent", () => {
    expect(headerStatus({ ...ok, demo: true, sync: "offline" })).toBe("Demo");
    expect(headerStatus({ ...ok, sync: "error" })).toBe("No se actualizó");
    expect(headerStatus({ ...ok, pending: 2 })).toBe("2 sin enviar");
  });
  it("shows being offline, with what is waiting", () => {
    expect(headerStatus({ ...ok, sync: "offline" })).toBe("Sin conexión");
    expect(headerStatus({ ...ok, offlineMode: true, pending: 1 })).toBe(
      "Sin conexión · 1 sin enviar",
    );
  });
});

describe("syncProblem", () => {
  it("offers to retry only when retrying can help", () => {
    expect(syncProblem("fetch failed")).toBe(
      "No se pudo actualizar. Desliza para reintentar.",
    );
    expect(syncProblem(null)).toContain("Desliza");
    expect(syncProblem(ACCOUNT_MISMATCH)).not.toContain("Desliza");
    expect(syncProblem(ACCOUNT_MISMATCH)).toContain("vuelve a entrar");
    expect(syncProblem(`2 registros pendientes; ${RETRIES_ALONE}`)).toBe(
      "Algunos datos no se pudieron enviar. Se reintentará solo.",
    );
  });
});

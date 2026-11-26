import { describe, expect, it } from "vitest";
import { headerStatus } from "./HeaderStatus";

const ok = { demo: false, sync: "idle", offlineMode: false, pending: 0 } as const;

describe("headerStatus", () => {
  it("says nothing when all is well, even while syncing", () => {
    expect(headerStatus(ok)).toBeUndefined();
    expect(headerStatus({ ...ok, sync: "syncing", pending: 3 })).toBeUndefined();
  });
  it("names the demo, a failed sync and records waiting to be sent", () => {
    expect(headerStatus({ ...ok, demo: true, sync: "offline" })).toBe("Demo");
    expect(headerStatus({ ...ok, sync: "error" })).toBe("Sync pendiente");
    expect(headerStatus({ ...ok, pending: 2 })).toBe("2 sin enviar");
  });
  it("shows being offline, with what is waiting", () => {
    expect(headerStatus({ ...ok, sync: "offline" })).toBe("Sin conexión");
    expect(headerStatus({ ...ok, offlineMode: true, pending: 1 })).toBe(
      "Sin conexión · 1 sin enviar",
    );
  });
});

import { describe, expect, it, vi } from "vitest";
import { claimNodeOnServer } from "./loraClaim";

const ok = (data: unknown, error: unknown = null) => ({
  rpc: vi.fn(async () => ({ data, error })),
});

describe("claiming a node on the server", () => {
  it("sends the DevEUI and the trimmed code to claim_lora_node and accepts only true", async () => {
    const client = ok(true);
    await claimNodeOnServer(client, "70b3d57ed0000001", "  codigo-de-nodo-1  ");
    expect(client.rpc).toHaveBeenCalledWith("claim_lora_node", {
      p_dev_eui: "70b3d57ed0000001",
      p_claim_code: "codigo-de-nodo-1",
    });
  });
  it("refuses a wrong code or another account's node with one generic message", async () => {
    for (const data of [false, null, "true", 1])
      await expect(
        claimNodeOnServer(ok(data), "70b3d57ed0000001", "codigo-de-nodo-1"),
      ).rejects.toThrow("no son correctos, o el nodo ya pertenece a otra cuenta");
  });
  it("does not call the server for a missing or short code, and explains an offline phone", async () => {
    const client = ok(true);
    await expect(claimNodeOnServer(client, "70b3d57ed0000001", "corto")).rejects.toThrow("código de vinculación");
    expect(client.rpc).not.toHaveBeenCalled();
    await expect(claimNodeOnServer(null, "70b3d57ed0000001", "codigo-de-nodo-1")).rejects.toThrow("necesita conexión");
  });
  it("reports a failed request without leaking server details", async () => {
    const boom = { rpc: vi.fn(async () => { throw new Error("postgres://secret"); }) };
    await expect(claimNodeOnServer(boom, "70b3d57ed0000001", "codigo-de-nodo-1")).rejects.toThrow("Revisa tu conexión");
    await expect(
      claimNodeOnServer(ok(null, { message: "relation lora_nodes" }), "70b3d57ed0000001", "codigo-de-nodo-1"),
    ).rejects.not.toThrow("lora_nodes");
  });
});

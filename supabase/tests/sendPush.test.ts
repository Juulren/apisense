import { describe, expect, it } from "vitest";
import {
  createSendPushHandler,
  type PushEvent,
  type SendPushDependencies,
} from "../functions/_shared/sendPushHandler";

const SECRET = "cron-secret-for-tests";
const event = (id: string, user = "u1"): PushEvent => ({
  id,
  user_id: user,
  hive_id: "h1",
  kind: "verdict",
  title: "Sonido diferente al habitual",
  body: "C-01: revisa la colmena.",
});
function setup(over: Partial<SendPushDependencies> & { events?: PushEvent[]; tokens?: Record<string, string[]> } = {}) {
  const sentIds: string[] = [];
  const deleted: string[] = [];
  const messages: { token: string; data: Record<string, string> }[] = [];
  let tokens = over.tokens ?? { u1: ["t1"] };
  const deps: SendPushDependencies = {
    cronSecret: () => SECRET,
    configured: () => true,
    pending: async () => over.events ?? [event("e1")],
    tokensFor: async (u) => tokens[u] ?? [],
    send: async (token, m) => {
      messages.push({ token, data: m.data });
      return "ok";
    },
    markSent: async (id) => void sentIds.push(id),
    deleteToken: async (t) => {
      deleted.push(t);
      tokens = { ...tokens, u1: (tokens.u1 ?? []).filter((x) => x !== t) };
    },
    ...over,
  };
  return { handler: createSendPushHandler(deps), sentIds, deleted, messages };
}
const call = (handler: (r: Request) => Promise<Response>, secret: string | null = SECRET, method = "POST") =>
  handler(new Request("https://x.test/send-push", { method, headers: secret ? { "x-cron-secret": secret } : {} }));

describe("send-push", () => {
  it("sends each pending event to the owner's phones and consumes it", async () => {
    const { handler, sentIds, messages } = setup({ tokens: { u1: ["t1", "t2"] } });
    const res = await call(handler);
    expect(await res.json()).toEqual({ status: "ok", sent: 1, failed: 0, skipped: 0 });
    expect(messages.map((m) => m.token)).toEqual(["t1", "t2"]);
    expect(messages[0]!.data).toEqual({ kind: "verdict", hive_id: "h1" });
    expect(sentIds).toEqual(["e1"]);
  });
  it("rejects a missing or wrong secret and other methods", async () => {
    const { handler, messages } = setup();
    expect((await call(handler, null)).status).toBe(401);
    expect((await call(handler, "mala")).status).toBe(401);
    expect((await call(handler, SECRET, "GET")).status).toBe(405);
    expect(messages).toEqual([]);
  });
  it("answers 500 when no secret is configured, and consumes nothing without Firebase", async () => {
    expect((await call(setup({ cronSecret: () => undefined }).handler)).status).toBe(500);
    const off = setup({ configured: () => false });
    expect(await (await call(off.handler)).json()).toEqual({ status: "push_not_configured" });
    expect(off.sentIds).toEqual([]);
  });
  it("consumes an event whose owner has no phone registered", async () => {
    const { handler, sentIds, messages } = setup({ tokens: {} });
    expect(await (await call(handler)).json()).toMatchObject({ skipped: 1, sent: 0 });
    expect(sentIds).toEqual(["e1"]);
    expect(messages).toEqual([]);
  });
  it("drops invalid tokens and retries a transient failure next minute", async () => {
    const invalid = setup({ send: async () => "invalid" });
    await call(invalid.handler);
    expect(invalid.deleted).toEqual(["t1"]);
    expect(invalid.sentIds).toEqual(["e1"]); // its only token vanished: nobody left to notify
    const flaky = setup({ send: async () => "error" });
    expect(await (await call(flaky.handler)).json()).toMatchObject({ failed: 1, sent: 0 });
    expect(flaky.sentIds).toEqual([]);
  });
  it("answers a generic storage error without internals", async () => {
    const { handler } = setup({
      pending: async () => {
        throw new Error("relation secret_table missing");
      },
    });
    const res = await call(handler);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret_table");
  });
});

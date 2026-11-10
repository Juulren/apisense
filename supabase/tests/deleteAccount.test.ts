import { describe, expect, it } from "vitest";
import {
  createDeleteAccountHandler,
  type DeleteAccountDependencies,
} from "../functions/_shared/deleteAccountHandler";

const USER = { id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa", email: "a@b.co" };
function setup(overrides: Partial<DeleteAccountDependencies> = {}) {
  const calls: string[] = [];
  const deps: DeleteAccountDependencies = {
    authenticate: async (jwt) => (jwt === "good.jwt" ? USER : null),
    passwordIsCorrect: async (_e, p) => p === "correcta-123",
    purgeStorage: async () => void calls.push("storage"),
    deleteData: async () => void calls.push("data"),
    deleteUser: async () => void calls.push("user"),
    ...overrides,
  };
  return { handler: createDeleteAccountHandler(deps), calls };
}
const post = (body: unknown, token: string | null = "good.jwt") =>
  new Request("https://x.test/delete-account", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("delete-account", () => {
  it("removes files, then rows, then the user, in that order", async () => {
    const { handler, calls } = setup();
    const res = await handler(post({ password: "correcta-123" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "deleted" });
    expect(calls).toEqual(["storage", "data", "user"]);
  });
  it("deletes nothing with a wrong password", async () => {
    const { handler, calls } = setup();
    const res = await handler(post({ password: "mala" }));
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });
  it("deletes nothing without a valid session", async () => {
    const { handler, calls } = setup();
    expect((await handler(post({ password: "correcta-123" }, null))).status).toBe(401);
    expect((await handler(post({ password: "correcta-123" }, "bad.jwt"))).status).toBe(401);
    expect(calls).toEqual([]);
  });
  it("rejects other methods and malformed bodies", async () => {
    const { handler, calls } = setup();
    const get = new Request("https://x.test/", { method: "GET" });
    expect((await handler(get)).status).toBe(405);
    expect((await handler(post("no json"))).status).toBe(400);
    expect((await handler(post({}))).status).toBe(400);
    expect((await handler(post({ password: 123 }))).status).toBe(400);
    expect((await handler(post({ password: "x".repeat(300) }))).status).toBe(400);
    expect((await handler(post("x".repeat(5000)))).status).toBe(413);
    expect(calls).toEqual([]);
  });
  it("answers a generic error, without internals, when a step fails, and stops there", async () => {
    const { handler, calls } = setup({
      deleteData: async () => {
        throw new Error("relation public.secret does not exist");
      },
    });
    const res = await handler(post({ password: "correcta-123" }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).not.toContain("secret");
    expect(calls).toEqual(["storage"]);
  });
});

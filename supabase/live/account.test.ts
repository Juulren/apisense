import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supabaseConfig } from "../../scripts/supabase-config.mjs";

// Live check of the account features against the real project, using temporary
// confirmed users made through the admin API (same mechanism as the other live
// tests). Every user is deleted at the end, even if a test fails.
const runId = randomUUID();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const created: string[] = [];
let admin: SupabaseClient, url: string, key: string;

async function makeUser(name?: string | null, rawMeta?: Record<string, unknown>) {
  const email = `apisense-${runId}-${created.length}@example.com`;
  const password = `A!${randomUUID()}z9`;
  const res = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: rawMeta ?? (name === undefined ? {} : { display_name: name }),
  });
  if (res.error || !res.data.user)
    throw new Error(`createUser: ${res.error?.code ?? "error"}`);
  created.push(res.data.user.id);
  const client = createClient(url, key, options);
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error(`signIn: ${signed.error.code}`);
  return { id: res.data.user.id, email, password, client };
}

beforeAll(async () => {
  ({ url, key } = supabaseConfig());
  const secret = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!secret) throw new Error("Falta SUPABASE_TEST_SECRET_KEY");
  admin = createClient(url, secret, options);
});
afterAll(async () => {
  for (const id of created) {
    await admin.rpc("delete_account_data", { target: id });
    await admin.auth.admin.deleteUser(id);
  }
});

describe("profiles on the real project", () => {
  it("creates a profile at sign-up with the name from the metadata", async () => {
    const u = await makeUser("  Damaris  ");
    const { data, error } = await u.client
      .from("profiles")
      .select("id,display_name")
      .eq("id", u.id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ id: u.id, display_name: "Damaris" });
  });
  it("never blocks sign-up for a bad name; the profile just has none", async () => {
    const u = await makeUser(null, { display_name: "x".repeat(80) });
    const { data } = await u.client.from("profiles").select("display_name").eq("id", u.id).single();
    expect(data).toEqual({ display_name: null });
  });
  it("lets a user rename only themselves, and only with a valid name", async () => {
    const a = await makeUser("Ana"),
      b = await makeUser("Beto");
    const ok = await a.client.from("profiles").update({ display_name: "Ana M." }).eq("id", a.id).select("display_name");
    expect(ok.data).toEqual([{ display_name: "Ana M." }]);
    const other = await a.client.from("profiles").update({ display_name: "Hack" }).eq("id", b.id).select("id");
    expect(other.data).toEqual([]);
    const seen = await a.client.from("profiles").select("id");
    expect(seen.data).toEqual([{ id: a.id }]);
    const bad = await a.client.from("profiles").update({ display_name: "" }).eq("id", a.id);
    expect(bad.error?.code).toBe("23514");
    const insert = await a.client.from("profiles").insert({ id: randomUUID() });
    expect(insert.error).not.toBeNull();
  });
});

describe("password recovery with the emailed code", () => {
  it("accepts the code once, sets a new password, and rejects a wrong code", async () => {
    const u = await makeUser("Recupera");
    const link = await admin.auth.admin.generateLink({ type: "recovery", email: u.email });
    expect(link.error).toBeNull();
    const code = link.data.properties?.email_otp;
    expect(code).toMatch(/^\d{6,8}$/);
    const fresh = createClient(url, key, options);
    const wrong = await fresh.auth.verifyOtp({ email: u.email, token: code === "000000" ? "111111" : "000000", type: "recovery" });
    expect(wrong.error).not.toBeNull();
    const verified = await fresh.auth.verifyOtp({ email: u.email, token: code!, type: "recovery" });
    expect(verified.error).toBeNull();
    const newPassword = `N!${randomUUID()}x7`;
    const updated = await fresh.auth.updateUser({ password: newPassword });
    expect(updated.error).toBeNull();
    const login = await createClient(url, key, options).auth.signInWithPassword({ email: u.email, password: newPassword });
    expect(login.error).toBeNull();
    const old = await createClient(url, key, options).auth.signInWithPassword({ email: u.email, password: u.password });
    expect(old.error).not.toBeNull();
    const reuse = await createClient(url, key, options).auth.verifyOtp({ email: u.email, token: code!, type: "recovery" });
    expect(reuse.error).not.toBeNull();
  });
});

describe("delete-account function", () => {
  it("refuses a missing session and a wrong password, then deletes everything", async () => {
    const u = await makeUser("Borrar");
    const apiary = randomUUID(), hive = randomUUID();
    expect((await u.client.from("apiaries").insert({ id: apiary, user_id: u.id, name: "Apiario QA" })).error).toBeNull();
    expect((await u.client.from("hives").insert({ id: hive, apiary_id: apiary, code: "QA-01" })).error).toBeNull();

    const anonymous = await fetch(`${url}/functions/v1/delete-account`, {
      method: "POST",
      body: JSON.stringify({ password: u.password }),
    });
    expect(anonymous.status).toBe(401);

    const wrong = await u.client.functions.invoke("delete-account", { body: { password: "incorrecta-123" } });
    expect(wrong.error).not.toBeNull();
    expect((await admin.auth.admin.getUserById(u.id)).data.user?.id).toBe(u.id);
    expect((await admin.from("apiaries").select("id").eq("id", apiary)).data).toHaveLength(1);

    const done = await u.client.functions.invoke("delete-account", { body: { password: u.password } });
    expect(done.error).toBeNull();
    expect(done.data).toEqual({ status: "deleted" });

    expect((await admin.auth.admin.getUserById(u.id)).data.user).toBeNull();
    expect((await admin.from("apiaries").select("id").eq("id", apiary)).data).toEqual([]);
    expect((await admin.from("hives").select("id").eq("id", hive)).data).toEqual([]);
    expect((await admin.from("profiles").select("id").eq("id", u.id)).data).toEqual([]);
    const login = await createClient(url, key, options).auth.signInWithPassword({ email: u.email, password: u.password });
    expect(login.error).not.toBeNull();
  });
});

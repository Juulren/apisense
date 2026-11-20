import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { supabaseConfig } from "../../scripts/supabase-config.mjs";

// Live check of node alerts against the real project, with a temporary user that
// is wiped at the end (data first, then the account).
const runId = randomUUID();
const options = { auth: { persistSession: false, autoRefreshToken: false } };
let admin: SupabaseClient, user: SupabaseClient, userId: string, url: string, key: string;
const apiary = randomUUID(), hive = randomUUID(), mic = randomUUID();
const eui = "70b3d5" + runId.replace(/-/g, "").slice(0, 10);

beforeAll(async () => {
  ({ url, key } = supabaseConfig());
  const secret = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!secret) throw new Error("Falta SUPABASE_TEST_SECRET_KEY");
  admin = createClient(url, secret, options);
  const email = `apisense-${runId}-alerts@example.com`;
  const password = `A!${randomUUID()}z9`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error("createUser");
  userId = created.data.user.id;
  user = createClient(url, key, options);
  const signed = await user.auth.signInWithPassword({ email, password });
  if (signed.error) throw new Error("signIn");
  expect((await user.from("apiaries").insert({ id: apiary, user_id: userId, name: "Apiario alertas" })).error).toBeNull();
  expect((await user.from("hives").insert({ id: hive, apiary_id: apiary, code: "QA-ALERTA" })).error).toBeNull();
});
afterAll(async () => {
  if (!userId) return;
  await admin.rpc("delete_account_data", { target: userId });
  await admin.auth.admin.deleteUser(userId);
  await admin.from("lora_nodes").delete().eq("dev_eui", eui);
});

describe("node alerts on the real project", () => {
  it("creates one neutral alert for a different node message, visible only to its owner", async () => {
    const insert = await admin.from("edge_verdicts").insert({
      id: randomUUID(), hive_id: hive, recorded_at: new Date().toISOString(), source: "lora",
      format_version: 1, class_map_version: 1, class_code: 1, confidence: 0.8,
    });
    expect(insert.error).toBeNull();
    const again = await admin.from("edge_verdicts").insert({
      id: randomUUID(), hive_id: hive, recorded_at: new Date().toISOString(), source: "lora",
      format_version: 1, class_map_version: 1, class_code: 1, confidence: 0.8,
    });
    expect(again.error).toBeNull();
    const mine = await user.from("alert_events").select("kind,title,body,hive_id");
    expect(mine.error).toBeNull();
    expect(mine.data).toHaveLength(1);
    expect(mine.data![0]).toMatchObject({ kind: "verdict", title: "Sonido diferente al habitual", hive_id: hive });
    expect(String(mine.data![0]!.body)).not.toMatch(/reina|plaga|enjambr|ataque/i);
    const forged = await user.from("alert_events").insert({ user_id: userId, hive_id: hive, kind: "verdict", title: "x", body: "y" });
    expect(forged.error).not.toBeNull();
  });
  it("flags a node silent for hours, once, and a phone token is capped and owned by its user", async () => {
    expect((await admin.from("lora_nodes").insert({ dev_eui: eui, claim_hash: "0".repeat(64), owner: userId })).error).toBeNull();
    expect((await admin.from("iot_microphones").insert({
      id: mic, hive_id: hive, mac_address: "LORA-QA", firmware_version: "lorawan", battery_level: 0,
      sampling_rate_hz: 16000, is_online: 0, dev_eui: eui,
    })).error).toBeNull();
    await admin.from("edge_verdicts").update({ recorded_at: new Date(Date.now() - 9 * 3_600_000).toISOString() }).eq("hive_id", hive);
    const first = await admin.rpc("detect_silent_nodes");
    expect(first.error).toBeNull();
    expect(first.data).toBeGreaterThanOrEqual(1);
    const second = await admin.rpc("detect_silent_nodes");
    expect(second.data).toBe(0);
    const silent = await user.from("alert_events").select("kind,body").eq("kind", "node_silent");
    expect(silent.data).toHaveLength(1);
    expect(String(silent.data![0]!.body)).toMatch(/QA-ALERTA no envía mensajes desde hace \d+ h/);

    for (let i = 0; i < 7; i++)
      expect((await user.rpc("claim_push_token", { p_token: `ExponentPushToken-${runId}-${i}`, p_platform: "android" })).error).toBeNull();
    const tokens = await user.from("push_tokens").select("id");
    expect(tokens.data).toHaveLength(5);
    const direct = await user.from("push_tokens").insert({ user_id: userId, token: `ExponentPushToken-${runId}-direct`, platform: "android" });
    expect(direct.error).not.toBeNull();
  });
});

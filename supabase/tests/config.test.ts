import { describe, expect, it } from "vitest";
import { supabaseConfig } from "../../scripts/supabase-config.mjs";
const env = (url: string, key = "sb_publishable_test_fixture") => ({
  EXPO_PUBLIC_SUPABASE_URL: url,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: key,
});
describe("Supabase local preflight configuration", () => {
  it("accepts HTTPS and loopback development origins", () => {
    expect(supabaseConfig(env("https://example.supabase.co/")).url).toBe(
      "https://example.supabase.co",
    );
    expect(supabaseConfig(env("http://localhost:54321")).url).toBe(
      "http://localhost:54321",
    );
  });
  it("rejects missing configuration and unencrypted remote origins", () => {
    expect(() => supabaseConfig({})).toThrow("Faltan");
    expect(() => supabaseConfig(env("http://example.supabase.co"))).toThrow(
      "HTTPS",
    );
  });
  it("rejects secret server keys and privileged legacy JWTs without echoing them", () => {
    expect(() =>
      supabaseConfig(
        env("https://example.supabase.co", "sb_secret_test_fixture"),
      ),
    ).toThrow("Publishable");
    const privileged = `eyJ.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.test`;
    expect(() =>
      supabaseConfig(env("https://example.supabase.co", privileged)),
    ).toThrow("anon");
  });
});

import { describe, expect, it } from "vitest";
import { checkReleaseConfig } from "./check-release-config.mjs";

const valid = {
  EXPO_PUBLIC_DEMO_ONLY: "0",
  EXPO_PUBLIC_SECURITY_QA: "0",
  EXPO_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co",
  EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_synthetic",
};
describe("Field distribution preflight", () => {
  it("accepts public configuration without contacting services", () => {
    expect(() => checkReleaseConfig(valid)).not.toThrow();
  });
  it.each([
    {},
    { EXPO_PUBLIC_DEMO_ONLY: "1" },
    { EXPO_PUBLIC_SECURITY_QA: "1" },
  ])("rejects missing or QA profile flags", (overrides) => {
    expect(() =>
      checkReleaseConfig(
        Object.keys(overrides).length ? { ...valid, ...overrides } : {},
      ),
    ).toThrow("desactivar");
  });
  it("rejects plaintext endpoints even on localhost", () => {
    expect(() =>
      checkReleaseConfig({
        ...valid,
        EXPO_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      }),
    ).toThrow("HTTPS");
  });
  it.each([
    "sb_secret_synthetic",
    `eyJheader.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`,
  ])("rejects server credentials in public environment", (key) => {
    expect(() =>
      checkReleaseConfig({ ...valid, EXPO_PUBLIC_SUPABASE_ANON_KEY: key }),
    ).toThrow(/pública|Publishable/);
  });
});

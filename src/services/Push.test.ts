import { describe, expect, it } from "vitest";
import { registerForPush, routeForNotification, type PushDeps } from "./Push";

function deps(over: Partial<PushDeps> = {}) {
  const claimed: string[][] = [];
  const d: PushDeps = {
    enabled: true,
    platform: "android",
    allowed: async () => true,
    token: async () => "fcm-token-aaaaaaaaaaaaaaaaaaaa",
    claim: async (t, p) => void claimed.push([t, p]),
    ...over,
  };
  return { d, claimed };
}

describe("push registration", () => {
  it("registers the device token for the account", async () => {
    const { d, claimed } = deps();
    expect(await registerForPush(d)).toEqual({
      outcome: "registered",
      token: "fcm-token-aaaaaaaaaaaaaaaaaaaa",
    });
    expect(claimed).toEqual([["fcm-token-aaaaaaaaaaaaaaaaaaaa", "android"]]);
  });
  it("does nothing when push is off or on another platform", async () => {
    const off = deps({ enabled: false });
    expect(await registerForPush(off.d)).toEqual({ outcome: "disabled" });
    const ios = deps({ platform: "ios" });
    expect(await registerForPush(ios.d)).toEqual({ outcome: "disabled" });
    expect(off.claimed.concat(ios.claimed)).toEqual([]);
  });
  it("stops quietly when the person refuses notifications", async () => {
    const { d, claimed } = deps({ allowed: async () => false });
    expect(await registerForPush(d)).toEqual({ outcome: "denied" });
    expect(claimed).toEqual([]);
  });
  it("never throws: a missing token or a failing server means no push", async () => {
    expect(await registerForPush(deps({ token: async () => null }).d)).toEqual({
      outcome: "failed",
    });
    expect(
      await registerForPush(
        deps({
          claim: async () => {
            throw new Error("sin red");
          },
        }).d,
      ),
    ).toEqual({ outcome: "failed" });
  });
});

describe("notification routing", () => {
  it("opens the alerts for node verdicts and the hive for a silent node", () => {
    expect(routeForNotification({ kind: "verdict", hive_id: "h1" })).toBe("/alerts");
    expect(routeForNotification({ kind: "node_silent", hive_id: "h1" })).toBe("/hive/h1");
    expect(routeForNotification({ kind: "node_silent" })).toBe("/alerts");
    expect(routeForNotification(undefined)).toBe("/alerts");
  });
});

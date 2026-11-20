import { describe, expect, it } from "vitest";
import { LocalKeyMissingError, isLocalKeyMissing } from "./localKey";

describe("local key loss", () => {
  it("is recognised, keeps the user-facing message and is not confused with other errors", () => {
    const e = new LocalKeyMissingError();
    expect(isLocalKeyMissing(e)).toBe(true);
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toContain("restaurarla desde tu cuenta");
    expect(isLocalKeyMissing(new Error("otro"))).toBe(false);
    expect(isLocalKeyMissing("x")).toBe(false);
  });
});

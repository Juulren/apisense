import { describe, expect, it } from "vitest";
import { scrollToReveal } from "./KeyboardScroll";

// The list shows from y=100 to y=500 once the keyboard is up.
const view = { viewTop: 100, viewBottom: 500, margin: 16 };

describe("scrollToReveal", () => {
  it("stays put when the field is already visible", () => {
    expect(
      scrollToReveal({ ...view, offset: 800, inputTop: 200, inputHeight: 50 }),
    ).toBeNull();
  });
  it("moves down only as far as needed when the keyboard covers the field", () => {
    // bottom 610 + margin 16 is 126 below the visible edge
    expect(
      scrollToReveal({ ...view, offset: 800, inputTop: 560, inputHeight: 50 }),
    ).toBe(926);
  });
  it("moves up when the top of the field is above the list", () => {
    expect(
      scrollToReveal({ ...view, offset: 800, inputTop: 60, inputHeight: 50 }),
    ).toBe(744);
  });
  it("keeps the start of a field taller than the space in view", () => {
    expect(
      scrollToReveal({ ...view, offset: 0, inputTop: 300, inputHeight: 600 }),
    ).toBe(184);
  });
  it("never goes above the start of the list", () => {
    expect(
      scrollToReveal({ ...view, offset: 10, inputTop: 60, inputHeight: 50 }),
    ).toBe(0);
  });
  it("does nothing without room or with unusable measures", () => {
    for (const bad of [
      { ...view, viewBottom: 100, offset: 5, inputTop: 200, inputHeight: 50 },
      { ...view, offset: 5, inputTop: Number.NaN, inputHeight: 50 },
      { ...view, offset: 5, inputTop: 200, inputHeight: 0 },
    ])
      expect(scrollToReveal(bad)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { greetingFor } from "./Greeting";

const at = (hour: number, minute = 0) => new Date(2026, 10, 25, hour, minute);

describe("greetingFor", () => {
  it("says good morning from 5:00 until noon", () => {
    for (const d of [at(5), at(9, 30), at(11, 59)])
      expect(greetingFor(d)).toBe("Buenos días");
  });
  it("says good afternoon from noon until 19:00", () => {
    for (const d of [at(12), at(16), at(18, 59)])
      expect(greetingFor(d)).toBe("Buenas tardes");
  });
  it("says good night from 19:00 until 5:00", () => {
    for (const d of [at(19), at(22, 41), at(0), at(4, 59)])
      expect(greetingFor(d)).toBe("Buenas noches");
  });
});

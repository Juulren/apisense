import { describe, expect, it } from "vitest";
import type { Inspection } from "../db/types";
import {
  calendarFor,
  checkinDue,
  parseCalendar,
  phaseLabels,
  phaseOn,
  recentDays,
  seasonSignals,
  serializeCalendar,
  suggestPreset,
  yucatanCalendar,
  type Calendar,
  type Phase,
} from "./Seasons";

const noon = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
let counter = 0;
function check(
  when: Date,
  fields: Partial<
    Pick<
      Inspection,
      "activity" | "population" | "stores" | "queen_cells" | "notes"
    >
  > = {},
): Inspection {
  return {
    id: `i${counter++}`,
    updated_at: when.toISOString(),
    synced_at: null,
    deleted_at: null,
    local_revision: 1,
    hive_id: "h",
    inspected_at: when.toISOString(),
    notes: fields.notes ?? "",
    tags_json: "[]",
    queen_seen: 0,
    queen_state: null,
    eggs_state: null,
    queen_cells: fields.queen_cells ?? null,
    activity: fields.activity ?? null,
    population: fields.population ?? null,
    stores: fields.stores ?? null,
  };
}
const uniform = (phase: Phase): Calendar =>
  Array.from({ length: 12 }, () => ({ phase, flora: "x", note: "y" }));

describe("calendar parsing", () => {
  it("round-trips a valid calendar and drops nothing", () => {
    const text = serializeCalendar(yucatanCalendar);
    // Confidence and "fuente única" survive, so an edited calendar keeps its labels.
    expect(parseCalendar(text)).toEqual(yucatanCalendar);
  });
  it("rejects anything that is not exactly the documented shape", () => {
    const months = (n: number) =>
      Array.from({ length: n }, () => ({ phase: "flow", flora: "", note: "" }));
    const wrap = (value: unknown) => JSON.stringify(value);
    expect(parseCalendar(null)).toBeNull();
    expect(parseCalendar("")).toBeNull();
    expect(parseCalendar("{no json")).toBeNull();
    expect(parseCalendar(wrap({ v: 2, months: months(12) }))).toBeNull();
    expect(parseCalendar(wrap({ v: 1, months: months(11) }))).toBeNull();
    expect(parseCalendar(wrap({ v: 1, months: months(13) }))).toBeNull();
    expect(parseCalendar(wrap({ v: 1, months: "x" }))).toBeNull();
    expect(
      parseCalendar(
        wrap({
          v: 1,
          months: [
            { phase: "boom", flora: "", note: "" },
            ...months(11),
          ],
        }),
      ),
    ).toBeNull();
    expect(
      parseCalendar(
        wrap({
          v: 1,
          months: [{ phase: "flow", flora: "", note: "x".repeat(201) }, ...months(11)],
        }),
      ),
    ).toBeNull();
    expect(
      parseCalendar(
        wrap({
          v: 1,
          months: [{ phase: "flow", flora: "x".repeat(61), note: "" }, ...months(11)],
        }),
      ),
    ).toBeNull();
    expect(parseCalendar("x".repeat(9000))).toBeNull();
    expect(
      parseCalendar(
        wrap({
          v: 1,
          months: [{ phase: "flow", flora: "", note: "", confidence: "total" }, ...months(11)],
        }),
      ),
    ).toBeNull();
    expect(
      parseCalendar(
        wrap({
          v: 1,
          months: [{ phase: "flow", flora: "", note: "", single: "si" }, ...months(11)],
        }),
      ),
    ).toBeNull();
  });
  it("accepts empty months, and a calendar at the per-field maximum still fits the size limit", () => {
    const sparse: Calendar = Array.from({ length: 12 }, () => null);
    expect(parseCalendar(serializeCalendar(sparse))).toEqual(sparse);
    const maximal: Calendar = Array.from({ length: 12 }, () => ({
      phase: "reactivation" as const,
      flora: "f".repeat(60),
      note: "n".repeat(200),
      confidence: "media" as const,
      single: true,
    }));
    // Normal use can never hit the 8192-character guard.
    const text = serializeCalendar(maximal);
    expect(text.length).toBeLessThan(8192);
    expect(parseCalendar(text)).toEqual(maximal);
  });
});

describe("which calendar applies", () => {
  it("uses the Yucatán calendar only when chosen, and never invents one", () => {
    expect(
      calendarFor({ region_preset: "yucatan", seasons_json: null }).source,
    ).toBe("yucatan");
    expect(
      calendarFor({ region_preset: "custom", seasons_json: null }),
    ).toEqual({ calendar: null, source: "none" });
    expect(calendarFor({ region_preset: null, seasons_json: null }).source).toBe(
      "none",
    );
    expect(calendarFor(undefined).source).toBe("none");
  });
  it("prefers the user's own calendar, falls back safely when it is damaged", () => {
    const own = serializeCalendar(uniform("hard"));
    expect(
      calendarFor({ region_preset: "yucatan", seasons_json: own }).source,
    ).toBe("custom");
    expect(
      calendarFor({ region_preset: "yucatan", seasons_json: "{bad" }).source,
    ).toBe("yucatan");
    expect(
      calendarFor({ region_preset: "custom", seasons_json: "{bad" }).source,
    ).toBe("none");
    const empty = serializeCalendar(Array.from({ length: 12 }, () => null));
    expect(
      calendarFor({ region_preset: "custom", seasons_json: empty }).source,
    ).toBe("none");
  });
  it("suggests Yucatán only inside the peninsula box", () => {
    expect(suggestPreset(20.97, -89.62)).toBe("yucatan"); // Mérida
    expect(suggestPreset(20.388, -89.323)).toBe("yucatan"); // Maní
    expect(suggestPreset(19.43, -99.13)).toBeNull(); // CDMX
    expect(suggestPreset(40.4, -3.7)).toBeNull();
    expect(suggestPreset(null, -89)).toBeNull();
  });
});

describe("typical phase of the year", () => {
  it("covers all twelve months of the Yucatán calendar with a documented phase", () => {
    expect(yucatanCalendar).toHaveLength(12);
    expect(yucatanCalendar.every((m) => m && m.note.length <= 200)).toBe(true);
    expect(yucatanCalendar.map((m) => m?.phase)).toEqual([
      "flow",
      "flow",
      "flow",
      "flow",
      "transition",
      "hard",
      "hard",
      "hard",
      "hard",
      "reactivation",
      "reactivation",
      "reactivation",
    ]);
    expect(yucatanCalendar[8]).toMatchObject({ confidence: "baja", single: true });
    expect(phaseLabels.hard).not.toMatch(/escasez/i);
  });
  it("reports how long the phase lasts and what comes next", () => {
    const jan = phaseOn(yucatanCalendar, noon(2026, 1, 15));
    expect(jan).toMatchObject({ month: 0, span: 4, changesIn: 4 });
    expect(jan.next?.phase).toBe("transition");
    const jul = phaseOn(yucatanCalendar, noon(2026, 7, 1));
    expect(jul).toMatchObject({ span: 4, changesIn: 3 });
    expect(jul.next?.phase).toBe("reactivation");
  });
  it("handles the year wrap (Oct-Dec reactivation, then January flow)", () => {
    const dec = phaseOn(yucatanCalendar, noon(2026, 12, 31));
    expect(dec).toMatchObject({ month: 11, span: 3, changesIn: 1 });
    expect(dec.next?.phase).toBe("flow");
    const oct = phaseOn(yucatanCalendar, noon(2026, 10, 1));
    expect(oct).toMatchObject({ span: 3, changesIn: 3 });
  });
  it("handles uniform, empty and partial calendars without inventing", () => {
    expect(phaseOn(uniform("flow"), noon(2026, 3, 3))).toMatchObject({
      span: 12,
      changesIn: null,
      next: null,
    });
    expect(phaseOn(null, noon(2026, 3, 3)).info).toBeNull();
    const partial: Calendar = Array.from({ length: 12 }, () => null);
    expect(phaseOn(partial, noon(2026, 3, 3)).info).toBeNull();
    partial[2] = { phase: "flow", flora: "", note: "" };
    expect(phaseOn(partial, noon(2026, 3, 3))).toMatchObject({
      span: 1,
      changesIn: 1,
      next: null,
    });
  });
});

describe("signals from the beekeeper's own check-ins", () => {
  const today = noon(2026, 7, 20);
  it("shows nothing without check-ins or when the latest one is stale", () => {
    expect(seasonSignals([], "hard", today)).toEqual([]);
    expect(
      seasonSignals([check(noon(2026, 7, 20), { notes: "solo nota" })], "hard", today),
    ).toEqual([]);
    expect(
      seasonSignals([check(noon(2026, 7, 5), { stores: "low" })], "hard", today),
    ).toEqual([]);
    expect(
      seasonSignals([check(noon(2026, 7, 6), { stores: "low" })], "hard", today),
    ).toHaveLength(1);
  });
  it("words low stores as the user's note, with season context only when typical", () => {
    const hard = seasonSignals(
      [check(noon(2026, 7, 19), { stores: "low" })],
      "hard",
      today,
    );
    expect(hard[0]?.text).toContain("Anotaste reservas bajas");
    expect(hard[0]?.text).toContain("poca floración");
    const flow = seasonSignals(
      [check(noon(2026, 7, 19), { stores: "low" })],
      "flow",
      today,
    );
    expect(flow[0]?.text).not.toContain("poca floración");
    for (const s of [...hard, ...flow]) {
      expect(s.text).not.toMatch(/aliment|trat|dosis|jarabe/i);
    }
  });
  it("needs two consecutive low-population check-ins", () => {
    const one = [check(noon(2026, 7, 19), { population: "down" })];
    expect(seasonSignals(one, null, today)).toEqual([]);
    const two = [
      check(noon(2026, 7, 12), { population: "down" }),
      check(noon(2026, 7, 19), { population: "down" }),
    ];
    expect(seasonSignals(two, null, today)[0]?.text).toContain("2 últimos");
    const recovered = [
      check(noon(2026, 7, 12), { population: "down" }),
      check(noon(2026, 7, 19), { population: "up" }),
    ];
    expect(seasonSignals(recovered, null, today)).toEqual([]);
  });
  it("flags queen cells without claiming what they mean", () => {
    const [signal] = seasonSignals(
      [check(noon(2026, 7, 19), { queen_cells: "present" })],
      "flow",
      today,
    );
    expect(signal?.text).toContain("enjambrazón o reemplazo");
    expect(signal?.text).toContain("no se puede saber");
  });
  it("lets the user's records override the calendar and says so", () => {
    const [signal] = seasonSignals(
      [check(noon(2026, 7, 19), { stores: "high" })],
      "hard",
      today,
    );
    expect(signal).toMatchObject({ tone: "info" });
    expect(signal?.text).toContain("mandan tus registros");
  });
  it("never shows more than two signals", () => {
    const signals = seasonSignals(
      [
        check(noon(2026, 7, 12), { population: "down" }),
        check(noon(2026, 7, 19), {
          population: "down",
          stores: "low",
          activity: "low",
          queen_cells: "present",
        }),
      ],
      "hard",
      today,
    );
    expect(signals).toHaveLength(2);
  });
});

describe("reminders and the 14-day strip", () => {
  const today = noon(2026, 7, 20);
  it("only reminds when a check-in is due and never when turned off", () => {
    const yesterday = [check(noon(2026, 7, 19))];
    const sameDay = [check(new Date(2026, 6, 20, 7))];
    expect(checkinDue("off", [], today)).toBe(false);
    expect(checkinDue("daily", sameDay, today)).toBe(false);
    expect(checkinDue("daily", yesterday, today)).toBe(true);
    expect(checkinDue("daily", [], today)).toBe(true);
    expect(checkinDue("weekly", [check(noon(2026, 7, 14))], today)).toBe(false);
    expect(checkinDue("weekly", [check(noon(2026, 7, 13))], today)).toBe(true);
  });
  it("marks only the days that exist, oldest first, ending today", () => {
    const days = recentDays(
      [check(noon(2026, 7, 20)), check(noon(2026, 7, 18))],
      today,
    );
    expect(days).toHaveLength(14);
    expect(days[13]).toEqual({ date: "2026-07-20", done: true });
    expect(days[11]).toEqual({ date: "2026-07-18", done: true });
    expect(days[12]).toEqual({ date: "2026-07-19", done: false });
    expect(days[0]?.date).toBe("2026-07-07");
    expect(days.filter((d) => d.done)).toHaveLength(2);
  });
});

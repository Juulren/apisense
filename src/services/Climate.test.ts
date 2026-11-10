import { describe, expect, it, vi } from "vitest";
import {
  climateUrl,
  contextLabel,
  loadClimate,
  monthContexts,
  monthlyClimatology,
  parseDaily,
  CLIMATE_TTL_MS,
  type Climatology,
} from "./Climate";

const NOW = new Date("2026-11-09T18:00:00.000Z");
// Mérida-like monthly pattern (WeatherSpark averages; only used as test data).
const TEMP = [23.3, 24.4, 26.1, 27.8, 28.9, 28.3, 27.8, 27.8, 27.2, 26.7, 25, 23.9];
const RAIN = [25, 23, 18, 23, 51, 107, 97, 107, 137, 91, 43, 28];
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

function daily(
  years: number[],
  temp = TEMP,
  rain = RAIN,
  drop?: (y: number, m: number, d: number) => boolean,
) {
  const time: string[] = [],
    t: (number | null)[] = [],
    r: (number | null)[] = [];
  for (const y of years)
    for (let m = 0; m < 12; m++)
      for (let d = 1; d <= daysIn(y, m); d++) {
        time.push(`${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
        const gone = drop?.(y, m, d) ?? false;
        t.push(gone ? null : temp[m]!);
        r.push(gone ? null : rain[m]! / daysIn(y, m));
      }
  return { time, temp: t, rain: r };
}
const body = (years: number[]) => {
  const d = daily(years);
  return {
    daily: {
      time: d.time,
      temperature_2m_mean: d.temp,
      precipitation_sum: d.rain,
    },
  };
};
const ok = (json: unknown) => async () => ({ ok: true, json: async () => json });
function memory(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    store,
    setting: async (key: string) => store[key],
    setSetting: async (key: string, value: string) => {
      store[key] = value;
    },
  };
}
const apiary = {
  id: "ap1",
  latitude: 20.968,
  longitude: -89.623,
  weather_enabled: 1,
};
const live = { offline: false, now: NOW };
const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i);

describe("request", () => {
  it("asks ERA5 for ten full past years with rounded coordinates over HTTPS", () => {
    const { url, fromYear, toYear } = climateUrl(20.9684, -89.6249, NOW);
    const u = new URL(url);
    expect(u.protocol).toBe("https:");
    expect(u.host).toBe("archive-api.open-meteo.com");
    expect([...u.searchParams.keys()].sort()).toEqual([
      "daily",
      "end_date",
      "latitude",
      "longitude",
      "start_date",
      "timezone",
    ]);
    expect(u.searchParams.get("latitude")).toBe("20.97");
    expect(u.searchParams.get("longitude")).toBe("-89.62");
    expect(u.searchParams.get("daily")).toBe("temperature_2m_mean,precipitation_sum");
    expect([fromYear, toYear]).toEqual([2016, 2025]);
    expect(u.searchParams.get("start_date")).toBe("2016-01-01");
    expect(u.searchParams.get("end_date")).toBe("2025-12-31");
  });
});

describe("parsing", () => {
  it("accepts matching arrays and nulls out impossible values", () => {
    const parsed = parseDaily({
      daily: {
        time: ["2020-01-01", "2020-01-02", "2020-01-03"],
        temperature_2m_mean: [25, -120, null],
        precipitation_sum: [0, 3, -4],
      },
    });
    expect(parsed).toEqual({
      time: ["2020-01-01", "2020-01-02", "2020-01-03"],
      temp: [25, null, null],
      rain: [0, 3, null],
    });
  });
  it("rejects missing, mismatched or malformed data", () => {
    expect(parseDaily(null)).toBeNull();
    expect(parseDaily({})).toBeNull();
    expect(
      parseDaily({ daily: { time: ["2020-01-01"], temperature_2m_mean: [1, 2], precipitation_sum: [1] } }),
    ).toBeNull();
    expect(
      parseDaily({ daily: { time: ["enero"], temperature_2m_mean: [1], precipitation_sum: [1] } }),
    ).toBeNull();
    expect(
      parseDaily({ daily: { time: [], temperature_2m_mean: [], precipitation_sum: [] } }),
    ).toBeNull();
  });
});

describe("monthly climatology", () => {
  it("averages daily values into twelve monthly figures", () => {
    const d = daily([2021, 2022, 2023, 2024]);
    const clim = monthlyClimatology(d.time, d.temp, d.rain);
    clim.forEach((m, i) => {
      expect(m?.tempC).toBeCloseTo(TEMP[i]!, 6);
      expect(m?.rainMm).toBeCloseTo(RAIN[i]!, 6);
    });
  });
  it("ignores month-years that are mostly missing and returns null without enough years", () => {
    // August is mostly missing in 2 of 4 years: only 2 usable years remain.
    const d = daily([2021, 2022, 2023, 2024], TEMP, RAIN, (y, m, day) => m === 7 && y <= 2022 && day > 5);
    const clim = monthlyClimatology(d.time, d.temp, d.rain);
    expect(clim[7]).toBeNull();
    expect(clim[6]?.rainMm).toBeCloseTo(RAIN[6]!, 6);
    // Fewer than three years in total: nothing is claimed.
    const short = daily([2023, 2024]);
    expect(monthlyClimatology(short.time, short.temp, short.rain).every((m) => m === null)).toBe(true);
  });
});

describe("context relative to the place", () => {
  const clim: Climatology = TEMP.map((tempC, i) => ({ tempC, rainMm: RAIN[i]! }));
  it("tags the wettest/driest and warmest/coolest thirds of this place's year", () => {
    const ctx = monthContexts(clim);
    expect(ctx[0]).toEqual({ rain: "dry", temp: "cool" }); // enero
    expect(ctx[8]).toEqual({ rain: "wet", temp: null }); // septiembre
    expect(ctx[5]).toEqual({ rain: "wet", temp: "warm" }); // junio
    expect(ctx[10]).toEqual({ rain: null, temp: "cool" }); // noviembre
    expect(ctx[3]).toEqual({ rain: "dry", temp: "warm" }); // abril
  });
  it("calls nothing wet or cool when the year is flat or the data is thin", () => {
    const flat: Climatology = Array.from({ length: 12 }, (_, i) => ({
      tempC: 20 + (i % 2) * 0.5,
      rainMm: 80 + (i % 3) * 5,
    }));
    expect(monthContexts(flat).every((c) => c.rain === null && c.temp === null)).toBe(true);
    const thin: Climatology = clim.map((m, i) => (i < 4 ? m : null));
    expect(monthContexts(thin).every((c) => c.rain === null && c.temp === null)).toBe(true);
  });
  it("words it as relative, never as a bloom or flow", () => {
    const ctx = monthContexts(clim);
    expect(contextLabel(ctx[5])).toBe("más lluvioso y más cálido");
    expect(contextLabel(ctx[0])).toBe("más seco y más fresco");
    expect(contextLabel({ rain: null, temp: null })).toBe("");
    expect(contextLabel(undefined)).toBe("");
    for (const c of ctx) expect(contextLabel(c)).not.toMatch(/flor|néctar|flujo/i);
  });
});

describe("loading with cache", () => {
  it("makes no request with the switch off or without a location", async () => {
    const fetchImpl = vi.fn(ok(body(YEARS)));
    const s = memory();
    expect((await loadClimate(s, { ...apiary, weather_enabled: 0 }, { ...live, fetchImpl })).disabled).toBe("off");
    expect((await loadClimate(s, { ...apiary, latitude: null }, { ...live, fetchImpl })).disabled).toBe("no-location");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("fetches once, saves, and serves the cache for a year", async () => {
    const fetchImpl = vi.fn(ok(body(YEARS)));
    const s = memory();
    const first = await loadClimate(s, apiary, { ...live, fetchImpl });
    expect(first.reading?.fromYear).toBe(2016);
    expect(first.reading?.toYear).toBe(2025);
    expect(first.reading?.months[5]?.rainMm).toBeCloseTo(107, 3);
    await loadClimate(s, apiary, {
      ...live,
      now: new Date(NOW.getTime() + CLIMATE_TTL_MS - 1000),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loadClimate(s, apiary, {
      ...live,
      now: new Date(NOW.getTime() + CLIMATE_TTL_MS),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("never shows another location's climate and refetches when the apiary moves", async () => {
    const fetchImpl = vi.fn(ok(body(YEARS)));
    const s = memory();
    await loadClimate(s, apiary, { ...live, fetchImpl });
    const moved = { ...apiary, latitude: 40.4, longitude: -3.7 };
    const offline = await loadClimate(s, moved, { ...live, offline: true, fetchImpl });
    expect(offline.reading).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loadClimate(s, moved, { ...live, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("serves the saved reading offline and after a failed request", async () => {
    const s = memory();
    await loadClimate(s, apiary, { ...live, fetchImpl: ok(body(YEARS)) });
    const later = { ...live, now: new Date(NOW.getTime() + 2 * CLIMATE_TTL_MS) };
    const offline = await loadClimate(s, apiary, { ...later, offline: true });
    expect(offline).toMatchObject({ disabled: "offline" });
    expect(offline.reading?.months[0]).not.toBeNull();
    for (const fetchImpl of [
      async () => {
        throw new Error("network");
      },
      async () => ({ ok: false, json: async () => ({}) }),
      ok({ daily: { time: ["x"] } }),
    ]) {
      const state = await loadClimate(s, apiary, { ...later, fetchImpl });
      expect(state.reading?.months[0]).not.toBeNull();
    }
  });
  it("aborts a request that never answers and ignores a damaged cache entry", async () => {
    const hang = (_u: string, init?: { signal?: AbortSignal }) =>
      new Promise<never>((_r, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("abort")));
      });
    const s = memory({ "climate:ap1": "{broken" });
    const state = await loadClimate(s, apiary, { ...live, fetchImpl: hang, timeoutMs: 20 });
    expect(state.reading).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  ageLabel,
  forecastUrl,
  geocodeUrl,
  loadWeather,
  parseForecast,
  parsePlaces,
  roundCoordinate,
  searchPlaces,
  WEATHER_REFRESH_MS,
} from "./Weather";

const NOW = new Date("2026-11-09T18:00:00.000Z");
const body = {
  current: {
    temperature_2m: 27.4,
    relative_humidity_2m: 71,
    precipitation: 0.2,
    wind_speed_10m: 13.5,
  },
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
const live = { demo: false, offline: false, now: NOW };

describe("what leaves the device", () => {
  it("rounds coordinates to ~1 km and sends only the requested variables over HTTPS", () => {
    expect(roundCoordinate(20.9684)).toBe(20.97);
    expect(roundCoordinate(-89.6249)).toBe(-89.62);
    const url = new URL(forecastUrl(20.9684, -89.6249));
    expect(url.protocol).toBe("https:");
    expect(url.host).toBe("api.open-meteo.com");
    expect([...url.searchParams.keys()].sort()).toEqual([
      "current",
      "latitude",
      "longitude",
      "timezone",
    ]);
    expect(url.searchParams.get("latitude")).toBe("20.97");
    expect(url.searchParams.get("longitude")).toBe("-89.62");
    expect(url.searchParams.get("current")).toBe(
      "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
    );
  });
  it("sends only the typed text when searching a place", () => {
    const url = new URL(geocodeUrl("  Mérida "));
    expect(url.host).toBe("geocoding-api.open-meteo.com");
    expect(url.searchParams.get("name")).toBe("Mérida");
    expect([...url.searchParams.keys()].sort()).toEqual([
      "count",
      "language",
      "name",
    ]);
  });
});

describe("parsing", () => {
  it("accepts a complete reading and rejects anything partial or absurd", () => {
    expect(parseForecast(body, "t")).toEqual({
      temperature: 27.4,
      humidity: 71,
      wind: 13.5,
      precipitation: 0.2,
      fetchedAt: "t",
    });
    expect(parseForecast(null, "t")).toBeNull();
    expect(parseForecast({}, "t")).toBeNull();
    expect(
      parseForecast({ current: { ...body.current, temperature_2m: "27" } }, "t"),
    ).toBeNull();
    expect(
      parseForecast({ current: { ...body.current, relative_humidity_2m: 140 } }, "t"),
    ).toBeNull();
    expect(
      parseForecast({ current: { ...body.current, wind_speed_10m: -1 } }, "t"),
    ).toBeNull();
    expect(
      parseForecast({ current: { ...body.current, temperature_2m: NaN } }, "t"),
    ).toBeNull();
  });
  it("keeps only valid places", () => {
    expect(parsePlaces({})).toEqual([]);
    expect(
      parsePlaces({
        results: [
          { name: "Mérida", latitude: 20.96, longitude: -89.62, admin1: "Yucatán", country: "México" },
          { name: "Roto", latitude: 200, longitude: 1 },
          { latitude: 1, longitude: 1 },
        ],
      }),
    ).toEqual([
      { name: "Mérida", region: "Yucatán, México", latitude: 20.96, longitude: -89.62 },
    ]);
  });
});

describe("loading with cache and every opt-out", () => {
  it("makes no request in the demo, with the toggle off, without location or offline", async () => {
    const fetchImpl = vi.fn(ok(body));
    const s = memory();
    expect((await loadWeather(s, apiary, { ...live, demo: true, fetchImpl })).disabled).toBe("demo");
    expect(
      (await loadWeather(s, { ...apiary, weather_enabled: 0 }, { ...live, fetchImpl })).disabled,
    ).toBe("off");
    expect(
      (await loadWeather(s, { ...apiary, latitude: null }, { ...live, fetchImpl })).disabled,
    ).toBe("no-location");
    expect((await loadWeather(s, apiary, { ...live, offline: true, fetchImpl })).disabled).toBe("offline");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("fetches, saves and then serves the cache for an hour", async () => {
    const fetchImpl = vi.fn(ok(body));
    const s = memory();
    const first = await loadWeather(s, apiary, { ...live, fetchImpl });
    expect(first.reading?.temperature).toBe(27.4);
    expect(first.stale).toBe(false);
    const again = await loadWeather(s, apiary, {
      ...live,
      now: new Date(NOW.getTime() + WEATHER_REFRESH_MS - 1000),
      fetchImpl,
    });
    expect(again.reading?.fetchedAt).toBe(NOW.toISOString());
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loadWeather(s, apiary, {
      ...live,
      now: new Date(NOW.getTime() + WEATHER_REFRESH_MS),
      fetchImpl,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
  it("falls back to the last saved reading on timeout, error status or bad data", async () => {
    const s = memory();
    await loadWeather(s, apiary, { ...live, fetchImpl: ok(body) });
    const later = { ...live, now: new Date(NOW.getTime() + 2 * WEATHER_REFRESH_MS) };
    const failing: Array<() => Promise<{ ok: boolean; json(): Promise<unknown> }>> = [
      async () => {
        throw new Error("network");
      },
      async () => ({ ok: false, json: async () => ({}) }),
      ok({ current: { temperature_2m: 1 } }),
    ];
    for (const fetchImpl of failing) {
      const state = await loadWeather(s, apiary, { ...later, fetchImpl });
      expect(state.reading?.temperature).toBe(27.4);
      expect(state.stale).toBe(true);
    }
  });
  it("aborts a request that never answers", async () => {
    const s = memory();
    const hang = (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise<never>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("abort")));
      });
    const state = await loadWeather(s, apiary, { ...live, fetchImpl: hang, timeoutMs: 20 });
    expect(state.reading).toBeNull();
  });
  it("ignores a damaged cache entry", async () => {
    const s = memory({ "weather:ap1": "{broken" });
    const state = await loadWeather(s, apiary, { ...live, fetchImpl: ok(body) });
    expect(state.reading?.temperature).toBe(27.4);
  });
});

describe("place search", () => {
  it("does not call the network for fewer than 3 characters", async () => {
    const fetchImpl = vi.fn(ok({ results: [] }));
    expect(await searchPlaces("Mé", fetchImpl)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    await searchPlaces("Mérida", fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it("returns nothing when the request fails", async () => {
    const boom = async () => {
      throw new Error("offline");
    };
    expect(await searchPlaces("Mérida", boom)).toEqual([]);
  });
});

describe("age label", () => {
  it("describes how old a reading is", () => {
    const at = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
    expect(ageLabel(at(0), NOW)).toBe("ahora");
    expect(ageLabel(at(25), NOW)).toBe("hace 25 min");
    expect(ageLabel(at(180), NOW)).toBe("hace 3 h");
    expect(ageLabel(at(60 * 24 * 5), NOW)).toBe("hace 5 días");
  });
});

import type { Apiary } from "../db/types";

// Open-Meteo, no API key. Used under the owner's decision that this is a personal,
// non-commercial project; review the licence before any commercial use.
// Privacy: only rounded latitude/longitude and the requested variables leave the
// device (HTTPS). No ids, no apiary name, no headers beyond the defaults.
export const WEATHER_TIMEOUT_MS = 8000;
export const WEATHER_REFRESH_MS = 60 * 60 * 1000;
export const WEATHER_LABEL = "Pronóstico/modelo, no medido en el apiario";
export const MIN_PLACE_QUERY = 3;
export const PLACE_DEBOUNCE_MS = 500;

export interface WeatherReading {
  temperature: number;
  humidity: number;
  wind: number;
  precipitation: number;
  fetchedAt: string;
}
export interface Place {
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}
type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** About 1 km: enough for weather, not a precise location. */
export const roundCoordinate = (value: number) => Math.round(value * 100) / 100;

export function forecastUrl(lat: number, lon: number) {
  const params = new URLSearchParams({
    latitude: String(roundCoordinate(lat)),
    longitude: String(roundCoordinate(lon)),
    current: "temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m",
    timezone: "auto",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}
export function geocodeUrl(query: string) {
  const params = new URLSearchParams({
    name: query.trim(),
    count: "5",
    language: "es",
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`;
}

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function parseForecast(
  json: unknown,
  fetchedAt: string,
): WeatherReading | null {
  const current = (json as { current?: Record<string, unknown> } | null)
    ?.current;
  if (!current) return null;
  const { temperature_2m, relative_humidity_2m, precipitation, wind_speed_10m } =
    current;
  if (
    !finite(temperature_2m) ||
    !finite(relative_humidity_2m) ||
    !finite(precipitation) ||
    !finite(wind_speed_10m) ||
    temperature_2m < -60 ||
    temperature_2m > 70 ||
    relative_humidity_2m < 0 ||
    relative_humidity_2m > 100 ||
    precipitation < 0 ||
    wind_speed_10m < 0
  )
    return null;
  return {
    temperature: temperature_2m,
    humidity: relative_humidity_2m,
    wind: wind_speed_10m,
    precipitation,
    fetchedAt,
  };
}
export function parsePlaces(json: unknown): Place[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const places: Place[] = [];
  for (const raw of results) {
    const r = raw as Record<string, unknown>;
    if (
      typeof r.name === "string" &&
      finite(r.latitude) &&
      finite(r.longitude) &&
      Math.abs(r.latitude) <= 90 &&
      Math.abs(r.longitude) <= 180
    )
      places.push({
        name: r.name,
        region: [r.admin1, r.country]
          .filter((v): v is string => typeof v === "string")
          .join(", "),
        latitude: r.latitude,
        longitude: r.longitude,
      });
  }
  return places;
}

async function getJson(url: string, fetchImpl: FetchLike, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
export async function fetchWeather(
  lat: number,
  lon: number,
  now = new Date(),
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = WEATHER_TIMEOUT_MS,
) {
  const json = await getJson(forecastUrl(lat, lon), fetchImpl, timeoutMs);
  return parseForecast(json, now.toISOString());
}
/** Sends only the typed text; callers debounce and require MIN_PLACE_QUERY. */
export async function searchPlaces(
  query: string,
  fetchImpl: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = WEATHER_TIMEOUT_MS,
) {
  if (query.trim().length < MIN_PLACE_QUERY) return [];
  return parsePlaces(await getJson(geocodeUrl(query), fetchImpl, timeoutMs));
}

interface SettingsPort {
  setting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}
const cacheKey = (apiaryId: string) => `weather:${apiaryId}`;
function readCache(raw: string | undefined): WeatherReading | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as WeatherReading;
    return parseForecast(
      {
        current: {
          temperature_2m: value.temperature,
          relative_humidity_2m: value.humidity,
          precipitation: value.precipitation,
          wind_speed_10m: value.wind,
        },
      },
      typeof value.fetchedAt === "string" ? value.fetchedAt : "",
    );
  } catch {
    return null;
  }
}
export interface WeatherState {
  reading: WeatherReading | null;
  /** True when the shown reading is older than the refresh window. */
  stale: boolean;
  /** Why nothing was requested, so the screen can explain instead of guessing. */
  disabled: "demo" | "off" | "no-location" | "offline" | null;
}
/**
 * Never throws and never blocks saving anything: on any failure it returns the
 * last saved reading. Makes no request in the demo, with the apiary toggle off,
 * without coordinates, in offline mode, or while the saved reading is fresh.
 */
export async function loadWeather(
  settings: SettingsPort,
  apiary: Pick<Apiary, "id" | "latitude" | "longitude" | "weather_enabled">,
  options: {
    demo: boolean;
    offline: boolean;
    now?: Date;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  },
): Promise<WeatherState> {
  const now = options.now ?? new Date();
  const cached = readCache(await settings.setting(cacheKey(apiary.id)));
  const stale = (r: WeatherReading | null) =>
    !r || now.getTime() - Date.parse(r.fetchedAt) >= WEATHER_REFRESH_MS;
  const state = (disabled: WeatherState["disabled"]): WeatherState => ({
    reading: cached,
    stale: stale(cached),
    disabled,
  });
  if (options.demo) return { reading: null, stale: false, disabled: "demo" };
  if (apiary.weather_enabled !== 1) return state("off");
  if (apiary.latitude === null || apiary.longitude === null)
    return state("no-location");
  if (options.offline) return state("offline");
  if (cached && !stale(cached)) return state(null);
  const fresh = await fetchWeather(
    apiary.latitude,
    apiary.longitude,
    now,
    options.fetchImpl,
    options.timeoutMs,
  );
  if (!fresh) return state(null);
  await settings.setSetting(cacheKey(apiary.id), JSON.stringify(fresh));
  return { reading: fresh, stale: false, disabled: null };
}

export function ageLabel(fetchedAt: string, now = new Date()) {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - Date.parse(fetchedAt)) / 60_000),
  );
  if (minutes < 2) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} días`;
}

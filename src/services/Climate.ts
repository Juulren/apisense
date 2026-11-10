import type { Apiary } from "../db/types";
import { roundCoordinate } from "./Weather";

// Climate context for ANY location: how each month compares with that place's
// own climate (Open-Meteo / ERA5 daily history, aggregated on the device).
// It says "wetter / drier / cooler / warmer than the rest of the year here".
// It does NOT say when anything blooms or when a nectar flow starts: that needs
// local flora, which the climate alone cannot tell.
export const CLIMATE_YEARS = 10;
export const CLIMATE_TTL_MS = 365 * 86_400_000;
export const CLIMATE_TIMEOUT_MS = 20_000;
export const CLIMATE_SOURCE = "ERA5 vía Open-Meteo";
export const CLIMATE_NOTE =
  "El clima describe el lugar, no la floración: no indica cuándo empieza un flujo de néctar.";
// Below these spreads the year is too uniform to call a month wetter/cooler.
const MIN_RAIN_SPREAD_MM = 30;
const MIN_TEMP_SPREAD_C = 4;
const MIN_YEARS_PER_MONTH = 3;

export interface MonthClimate {
  tempC: number;
  rainMm: number;
}
export type Climatology = (MonthClimate | null)[];
export interface MonthContext {
  rain: "wet" | "dry" | null;
  temp: "warm" | "cool" | null;
}
export interface ClimateReading {
  months: Climatology;
  fromYear: number;
  toYear: number;
  fetchedAt: string;
  lat: number;
  lon: number;
}
type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export function climateUrl(lat: number, lon: number, now = new Date()) {
  const toYear = now.getFullYear() - 1;
  const fromYear = toYear - CLIMATE_YEARS + 1;
  const params = new URLSearchParams({
    latitude: String(roundCoordinate(lat)),
    longitude: String(roundCoordinate(lon)),
    start_date: `${fromYear}-01-01`,
    end_date: `${toYear}-12-31`,
    daily: "temperature_2m_mean,precipitation_sum",
    timezone: "auto",
  });
  return {
    url: `https://archive-api.open-meteo.com/v1/archive?${params.toString()}`,
    fromYear,
    toYear,
  };
}

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function parseDaily(json: unknown) {
  const daily = (json as { daily?: Record<string, unknown> } | null)?.daily;
  const time = daily?.time,
    temp = daily?.temperature_2m_mean,
    rain = daily?.precipitation_sum;
  if (
    !Array.isArray(time) ||
    !Array.isArray(temp) ||
    !Array.isArray(rain) ||
    time.length === 0 ||
    time.length !== temp.length ||
    time.length !== rain.length ||
    !time.every((t) => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t))
  )
    return null;
  return {
    time: time as string[],
    temp: temp.map((v) => (finite(v) && v > -90 && v < 70 ? v : null)),
    rain: rain.map((v) => (finite(v) && v >= 0 && v < 2000 ? v : null)),
  };
}

/** Monthly mean temperature and mean monthly rainfall, averaged over the years. */
export function monthlyClimatology(
  time: string[],
  temp: (number | null)[],
  rain: (number | null)[],
): Climatology {
  type Bucket = { t: number[]; r: number[]; days: number };
  const buckets = new Map<string, Bucket>();
  time.forEach((day, i) => {
    const key = day.slice(0, 7);
    const bucket = buckets.get(key) ?? { t: [], r: [], days: 0 };
    bucket.days++;
    const t = temp[i],
      r = rain[i];
    if (t !== null && t !== undefined) bucket.t.push(t);
    if (r !== null && r !== undefined) bucket.r.push(r);
    buckets.set(key, bucket);
  });
  const perMonth = Array.from({ length: 12 }, () => ({
    t: [] as number[],
    r: [] as number[],
  }));
  for (const [key, b] of buckets) {
    const month = Number(key.slice(5, 7)) - 1;
    if (month < 0 || month > 11) continue;
    // Only count month-years that are almost complete.
    if (b.t.length >= Math.ceil(b.days * 0.8))
      perMonth[month]!.t.push(b.t.reduce((a, v) => a + v, 0) / b.t.length);
    if (b.r.length >= Math.ceil(b.days * 0.8))
      perMonth[month]!.r.push(b.r.reduce((a, v) => a + v, 0));
  }
  return perMonth.map((m) =>
    m.t.length >= MIN_YEARS_PER_MONTH && m.r.length >= MIN_YEARS_PER_MONTH
      ? {
          tempC: m.t.reduce((a, v) => a + v, 0) / m.t.length,
          rainMm: m.r.reduce((a, v) => a + v, 0) / m.r.length,
        }
      : null,
  );
}

function thirds(values: (number | null)[], minSpread: number) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 6) return values.map(() => 0);
  const sorted = [...present].sort((a, b) => a - b);
  if (sorted[sorted.length - 1]! - sorted[0]! < minSpread)
    return values.map(() => 0);
  const low = sorted[Math.floor(sorted.length / 3) - 1]!,
    high = sorted[sorted.length - Math.floor(sorted.length / 3)]!;
  return values.map((v) =>
    v === null ? 0 : v <= low ? -1 : v >= high ? 1 : 0,
  );
}
/** Relative to this place's own year, by thirds; nothing when the year is flat. */
export function monthContexts(climate: Climatology): MonthContext[] {
  const rain = thirds(
    climate.map((m) => m?.rainMm ?? null),
    MIN_RAIN_SPREAD_MM,
  );
  const temp = thirds(
    climate.map((m) => m?.tempC ?? null),
    MIN_TEMP_SPREAD_C,
  );
  return climate.map((_, i) => ({
    rain: rain[i] === 1 ? "wet" : rain[i] === -1 ? "dry" : null,
    temp: temp[i] === 1 ? "warm" : temp[i] === -1 ? "cool" : null,
  }));
}
export function contextLabel(context: MonthContext | undefined) {
  if (!context) return "";
  const parts: string[] = [];
  if (context.rain === "wet") parts.push("más lluvioso");
  if (context.rain === "dry") parts.push("más seco");
  if (context.temp === "warm") parts.push("más cálido");
  if (context.temp === "cool") parts.push("más fresco");
  return parts.join(" y ");
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

interface SettingsPort {
  setting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<void>;
}
const cacheKey = (apiaryId: string) => `climate:${apiaryId}`;
function readCache(raw: string | undefined): ClimateReading | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as ClimateReading;
    if (
      !Array.isArray(v.months) ||
      v.months.length !== 12 ||
      !finite(v.fromYear) ||
      !finite(v.toYear) ||
      !finite(v.lat) ||
      !finite(v.lon) ||
      typeof v.fetchedAt !== "string"
    )
      return null;
    return v;
  } catch {
    return null;
  }
}

export interface ClimateState {
  reading: ClimateReading | null;
  disabled: "off" | "no-location" | "offline" | null;
}
/**
 * One request per location per year, cached. Same switch and the same privacy
 * rules as the weather: rounded coordinates only, never blocks anything, falls
 * back to the saved reading, and asks nothing while offline.
 */
export async function loadClimate(
  settings: SettingsPort,
  apiary: Pick<Apiary, "id" | "latitude" | "longitude" | "weather_enabled">,
  options: {
    offline: boolean;
    now?: Date;
    fetchImpl?: FetchLike;
    timeoutMs?: number;
  },
): Promise<ClimateState> {
  const now = options.now ?? new Date();
  const cached = readCache(await settings.setting(cacheKey(apiary.id)));
  const state = (disabled: ClimateState["disabled"]): ClimateState => ({
    reading: cached,
    disabled,
  });
  if (apiary.weather_enabled !== 1) return state("off");
  if (apiary.latitude === null || apiary.longitude === null)
    return state("no-location");
  const lat = roundCoordinate(apiary.latitude),
    lon = roundCoordinate(apiary.longitude);
  const sameSpot = cached && cached.lat === lat && cached.lon === lon;
  const fresh =
    sameSpot && now.getTime() - Date.parse(cached.fetchedAt) < CLIMATE_TTL_MS;
  // A reading for another location is never shown for this one.
  const usable = sameSpot ? cached : null;
  if (fresh) return { reading: usable, disabled: null };
  if (options.offline) return { reading: usable, disabled: "offline" };
  const { url, fromYear, toYear } = climateUrl(lat, lon, now);
  const daily = parseDaily(
    await getJson(
      url,
      options.fetchImpl ?? (fetch as unknown as FetchLike),
      options.timeoutMs ?? CLIMATE_TIMEOUT_MS,
    ),
  );
  if (!daily) return { reading: usable, disabled: null };
  const months = monthlyClimatology(daily.time, daily.temp, daily.rain);
  if (months.every((m) => m === null))
    return { reading: usable, disabled: null };
  const reading: ClimateReading = {
    months,
    fromYear,
    toYear,
    fetchedAt: now.toISOString(),
    lat,
    lon,
  };
  await settings.setSetting(cacheKey(apiary.id), JSON.stringify(reading));
  return { reading, disabled: null };
}

import type { Repository } from "../db/Repository";
import type { CheckinFrequency, RegionPreset } from "../db/types";
import {
  serializeCalendar,
  yucatanCalendar,
  type Calendar,
} from "./Seasons";

export const MIN_APIARY_NAME = 3;
export const MAX_APIARY_NAME = 80;

/** Both coordinates or none; always within range. */
export function parseLocation(lat: string, lon: string) {
  const latText = lat.trim().replace(",", "."),
    lonText = lon.trim().replace(",", ".");
  if (!latText && !lonText) return { latitude: null, longitude: null };
  const latitude = Number(latText),
    longitude = Number(lonText);
  if (
    !latText ||
    !lonText ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    throw new Error("Revisa latitud y longitud");
  return { latitude, longitude };
}

export interface ApiaryProfile {
  name: string;
  lat: string;
  lon: string;
  checkin_frequency: CheckinFrequency;
  weather_enabled: boolean;
  region_preset: RegionPreset | null;
  /** The calendar the user sees; null means none. */
  calendar: Calendar | null;
}

const sameCalendar = (a: Calendar, b: Calendar) =>
  serializeCalendar(a) === serializeCalendar(b);

export async function saveApiaryProfile(
  repo: Repository,
  apiaryId: string,
  profile: ApiaryProfile,
) {
  const apiary = await repo.get("apiaries", apiaryId);
  // A stale screen must not edit or revive a removed apiary.
  if (!apiary || apiary.deleted_at)
    throw new Error("El apiario ya no está disponible");
  const name = profile.name.trim();
  if (name.length < MIN_APIARY_NAME)
    throw new Error("Escribe un nombre de al menos 3 caracteres");
  if (name.length > MAX_APIARY_NAME)
    throw new Error(`Usa máximo ${MAX_APIARY_NAME} caracteres`);
  const { latitude, longitude } = parseLocation(profile.lat, profile.lon);
  if (profile.weather_enabled && latitude === null)
    throw new Error("Para ver el clima indica la ubicación del apiario");
  // The built-in Yucatán calendar is stored as a preset only; any edit to it,
  // or any custom calendar, is stored in full.
  const calendar = profile.calendar;
  const hasMonths = Boolean(calendar?.some(Boolean));
  const usesPreset =
    profile.region_preset === "yucatan" &&
    calendar !== null &&
    sameCalendar(calendar, yucatanCalendar);
  return repo.save("apiaries", {
    id: apiary.id,
    user_id: apiary.user_id,
    name,
    latitude,
    longitude,
    check_interval_minutes: apiary.check_interval_minutes,
    region_preset: profile.region_preset,
    seasons_json:
      calendar && hasMonths && !usesPreset ? serializeCalendar(calendar) : null,
    weather_enabled: profile.weather_enabled ? 1 : 0,
    checkin_frequency: profile.checkin_frequency,
  });
}

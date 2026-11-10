import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Apiary } from "../db/types";
import { loadWeather, type WeatherState } from "../services/Weather";
import { useApp } from "./AppProvider";

/** Loads (or serves from cache) the weather for an apiary; never throws. */
export function useWeather(apiary: Apiary | undefined) {
  const app = useApp();
  const [state, setState] = useState<WeatherState | null>(null);
  const workspace = app.workspace;
  const offline = app.data.settings.offline === "1";
  const id = apiary?.id,
    lat = apiary?.latitude ?? null,
    lon = apiary?.longitude ?? null,
    enabled = apiary?.weather_enabled ?? 0;
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (!workspace || !id) {
        setState(null);
        return;
      }
      void loadWeather(
        workspace.repo,
        { id, latitude: lat, longitude: lon, weather_enabled: enabled },
        { demo: workspace.demo, offline },
      )
        .then((next) => {
          if (!cancelled) setState(next);
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [workspace, id, lat, lon, enabled, offline]),
  );
  return state;
}

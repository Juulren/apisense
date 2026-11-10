import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Apiary } from "../db/types";
import { loadClimate, type ClimateState } from "../services/Climate";
import { useApp } from "./AppProvider";

/** Climate of the apiary's own location (cached for a year); never throws. */
export function useClimate(apiary: Apiary | undefined) {
  const app = useApp();
  const [state, setState] = useState<ClimateState | null>(null);
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
      void loadClimate(
        workspace.repo,
        { id, latitude: lat, longitude: lon, weather_enabled: enabled },
        { offline },
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

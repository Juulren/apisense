import { useApp } from "./AppProvider";
import { playDone } from "../services/sounds";

/** The "saved" tone, unless sounds are turned off in Ajustes. */
export function useDoneSound() {
  const { data } = useApp();
  const on = data.settings.sounds !== "0";
  return () => {
    if (on) playDone();
  };
}

import { useEffect, useState } from "react";
import { Button, Field, Label } from "./ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { setApiaryLocation } from "../services/Apiaries";
import {
  MIN_PLACE_QUERY,
  PLACE_DEBOUNCE_MS,
  searchPlaces,
  type Place,
} from "../services/Weather";

/**
 * Choose where the apiary is by searching a place name: saving it turns the
 * weather on for that area. Only the text typed is sent, to look the place up.
 */
export function PlacePicker({
  apiaryId,
  onDone,
}: {
  apiaryId: string;
  onDone?: () => void;
}) {
  const app = useApp(),
    task = useTask();
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[] | null>(null);
  const demo = Boolean(app.workspace?.demo),
    offline = app.data.settings.offline === "1";
  const canSearch = !demo && !offline;
  useEffect(() => {
    setPlaces(null);
    if (!canSearch || query.trim().length < MIN_PLACE_QUERY) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchPlaces(query).then((found) => {
        if (!cancelled) setPlaces(found);
      });
    }, PLACE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, canSearch]);
  if (demo)
    return (
      <Label muted size={12}>
        En la demo el clima usa una ubicación ficticia.
      </Label>
    );
  const pick = (place: Place) =>
    task.run(async () => {
      if (!app.workspace) return;
      await setApiaryLocation(
        app.workspace.repo,
        apiaryId,
        place.latitude,
        place.longitude,
      );
      await app.refresh();
      setQuery("");
      setPlaces(null);
      task.setMessage(`Ubicación guardada: ${place.name}`);
      onDone?.();
    });
  return (
    <>
      <Field
        testID="place-search"
        label="Buscar el lugar del apiario"
        value={query}
        onChangeText={setQuery}
        placeholder="Mérida, Yucatán"
        editable={canSearch}
        autoCapitalize="words"
      />
      {!canSearch ? (
        <Label muted size={12}>
          La búsqueda necesita conexión: desactiva el modo sin conexión.
        </Label>
      ) : places && places.length === 0 ? (
        <Label muted size={12}>
          No encontré ese lugar. Prueba con el municipio y el estado.
        </Label>
      ) : (
        <Label muted size={12}>
          Elige el pueblo o la zona más cercana al apiario. Solo se envía el texto que escribes para buscar el lugar.
        </Label>
      )}
      {(places ?? []).map((place) => (
        <Button
          key={`${place.latitude},${place.longitude}`}
          label={`${place.name} · ${place.region}`}
          variant="secondary"
          loading={task.busy}
          onPress={() => pick(place)}
        />
      ))}
      {task.message ? (
        <Label accessibilityLiveRegion="polite">{task.message}</Label>
      ) : null}
    </>
  );
}

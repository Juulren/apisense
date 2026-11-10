import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Badge, Button, Card, Field, Icon, Label, Row, Segmented, Toggle } from "./ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { saveApiaryProfile } from "../services/Apiaries";
import {
  PLACE_DEBOUNCE_MS,
  MIN_PLACE_QUERY,
  searchPlaces,
  type Place,
} from "../services/Weather";
import {
  YUCATAN_REFERENCE,
  calendarDisclaimer,
  calendarFor,
  monthShort,
  phaseLabels,
  suggestPreset,
  yucatanCalendar,
  type Calendar,
  type Phase,
} from "../services/Seasons";
import type { Apiary, CheckinFrequency, RegionPreset } from "../db/types";

const cycle: (Phase | null)[] = [null, "flow", "hard", "reactivation", "transition"];
const empty = (): Calendar => Array.from({ length: 12 }, () => null);

function Form({ apiary }: { apiary: Apiary }) {
  const app = useApp(),
    task = useTask();
  const resolved = calendarFor(apiary);
  const [name, setName] = useState(apiary.name),
    [lat, setLat] = useState(apiary.latitude === null ? "" : String(apiary.latitude)),
    [lon, setLon] = useState(apiary.longitude === null ? "" : String(apiary.longitude)),
    [frequency, setFrequency] = useState<CheckinFrequency>(apiary.checkin_frequency),
    [weather, setWeather] = useState(apiary.weather_enabled === 1),
    [preset, setPreset] = useState<RegionPreset | null>(apiary.region_preset),
    [calendar, setCalendar] = useState<Calendar | null>(resolved.calendar),
    [editing, setEditing] = useState(false),
    [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]);
  const demo = Boolean(app.workspace?.demo),
    offline = app.data.settings.offline === "1";
  const canSearch = !demo && !offline;
  useEffect(() => {
    setPlaces([]);
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
  const suggestion = suggestPreset(
    Number(lat.replace(",", ".")) || null,
    Number(lon.replace(",", ".")) || null,
  );
  const choosePreset = (next: RegionPreset) => {
    setPreset(next);
    setCalendar(next === "yucatan" ? yucatanCalendar.map((m) => (m ? { ...m } : m)) : (calendar ?? empty()));
  };
  const cycleMonth = (index: number) => {
    const base = calendar ?? empty();
    const current = base[index]?.phase ?? null;
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length] ?? null;
    setCalendar(
      base.map((m, i) =>
        i !== index
          ? m
          : next
            ? { phase: next, flora: m?.flora ?? "", note: m?.note ?? "" }
            : null,
      ),
    );
  };
  const save = () =>
    task.run(async () => {
      if (!app.workspace) return;
      await saveApiaryProfile(app.workspace.repo, apiary.id, {
        name,
        lat,
        lon,
        checkin_frequency: frequency,
        weather_enabled: weather,
        region_preset: preset,
        calendar,
      });
      await app.refresh();
    }, "Apiario guardado en este dispositivo");
  return (
    <Card>
      <Field label="Nombre del apiario" value={name} onChangeText={setName} maxLength={80} />
      <Field
        label="Buscar lugar (opcional)"
        value={query}
        onChangeText={setQuery}
        placeholder="Mérida, Yucatán"
        editable={canSearch}
      />
      {!canSearch ? (
        <Label muted size={12}>
          {demo
            ? "La búsqueda de lugares no está disponible en el demo."
            : "La búsqueda necesita conexión: desactiva el modo sin conexión."}
        </Label>
      ) : (
        <Label muted size={12}>
          Solo se envía el texto que escribes para buscar el lugar.
        </Label>
      )}
      {places.map((place) => (
        <Button
          key={`${place.latitude},${place.longitude}`}
          label={`${place.name} · ${place.region}`}
          variant="secondary"
          onPress={() => {
            setLat(place.latitude.toFixed(3));
            setLon(place.longitude.toFixed(3));
            setQuery("");
            setPlaces([]);
          }}
        />
      ))}
      <Field
        label="Latitud"
        value={lat}
        onChangeText={setLat}
        keyboardType="numbers-and-punctuation"
        placeholder="20.970"
      />
      <Field
        label="Longitud"
        value={lon}
        onChangeText={setLon}
        keyboardType="numbers-and-punctuation"
        placeholder="-89.620"
      />
      <Label bold>Calendario de temporadas</Label>
      <Segmented
        value={(preset ?? "custom") as RegionPreset}
        onChange={choosePreset}
        options={[
          { value: "yucatan", label: "Yucatán" },
          { value: "custom", label: "Personalizado" },
        ]}
      />
      {preset === "yucatan" ? (
        <Label muted size={12}>
          Basado en pocas fuentes técnicas y reportes de apicultores ({YUCATAN_REFERENCE}).
        </Label>
      ) : suggestion === "yucatan" ? (
        <Label muted size={12}>
          Tu ubicación está en la península de Yucatán: puedes elegir ese calendario.
        </Label>
      ) : (
        <Label muted size={12}>
          Aún no hay un calendario verificado para otras zonas. Completa tu propio
          calendario o déjalo vacío.
        </Label>
      )}
      <Pressable
        testID="calendar-edit"
        accessibilityRole="button"
        accessibilityState={{ expanded: editing }}
        onPress={() => setEditing(!editing)}
        style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Icon name={editing ? "expand-less" : "expand-more"} />
        <Label bold>Editar meses</Label>
      </Pressable>
      {editing ? (
        <View style={{ gap: 6 }}>
          <Label muted size={12}>
            Toca un mes para cambiar su fase típica.
          </Label>
          {monthShort.map((month, i) => (
            <Pressable
              key={month}
              accessibilityRole="button"
              accessibilityLabel={`${month}: ${calendar?.[i] ? phaseLabels[calendar[i]!.phase] : "sin dato"}`}
              onPress={() => cycleMonth(i)}
              style={{ minHeight: 44, justifyContent: "center" }}
            >
              <Row>
                <Label bold>{month}</Label>
                <Badge
                  label={calendar?.[i] ? phaseLabels[calendar[i]!.phase] : "Sin dato"}
                  tone={calendar?.[i] ? "amber" : "neutral"}
                />
              </Row>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Label muted size={12}>
        {calendarDisclaimer}
      </Label>
      <Label bold>Recordatorio de registro</Label>
      <Segmented
        value={frequency}
        onChange={setFrequency}
        options={[
          { value: "daily", label: "Diario" },
          { value: "weekly", label: "Semanal" },
          { value: "off", label: "Sin recordatorio" },
        ]}
      />
      <Label muted size={12}>
        Solo es un recordatorio: puedes dejar días sin registrar.
      </Label>
      <Toggle
        label="Mostrar el clima del apiario"
        caption={
          demo
            ? "No se usa en el demo."
            : "Envía a Open-Meteo la ubicación redondeada (~1 km) para pedir el clima."
        }
        value={weather && !demo}
        onChange={(value) => setWeather(value)}
      />
      <Button label="Guardar apiario" icon="save-alt" loading={task.busy} onPress={save} />
      {task.message ? <Label accessibilityLiveRegion="polite">{task.message}</Label> : null}
    </Card>
  );
}

/** Apiary name, location, season calendar, reminders and weather, editable at any time. */
export function ApiaryProfile({ apiary }: { apiary: Apiary | undefined }) {
  if (!apiary)
    return (
      <Card>
        <Label>Crea primero un apiario desde Inicio &gt; Gestionar apiario.</Label>
      </Card>
    );
  // Remount when the apiary or its saved values change so the form never shows stale text.
  return <Form key={`${apiary.id}-${apiary.local_revision}`} apiary={apiary} />;
}

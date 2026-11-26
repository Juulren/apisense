import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Badge, Button, Card, Field, Icon, Label, Row, Segmented, Toggle } from "./ui";
import { useApp } from "../state/AppProvider";
import { useClimate } from "../state/useClimate";
import { contextLabel, monthContexts } from "../services/Climate";
import { useTask } from "../state/useTask";
import { useDoneSound } from "../state/useDoneSound";
import { saveApiaryProfile } from "../services/Apiaries";
import {
  PLACE_DEBOUNCE_MS,
  MIN_PLACE_QUERY,
  searchPlaces,
  type Place,
} from "../services/Weather";
import {
  calendarDisclaimer,
  calendarFor,
  monthShort,
  phaseLabels,
  regionById,
  regionalCalendars,
  suggestPreset,
  type Calendar,
  type Phase,
} from "../services/Seasons";
import type { Apiary, CheckinFrequency, RegionPreset } from "../db/types";

const cycle: (Phase | null)[] = [null, "flow", "hard", "reactivation", "transition"];
const empty = (): Calendar => Array.from({ length: 12 }, () => null);

type Task = ReturnType<typeof useTask>;

function Form({
  apiary,
  task,
  open,
  onToggle,
  editing,
  onEditing,
}: {
  apiary: Apiary;
  task: Task;
  /** "Avanzado": coordinates and the season calendar. */
  open: boolean;
  onToggle: () => void;
  editing: boolean;
  onEditing: () => void;
}) {
  const app = useApp(),
    done = useDoneSound();
  const resolved = calendarFor(apiary);
  const [name, setName] = useState(apiary.name),
    [lat, setLat] = useState(apiary.latitude === null ? "" : String(apiary.latitude)),
    [lon, setLon] = useState(apiary.longitude === null ? "" : String(apiary.longitude)),
    [frequency, setFrequency] = useState<CheckinFrequency>(apiary.checkin_frequency),
    [weather, setWeather] = useState(apiary.weather_enabled === 1),
    [preset, setPreset] = useState<RegionPreset | null>(apiary.region_preset),
    [calendar, setCalendar] = useState<Calendar | null>(resolved.calendar),
    [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]);
  const offline = app.data.settings.offline === "1";
  const climate = useClimate(apiary);
  const contexts = climate?.reading
    ? monthContexts(climate.reading.months)
    : null;
  const canSearch = !offline;
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
    const region = regionById(next);
    setCalendar(
      region
        ? region.calendar.map((m) => (m ? { ...m } : m))
        : (calendar ?? empty()),
    );
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
            ? // The sourced text described the old phase: start the month clean.
              m && m.phase === next
              ? m
              : { phase: next, flora: "", note: "" }
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
      done();
    }, "Apiario guardado en este dispositivo");
  const moved =
    lat !== (apiary.latitude === null ? "" : String(apiary.latitude)) ||
    lon !== (apiary.longitude === null ? "" : String(apiary.longitude));
  return (
    <>
      <Field label="Nombre del apiario" value={name} onChangeText={setName} maxLength={80} />
      <View style={{ gap: 8 }}>
        <Field
          label={
            moved
              ? "Lugar · cambiado, falta guardar"
              : lat && lon
                ? "Lugar · ubicación guardada"
                : "Lugar (opcional)"
          }
          value={query}
          onChangeText={setQuery}
          placeholder={lat && lon ? "Buscar otro lugar" : "Mérida, Yucatán"}
          editable={canSearch}
        />
        <Label muted size={12}>
          {canSearch
            ? "Solo se envía el texto que escribes."
            : "La búsqueda necesita conexión: apaga «Sin conexión»."}
        </Label>
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
      </View>
      <Card style={{ padding: 16 }}>
        <Toggle
          label="Mostrar el clima"
          caption="Envía a Open-Meteo la ubicación redondeada (~1 km)."
          value={weather}
          onChange={(value) => setWeather(value)}
        />
      </Card>
      <View style={{ gap: 8 }}>
        <Label bold>Recordatorio de registro</Label>
        <Segmented
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: "daily", label: "Diario" },
            { value: "weekly", label: "Semanal" },
            { value: "off", label: "No" },
          ]}
        />
      </View>
      <Pressable
        testID="apiary-advanced"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel="Avanzado: coordenadas y temporadas"
        onPress={onToggle}
        style={{ minHeight: 64 }}
      >
        <Card style={{ padding: 16 }}>
          <Row>
            <View style={{ flex: 1 }}>
              <Label bold size={16}>
                Avanzado
              </Label>
              <Label muted size={12}>
                Coordenadas y temporadas
              </Label>
            </View>
            <Icon name={open ? "expand-less" : "expand-more"} />
          </Row>
        </Card>
      </Pressable>
      {open ? (
        <Card style={{ padding: 16 }}>
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
              ...regionalCalendars.map((r) => ({ value: r.id as RegionPreset, label: r.label })),
              { value: "custom" as RegionPreset, label: "Personalizado" },
            ]}
          />
          {regionById(preset) ? (
            <Label muted size={12}>
              Basado en pocas fuentes técnicas y reportes de apicultores ({regionById(preset)?.reference}).
            </Label>
          ) : regionById(suggestion) ? (
            <Label muted size={12}>
              Tu ubicación está en la zona de «{regionById(suggestion)?.label}»: puedes elegirlo.
            </Label>
          ) : (
            <Label muted size={12}>
              Sin calendario verificado para este lugar: llena el tuyo o déjalo vacío.
            </Label>
          )}
          <Pressable
            testID="calendar-edit"
            accessibilityRole="button"
            accessibilityState={{ expanded: editing }}
            onPress={onEditing}
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
                    <View style={{ flex: 1 }}>
                      <Label bold>{month}</Label>
                      {contexts && contextLabel(contexts[i]) ? (
                        <Label muted size={11}>
                          Clima aquí: {contextLabel(contexts[i])}
                        </Label>
                      ) : null}
                    </View>
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
        </Card>
      ) : null}
      <Button testID="apiary-save" label="Guardar" icon="save-alt" loading={task.busy} onPress={save} />
      {task.message ? <Label accessibilityLiveRegion="polite">{task.message}</Label> : null}
    </>
  );
}

/** Apiary name, location, season calendar, reminders and weather, editable at any time. */
export function ApiaryProfile({
  apiary,
  advanced = false,
}: {
  apiary: Apiary;
  /** Opens with "Avanzado" unfolded. */
  advanced?: boolean;
}) {
  // Held here, above the key below, so saving a new place does not take the
  // "saved" message or fold "Avanzado" away.
  const task = useTask();
  const [open, setOpen] = useState(advanced);
  const [editing, setEditing] = useState(false);
  // Keyed by apiary only: saving something else on the same screen (for example the
  // analysis interval) must not wipe what the user is typing here.
  // The place and the weather switch are part of the key because the dashboard can change them too.
  return (
    <View style={{ gap: 24 }}>
      <Form
        key={`${apiary.id}:${apiary.latitude}:${apiary.longitude}:${apiary.weather_enabled}`}
        apiary={apiary}
        task={task}
        open={open}
        onToggle={() => setOpen(!open)}
        editing={editing}
        onEditing={() => setEditing(!editing)}
      />
    </View>
  );
}

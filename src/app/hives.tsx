import { useState } from "react";
import { View } from "react-native";
import { AppScreen, Empty } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Segmented,
  Section,
} from "../components/ui";
import { ApiaryMap } from "../components/ApiaryMap";
import { HiveTile } from "../components/HiveTile";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
export default function Hives() {
  const app = useApp(),
    task = useTask();
  const [view, setView] = useState<"list" | "map">("list"),
    [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState(""),
    [code, setCode] = useState(""),
    [selected, setSelected] = useState("");
  const apiary =
    app.data.apiaries.find((a) => a.id === selected) ?? app.data.apiaries[0];
  const hives = app.data.hives.filter(
    (h) =>
      (!apiary || h.apiary_id === apiary.id) &&
      h.code.toLowerCase().includes(query.toLowerCase()),
  );
  const createApiary = () =>
    task.run(async () => {
      if (!app.workspace) return;
      if (name.trim().length < 3)
        throw new Error("Escribe un nombre de al menos 3 caracteres");
      const latitude = lat.trim() ? Number(lat) : null,
        longitude = lon.trim() ? Number(lon) : null;
      if (
        (latitude === null) !== (longitude === null) ||
        (latitude !== null &&
          (!Number.isFinite(latitude) || Math.abs(latitude) > 90)) ||
        (longitude !== null &&
          (!Number.isFinite(longitude) || Math.abs(longitude) > 180))
      )
        throw new Error("Revisa latitud y longitud");
      const created = await app.workspace.repo.save("apiaries", {
        user_id: app.workspace.userId,
        name: name.trim(),
        latitude,
        longitude,
        check_interval_minutes: 15,
      });
      setSelected(created.id);
      setName("");
      setLat("");
      setLon("");
      await app.refresh();
    }, "Apiario guardado en este dispositivo");
  const addHive = () =>
    task.run(async () => {
      if (!app.workspace || !apiary) throw new Error("Primero crea un apiario");
      if (!code.trim()) throw new Error("Escribe el código de la colmena");
      if (
        app.data.hives.some(
          (h) =>
            h.apiary_id === apiary.id &&
            h.code.toLowerCase() === code.trim().toLowerCase(),
        )
      )
        throw new Error("Ese código ya existe en el apiario");
      await app.workspace.repo.save("hives", {
        apiary_id: apiary.id,
        code: code.trim(),
        queen_status: "unknown",
        health_score: null,
        last_audio_check_at: null,
      });
      setCode("");
      await app.refresh();
    }, "Colmena guardada localmente");
  return (
    <AppScreen
      title="Mis colmenas"
      subtitle="Tu recorrido, con o sin señal"
      back
    >
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "list", label: "Lista" },
          { value: "map", label: "Mapa" },
        ]}
      />
      {app.data.apiaries.length > 1 ? (
        <Segmented
          value={apiary?.id ?? ""}
          onChange={setSelected}
          options={app.data.apiaries.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />
      ) : null}
      {view === "map" && apiary ? (
        <Card>
          <Label bold>{apiary.name}</Label>
          {app.data.settings.offline === "1" ? (
            <Label muted>
              Mapa sin conexión: conserva la lista y las coordenadas guardadas.
              Los mapas base necesitan red.
            </Label>
          ) : (
            <ApiaryMap apiary={apiary} demo={app.workspace?.demo} />
          )}
          <Label muted size={12}>
            {apiary.latitude ?? "—"}, {apiary.longitude ?? "—"} · Ubicación del
            apiario
          </Label>
        </Card>
      ) : null}
      <Field
        label="Buscar colmena"
        placeholder="Nombre o código"
        value={query}
        onChangeText={setQuery}
      />
      {hives.length ? (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          {hives.map((h) => (
            <HiveTile key={h.id} hive={h} />
          ))}
        </View>
      ) : (
        <Empty>No hay colmenas para esta búsqueda.</Empty>
      )}
      {apiary ? (
        <Card>
          <Label bold>Añadir colmena a {apiary.name}</Label>
          <Field
            label="Código de colmena"
            value={code}
            onChangeText={setCode}
            placeholder="Colmena 09"
          />
          <Button
            label="Guardar colmena"
            icon="add"
            loading={task.busy}
            onPress={addHive}
          />
        </Card>
      ) : null}
      <Section title="Nuevo apiario">
        <Card>
          <Field
            label="Nombre del apiario"
            value={name}
            onChangeText={setName}
            placeholder="Apiario Flor de Tajonal"
          />
          <Field
            label="Latitud (opcional)"
            value={lat}
            onChangeText={setLat}
            keyboardType="numbers-and-punctuation"
            placeholder="20.388"
          />
          <Field
            label="Longitud (opcional)"
            value={lon}
            onChangeText={setLon}
            keyboardType="numbers-and-punctuation"
            placeholder="-89.323"
          />
          <Button
            label="Crear apiario"
            variant="secondary"
            loading={task.busy}
            onPress={createApiary}
          />
          <Badge label="Guardado local primero" tone="blue" />
        </Card>
      </Section>
      {task.message ? <Label>{task.message}</Label> : null}
    </AppScreen>
  );
}

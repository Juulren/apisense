import { useState } from "react";
import { Button, Card, Field, Label } from "./ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";

/** A new apiary: a name and, optionally, its coordinates. */
export function NewApiaryForm({ onCreated }: { onCreated: (id: string) => void }) {
  const app = useApp(),
    task = useTask();
  const [name, setName] = useState(""),
    [lat, setLat] = useState(""),
    [lon, setLon] = useState("");
  const create = () =>
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
        // The weather is on by default wherever there is a location.
        weather_enabled: latitude === null ? 0 : 1,
      });
      setName("");
      setLat("");
      setLon("");
      await app.refresh();
      onCreated(created.id);
    }, "Apiario guardado en este dispositivo");
  return (
    <Card>
      <Label bold>Nuevo apiario</Label>
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
      <Button label="Crear apiario" loading={task.busy} onPress={create} />
      {task.message ? <Label>{task.message}</Label> : null}
    </Card>
  );
}

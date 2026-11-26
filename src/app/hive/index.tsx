import { useState } from "react";
import { AppScreen, Empty } from "../../components/AppScreen";
import {
  Button,
  Card,
  Field,
  IconButton,
  Label,
  Segmented,
} from "../../components/ui";
import { ApiaryMap } from "../../components/ApiaryMap";
import { HiveRow } from "../../components/HiveRow";
import { SeasonBrief } from "../../components/SeasonBrief";
import { NewApiaryForm } from "../../components/NewApiaryForm";
import { addHive } from "../../services/Hives";
import { useApp } from "../../state/AppProvider";
import { useTask } from "../../state/useTask";

// "Colmenas": every hive one tap away, as a list or with the apiary's map.
export default function Hives() {
  const app = useApp(),
    task = useTask();
  const { data } = app;
  const [view, setView] = useState<"list" | "map">("list"),
    [query, setQuery] = useState(""),
    [code, setCode] = useState(""),
    [adding, setAdding] = useState(false),
    [newApiary, setNewApiary] = useState(false),
    [selected, setSelected] = useState("");
  const apiary =
    data.apiaries.find((a) => a.id === selected) ?? data.apiaries[0];
  const ofApiary = data.hives.filter(
    (h) => !apiary || h.apiary_id === apiary.id,
  );
  const hives = ofApiary.filter((h) =>
    h.code.toLowerCase().includes(query.toLowerCase()),
  );
  const createHive = () =>
    task.run(async () => {
      if (!app.workspace || !apiary) throw new Error("Primero crea un apiario");
      await addHive(app.workspace.repo, apiary.id, code);
      setCode("");
      setAdding(false);
      await app.refresh();
    }, "Colmena guardada localmente");
  const showNewApiary = newApiary || !data.apiaries.length;
  return (
    <AppScreen
      title="Colmenas"
      pullEnabled={view !== "map"}
      action={
        data.apiaries.length ? (
          <IconButton
            testID="fold-new-apiary"
            icon="more-vert"
            label="Nuevo apiario"
            expanded={newApiary}
            onPress={() => setNewApiary(!newApiary)}
          />
        ) : undefined
      }
    >
      {showNewApiary ? (
        <NewApiaryForm
          onCreated={(id) => {
            setSelected(id);
            setNewApiary(false);
          }}
        />
      ) : null}
      <SeasonBrief apiary={apiary} />
      {data.apiaries.length > 1 ? (
        <Segmented
          value={apiary?.id ?? ""}
          onChange={setSelected}
          options={data.apiaries.map((a) => ({ value: a.id, label: a.name }))}
        />
      ) : null}
      {ofApiary.length ? (
        <Field
          label="Buscar colmena"
          placeholder="Nombre o código"
          value={query}
          onChangeText={setQuery}
        />
      ) : null}
      {apiary ? (
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: "list", label: "Lista" },
            { value: "map", label: "Mapa" },
          ]}
        />
      ) : null}
      {view === "map" && apiary ? (
        <Card>
          {data.settings.offline === "1" ? (
            <Label muted>El mapa necesita conexión.</Label>
          ) : (
            <ApiaryMap apiary={apiary} demo={app.workspace?.demo} />
          )}
          <Label muted size={12}>
            {apiary.latitude ?? "—"}, {apiary.longitude ?? "—"}
          </Label>
        </Card>
      ) : null}
      {hives.map((hive) => (
        <HiveRow key={hive.id} hive={hive} />
      ))}
      {apiary && !hives.length ? (
        <Empty>
          {ofApiary.length
            ? "No hay colmenas para esta búsqueda."
            : "Aún no tienes colmenas."}
        </Empty>
      ) : null}
      {apiary ? (
        <>
          <Button
            label={adding ? "Cancelar" : "Añadir colmena"}
            icon={adding ? "close" : "add"}
            variant="secondary"
            onPress={() => setAdding(!adding)}
          />
          {adding ? (
            <Card>
              <Field
                label="Código de colmena"
                value={code}
                onChangeText={setCode}
                placeholder="Colmena 09"
              />
              <Button
                label="Guardar colmena"
                loading={task.busy}
                onPress={createHive}
              />
            </Card>
          ) : null}
        </>
      ) : null}
      {task.message ? <Label>{task.message}</Label> : null}
    </AppScreen>
  );
}

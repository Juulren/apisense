import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppScreen } from "../components/AppScreen";
import { CheckinFields } from "../components/CheckinFields";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Segmented,
} from "../components/ui";
import { emptyCheckin, saveCheckin } from "../services/Checkin";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
export default function Inspection() {
  const { hiveId } = useLocalSearchParams<{ hiveId?: string }>(),
    app = useApp(),
    task = useTask();
  const [selected, setSelected] = useState(hiveId ?? ""),
    [form, setForm] = useState(emptyCheckin);
  const hive = selected
    ? app.data.hives.find((h) => h.id === selected)
    : app.data.hives[0];
  useEffect(() => {
    setSelected(hiveId ?? "");
  }, [hiveId]);
  const save = () =>
    task.run(
      async () => {
        if (!app.workspace || !hive) throw new Error("Selecciona una colmena");
        await saveCheckin(app.workspace.repo, hive.id, form);
        await app.refresh();
        setForm(emptyCheckin);
      },
      app.workspace?.demo
        ? "Observación de demo guardada localmente."
        : "Observación guardada en este dispositivo. Se sincronizará al recuperar red.",
    );
  return (
    <AppScreen
      title="Anotar observación"
      subtitle="Todo es opcional: elige lo que quieras registrar"
      back
    >
      <Badge label="Guardado local · Disponible sin señal" tone="blue" />
      <Label bold>
        {hive
          ? `Observaciones de ${hive.code}`
          : "Selecciona una colmena válida"}
      </Label>
      <Segmented
        value={hive?.id ?? ""}
        onChange={setSelected}
        options={app.data.hives.map((h) => ({ value: h.id, label: h.code }))}
      />
      <Card>
        <CheckinFields value={form} onChange={setForm} />
        <Field
          label="Nota (opcional)"
          testID="inspection-notes"
          placeholder="Qué viste o hiciste: piquera, alimentación, ventilación, posibles plagas…"
          multiline
          numberOfLines={4}
          style={{ minHeight: 110, textAlignVertical: "top" }}
          value={form.notes}
          onChangeText={(notes) => setForm({ ...form, notes })}
          maxLength={5000}
        />
        <Field
          label="Etiquetas (separadas por comas)"
          placeholder="Alimentación, ventilación, revisión de cría"
          value={form.tags}
          onChangeText={(tags) => setForm({ ...form, tags })}
          maxLength={300}
        />
        <Button
          label="Guardar observación"
          icon="save-alt"
          disabled={!hive}
          loading={task.busy}
          onPress={save}
        />
      </Card>
      {task.message ? (
        <Label accessibilityLiveRegion="polite">{task.message}</Label>
      ) : null}
      {hive ? (
        <Button
          label="Volver al detalle de colmena"
          variant="secondary"
          onPress={() =>
            router.dismissTo({ pathname: "/hive/[id]", params: { id: hive.id } })
          }
        />
      ) : null}
    </AppScreen>
  );
}

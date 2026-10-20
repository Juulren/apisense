import { useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { AppScreen } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Segmented,
  Toggle,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
export default function Inspection() {
  const { hiveId } = useLocalSearchParams<{ hiveId?: string }>(),
    app = useApp(),
    task = useTask();
  const [selected, setSelected] = useState(hiveId ?? ""),
    [notes, setNotes] = useState(""),
    [tags, setTags] = useState(""),
    [queen, setQueen] = useState(false);
  const hive =
    app.data.hives.find((h) => h.id === selected) ?? app.data.hives[0];
  const save = () =>
    task.run(
      async () => {
        if (!app.workspace || !hive) throw new Error("Selecciona una colmena");
        if (notes.trim().length < 10)
          throw new Error("Describe tu observación con al menos 10 caracteres");
        if (notes.length > 5000 || tags.length > 300)
          throw new Error("Acorta la nota o las etiquetas");
        const labels = tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        await app.workspace.repo.save("inspections", {
          hive_id: hive.id,
          inspected_at: new Date().toISOString(),
          notes: notes.trim(),
          tags_json: JSON.stringify(labels),
          queen_seen: queen ? 1 : 0,
        });
        await app.refresh();
        setNotes("");
        setTags("");
        setQueen(false);
      },
      app.workspace?.demo
        ? "Inspección de demo guardada localmente."
        : "Inspección guardada en este dispositivo. Se sincronizará al recuperar red.",
    );
  return (
    <AppScreen
      title="Anotar inspección"
      subtitle="Observaciones que ayudan a entender el audio"
      back
    >
      <Badge label="Guardado local · Disponible sin señal" tone="blue" />
      <Segmented
        value={hive?.id ?? ""}
        onChange={setSelected}
        options={app.data.hives.map((h) => ({ value: h.id, label: h.code }))}
      />
      <Card>
        <Field
          label="Observaciones de campo"
          placeholder="Describe cría, piquera, alimentación, ventilación o posibles plagas…"
          multiline
          numberOfLines={6}
          style={{ minHeight: 150, textAlignVertical: "top" }}
          value={notes}
          onChangeText={setNotes}
          maxLength={5000}
        />
        <Field
          label="Etiquetas (separadas por comas)"
          placeholder="Alimentación, ventilación, revisión de cría"
          value={tags}
          onChangeText={setTags}
          maxLength={300}
        />
        <Toggle
          label="Reina observada en esta inspección"
          caption="Marca solo si la viste directamente"
          value={queen}
          onChange={setQueen}
        />
        <Button
          label="Guardar inspección"
          icon="save-alt"
          disabled={!hive}
          loading={task.busy}
          onPress={save}
        />
      </Card>
      {task.message ? <Label>{task.message}</Label> : null}
      {hive ? (
        <Button
          label="Volver al detalle de colmena"
          variant="secondary"
          onPress={() =>
            router.replace({ pathname: "/hive/[id]", params: { id: hive.id } })
          }
        />
      ) : null}
    </AppScreen>
  );
}

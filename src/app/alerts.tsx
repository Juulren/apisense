import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { AppScreen, Empty } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Row,
  Section,
  Segmented,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import {
  isAlert,
  nodeWarnings,
  pendingAlerts,
  reviewLabels,
  reviewVerdict,
  simulateVerdict,
  verdictSummary,
} from "../services/EdgeVerdicts";
import type { EdgeVerdict, VerdictReview } from "../db/types";

const sourceLabel: Record<EdgeVerdict["source"], string> = {
  lora: "LoRaWAN",
  ble: "Bluetooth",
  mqtt: "MQTT",
  simulator: "Simulado",
};

export default function Alerts() {
  const app = useApp(),
    task = useTask();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [target, setTarget] = useState("");
  const demo = Boolean(app.workspace?.demo);
  const hiveCode = (id: string) =>
    app.data.hives.find((h) => h.id === id)?.code ?? "Colmena";
  const pending = pendingAlerts(app.data.verdicts);
  const reviewed = app.data.verdicts
    .filter((v) => isAlert(v) && v.review !== null)
    .sort((a, b) => (b.reviewed_at ?? "").localeCompare(a.reviewed_at ?? ""))
    .slice(0, 10);
  const hive =
    app.data.hives.find((h) => h.id === target) ?? app.data.hives[0];
  const review = (v: EdgeVerdict, decision: VerdictReview) =>
    task.run(async () => {
      if (!app.workspace) return;
      await reviewVerdict(app.workspace.repo, v.id, decision, notes[v.id] ?? "");
      setNotes((n) => ({ ...n, [v.id]: "" }));
      await app.refresh();
    }, `Marcada: ${reviewLabels[decision].toLowerCase()}`);
  const simulate = (kind: "usual" | "different") =>
    task.run(async () => {
      if (!app.workspace || !hive) throw new Error("Crea primero una colmena");
      await simulateVerdict(app.workspace.repo, hive.id, kind);
      await app.refresh();
    }, "Veredicto simulado guardado");
  return (
    <AppScreen
      title="Alertas del nodo"
      subtitle="Lo que reportó el clasificador del nodo"
      back
    >
      <Card>
        <Label muted size={12}>
          El nodo clasifica el sonido en el propio dispositivo y manda solo un
          código. «Sonido diferente al habitual» únicamente significa que se oye
          distinto de lo normal en esa colmena; el nodo no sabe por qué. Revísala
          y marca el resultado: tu respuesta sirve para ajustar el modelo.
        </Label>
      </Card>
      <Section title="Por revisar" caption={`${pending.length} sin revisar`}>
        {pending.length ? (
          pending.map((v) => (
            <Card key={v.id} tone="amber">
              <Row>
                <Label bold style={{ flex: 1 }}>
                  {hiveCode(v.hive_id)}
                </Label>
                <Badge label={sourceLabel[v.source]} tone="blue" />
              </Row>
              <Label>{verdictSummary(v)}</Label>
              {nodeWarnings(v).length ? (
                <Label tone="warning" size={12}>
                  Aviso del nodo: {nodeWarnings(v).join(", ")}.
                </Label>
              ) : null}
              <Field
                label="Nota (opcional)"
                value={notes[v.id] ?? ""}
                onChangeText={(text) => setNotes((n) => ({ ...n, [v.id]: text }))}
                maxLength={500}
                placeholder="Qué encontraste al revisar"
              />
              <Button
                label="Confirmada tras inspección"
                icon="check"
                loading={task.busy}
                onPress={() => review(v, "confirmed")}
              />
              <Button
                label="Falsa alarma"
                variant="secondary"
                disabled={task.busy}
                onPress={() => review(v, "false_alarm")}
              />
              <Button
                label="Marcar como vista"
                variant="ghost"
                disabled={task.busy}
                onPress={() => review(v, "seen")}
              />
              <Button
                label="Abrir la colmena"
                variant="ghost"
                onPress={() =>
                  router.push({ pathname: "/hive/[id]", params: { id: v.hive_id } })
                }
              />
            </Card>
          ))
        ) : (
          <Empty>No hay alertas pendientes.</Empty>
        )}
      </Section>
      {reviewed.length ? (
        <Section title="Revisadas recientemente">
          {reviewed.map((v) => (
            <Card key={v.id}>
              <Row>
                <Label bold style={{ flex: 1 }}>
                  {hiveCode(v.hive_id)}
                </Label>
                <Badge
                  label={v.review ? reviewLabels[v.review] : ""}
                  tone={v.review === "confirmed" ? "amber" : "neutral"}
                />
              </Row>
              <Label muted size={12}>
                {verdictSummary(v)}
              </Label>
              {v.review_note ? <Label>{v.review_note}</Label> : null}
            </Card>
          ))}
        </Section>
      ) : null}
      {demo ? (
        <Section
          title="Probar sin hardware (demo)"
          caption="Genera veredictos simulados con el mismo formato que envía el nodo"
        >
          <Card>
            <Segmented
              value={hive?.id ?? ""}
              onChange={setTarget}
              options={app.data.hives.map((h) => ({ value: h.id, label: h.code }))}
            />
            <View style={{ gap: 8 }}>
              <Button
                label="Simular sonido diferente"
                icon="notifications-active"
                loading={task.busy}
                onPress={() => simulate("different")}
              />
              <Button
                label="Simular sonido habitual"
                variant="secondary"
                disabled={task.busy}
                onPress={() => simulate("usual")}
              />
            </View>
          </Card>
        </Section>
      ) : null}
      {task.message ? (
        <Label accessibilityLiveRegion="polite">{task.message}</Label>
      ) : null}
    </AppScreen>
  );
}

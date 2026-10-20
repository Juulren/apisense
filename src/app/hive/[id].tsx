import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { AppScreen, Empty } from "../../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Label,
  Metric,
  Row,
  Section,
} from "../../components/ui";
import { SummaryCard } from "../../components/SummaryCard";
import { useApp } from "../../state/AppProvider";
import { useTask } from "../../state/useTask";
import {
  dateLabel,
  latestSample,
  latestSummary,
  parseTags,
} from "../../state/selectors";
export default function HiveDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useApp(),
    task = useTask();
  const hive = app.data.hives.find((h) => h.id === id),
    sample = latestSample(app.data.samples, id),
    summary = latestSummary(app.data.summaries, id);
  const inspections = app.data.inspections
    .filter((i) => i.hive_id === id)
    .sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));
  return (
    <AppScreen
      title={hive?.code ?? "Detalle de colmena"}
      subtitle={app.data.apiaries.find((a) => a.id === hive?.apiary_id)?.name}
      back
    >
      {!hive ? (
        <Empty>La colmena no existe en esta base local.</Empty>
      ) : (
        <>
          <Card>
            <Badge label="Seguimiento de campo" tone="blue" />
            <Label bold size={20}>
              Estado de la reina
            </Label>
            <Label>
              {inspections[0]?.queen_seen === 1
                ? `Observada en inspección del ${dateLabel(inspections[0].inspected_at)}`
                : "Sin verificación reciente en campo"}
            </Label>
            <Label muted size={12}>
              El audio no confirma por sí solo la presencia de reina. Las
              observaciones manuales quedan en la bitácora.
            </Label>
          </Card>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <Metric
              label="Frecuencia reciente"
              value={sample ? String(Math.round(sample.dominant_freq_hz)) : "—"}
              unit="Hz"
              icon="graphic-eq"
            />
            <Metric
              label="Nivel digital"
              value={sample ? sample.amplitude_db.toFixed(1) : "—"}
              unit="dBFS"
              icon="volume-up"
            />
          </View>
          {summary ? (
            <SummaryCard summary={summary} />
          ) : (
            <Empty>
              Aún no hay resúmenes. Recibe una muestra para comenzar.
            </Empty>
          )}
          <Button
            label="Generar resumen local"
            icon="auto-awesome"
            loading={task.busy}
            onPress={() =>
              task.run(async () => {
                await app.workspace?.summaries.generate(id);
                await app.refresh();
              }, "Resumen guardado localmente")
            }
          />
          <Row>
            <View style={{ flex: 1 }}>
              <Button
                label="Monitor acústico"
                variant="audio"
                onPress={() =>
                  router.push({ pathname: "/monitor", params: { hiveId: id } })
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Ver historial"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: "/history", params: { hiveId: id } })
                }
              />
            </View>
          </Row>
          <Section
            title="Bitácora de campo"
            caption="Tus observaciones y acciones guardadas localmente"
          >
            {inspections.length ? (
              inspections.slice(0, 5).map((inspection) => (
                <Card key={inspection.id}>
                  <Row>
                    <Label bold>Inspección manual</Label>
                    <Badge
                      label={
                        inspection.synced_at ? "Sincronizada" : "Guardada local"
                      }
                      tone="blue"
                    />
                  </Row>
                  <Label muted size={11}>
                    {dateLabel(inspection.inspected_at)}
                  </Label>
                  <Label>{inspection.notes}</Label>
                  <Label muted size={12}>
                    {parseTags(inspection.tags_json).join(" · ")}
                  </Label>
                </Card>
              ))
            ) : (
              <Empty>Aún no has registrado inspecciones.</Empty>
            )}
            <Button
              label="Anotar inspección"
              icon="add-circle-outline"
              onPress={() =>
                router.push({ pathname: "/inspection", params: { hiveId: id } })
              }
            />
          </Section>
          {task.message ? <Label>{task.message}</Label> : null}
        </>
      )}
    </AppScreen>
  );
}

import { router, useLocalSearchParams } from "expo-router";
import { Alert, View } from "react-native";
import { useState } from "react";
import { AppScreen, Empty } from "../../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Row,
  Section,
} from "../../components/ui";
import { SummaryCard } from "../../components/SummaryCard";
import { BroodCycleTracker } from "../../components/BroodCycleTracker";
import { SeasonTracker } from "../../components/SeasonTracker";
import { HiveReadings } from "../../components/HiveReadings";
import { checkinSummary } from "../../services/Checkin";
import { removeHive, renameHive } from "../../services/Hives";
import { useApp } from "../../state/AppProvider";
import { useTask } from "../../state/useTask";
import {
  dateLabel,
  latestSummary,
  parseTags,
} from "../../state/selectors";
export default function HiveDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    app = useApp(),
    task = useTask();
  const hive = app.data.hives.find((h) => h.id === id),
    summary = latestSummary(app.data.summaries, id);
  const [inspectionLimit, setInspectionLimit] = useState(5);
  const [draft, setDraft] = useState<string | null>(null);
  const confirmRemove = () => {
    if (!hive || !app.workspace) return;
    const repo = app.workspace.repo;
    Alert.alert(
      "Quitar colmena",
      `Se quitará ${hive.code} con sus observaciones, seguimientos y micrófonos. Dejará de aparecer en la app y el cambio se sincroniza. No se puede deshacer desde aquí.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Quitar",
          style: "destructive",
          onPress: () =>
            task.run(async () => {
              await removeHive(repo, hive.id);
              await app.refresh();
              router.replace("/hives");
            }),
        },
      ],
    );
  };
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
          <Button
            label="Anotar observación de esta colmena"
            icon="edit-note"
            onPress={() =>
              router.push({ pathname: "/inspection", params: { hiveId: id } })
            }
          />
          <SeasonTracker key={`season-${id}`} hiveId={id} cta={false} />
          <Section
            title="Bitácora de campo"
            caption="Tus observaciones y acciones guardadas localmente"
          >
            {inspections.length ? (
              inspections.slice(0, inspectionLimit).map((inspection) => (
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
                  {checkinSummary(inspection).length ? (
                    <Label bold size={12}>
                      {checkinSummary(inspection).join(" · ")}
                    </Label>
                  ) : null}
                  {inspection.notes ? <Label>{inspection.notes}</Label> : null}
                  <Label muted size={12}>
                    {parseTags(inspection.tags_json).join(" · ")}
                  </Label>
                </Card>
              ))
            ) : (
              <Empty>Aún no has registrado inspecciones.</Empty>
            )}
            {inspections.length > inspectionLimit ? (
              <Button
                label="Ver observaciones anteriores"
                variant="secondary"
                onPress={() => setInspectionLimit(inspectionLimit + 5)}
              />
            ) : null}
            <Button
              label="Anotar inspección"
              icon="add-circle-outline"
              onPress={() =>
                router.push({ pathname: "/inspection", params: { hiveId: id } })
              }
            />
          </Section>
          <Section
            title="Cuadros de cría (opcional)"
            caption="Seguimiento de 21 días de un cuadro o lote concreto"
          >
            <BroodCycleTracker key={`cycle-${id}`} hiveId={id} />
          </Section>
          <HiveReadings key={`readings-${id}`} hiveId={id} />
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
          <Section title="Administrar colmena">
            <Card>
              <Field
                label="Nombre o código"
                value={draft ?? hive.code}
                onChangeText={setDraft}
                maxLength={40}
              />
              <Button
                label="Guardar nombre"
                icon="check"
                variant="secondary"
                loading={task.busy}
                disabled={draft === null || draft.trim() === hive.code}
                onPress={() =>
                  task.run(async () => {
                    if (!app.workspace) return;
                    await renameHive(app.workspace.repo, hive.id, draft ?? "");
                    setDraft(null);
                    await app.refresh();
                  }, "Nombre guardado")
                }
              />
              <Button
                label="Quitar colmena"
                icon="delete-outline"
                variant="ghost"
                onPress={confirmRemove}
              />
            </Card>
          </Section>
          {task.message ? <Label>{task.message}</Label> : null}
        </>
      )}
    </AppScreen>
  );
}

import { router, useLocalSearchParams } from "expo-router";
import { Alert } from "react-native";
import { useState } from "react";
import { AppScreen, Empty } from "../../components/AppScreen";
import {
  Button,
  Card,
  Field,
  Icon,
  IconButton,
  Label,
  Row,
} from "../../components/ui";
import { useTheme } from "../../components/ui/theme";
import { NodeCard } from "../../components/NodeCard";
import { VerdictTimeline } from "../../components/VerdictTimeline";
import { checkinSummary } from "../../services/Checkin";
import { removeHive, renameHive } from "../../services/Hives";
import { pendingAlerts } from "../../services/EdgeVerdicts";
import { calendarFor, phaseOn, seasonSignals } from "../../services/Seasons";
import { useApp } from "../../state/AppProvider";
import { useNodeState } from "../../state/useNodeState";
import { useTask } from "../../state/useTask";
import { useDoneSound } from "../../state/useDoneSound";
import { dateLabel, parseTags } from "../../state/selectors";
export default function HiveRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Keyed by hive: the open menu or a half-typed name never carries to another.
  return <HiveDetail key={id} id={id} />;
}
function HiveDetail({ id }: { id: string }) {
  const app = useApp(),
    task = useTask(),
    done = useDoneSound();
  const { colors } = useTheme();
  const nodes = useNodeState();
  const hive = app.data.hives.find((h) => h.id === id);
  const apiary = app.data.apiaries.find((a) => a.id === hive?.apiary_id);
  const [shown, setShown] = useState(1);
  const [menu, setMenu] = useState(false);
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
              (router.canGoBack() ? router.back() : router.replace("/hive"));
            }),
        },
      ],
    );
  };
  const inspections = app.data.inspections
    .filter((i) => i.hive_id === id)
    .sort((a, b) => b.inspected_at.localeCompare(a.inspected_at));
  const today = new Date();
  const signals = seasonSignals(
    inspections,
    phaseOn(calendarFor(apiary).calendar, today).info?.phase ?? null,
    today,
  );
  const toReview = pendingAlerts(app.data.verdicts).some(
    (v) => v.hive_id === id,
  );
  const note = (variant: "primary" | "secondary") => (
    <Button
      label="Anotar"
      icon="edit-note"
      variant={variant}
      onPress={() =>
        router.push({ pathname: "/inspection", params: { hiveId: id } })
      }
    />
  );
  return (
    <AppScreen
      title={hive?.code ?? "Detalle de colmena"}
      subtitle={app.data.apiaries.length > 1 ? apiary?.name : undefined}
      back
      action={
        hive ? (
          <IconButton
            testID="fold-admin"
            icon="more-vert"
            label="Opciones de la colmena"
            expanded={menu}
            onPress={() => setMenu(!menu)}
          />
        ) : undefined
      }
    >
      {!hive ? (
        <Empty>La colmena no existe en esta base local.</Empty>
      ) : (
        <>
          {menu ? (
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
                    done();
                  }, "Nombre guardado")
                }
              />
              {/* Moves to administration once that screen exists. */}
              <Button
                label="Vincular nodo de la colmena"
                icon="link"
                variant="secondary"
                onPress={() =>
                  router.push({ pathname: "/pairing", params: { hiveId: id } })
                }
              />
              <Button
                label="Quitar colmena"
                icon="delete-outline"
                variant="ghost"
                onPress={confirmRemove}
              />
            </Card>
          ) : null}
          <NodeCard hiveId={id} state={nodes.stateOf(id)} />
          {signals.map((signal) => (
            <Card
              key={signal.text}
              tone={signal.tone === "info" ? "blue" : "amber"}
              style={{ padding: 14 }}
            >
              <Row>
                <Icon
                  name={signal.tone === "info" ? "info-outline" : "report-problem"}
                  color={
                    signal.tone === "info" ? colors.blueText : colors.amberText
                  }
                />
                <Label size={13} style={{ flex: 1 }}>
                  {signal.text}
                </Label>
              </Row>
            </Card>
          ))}
          {toReview ? (
            <Button label="Revisar" onPress={() => router.push("/alerts")} />
          ) : (
            note("primary")
          )}
          <VerdictTimeline hiveId={id} />
          {inspections.slice(0, shown).map((inspection, i) => (
            <Card key={inspection.id} style={{ gap: 6 }}>
              <Label bold>{i === 0 ? "Última nota" : "Nota"}</Label>
              <Label muted size={12}>
                {dateLabel(inspection.inspected_at)}
                {inspection.synced_at ? "" : " · sin enviar"}
              </Label>
              {checkinSummary(inspection).length ? (
                <Label bold size={12}>
                  {checkinSummary(inspection).join(" · ")}
                </Label>
              ) : null}
              {inspection.notes ? <Label>{inspection.notes}</Label> : null}
              {parseTags(inspection.tags_json).length ? (
                <Label muted size={12}>
                  {parseTags(inspection.tags_json).join(" · ")}
                </Label>
              ) : null}
            </Card>
          ))}
          {!inspections.length ? <Label muted>Aún no hay notas.</Label> : null}
          {inspections.length > shown ? (
            <Button
              label="Ver observaciones anteriores"
              variant="ghost"
              onPress={() => setShown(shown + 5)}
            />
          ) : null}
          {toReview ? note("secondary") : null}
          {task.message ? <Label>{task.message}</Label> : null}
        </>
      )}
    </AppScreen>
  );
}

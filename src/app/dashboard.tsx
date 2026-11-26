import { Pressable } from "react-native";
import { router } from "expo-router";
import { AppScreen, Empty } from "../components/AppScreen";
import { Button, Card, Icon, Label, Row } from "../components/ui";
import { useTheme } from "../components/ui/theme";
import { WeatherCard } from "../components/WeatherCard";
import { greetingFor } from "../services/Greeting";
import {
  hivesNeedingAttention,
  nodeHiveStatus,
} from "../services/NodeStatus";
import {
  alertEpisodes,
  hivePending,
  reviewedGroups,
  timeText,
} from "../services/AlertEpisodes";
import { useNodeState } from "../state/useNodeState";
import { useApp } from "../state/AppProvider";
export default function Dashboard() {
  const { data } = useApp();
  const { colors } = useTheme();
  const nodes = useNodeState();
  const attention = hivesNeedingAttention(data.hives, data.verdicts, nodes.stateOf);
  const episodes = alertEpisodes(data.verdicts);
  // The phone has not synced lately: it cannot say whether these nodes report.
  const unknown = data.hives.filter(
    (h) =>
      nodes.stateOf(h.id).kind === "stale" &&
      !attention.some((row) => row.hive.id === h.id),
  ).length;
  // The same rule as each hive's row.
  const usual = data.hives.filter(
    (h) => nodeHiveStatus(data.verdicts, h.id, nodes.stateOf(h.id))?.stable,
  ).length;
  return (
    <AppScreen>
      <Label bold size={24} accessibilityRole="header">
        {greetingFor(new Date())}, {data.settings.name || "apicultor"}
      </Label>
      <WeatherCard apiary={data.apiaries[0]} />
      {attention.map(({ hive, status }) => {
        const pending = hivePending(episodes, hive.id);
        const detail = pending
          ? `desde ${timeText(pending.since)}`
          : status.detail;
        return (
          <Pressable
            key={hive.id}
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${hive.code}`}
            accessibilityHint={`${status.label}, ${detail}`}
            onPress={() =>
              router.push({ pathname: "/hive/[id]", params: { id: hive.id } })
            }
          >
            <Card tone="amber" style={{ padding: 16, gap: 4 }}>
              <Row>
                <Icon name="warning-amber" color={colors.amberText} />
                <Label bold size={20} style={{ flex: 1 }}>
                  {hive.code}
                </Label>
                <Icon name="chevron-right" color={colors.muted} />
              </Row>
              <Label size={13}>
                {status.label} · {detail}
              </Label>
            </Card>
          </Pressable>
        );
      })}
      {!data.hives.length ? (
        <>
          <Empty>Crea tu apiario y añade la primera colmena.</Empty>
          <Button label="Ir a Colmenas" onPress={() => router.navigate("/hive")} />
        </>
      ) : (
        <>
          {unknown ? (
            <Card style={{ padding: 16, gap: 4 }}>
              <Label bold size={18}>
                Sin sincronizar
              </Label>
              <Label muted size={13}>
                No se sabe si {unknown === 1 ? "1 nodo reporta" : `${unknown} nodos reportan`}.
                Desliza hacia abajo.
              </Label>
            </Card>
          ) : null}
          {!attention.length && !unknown ? (
            <Card style={{ padding: 16, gap: 4 }}>
              <Label bold size={18}>
                Nada por revisar
              </Label>
              {/* Not "all fine": only these have a recent usual sound. */}
              <Label muted size={13}>
                {usual} de {data.hives.length} con sonido habitual
              </Label>
            </Card>
          ) : null}
          <Button
            label="Anotar"
            icon="edit-note"
            onPress={() => router.push("/inspection")}
          />
          {!episodes.length && reviewedGroups(data.verdicts, 1).length ? (
            <Button
              label="Ver alertas revisadas"
              variant="ghost"
              onPress={() => router.push("/alerts")}
            />
          ) : null}
        </>
      )}
    </AppScreen>
  );
}

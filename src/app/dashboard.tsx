import { View } from "react-native";
import { router } from "expo-router";
import { AppScreen, Empty } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Icon,
  Label,
  Row,
  Section,
} from "../components/ui";
import { HiveTile } from "../components/HiveTile";
import { WeatherCard } from "../components/WeatherCard";
import { greetingFor } from "../services/Greeting";
import { calendarFor, phaseLabels, phaseOn } from "../services/Seasons";
import { pendingAlerts } from "../services/EdgeVerdicts";
import { useNodeState } from "../state/useNodeState";
import { nodeHiveStatus } from "../services/NodeStatus";
import { useApp } from "../state/AppProvider";
export default function Dashboard() {
  const app = useApp();
  const { data } = app;
  const nodes = useNodeState();
  // The same rule as each hive's tile.
  const usual = data.hives.filter(
    (h) => nodeHiveStatus(data.verdicts, h.id, nodes.stateOf(h.id))?.stable,
  ).length;
  const season = phaseOn(calendarFor(data.apiaries[0]).calendar, new Date()).info;
  const nodeAlerts = pendingAlerts(data.verdicts);
  const quiet = nodes.silent;
  return (
    <AppScreen>
      <View style={{ gap: 5 }}>
        <Label bold size={24}>
          {greetingFor(new Date())}, {data.settings.name || "apicultor"}
        </Label>
        <Label muted>
          {data.apiaries[0]?.name || "Tu próximo apiario comienza aquí"}
        </Label>
        {season ? (
          <Badge label={`Fase típica: ${phaseLabels[season.phase]}`} tone="amber" />
        ) : null}
      </View>
      <WeatherCard apiary={data.apiaries[0]} />
      {data.hives.length ? (
        <Button
          label="Anotar observación"
          icon="edit-note"
          onPress={() => router.push("/inspection")}
        />
      ) : null}
      {nodeAlerts.length ? (
        <Card tone="amber">
          <Row>
            <Icon name="notifications-active" color="#D97706" size={28} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label bold>
                {nodeAlerts.length === 1
                  ? "1 alerta del nodo sin revisar"
                  : `${nodeAlerts.length} alertas del nodo sin revisar`}
              </Label>
              <Label muted size={12}>
                El nodo detectó un sonido diferente al habitual. Revisa la
                colmena.
              </Label>
            </View>
          </Row>
          <Button
            label="Ver alertas"
            variant="secondary"
            onPress={() => router.push("/alerts")}
          />
        </Card>
      ) : null}
      {quiet.length ? (
        <Card tone="amber">
          <Row>
            <Icon name="sensors-off" color="#D97706" size={28} />
            <View style={{ flex: 1, gap: 2 }}>
              <Label bold>
                {quiet.length === 1
                  ? "1 nodo sin reportar"
                  : `${quiet.length} nodos sin reportar`}
              </Label>
              <Label muted size={12}>
                {quiet.map((h) => h.code).join(", ")}. Sin mensajes en más de 3
                horas.
              </Label>
            </View>
          </Row>
          <Button
            label="Ver colmenas"
            variant="secondary"
            onPress={() => router.push("/hive")}
          />
        </Card>
      ) : null}
      <Section
        title="Estado por Colmena"
        caption={
          data.hives.length
            ? `${usual} de ${data.hives.length} con sonido habitual`
            : undefined
        }
      >
        <Row>
          <Badge label={`${data.hives.length} colmenas`} tone="neutral" />
          <Button
            label="Ver lista / mapa"
            compact
            variant="ghost"
            icon="map"
            onPress={() => router.push("/hives")}
          />
        </Row>
        {data.hives.length ? (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
            }}
          >
            {data.hives.map((hive) => (
              <HiveTile key={hive.id} hive={hive} />
            ))}
          </View>
        ) : (
          <Empty>Crea tu apiario y añade la primera colmena.</Empty>
        )}
      </Section>
      <Label muted size={12}>
        Los avisos del nodo son orientativos. Confirma el estado de reina y
        cría durante la inspección.
      </Label>
    </AppScreen>
  );
}

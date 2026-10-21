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
import { useTheme } from "../components/ui/theme";
import { HiveTile } from "../components/HiveTile";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { latestSummary } from "../state/selectors";
export default function Dashboard() {
  const app = useApp(),
    task = useTask(),
    { colors } = useTheme();
  const { data } = app;
  const statuses = data.hives.map((h) => latestSummary(data.summaries, h.id));
  const normal = statuses.filter((s) => s?.overall_status === "optimal").length;
  const alert = data.hives.find((h) => {
    const s = latestSummary(data.summaries, h.id);
    return (
      s &&
      s.overall_status !== "optimal" &&
      s.id !== data.settings.dismissed_alert
    );
  });
  const summary = alert ? latestSummary(data.summaries, alert.id) : undefined;
  const percentage = data.hives.length
    ? Math.round((normal / data.hives.length) * 100)
    : 0;
  return (
    <AppScreen>
      <View style={{ gap: 5 }}>
        <Label bold size={24}>
          Buenos días, {data.settings.name || "apicultor"}
        </Label>
        <Label muted>
          {data.apiaries[0]?.name || "Tu próximo apiario comienza aquí"}
        </Label>
      </View>
      {app.workspace?.demo ? (
        <Badge label="Datos de demostración · Sin envío a nube" tone="blue" />
      ) : null}
      <Card tone="green">
        <Row>
          <Icon name="verified" color="#10B981" size={40} />
          <View style={{ flex: 1, gap: 5 }}>
            <Label color={colors.greenText} size={11} bold>
              ESTADO ACÚSTICO GENERAL
            </Label>
            <Label bold size={21}>
              {normal === data.hives.length && normal > 0
                ? "Apiario en calma"
                : normal > 0
                  ? "La mayoría está en calma"
                  : "Tu apiario, bajo seguimiento"}
            </Label>
            <Label muted size={12}>
              {normal} de {data.hives.length} colmenas con patrón estable
            </Label>
          </View>
          <Badge label={`${percentage}%`} />
        </Row>
        <Row>
          <Label muted size={12}>
            Distribución actual
          </Label>
          <Label color={colors.greenText} size={12}>
            {data.hives.length - normal} por revisar
          </Label>
        </Row>
        <View
          accessibilityLabel={`${normal} colmenas estables`}
          style={{ flexDirection: "row", gap: 6 }}
        >
          {statuses.map((s, i) => (
            <View
              key={data.hives[i]?.id}
              style={{
                flex: 1,
                height: 8,
                borderRadius: 4,
                backgroundColor:
                  s?.overall_status === "optimal"
                    ? "#34D399"
                    : s
                      ? "#FCD34D"
                      : "#CBD5E1",
              }}
            />
          ))}
        </View>
      </Card>
      {alert && summary && data.settings.alerts !== "0" ? (
        <Card tone="amber">
          <Row>
            <Icon name="notifications-active" color="#D97706" size={28} />
            <Label bold style={{ flex: 1 }}>
              Atención en {alert.code}
            </Label>
            <Badge label="Por verificar" tone="amber" />
          </Row>
          <Label size={13}>
            {summary.overall_status === "critical"
              ? "Variación repetida detectada por el modelo. Prioriza una inspección de campo para verificar el estado."
              : "Se detectó una variación acústica. Revisa el entorno y la ventilación; confirma el estado en campo si el patrón persiste."}
          </Label>
          <Button
            label="Ver cómo actuar"
            icon="lightbulb-outline"
            onPress={() =>
              router.push({ pathname: "/hive/[id]", params: { id: alert.id } })
            }
          />
          <Button
            label="Descartar este aviso"
            variant="secondary"
            compact
            onPress={() =>
              task.run(() => app.saveSetting("dismissed_alert", summary.id))
            }
          />
        </Card>
      ) : null}
      <Section
        title="Estado por Colmena"
        caption="Resumen local para tu recorrido de campo"
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
        <Button
          label="Gestionar apiario"
          variant="secondary"
          onPress={() => router.push("/hives")}
        />
      </Section>
      {task.message ? <Label>{task.message}</Label> : null}
      <Label muted size={11}>
        Los patrones acústicos son orientativos. Confirma el estado de reina y
        cría durante la inspección.
      </Label>
    </AppScreen>
  );
}

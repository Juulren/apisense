import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AppScreen, Empty } from "../../components/AppScreen";
import { Badge, Button, Card, Icon, Label, Row } from "../../components/ui";
import { useTheme } from "../../components/ui/theme";
import { useApp } from "../../state/AppProvider";
import { latestSummary, statusLabel } from "../../state/selectors";
import { latestVerdict, verdictSummary } from "../../services/EdgeVerdicts";

// "Diagnóstico": every hive one tap away. Opens a hive's detail directly.
export default function HiveList() {
  const { data } = useApp();
  const { colors } = useTheme();
  const several = data.apiaries.length > 1;
  return (
    <AppScreen
      title="Diagnóstico"
      subtitle="Elige una colmena para ver su estado o anotar"
    >
      {data.hives.length ? (
        data.hives.map((hive) => {
          const summary = latestSummary(data.summaries, hive.id),
            verdict = latestVerdict(data.verdicts, hive.id),
            warning = summary && summary.overall_status !== "optimal";
          const detail = verdict
            ? verdictSummary(verdict)
            : summary
              ? "Resumen acústico disponible"
              : "Aún sin lecturas";
          const apiary = several
            ? data.apiaries.find((a) => a.id === hive.apiary_id)?.name
            : undefined;
          return (
            <Pressable
              key={hive.id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${hive.code}`}
              testID={`hive-row-${hive.code}`}
              onPress={() =>
                router.push({ pathname: "/hive/[id]", params: { id: hive.id } })
              }
              style={{ minHeight: 64 }}
            >
              <Card
                tone={warning ? "amber" : undefined}
                style={{ padding: 16, gap: 6 }}
              >
                <Row>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Label bold size={16}>
                      {hive.code}
                    </Label>
                    {apiary ? (
                      <Label muted size={12}>
                        {apiary}
                      </Label>
                    ) : null}
                  </View>
                  <Badge
                    label={statusLabel(summary?.overall_status)}
                    tone={warning ? "amber" : summary ? "green" : "neutral"}
                  />
                  <Icon name="chevron-right" size={22} color={colors.muted} />
                </Row>
                <Label muted size={12}>
                  {detail}
                </Label>
              </Card>
            </Pressable>
          );
        })
      ) : (
        <Empty>Aún no tienes colmenas. Añade la primera desde "Mis colmenas".</Empty>
      )}
      <Button
        label="Añadir o administrar colmenas"
        variant="secondary"
        icon="add"
        onPress={() => router.push("/hives")}
      />
      <Button
        label="Historial de resúmenes"
        variant="ghost"
        icon="history"
        onPress={() => router.push("/history")}
      />
    </AppScreen>
  );
}

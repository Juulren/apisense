import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { AppScreen, Empty } from "../../components/AppScreen";
import { Badge, Button, Card, Icon, Label, Row } from "../../components/ui";
import { useTheme } from "../../components/ui/theme";
import { useApp } from "../../state/AppProvider";
import { latestVerdict, verdictSummary } from "../../services/EdgeVerdicts";
import { nodeHiveStatus, silentText } from "../../services/NodeStatus";
import { useNodeState } from "../../state/useNodeState";
import { SeasonBrief } from "../../components/SeasonBrief";

// "Diagnóstico": every hive one tap away. Opens a hive's detail directly.
export default function HiveList() {
  const { data } = useApp();
  const nodes = useNodeState();
  const { colors } = useTheme();
  const several = data.apiaries.length > 1;
  return (
    <AppScreen
      title="Diagnóstico"
      subtitle="Elige una colmena para ver su estado o anotar"
    >
      <SeasonBrief />
      {data.hives.length ? (
        data.hives.map((hive) => {
          const verdict = latestVerdict(data.verdicts, hive.id);
          const node = nodes.stateOf(hive.id);
          // The same rule as the hive's tile on the home screen.
          const status = nodeHiveStatus(data.verdicts, hive.id, node);
          // The line under the badge must not contradict it: a message is shown only when the badge speaks for it.
          const detail =
            node.kind === "silent"
              ? silentText(node)
              : status && verdict
                ? verdictSummary(verdict)
                : (status?.detail ?? "Sin nodo vinculado");
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
                tone={status?.tone === "amber" ? "amber" : undefined}
                style={{ padding: 16, gap: 6 }}
              >
                {/* Wraps instead of breaking the code mid-word at large text sizes. */}
                <Row style={{ flexWrap: "wrap", rowGap: 6 }}>
                  <View style={{ flexGrow: 1, flexShrink: 0, gap: 2 }}>
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
                    label={status?.label ?? "Sin nodo"}
                    tone={status?.tone ?? "neutral"}
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
    </AppScreen>
  );
}

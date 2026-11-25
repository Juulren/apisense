import { Pressable } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { useApp } from "../state/AppProvider";
import { latestSample, latestSummary, statusLabel } from "../state/selectors";
import { nodeHiveStatus } from "../services/NodeStatus";
import { useNodeState } from "../state/useNodeState";
import type { Hive } from "../db/types";
export function HiveTile({ hive }: { hive: Hive }) {
  const { data } = useApp();
  const sample = latestSample(data.samples, hive.id),
    summary = latestSummary(data.summaries, hive.id);
  const phoneWarning = !!summary && summary.overall_status !== "optimal";
  const node = nodeHiveStatus(
    data.verdicts,
    hive.id,
    useNodeState().stateOf(hive.id),
    !summary ? "none" : phoneWarning ? "warning" : "ok",
  );
  const warning = node ? node.tone === "amber" : phoneWarning;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${hive.code}`}
      onPress={() =>
        router.push({ pathname: "/hive/[id]", params: { id: hive.id } })
      }
      style={{ width: "48%" }}
    >
      <Card
        tone={warning ? "amber" : undefined}
        style={{ padding: 14, minHeight: 104, gap: 8 }}
      >
        <Row>
          <Label bold size={12} style={{ flex: 1 }}>
            {hive.code}
          </Label>
          <Icon
            name={warning ? "warning-amber" : "circle"}
            size={warning ? 16 : 8}
            color={warning ? "#D97706" : node?.tone === "neutral" ? "#94A3B8" : "#10B981"}
          />
        </Row>
        <Badge
          label={node?.label ?? statusLabel(summary?.overall_status)}
          tone={node?.tone ?? (warning ? "amber" : summary ? "green" : "neutral")}
        />
        <Label muted size={11}>
          {node?.detail ??
            (sample
              ? warning
                ? "Patrón por verificar"
                : "Actividad acústica estable"
              : "Vincula un micrófono")}
        </Label>
      </Card>
    </Pressable>
  );
}

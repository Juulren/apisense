import { Pressable } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { useApp } from "../state/AppProvider";
import { nodeHiveStatus } from "../services/NodeStatus";
import { useNodeState } from "../state/useNodeState";
import type { Hive } from "../db/types";
export function HiveTile({ hive }: { hive: Hive }) {
  const { data } = useApp();
  const node = nodeHiveStatus(data.verdicts, hive.id, useNodeState().stateOf(hive.id));
  const warning = node?.tone === "amber";
  // Green only for something the node actually said; no node or no judgement is grey.
  const dot = node?.tone === "green" ? "#10B981" : "#94A3B8";
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
            color={warning ? "#D97706" : dot}
          />
        </Row>
        <Badge label={node?.label ?? "Sin nodo"} tone={node?.tone ?? "neutral"} />
        <Label muted size={11}>
          {node?.detail ?? "Vincula el nodo de esta colmena"}
        </Label>
      </Card>
    </Pressable>
  );
}

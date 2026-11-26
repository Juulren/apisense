import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { useTheme } from "./ui/theme";
import { useApp } from "../state/AppProvider";
import { nodeHiveStatus, silentText } from "../services/NodeStatus";
import { useNodeState } from "../state/useNodeState";
import type { Hive } from "../db/types";

/** One hive in the list: its code and what its node says, in two or three words. */
export function HiveRow({ hive, apiary }: { hive: Hive; apiary?: string }) {
  const { data } = useApp();
  const { colors } = useTheme();
  const node = useNodeState().stateOf(hive.id);
  const status = nodeHiveStatus(data.verdicts, hive.id, node);
  const label = status?.label ?? "Sin nodo";
  // The extra line only when the label alone would leave the person guessing.
  const detail = node.kind === "silent" ? silentText(node) : apiary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${hive.code}`}
      accessibilityHint={label}
      testID={`hive-row-${hive.code}`}
      onPress={() =>
        router.push({ pathname: "/hive/[id]", params: { id: hive.id } })
      }
      style={{ minHeight: 64 }}
    >
      <Card
        tone={status?.tone === "amber" ? "amber" : undefined}
        style={{ padding: 16, gap: 4 }}
      >
        {/* Wraps instead of breaking the code mid-word at large text sizes. */}
        <Row style={{ flexWrap: "wrap", rowGap: 6 }}>
          <View style={{ flexGrow: 1, flexShrink: 0 }}>
            <Label bold size={16}>
              {hive.code}
            </Label>
          </View>
          {status?.tone === "amber" ? (
            <Icon name="warning-amber" size={18} color={colors.amberText} />
          ) : null}
          <Badge label={label} tone={status?.tone ?? "neutral"} />
          <Icon name="chevron-right" size={22} color={colors.muted} />
        </Row>
        {detail ? (
          <Label muted size={12}>
            {detail}
          </Label>
        ) : null}
      </Card>
    </Pressable>
  );
}

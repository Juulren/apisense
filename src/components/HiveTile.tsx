import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { useApp } from "../state/AppProvider";
import { latestSample, latestSummary, statusLabel } from "../state/selectors";
import type { Hive } from "../db/types";
import { useTheme } from "./ui/theme";
export function HiveTile({ hive }: { hive: Hive }) {
  const { data } = useApp();
  const { colors } = useTheme();
  const sample = latestSample(data.samples, hive.id),
    summary = latestSummary(data.summaries, hive.id),
    mic = data.microphones.find((m) => m.hive_id === hive.id);
  const warning = summary && summary.overall_status !== "optimal";
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
        style={{ padding: 14, minHeight: 170, gap: 12 }}
      >
        <Row>
          <Label bold size={12}>
            {hive.code}
          </Label>
          <Icon
            name={warning ? "warning-amber" : "circle"}
            size={warning ? 16 : 8}
            color={warning ? "#D97706" : "#10B981"}
          />
        </Row>
        <Badge
          label={statusLabel(summary?.overall_status)}
          tone={warning ? "amber" : summary ? "green" : "neutral"}
        />
        <Label muted size={11}>
          {sample
            ? warning
              ? "Patrón por verificar"
              : "Actividad acústica estable"
            : "Vincula un micrófono"}
        </Label>
        <View style={{ height: 1, backgroundColor: colors.border }} />
        <Row>
          <Label muted size={11}>
            {sample ? `${Math.round(sample.dominant_freq_hz)} Hz` : "— Hz"}
          </Label>
          <Row style={{ gap: 2 }}>
            <Icon name="battery-full" size={14} color={colors.muted} />
            <Label muted size={11}>
              {mic ? `${Math.round(mic.battery_level)}%` : "—"}
            </Label>
          </Row>
        </Row>
      </Card>
    </Pressable>
  );
}

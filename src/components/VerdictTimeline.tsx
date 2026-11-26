import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Label, Row } from "./ui";
import { useTheme } from "./ui/theme";
import { useApp } from "../state/AppProvider";
import {
  isAlert,
  dayLabel,
  timelineSummary,
  verdictDays,
  verdictSummary,
  type DayStatus,
} from "../services/NodeStatus";

const statusText: Record<DayStatus, string> = {
  none: "sin datos",
  learning: "aprendiendo (aún no juzga)",
  usual: "sonido habitual",
  different: "sonido diferente",
};

/**
 * The last 14 days of what the node reported for one hive. Each cell is the
 * worst message of that day; the text below repeats it, so colour is never the
 * only signal.
 */
export function VerdictTimeline({ hiveId }: { hiveId: string }) {
  const { data } = useApp();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const days = verdictDays(data.verdictStats, data.verdicts, hiveId);
  const total = days.reduce((sum, d) => sum + d.count, 0);
  if (total === 0) return null;
  const fill: Record<DayStatus, string> = {
    none: colors.border,
    learning: colors.soft,
    usual: "#10B981",
    different: "#D97706",
  };
  const withData = days.filter((d) => d.count > 0).reverse();
  const shown = (d: (typeof days)[number]) =>
    d.verdicts.filter((v) => isAlert(v)).slice(0, 5);
  return (
    <Card style={{ gap: 10 }}>
        <Label bold>Últimos 14 días</Label>
        <View
          accessible
          accessibilityLabel={`Últimos 14 días. ${timelineSummary(days)}`}
          style={{ flexDirection: "row", gap: 4 }}
        >
          {days.map((d) => (
            <View
              key={d.key}
              testID={`timeline-${d.key}`}
              style={{
                flex: 1,
                minHeight: 36,
                borderRadius: 6,
                backgroundColor: fill[d.status],
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {d.status === "different" ? (
                <Label bold size={12} color="#FFFFFF">
                  !
                </Label>
              ) : null}
            </View>
          ))}
        </View>
        <Row>
          <Label muted size={12} style={{ flex: 1 }}>
            {dayLabel(days[0]!.key)}
          </Label>
          <Label muted size={12}>
            hoy
          </Label>
        </Row>
      <Label muted size={13}>
        {timelineSummary(days)}
      </Label>
      <Button
        testID="fold-node-messages"
        label={open ? "Ocultar mensajes" : "Ver mensajes"}
        variant="ghost"
        compact
        onPress={() => setOpen(!open)}
      />
      {open
        ? withData.map((d) => (
            <View key={d.key} style={{ gap: 4 }}>
              <Label bold size={13}>
                {dayLabel(d.key)} · {statusText[d.status]} · {d.count}{" "}
                {d.count === 1 ? "mensaje" : "mensajes"}
              </Label>
              {shown(d).map((v) => (
                <Label key={v.id} muted size={13}>
                  {verdictSummary(v)}
                </Label>
              ))}
            </View>
          ))
        : null}
    </Card>
  );
}

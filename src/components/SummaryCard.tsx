import { useState } from "react";
import { Pressable } from "react-native";
import type { AiSummary } from "../db/types";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { dateLabel, statusLabel } from "../state/selectors";

/**
 * `compact` leads with the status and the next step and keeps the long
 * analysis text behind "Ver detalle", so the screen starts with what to do.
 */
export function SummaryCard({
  summary,
  compact = false,
}: {
  summary: AiSummary;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const tone = summary.overall_status === "optimal" ? "green" : "amber";
  const detail = !compact || open;
  return (
    <Card tone={tone}>
      <Row>
        <Icon
          name="auto-awesome"
          color={tone === "green" ? "#10B981" : "#D97706"}
        />
        <Label bold style={{ flex: 1 }}>
          Resumen acústico periódico
        </Label>
        <Badge label={statusLabel(summary.overall_status)} tone={tone} />
      </Row>
      {compact ? (
        <>
          <Label bold size={12}>
            PRÓXIMO PASO
          </Label>
          <Label size={14}>{summary.recommended_action}</Label>
        </>
      ) : null}
      {detail ? <Label>{summary.summary_text}</Label> : null}
      {!compact ? <ViewRecommendation text={summary.recommended_action} /> : null}
      {detail ? (
        <Label muted size={11}>
          {dateLabel(summary.period_start)} — {dateLabel(summary.period_end)} ·{" "}
          {summary.samples_analyzed_count} muestras
        </Label>
      ) : null}
      {compact ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(!open)}
          style={{
            minHeight: 48,
            justifyContent: "center",
            alignSelf: "flex-start",
          }}
        >
          <Row style={{ gap: 4 }}>
            <Label bold size={13}>
              {open ? "Ocultar detalle" : "Ver detalle del análisis"}
            </Label>
            <Icon name={open ? "expand-less" : "expand-more"} size={20} />
          </Row>
        </Pressable>
      ) : null}
    </Card>
  );
}
function ViewRecommendation({ text }: { text: string }) {
  return (
    <>
      <Label bold size={12}>
        PRÓXIMO PASO
      </Label>
      <Label size={13}>{text}</Label>
    </>
  );
}

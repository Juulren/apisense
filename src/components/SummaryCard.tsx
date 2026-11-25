import type { AiSummary } from "../db/types";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { dateLabel, statusLabel } from "../state/selectors";

/**
 * `compact` is the brief automatic diagnosis: the status and the next step, and
 * when it was made. The history screen has the full text.
 */
export function SummaryCard({
  summary,
  compact = false,
}: {
  summary: AiSummary;
  compact?: boolean;
}) {
  const tone = summary.overall_status === "optimal" ? "green" : "amber";
  return (
    <Card tone={tone}>
      <Row>
        <Icon
          name="auto-awesome"
          color={tone === "green" ? "#10B981" : "#D97706"}
        />
        <Label bold style={{ flex: 1 }}>
          {compact ? "Diagnóstico automático" : "Resumen acústico periódico"}
        </Label>
        <Badge label={statusLabel(summary.overall_status)} tone={tone} />
      </Row>
      {compact ? null : <Label>{summary.summary_text}</Label>}
      <Label bold size={12}>
        PRÓXIMO PASO
      </Label>
      <Label size={compact ? 14 : 13}>{summary.recommended_action}</Label>
      <Label muted size={12}>
        {compact
          ? dateLabel(summary.period_end)
          : `${dateLabel(summary.period_start)} — ${dateLabel(summary.period_end)} · ${summary.samples_analyzed_count} muestras`}
      </Label>
    </Card>
  );
}

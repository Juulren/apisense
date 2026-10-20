import type { AiSummary } from "../db/types";
import { Badge, Card, Icon, Label, Row } from "./ui";
import { dateLabel, statusLabel } from "../state/selectors";
export function SummaryCard({ summary }: { summary: AiSummary }) {
  const tone = summary.overall_status === "optimal" ? "green" : "amber";
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
      </Row>
      <Badge label={statusLabel(summary.overall_status)} tone={tone} />
      <Label>{summary.summary_text}</Label>
      <ViewRecommendation text={summary.recommended_action} />
      <Label muted size={11}>
        {dateLabel(summary.period_start)} — {dateLabel(summary.period_end)} ·{" "}
        {summary.samples_analyzed_count} muestras
      </Label>
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

import { Card, Icon, Label, Row } from "./ui";
import { useTheme } from "./ui/theme";
import { NotDiagnosis } from "./NotDiagnosis";
import { useApp } from "../state/AppProvider";
import {
  nodeHiveStatus,
  silentText,
  type NodeState,
} from "../services/NodeStatus";
import {
  ageText,
  isLearning,
  latestVerdict,
  nodeWarnings,
} from "../services/EdgeVerdicts";
import {
  alertEpisodes,
  episodeCount,
  hivePending,
  timeText,
} from "../services/AlertEpisodes";
import type { EdgeVerdict } from "../db/types";

// Non-breaking spaces keep a number and its unit on the same line.
const percent = (v: EdgeVerdict) =>
  `confianza ${Math.round(v.confidence * 100)} %`;

/**
 * The hive's state in big letters, only when it has a node or any verdict.
 * Takes the node state from the screen so both always agree.
 */
export function NodeCard({ hiveId, state }: { hiveId: string; state: NodeState }) {
  const app = useApp();
  const { colors } = useTheme();
  const mic = app.data.microphones.find((m) => m.hive_id === hiveId);
  const verdict = latestVerdict(app.data.verdicts, hiveId);
  if (!verdict && !mic?.dev_eui) return null;
  // The same rule as the hive's row, so the two never disagree.
  const status = nodeHiveStatus(app.data.verdicts, hiveId, state);
  const pending = hivePending(alertEpisodes(app.data.verdicts), hiveId);
  const warnings = pending?.warnings.length
    ? pending.warnings
    : verdict
      ? nodeWarnings(verdict)
      : [];
  const amber = status?.tone === "amber";
  const detail = pending
    ? `${episodeCount(pending.count)} · ${percent(pending.latest)} · desde ${timeText(pending.since)}`
    : state.kind === "silent"
      ? `${silentText(state)}. Revisa el nodo.`
      : state.kind === "stale"
        ? "Sin sincronizar: no se sabe cómo está ahora"
        : !verdict
          ? "Esperando su primer mensaje"
          : [
              status ? "Último mensaje" : "Sin datos recientes · último",
              ageText(verdict.recorded_at),
              isLearning(verdict) ? "" : percent(verdict),
              verdict.temperature_c === null
                ? ""
                : `${verdict.temperature_c.toFixed(1).replace(".", ",")} °C`,
            ]
              .filter(Boolean)
              .join(" · ");
  return (
    <Card tone={amber ? "amber" : undefined} style={{ gap: 8 }}>
      <Row style={{ justifyContent: "flex-start" }}>
        {amber ? <Icon name="warning-amber" color={colors.amberText} /> : null}
        <Label bold size={22} style={{ flex: 1 }}>
          {status?.label ?? "Sin datos"}
        </Label>
      </Row>
      <Label>{detail}</Label>
      {warnings.length ? (
        <Label tone="warning" size={13}>
          Aviso del nodo: {warnings.join(", ")}.
        </Label>
      ) : null}
      {pending ? <NotDiagnosis /> : null}
    </Card>
  );
}

import { router } from "expo-router";
import { Badge, Button, Card, Label, Row } from "./ui";
import { useApp } from "../state/AppProvider";
import { nodeHiveStatus, silentText, staleText } from "../services/NodeStatus";
import { useNodeState } from "../state/useNodeState";
import {
  latestVerdict,
  pendingAlerts,
  nodeWarnings,
  verdictSummary,
} from "../services/EdgeVerdicts";

/** The hive node's last message, only when the hive has a node or any verdict. */
export function NodeCard({ hiveId }: { hiveId: string }) {
  const app = useApp();
  const mic = app.data.microphones.find((m) => m.hive_id === hiveId);
  const verdict = latestVerdict(app.data.verdicts, hiveId);
  if (!verdict && !mic?.dev_eui) return null;
  const nodes = useNodeState();
  const state = nodes.stateOf(hiveId);
  const silent = state.kind === "silent" ? state : null;
  const warnings = verdict ? nodeWarnings(verdict) : [];
  // The same rule as the hive's tile, so the two never disagree.
  const status = nodeHiveStatus(app.data.verdicts, hiveId, state);
  const attention = pendingAlerts(app.data.verdicts).some((v) => v.hive_id === hiveId);
  return (
    <Card tone={attention || silent ? "amber" : undefined}>
      <Row>
        <Label bold style={{ flex: 1 }}>
          Nodo de la colmena
        </Label>
        {status ? <Badge label={status.label} tone={status.tone} /> : null}
      </Row>
      {verdict ? (
        <Label>{verdictSummary(verdict)}</Label>
      ) : (
        <Label muted>Nodo vinculado: esperando su primer mensaje.</Label>
      )}
      {silent ? (
        <Label tone="warning" size={12}>
          {silentText(silent)}. Si pasa mucho tiempo, revisa el nodo en campo.
        </Label>
      ) : null}
      {state.kind === "stale" ? (
        <Label muted size={12}>
          {staleText}
        </Label>
      ) : null}
      {warnings.length ? (
        <Label tone="warning" size={12}>
          Aviso del nodo: {warnings.join(", ")}.
        </Label>
      ) : null}
      {attention ? (
        <Button
          label="Revisar alerta"
          variant="secondary"
          onPress={() => router.push("/alerts")}
        />
      ) : null}
    </Card>
  );
}

import { router } from "expo-router";
import { Badge, Button, Card, Label, Row } from "./ui";
import { useApp } from "../state/AppProvider";
import {
  isAlert,
  latestVerdict,
  nodeWarnings,
  verdictSummary,
} from "../services/EdgeVerdicts";

/** The hive node's last message, only when the hive has a node or any verdict. */
export function NodeCard({ hiveId }: { hiveId: string }) {
  const app = useApp();
  const mic = app.data.microphones.find((m) => m.hive_id === hiveId);
  const verdict = latestVerdict(app.data.verdicts, hiveId);
  if (!verdict && !mic?.dev_eui) return null;
  const warnings = verdict ? nodeWarnings(verdict) : [];
  const attention = verdict && isAlert(verdict) && verdict.review === null;
  return (
    <Card tone={attention ? "amber" : undefined}>
      <Row>
        <Label bold style={{ flex: 1 }}>
          Nodo de la colmena
        </Label>
        {verdict ? (
          <Badge
            label={attention ? "Por revisar" : isAlert(verdict) ? "Revisada" : "Sonido habitual"}
            tone={attention ? "amber" : "green"}
          />
        ) : null}
      </Row>
      {verdict ? (
        <Label>{verdictSummary(verdict)}</Label>
      ) : (
        <Label muted>Nodo vinculado: esperando su primer mensaje.</Label>
      )}
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

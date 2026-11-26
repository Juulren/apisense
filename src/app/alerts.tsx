import { useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { AppScreen, Empty } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Label,
  Row,
} from "../components/ui";
import { Fold } from "../components/ui/Fold";
import { NotDiagnosis } from "../components/NotDiagnosis";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { reviewLabels } from "../services/EdgeVerdicts";
import {
  alertEpisodes,
  episodeCount,
  reviewEpisode,
  reviewedGroups,
  timeText,
  type AlertEpisode,
} from "../services/AlertEpisodes";
import type { VerdictReview } from "../db/types";

export default function Alerts() {
  const app = useApp(),
    task = useTask();
  // Keyed by the episode's first alert, which stays put while it grows.
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState<Record<string, boolean>>({});
  const hiveCode = (id: string) =>
    app.data.hives.find((h) => h.id === id)?.code ?? "Colmena";
  const episodes = alertEpisodes(app.data.verdicts);
  const reviewed = reviewedGroups(app.data.verdicts);
  const review = (episode: AlertEpisode, decision: VerdictReview) =>
    task.run(async () => {
      if (!app.workspace) return;
      const key = episode.ids[0]!;
      // Only the alerts on the card: one that arrives meanwhile opens another.
      await reviewEpisode(
        app.workspace.repo,
        episode.ids,
        decision,
        notes[key] ?? "",
      );
      setNotes((n) => ({ ...n, [key]: "" }));
      await app.refresh();
    }, `Marcada: ${reviewLabels[decision].toLowerCase()}`);
  return (
    <AppScreen title="Alertas" back>
      {episodes.map((episode) => {
        const key = episode.ids[0]!;
        const code = hiveCode(episode.hive_id);
        const when =
          episode.first === episode.last
            ? timeText(episode.first)
            : `${timeText(episode.first)} a ${timeText(episode.last)}`;
        return (
          <Card key={key} tone="amber" style={{ gap: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Abrir ${code}`}
              onPress={() =>
                router.push({
                  pathname: "/hive/[id]",
                  params: { id: episode.hive_id },
                })
              }
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <Row>
                <Label bold size={20} style={{ flex: 1 }}>
                  {code}
                </Label>
                {episode.latest.source === "simulator" ? (
                  <Badge label="Simulado" tone="blue" />
                ) : null}
                <Icon name="chevron-right" />
              </Row>
            </Pressable>
            <Label>{episodeCount(episode.ids.length)}</Label>
            <Label muted size={13}>
              {when} · confianza {Math.round(episode.latest.confidence * 100)} %
            </Label>
            {episode.warnings.length ? (
              <Label tone="warning" size={13}>
                Aviso del nodo: {episode.warnings.join(", ")}.
              </Label>
            ) : null}
            <NotDiagnosis />
            {writing[key] ? (
              <Field
                label="Nota (opcional)"
                value={notes[key] ?? ""}
                onChangeText={(text) => setNotes((n) => ({ ...n, [key]: text }))}
                maxLength={500}
                placeholder="Qué encontraste al revisar"
              />
            ) : (
              <Button
                label="Añadir nota"
                icon="add"
                variant="ghost"
                compact
                onPress={() => setWriting((w) => ({ ...w, [key]: true }))}
              />
            )}
            <Button
              label="Confirmada"
              icon="check"
              variant="secondary"
              loading={task.busy}
              onPress={() => review(episode, "confirmed")}
            />
            <Button
              label="Falsa alarma"
              icon="close"
              variant="secondary"
              disabled={task.busy}
              onPress={() => review(episode, "false_alarm")}
            />
          </Card>
        );
      })}
      {!episodes.length ? <Empty>Nada por revisar.</Empty> : null}
      {reviewed.length ? (
        <Fold title="Revisadas" testID="fold-reviewed">
          {reviewed.map((group) => (
            <Card key={group.key} style={{ padding: 14, gap: 6 }}>
              <Row style={{ flexWrap: "wrap", rowGap: 6 }}>
                <Label bold style={{ flex: 1 }}>
                  {hiveCode(group.hive_id)}
                </Label>
                <Badge
                  label={reviewLabels[group.review]}
                  tone={group.review === "confirmed" ? "amber" : "neutral"}
                />
              </Row>
              <Label muted size={12}>
                {episodeCount(group.count)}
                {group.reviewedAt ? ` · ${timeText(group.reviewedAt)}` : ""}
              </Label>
              {group.note ? <Label>{group.note}</Label> : null}
            </Card>
          ))}
        </Fold>
      ) : null}
      {task.message ? (
        <Label accessibilityLiveRegion="polite">{task.message}</Label>
      ) : null}
    </AppScreen>
  );
}

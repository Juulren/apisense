import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { AppScreen, Empty } from "../components/AppScreen";
import { Button, Label, Segmented } from "../components/ui";
import { SummaryCard } from "../components/SummaryCard";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
export default function History() {
  const params = useLocalSearchParams<{ hiveId?: string }>(),
    app = useApp(),
    task = useTask();
  const [selected, setSelected] = useState(params.hiveId ?? "all"),
    [status, setStatus] = useState("all");
  const summaries = app.data.summaries
    .filter(
      (s) =>
        (selected === "all" || s.hive_id === selected) &&
        (status === "all" || s.overall_status === status),
    )
    .sort((a, b) => b.period_end.localeCompare(a.period_end));
  return (
    <AppScreen
      title="Historial de resúmenes"
      subtitle="Cambios acústicos a lo largo del tiempo"
      back
    >
      <Segmented
        value={selected}
        onChange={setSelected}
        options={[
          { value: "all", label: "Todas" },
          ...app.data.hives.map((h) => ({ value: h.id, label: h.code })),
        ]}
      />
      <Segmented
        value={status}
        onChange={setStatus}
        options={[
          { value: "all", label: "Todos" },
          { value: "optimal", label: "Estables" },
          { value: "warning", label: "Atención" },
          { value: "critical", label: "Prioritarios" },
        ]}
      />
      {summaries.length ? (
        summaries.map((summary) => (
          <SummaryEntry key={summary.id} summaryId={summary.id} />
        ))
      ) : (
        <Empty>
          No hay resúmenes para estos filtros. Genera uno desde el detalle de
          una colmena después de recibir audio.
        </Empty>
      )}
      <Button
        label="Revisar resúmenes pendientes"
        variant="secondary"
        loading={task.busy}
        onPress={() =>
          task.run(async () => {
            await app.workspace?.summaries.runDue();
            await app.refresh();
          }, "Revisión completada")
        }
      />
      {task.message ? <Label>{task.message}</Label> : null}
    </AppScreen>
  );
}
function SummaryEntry({ summaryId }: { summaryId: string }) {
  const { data } = useApp();
  const summary = data.summaries.find((s) => s.id === summaryId);
  return summary ? (
    <>
      <Label bold>
        {data.hives.find((h) => h.id === summary.hive_id)?.code ?? "Colmena"}
      </Label>
      <SummaryCard summary={summary} />
    </>
  ) : null;
}

import { useCallback, useEffect, useState } from "react";
import { Alert, AppState, Pressable, View } from "react-native";
import { useFocusEffect } from "expo-router";
import Svg, { Circle } from "react-native-svg";
import { Badge, Button, Card, Field, Label, Segmented } from "./ui";
import { useTheme } from "./ui/theme";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { dateLabel } from "../state/selectors";
import {
  broodStages,
  cycleProgress,
  localDate,
  observeCycle,
  saveCycleStart,
  stopCycle,
} from "../services/BroodCycle";
import type { BroodStage } from "../db/types";

export function BroodCycleTracker({ hiveId }: { hiveId: string }) {
  const app = useApp(),
    task = useTask(),
    { colors } = useTheme();
  const [today, setToday] = useState(localDate),
    [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState(false),
    [editingId, setEditingId] = useState<string | undefined>();
  const [startedOn, setStartedOn] = useState(today),
    [label, setLabel] = useState("");
  const [observed, setObserved] =
    useState<Exclude<BroodStage, "unknown">>("egg");
  useFocusEffect(
    useCallback(() => {
      const update = () => setToday(localDate());
      update();
      const timer = setInterval(update, 60_000);
      const subscription = AppState.addEventListener("change", (state) => {
        if (state === "active") update();
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
      };
    }, []),
  );
  const cycles = app.data.cycles
    .filter((c) => c.hive_id === hiveId)
    .sort(
      (a, b) =>
        b.updated_at.localeCompare(a.updated_at) || b.id.localeCompare(a.id),
    );
  const cycle = cycles.find((c) => c.id === selected) ?? cycles[0];
  const progress = cycle
    ? cycleProgress(
        cycle.started_on,
        cycle.ended_at ? localDate(new Date(cycle.ended_at)) : today,
      )
    : null;
  useEffect(() => {
    setObserved(
      cycle?.observed_stage && cycle.observed_stage !== "unknown"
        ? cycle.observed_stage
        : "egg",
    );
  }, [cycle?.id, cycle?.observed_stage]);
  const begin = (edit = false) => {
    setEditingId(edit ? cycle?.id : undefined);
    setStartedOn(edit && cycle ? cycle.started_on : today);
    setLabel(edit && cycle ? cycle.cohort_label : "");
    setEditing(true);
    task.setMessage(null);
  };
  const save = () =>
    task.run(async () => {
      if (!app.workspace) throw new Error("Abre tu espacio de trabajo");
      const saved = await saveCycleStart(
        app.workspace.repo,
        hiveId,
        startedOn,
        label,
        new Date(),
        editingId,
      );
      setSelected(saved.id);
      await app.refresh();
      setEditing(false);
    }, "Seguimiento guardado en este dispositivo");
  const confirm = () =>
    task.run(
      async () => {
        if (!app.workspace || !cycle)
          throw new Error("Selecciona un seguimiento");
        await observeCycle(app.workspace.repo, cycle.id, observed);
        await app.refresh();
      },
      observed === "emerged"
        ? "Emergencia confirmada por tu observación"
        : "Etapa observada guardada",
    );
  const stop = () =>
    Alert.alert(
      "¿Detener este seguimiento?",
      "Se conservará su registro. No indica que la cría haya muerto o emergido.",
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Detener",
          onPress: () => {
            void task.run(async () => {
              if (!app.workspace || !cycle)
                throw new Error("Selecciona un seguimiento");
              await stopCycle(app.workspace.repo, cycle.id);
              await app.refresh();
            }, "Seguimiento detenido; registro conservado");
          },
        },
      ],
    );
  const estimated = progress
    ? progress.due
      ? "Emergencia estimada · Por verificar"
      : `${broodStages[progress.stage]} · Estimación`
    : "Sin fecha de inicio";
  const circumference = 2 * Math.PI * 88;
  const phaseDays = [
    Math.min(progress?.day ?? 0, 3),
    Math.max(0, Math.min((progress?.day ?? 0) - 3, 5)),
    Math.max(0, (progress?.day ?? 0) - 8),
  ];
  let offset = 0;
  return (
    <Card>
      <Label bold size={20} accessibilityRole="header">
        Ciclo de cría
      </Label>
      <Badge label="Obreras · Calendario orientativo de 21 días" tone="amber" />
      {cycles.length > 1 ? (
        <Segmented
          value={cycle?.id ?? ""}
          onChange={(id) => {
            setSelected(id);
            setEditing(false);
            task.setMessage(null);
          }}
          options={cycles.map((c) => ({
            value: c.id,
            label: `${c.cohort_label} · ${c.started_on}${c.state !== "active" ? " · Cerrado" : ""}`,
          }))}
        />
      ) : null}
      {cycle ? (
        <Label bold>{cycle.cohort_label}</Label>
      ) : (
        <Label>
          Registra un cuadro o lote y su fecha estimada de puesta para empezar.
        </Label>
      )}
      <Pressable
        testID="brood-cycle-ring"
        accessibilityRole="button"
        accessibilityLabel={
          cycle && progress
            ? `Ciclo de ${cycle.cohort_label}, día ${progress.day} de 21. ${estimated}. ${cycle.state === "active" ? "Editar fecha o cuadro" : "Iniciar otro seguimiento"}`
            : "Ciclo sin registro. Iniciar seguimiento"
        }
        accessibilityHint="Abre el formulario de fecha y cuadro"
        onPress={() => begin(cycle?.state === "active")}
        disabled={task.busy}
        style={{ alignSelf: "center", width: 220, height: 220 }}
      >
        <Svg width={220} height={220} viewBox="0 0 220 220" accessible={false}>
          <Circle
            cx={110}
            cy={110}
            r={88}
            stroke={colors.border}
            strokeWidth={14}
            fill="none"
          />
          {phaseDays.map((days, i) => {
            const start = offset;
            offset += (days / 21) * circumference;
            return days ? (
              <Circle
                key={i}
                cx={110}
                cy={110}
                r={88}
                fill="none"
                stroke={["#D97706", colors.amberText, colors.greenText][i]}
                strokeWidth={14}
                strokeDasharray={`${Math.max(0, (days / 21) * circumference - 3)} ${circumference}`}
                strokeDashoffset={-start}
                rotation={-90}
                origin="110,110"
              />
            ) : null;
          })}
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 40,
            left: 30,
            right: 30,
            bottom: 40,
            justifyContent: "center",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Label bold size={24} style={{ textAlign: "center" }}>
            {progress ? `Día ${progress.day}` : "Sin registro"}
          </Label>
          <Label muted style={{ textAlign: "center" }}>
            {progress ? "de 21" : "Toca para iniciar"}
          </Label>
        </View>
      </Pressable>
      <Label bold color={colors.greenText}>
        {estimated}
      </Label>
      {cycle && progress ? (
        <>
          <Label muted size={12}>
            Inicio: {cycle.started_on} · Emergencia aproximada:{" "}
            {progress.expectedOn}
          </Label>
          <Label>
            {cycle.state === "active"
              ? progress.due
                ? "El plazo orientativo se cumplió. Revisa el cuadro y confirma lo observado; el ciclo no se cierra automáticamente."
                : `Faltan aproximadamente ${progress.remaining} días para el día 21.`
              : cycle.state === "emerged"
                ? "Cerrado con emergencia observada en campo."
                : "Seguimiento detenido; historial conservado."}
          </Label>
          {progress.elapsed >= 21 ? (
            <Label muted size={12}>
              Han transcurrido {progress.elapsed} días desde la fecha
              registrada.
            </Label>
          ) : null}
          <Label muted size={12}>
            Última observación: {broodStages[cycle.observed_stage]}
            {cycle.observed_at ? ` · ${dateLabel(cycle.observed_at)}` : ""}
          </Label>
          <Badge
            label={
              cycle.synced_at
                ? "Sincronizado"
                : app.workspace?.demo
                  ? "Registro sintético local"
                  : "Guardado local · Pendiente de sincronizar"
            }
            tone="blue"
          />
          {cycle.state === "active" ? (
            <>
              <Button
                label="Editar fecha o cuadro"
                variant="secondary"
                onPress={() => begin(true)}
                disabled={task.busy}
              />
              <Label bold>¿Qué observaste en el cuadro?</Label>
              <Segmented
                value={observed}
                onChange={setObserved}
                options={(["egg", "larva", "capped", "emerged"] as const).map(
                  (value) => ({ value, label: broodStages[value] }),
                )}
              />
              <Button
                label={
                  observed === "emerged"
                    ? "Confirmar emergencia observada"
                    : "Guardar etapa observada"
                }
                icon="check-circle-outline"
                onPress={confirm}
                loading={task.busy}
              />
              <Button
                label="Detener seguimiento"
                variant="secondary"
                onPress={stop}
                disabled={task.busy}
              />
            </>
          ) : null}
        </>
      ) : null}
      <Label muted size={12}>
        Días 1–3: huevos · 4–8: larvas · 9–20: cría operculada · 21: emergencia
        aproximada. Día 1 es la fecha registrada. Los tiempos varían: el
        calendario no mide el estado real ni se calcula con audio. Confirma en
        inspección.
      </Label>
      {editing || !cycle ? (
        <View style={{ gap: 16 }}>
          <Field
            label="Cuadro o lote"
            testID="cycle-label"
            value={label}
            onChangeText={setLabel}
            placeholder="Ej. Cuadro 3 · lote norte"
            maxLength={80}
          />
          <Field
            label="Fecha estimada de puesta (AAAA-MM-DD)"
            testID="cycle-start"
            value={startedOn}
            onChangeText={setStartedOn}
            placeholder="2026-11-02"
            maxLength={10}
            autoCapitalize="none"
          />
          <Button
            label={
              editingId
                ? "Guardar cambios del ciclo"
                : "Iniciar seguimiento de cría"
            }
            icon="save-alt"
            onPress={save}
            loading={task.busy}
          />
          {cycle ? (
            <Button
              label="Cancelar edición"
              variant="secondary"
              onPress={() => {
                setEditing(false);
                task.setMessage(null);
              }}
              disabled={task.busy}
            />
          ) : null}
        </View>
      ) : (
        <Button
          label="Iniciar otro cuadro o lote"
          variant="secondary"
          onPress={() => begin()}
          disabled={task.busy}
        />
      )}
      {task.message ? (
        <Label accessibilityLiveRegion="polite">{task.message}</Label>
      ) : null}
    </Card>
  );
}

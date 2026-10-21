import { useState } from "react";
import { View } from "react-native";
import { useAudioPlayer } from "expo-audio";
import { router, useLocalSearchParams } from "expo-router";
import { randomUUID } from "expo-crypto";
import { AppScreen, Empty } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Label,
  Metric,
  Section,
  Segmented,
} from "../components/ui";
import { AcousticChart } from "../components/AcousticChart";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { dateLabel, latestSample } from "../state/selectors";
import { simulate, type SimulationPattern } from "../services/iot/Simulator";
import { supabase } from "../services/supabase";
const labels = {
  healthy: "Patrón estable",
  swarming: "Patrón agudo por verificar",
  queenless: "Patrón disperso por verificar",
  pest_disturbance: "Perturbación por verificar",
  unknown: "Sin clasificación fiable",
};
export default function Monitor() {
  const params = useLocalSearchParams<{ hiveId?: string }>(),
    app = useApp(),
    task = useTask(),
    player = useAudioPlayer(null);
  const [selected, setSelected] = useState(params.hiveId ?? ""),
    [technical, setTechnical] = useState(false),
    [pattern, setPattern] = useState<SimulationPattern>("healthy");
  const hive =
      app.data.hives.find((h) => h.id === selected) ?? app.data.hives[0],
    sample = hive ? latestSample(app.data.samples, hive.id) : undefined,
    mic = app.data.microphones.find((m) => m.hive_id === hive?.id);
  const play = () =>
    task.run(async () => {
      if (!sample) throw new Error("No hay muestras para escuchar");
      let uri = sample.local_audio_uri;
      if (!uri && sample.audio_file_url && supabase) {
        const { data, error } = await supabase.storage
          .from("hive-audio")
          .createSignedUrl(sample.audio_file_url, 60);
        if (error) throw error;
        uri = data.signedUrl;
      }
      if (!uri) throw new Error("Esta muestra no tiene un clip disponible");
      player.replace({ uri });
      player.play();
    }, "Reproduciendo clip");
  const capture = () =>
    task.run(async () => {
      if (!app.workspace?.demo || !hive || !mic)
        throw new Error("El simulador solo está disponible en la demo");
      await app.workspace.ingestion.ingest(
        simulate(
          pattern,
          { id: randomUUID(), hive_id: hive.id, device_id: mic.id },
          Date.now(),
        ),
        "simulator",
      );
      await app.workspace.summaries.generate(hive.id);
      await app.refresh();
    }, "Muestra simulada y resumen guardados");
  return (
    <AppScreen
      title="Monitoreo acústico"
      subtitle="Escucha inteligente de tus colmenas"
    >
      <Segmented
        value={hive?.id ?? ""}
        options={app.data.hives.map((h) => ({ value: h.id, label: h.code }))}
        onChange={setSelected}
      />
      {hive ? (
        <>
          <Card>
            <Badge
              label={
                sample?.source === "simulator"
                  ? "Simulación"
                  : sample
                    ? "Lectura recibida"
                    : "Esperando lectura"
              }
              tone="blue"
            />
            <Label bold size={21}>
              {hive.code}
            </Label>
            <Badge
              label={
                sample ? labels[sample.acoustic_classification] : "Sin muestras"
              }
              tone={
                sample?.acoustic_classification === "healthy"
                  ? "green"
                  : "amber"
              }
            />
            <Label muted>
              {sample
                ? "El sonido ayuda a observar cambios de actividad. Contrasta cualquier variación con el entorno y tu inspección."
                : "Vincula un micrófono o utiliza el simulador de la demo."}
            </Label>
            {sample ? (
              <Label muted size={11}>
                {dateLabel(sample.recorded_at)} ·{" "}
                {sample.classifier_version.startsWith("onnx:")
                  ? "Modelo ONNX"
                  : "Reglas experimentales · sin modelo validado"}
              </Label>
            ) : null}
            <Button
              label="Escuchar zumbido"
              variant="audio"
              icon="volume-up"
              disabled={!sample}
              loading={task.busy}
              onPress={play}
            />
            <Button
              label="Detener audio"
              variant="secondary"
              compact
              onPress={() => {
                player.pause();
                player.seekTo(0);
              }}
            />
          </Card>
          <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
            <Metric
              label="Frecuencia dominante"
              value={
                sample ? Math.round(sample.dominant_freq_hz).toString() : "—"
              }
              unit="Hz"
              icon="graphic-eq"
            />
            <Metric
              label="Nivel digital"
              value={sample ? sample.amplitude_db.toFixed(1) : "—"}
              unit="dBFS"
              icon="volume-up"
            />
          </View>
          <Card>
            <AcousticChart sample={sample} />
          </Card>
          <Button
            label={
              technical ? "Ocultar telemetría" : "Ver telemetría y frecuencias"
            }
            variant="secondary"
            icon="tune"
            onPress={() => setTechnical(!technical)}
          />
          {technical && sample ? (
            <Card>
              <Label bold>Características de la muestra</Label>
              <Label size={12}>
                MFCC:{" "}
                {JSON.parse(sample.mfcc_features_json)
                  .map((v: number) => v.toFixed(2))
                  .join(", ")}
              </Label>
              <Label muted size={12}>
                Muestreo: {mic?.sampling_rate_hz ?? "—"} Hz ·{" "}
                {sample.duration_seconds} segundos · Fuente: {sample.source}
              </Label>
              <Label muted size={12}>
                Puntuación orientativa:{" "}
                {Math.round(sample.confidence_score * 100)}%. Las reglas no
                emiten probabilidades calibradas.
              </Label>
              <Label muted size={12}>
                Calibración relativa: {mic?.calibration_db ?? 0} dB. El nivel
                mostrado es dBFS, no presión sonora SPL.
              </Label>
            </Card>
          ) : null}
          {app.workspace?.demo ? (
            <Section
              title="Simulador de campo"
              caption="Genera audio sintético; estos datos permanecen en la demo"
            >
              <Segmented
                value={pattern}
                onChange={setPattern}
                options={[
                  { value: "healthy", label: "Sana" },
                  { value: "swarming", label: "Piping" },
                  { value: "queenless", label: "Sin reina" },
                  { value: "pest_disturbance", label: "Perturbación" },
                ]}
              />
              <Button
                label="Simular muestra de 5 segundos"
                icon="play-circle-outline"
                loading={task.busy}
                onPress={capture}
              />
            </Section>
          ) : null}
          <Button
            label="Vincular micrófono"
            variant="secondary"
            icon="bluetooth"
            onPress={() =>
              router.push({ pathname: "/pairing", params: { hiveId: hive.id } })
            }
          />
        </>
      ) : (
        <Empty>Crea una colmena para recibir lecturas.</Empty>
      )}
      {task.message ? <Label>{task.message}</Label> : null}
    </AppScreen>
  );
}

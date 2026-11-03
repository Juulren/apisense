import { useState } from "react";
import { router } from "expo-router";
import { Badge, Button, Card, Label, Section } from "./ui";
import { useApp } from "../state/AppProvider";
import { dateLabel, hiveReadings } from "../state/selectors";

export function HiveReadings({ hiveId }: { hiveId: string }) {
  const { data } = useApp();
  const [expanded, setExpanded] = useState(false),
    [limit, setLimit] = useState(10);
  const samples = hiveReadings(data.samples, hiveId);
  return (
    <Section
      title="Lecturas de esta colmena"
      caption="Cada registro conserva fecha, origen y mediciones"
    >
      <Button
        label={
          expanded
            ? "Ocultar lecturas"
            : `Ver lecturas guardadas (${samples.length})`
        }
        variant="secondary"
        onPress={() => setExpanded(!expanded)}
      />
      {expanded ? (
        samples.length ? (
          <>
            {samples.slice(0, limit).map((sample, index) => (
              <Card key={sample.id}>
                <Label bold>{dateLabel(sample.recorded_at)}</Label>
                <Badge
                  label={
                    sample.source === "simulator"
                      ? "Audio sintético · Demo"
                      : sample.source === "ble"
                        ? "Recibida por BLE"
                        : "Recibida por MQTT"
                  }
                  tone="blue"
                />
                <Label>
                  {Math.round(sample.dominant_freq_hz)} Hz ·{" "}
                  {sample.amplitude_db.toFixed(1)} dBFS ·{" "}
                  {sample.duration_seconds} s
                </Label>
                <Label muted size={12}>
                  Micrófono:{" "}
                  {data.microphones.find((m) => m.id === sample.device_id)
                    ?.mac_address ?? sample.device_id}
                </Label>
                <Button
                  label={`Abrir lectura ${index + 1}`}
                  testID={`reading-${sample.id}`}
                  icon="graphic-eq"
                  variant="secondary"
                  onPress={() =>
                    router.push({
                      pathname: "/monitor",
                      params: { hiveId, sampleId: sample.id },
                    })
                  }
                />
              </Card>
            ))}
            {samples.length > limit ? (
              <Button
                label="Mostrar más lecturas"
                variant="secondary"
                onPress={() => setLimit(limit + 10)}
              />
            ) : null}
          </>
        ) : (
          <Label>
            Aún no hay lecturas de esta colmena. Vincula un micrófono desde el
            monitor acústico.
          </Label>
        )
      ) : null}
    </Section>
  );
}

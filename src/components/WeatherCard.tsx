import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button, Card, Icon, IconButton, Label, Row } from "./ui";
import { PlacePicker } from "./PlacePicker";
import { useTask } from "../state/useTask";
import { setApiaryLocation } from "../services/Apiaries";
import { useApp } from "../state/AppProvider";
import { useWeather } from "../state/useWeather";
import { ageLabel, WEATHER_LABEL } from "../services/Weather";
import type { Apiary } from "../db/types";

/**
 * Current weather for the apiary in one line; touching it shows the rest, with a
 * way to change the place it is for.
 */
export function WeatherCard({ apiary }: { apiary: Apiary | undefined }) {
  const state = useWeather(apiary);
  const app = useApp();
  const task = useTask();
  const [choosing, setChoosing] = useState(false);
  const [open, setOpen] = useState(false);
  if (!apiary || !state) return null;
  if (state.disabled === "off" || state.disabled === "no-location") {
    const hasPlace = apiary.latitude !== null && apiary.longitude !== null;
    return (
      <Card>
        <Row>
          <View style={{ flex: 1, gap: 2 }}>
            <Label bold>Clima del apiario</Label>
            <Label muted size={12}>
              {hasPlace
                ? "El clima está desactivado."
                : "Elige dónde está tu apiario para ver el clima."}
            </Label>
          </View>
          {hasPlace ? (
            <Button
              label="Activar clima"
              variant="secondary"
              compact
              loading={task.busy}
              onPress={() =>
                task.run(async () => {
                  if (!app.workspace || apiary.latitude === null || apiary.longitude === null) return;
                  await setApiaryLocation(app.workspace.repo, apiary.id, apiary.latitude, apiary.longitude);
                  await app.refresh();
                })
              }
            />
          ) : (
            <Button
              label={choosing ? "Cerrar" : "Elegir lugar"}
              variant="secondary"
              compact
              onPress={() => setChoosing(!choosing)}
            />
          )}
        </Row>
        {choosing && !hasPlace ? <PlacePicker apiaryId={apiary.id} onDone={() => setChoosing(false)} /> : null}
        {task.message ? <Label>{task.message}</Label> : null}
      </Card>
    );
  }
  const reading = state.reading;
  const old = state.stale || state.disabled === "offline";
  if (!open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clima del apiario"
        accessibilityHint={
          reading
            ? `${Math.round(reading.temperature)} grados, pronóstico`
            : "Sin datos recientes"
        }
        accessibilityState={{ expanded: false }}
        onPress={() => setOpen(true)}
        style={{ minHeight: 48 }}
      >
        <Card style={{ paddingVertical: 12, gap: 2 }}>
          <Row>
            <Icon name="cloud-queue" size={22} />
            <View style={{ flex: 1 }}>
              <Label bold>
                {reading
                  ? `${Math.round(reading.temperature)} °C · ${
                      reading.precipitation > 0
                        ? `lluvia ${reading.precipitation.toFixed(1)} mm`
                        : "sin lluvia"
                    }`
                  : "Clima sin datos recientes"}
              </Label>
              {reading ? (
                <Label muted size={12}>
                  Estimado, no medido aquí{old ? " · sin actualizar" : ""}
                </Label>
              ) : null}
            </View>
            <Icon name="expand-more" size={22} />
          </Row>
        </Card>
      </Pressable>
    );
  return (
    <Card>
      <Row>
        <View style={{ flex: 1 }}>
          <Label bold>Clima del apiario</Label>
        </View>
        <Button
          label={choosing ? "Cerrar" : "Cambiar lugar"}
          variant="ghost"
          compact
          onPress={() => setChoosing(!choosing)}
        />
        <IconButton
          icon="expand-less"
          label="Ocultar el clima"
          expanded
          onPress={() => {
            setOpen(false);
            setChoosing(false);
          }}
        />
      </Row>
      {reading ? (
        <>
          <Label bold size={20}>
            {Math.round(reading.temperature)} °C · {Math.round(reading.humidity)} %
          </Label>
          <Label>
            Viento {Math.round(reading.wind)} km/h · Lluvia{" "}
            {reading.precipitation.toFixed(1)} mm
          </Label>
          <Label muted size={12}>
            {ageLabel(reading.fetchedAt)}
            {state.stale || state.disabled === "offline"
              ? " · dato guardado, sin actualizar"
              : ""}{" "}
            · {WEATHER_LABEL}
          </Label>
        </>
      ) : (
        <Label muted>Sin datos recientes del clima.</Label>
      )}
      {choosing ? (
        <PlacePicker apiaryId={apiary.id} onDone={() => setChoosing(false)} />
      ) : null}
    </Card>
  );
}

import { useState } from "react";
import { View } from "react-native";
import { Button, Card, Icon, Label, Row } from "./ui";
import { PlacePicker } from "./PlacePicker";
import { useTask } from "../state/useTask";
import { setApiaryLocation } from "../services/Apiaries";
import { useApp } from "../state/AppProvider";
import { useWeather } from "../state/useWeather";
import { ageLabel, WEATHER_LABEL } from "../services/Weather";
import type { Apiary } from "../db/types";

/**
 * Current weather for the apiary, with a way to pick (or change) the place it
 * is for. With no place chosen it shows the picker straight away.
 */
export function WeatherCard({ apiary }: { apiary: Apiary | undefined }) {
  const state = useWeather(apiary);
  const app = useApp();
  const task = useTask();
  const [choosing, setChoosing] = useState(false);
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
        <Icon name="cloud-queue" />
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

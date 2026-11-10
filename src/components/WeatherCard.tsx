import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Icon, Label, Row } from "./ui";
import { useWeather } from "../state/useWeather";
import { ageLabel, WEATHER_LABEL } from "../services/Weather";
import type { Apiary } from "../db/types";

/** Current weather for the apiary, or a one-line way to turn it on. Hidden in the demo. */
export function WeatherCard({ apiary }: { apiary: Apiary | undefined }) {
  const state = useWeather(apiary);
  if (!apiary || !state || state.disabled === "demo") return null;
  if (state.disabled === "off" || state.disabled === "no-location")
    return (
      <Card>
        <Row>
          <View style={{ flex: 1, gap: 4 }}>
            <Label bold>Clima del apiario</Label>
            <Label muted size={12}>
              {state.disabled === "no-location"
                ? "Indica la ubicación del apiario en Ajustes para ver el clima."
                : "Actívalo en Ajustes para ver temperatura, humedad, viento y lluvia."}
            </Label>
          </View>
          <Button
            label="Ajustes"
            variant="secondary"
            compact
            onPress={() => router.push("/settings")}
          />
        </Row>
      </Card>
    );
  const reading = state.reading;
  return (
    <Card>
      <Row>
        <Label bold>Clima del apiario</Label>
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
    </Card>
  );
}

import { View } from "react-native";
import { router } from "expo-router";
import { Badge, Button, Card, Icon, Label, Row } from "./ui";
import { Fold } from "./ui/Fold";
import { SeasonRing } from "./SeasonRing";
import { useApp } from "../state/AppProvider";
import {
  calendarDisclaimer,
  calendarFor,
  monthLong,
  phaseLabels,
  phaseOn,
} from "../services/Seasons";

/**
 * Where the apiary typically is in the year, in three lines. The ring and the
 * details open on request. Sits at the top of Diagnóstico.
 */
export function SeasonBrief() {
  const { data } = useApp();
  const apiary = data.apiaries[0];
  if (!apiary) return null;
  const today = new Date();
  const { calendar } = calendarFor(apiary);
  const position = phaseOn(calendar, today);
  const info = position.info;
  if (!info)
    return (
      <Card>
        <Row>
          <Icon name="event" />
          <Label bold style={{ flex: 1 }}>
            Temporada de la zona
          </Label>
        </Row>
        <Label muted size={13}>
          {calendar
            ? "Este mes no tiene datos en tu calendario."
            : "Elige el calendario de tu zona para ver la temporada típica de cada mes."}
        </Label>
        <Button
          label="Elegir en Ajustes"
          variant="secondary"
          compact
          onPress={() => router.push("/settings")}
        />
      </Card>
    );
  return (
    <View style={{ gap: 12 }}>
      <Card>
        <Row>
          <Icon name="event" />
          <Label bold style={{ flex: 1 }}>
            {monthLong[position.month]} · temporada típica
          </Label>
          <Badge label={phaseLabels[info.phase]} tone="amber" />
        </Row>
        <Label size={13}>{info.flora}</Label>
        {position.changesIn !== null && position.next ? (
          <Label muted size={12}>
            {position.changesIn === 1
              ? "El próximo mes"
              : `En ${position.changesIn} meses`}{" "}
            suele pasar a: {phaseLabels[position.next.phase]}.
          </Label>
        ) : null}
      </Card>
      <Fold title="Ver temporada completa" testID="fold-season">
        <Card>
          <SeasonRing calendar={calendar} today={today} info={info} />
          <Label size={13}>{info.note}</Label>
          <Label muted size={12}>
            {info.confidence ? `Confianza: ${info.confidence}` : "Tu calendario"}
            {info.single ? " · fuente única" : ""}
          </Label>
          <Label muted size={12}>
            {calendarDisclaimer}
          </Label>
        </Card>
      </Fold>
    </View>
  );
}

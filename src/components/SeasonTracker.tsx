import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Badge, Button, Card, Icon, Label } from "./ui";
import { useTheme } from "./ui/theme";
import { SeasonRing } from "./SeasonRing";
import { useApp } from "../state/AppProvider";
import {
  YUCATAN_REFERENCE,
  calendarDisclaimer,
  calendarFor,
  checkinDue,
  monthLong,
  phaseLabels,
  phaseOn,
  recentDays,
  seasonSignals,
  type Frequency,
} from "../services/Seasons";

const dueText: Record<Frequency, string> = {
  daily: "Hoy aún no hay registro de esta colmena.",
  weekly: "Esta semana aún no hay registro de esta colmena.",
  off: "",
};

/**
 * Season tracker for one hive: where the apiary typically is in the year, what
 * the beekeeper wrote recently, and at most two plain-worded signals. With no
 * check-ins it only shows the general information for the season.
 */
export function SeasonTracker({
  hiveId,
  cta = true,
}: {
  hiveId: string;
  cta?: boolean;
}) {
  const app = useApp(),
    { colors } = useTheme();
  const [today, setToday] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setToday(new Date());
    }, []),
  );
  const hive = app.data.hives.find((h) => h.id === hiveId);
  const apiary = app.data.apiaries.find((a) => a.id === hive?.apiary_id);
  const { calendar, source } = useMemo(() => calendarFor(apiary), [apiary]);
  const position = phaseOn(calendar, today);
  const info = position.info;
  const checkins = useMemo(
    () => app.data.inspections.filter((i) => i.hive_id === hiveId),
    [app.data.inspections, hiveId],
  );
  const frequency: Frequency = apiary?.checkin_frequency ?? "weekly";
  const due = checkinDue(frequency, checkins, today);
  const days = useMemo(() => recentDays(checkins, today), [checkins, today]);
  const signals = seasonSignals(checkins, info?.phase ?? null, today);
  const open = () =>
    router.push({ pathname: "/inspection", params: { hiveId } });
  return (
    <Card>
      <Badge label="Temporada · orientativa" tone="amber" />
      <SeasonRing calendar={calendar} today={today} info={info} />
      {info ? (
        <View style={{ gap: 6 }}>
          <Label bold>{info.flora}</Label>
          <Label>{info.note}</Label>
          <Label muted size={12}>
            {info.confidence ? `Confianza: ${info.confidence}` : "Tu calendario"}
            {info.single ? " · fuente única" : ""}
            {source === "yucatan" ? ` · ${YUCATAN_REFERENCE}` : ""}
          </Label>
          {position.changesIn !== null && position.next ? (
            <Label muted size={12}>
              {position.changesIn === 1
                ? "El próximo mes"
                : `En ${position.changesIn} meses`}{" "}
              ({monthLong[(position.month + position.changesIn) % 12]}) suele
              pasar a: {phaseLabels[position.next.phase]}.
            </Label>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          <Label>
            {calendar
              ? "Este mes no tiene datos en tu calendario."
              : "Aún no hay un calendario para esta ubicación. Elige o edita uno en Ajustes."}
          </Label>
          <Button
            label="Ir a Ajustes"
            variant="secondary"
            onPress={() => router.push("/settings")}
          />
        </View>
      )}
      <View style={{ gap: 8 }}>
        <Label bold>Registro rápido</Label>
        {checkins.length === 0 ? (
          <Label muted size={12}>
            Sin registros: mostrando información general de la temporada.
            Anota cuando quieras, a diario o cada semana, para afinarla.
          </Label>
        ) : (
          <View
            accessible
            accessibilityLabel={`Registros de los últimos 14 días: ${days.filter((d) => d.done).length}`}
            style={{ flexDirection: "row", gap: 4, flexWrap: "wrap" }}
          >
            {days.map((day) => (
              <View
                key={day.date}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: day.done ? colors.amberText : colors.border,
                  backgroundColor: day.done ? colors.amberText : "transparent",
                }}
              />
            ))}
          </View>
        )}
        {due && frequency !== "off" ? (
          <Label muted size={12}>
            {dueText[frequency]}
          </Label>
        ) : null}
        {cta ? (
          <Button
            label="Registrar cómo la ves"
            icon="edit-note"
            variant={due ? "primary" : "secondary"}
            onPress={open}
          />
        ) : null}
      </View>
      {signals.map((signal) => (
        <View
          key={signal.text}
          accessibilityRole="alert"
          style={{
            flexDirection: "row",
            gap: 8,
            padding: 12,
            borderRadius: 12,
            backgroundColor: signal.tone === "info" ? colors.blue : colors.amber,
          }}
        >
          <Icon
            name={signal.tone === "info" ? "info-outline" : "report-problem"}
            color={signal.tone === "info" ? colors.blueText : colors.amberText}
          />
          <Label style={{ flex: 1 }}>{signal.text}</Label>
        </View>
      ))}
      <Label muted size={12}>
        {calendarDisclaimer}
      </Label>
    </Card>
  );
}

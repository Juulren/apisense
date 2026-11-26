import { useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { Card, Icon, Label, Row } from "./ui";
import { SeasonRing } from "./SeasonRing";
import type { Apiary } from "../db/types";
import {
  calendarDisclaimer,
  calendarFor,
  monthLong,
  phaseLabels,
  phaseOn,
} from "../services/Seasons";

/**
 * Where the apiary typically is in the year, in one line at the top of Colmenas.
 * The ring and the details open when it is touched.
 */
export function SeasonBrief({ apiary }: { apiary: Apiary | undefined }) {
  const [open, setOpen] = useState(false);
  if (!apiary) return null;
  const today = new Date();
  const { calendar } = calendarFor(apiary);
  const position = phaseOn(calendar, today);
  const info = position.info;
  return (
    <>
      <Pressable
        testID="fold-season"
        accessibilityRole="button"
        accessibilityState={info ? { expanded: open } : undefined}
        onPress={() =>
          info
            ? setOpen(!open)
            : router.push({
                pathname: "/settings/apiary",
                params: { id: apiary.id, advanced: "1" },
              })
        }
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Row>
          <Icon name="event" size={20} />
          <Label style={{ flex: 1 }}>
            {info
              ? `${monthLong[position.month]} · ${phaseLabels[info.phase]} (típica)`
              : "Temporada: elegir calendario"}
          </Label>
          <Icon
            name={info ? (open ? "expand-less" : "expand-more") : "chevron-right"}
            size={22}
          />
        </Row>
      </Pressable>
      {info && open ? (
        <Card>
          <SeasonRing calendar={calendar} today={today} info={info} />
          <Label size={13}>{info.flora}</Label>
          <Label size={13}>{info.note}</Label>
          {position.changesIn !== null && position.next ? (
            <Label muted size={12}>
              {position.changesIn === 1
                ? "El próximo mes"
                : `En ${position.changesIn} meses`}{" "}
              suele pasar a: {phaseLabels[position.next.phase]}.
            </Label>
          ) : null}
          <Label muted size={12}>
            {info.confidence ? `Confianza: ${info.confidence}` : "Tu calendario"}
            {info.single ? " · fuente única" : ""}
          </Label>
          <Label muted size={12}>
            {calendarDisclaimer}
          </Label>
        </Card>
      ) : null}
    </>
  );
}

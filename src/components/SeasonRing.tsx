import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Label } from "./ui";
import { tokens, useTheme } from "./ui/theme";
import {
  monthLong,
  phaseLabels,
  type Calendar,
  type MonthInfo,
  type Phase,
} from "../services/Seasons";

const SIZE = 220;
const CENTER = SIZE / 2;
const RADIUS = 88;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function usePhaseColors() {
  const { colors } = useTheme();
  return {
    flow: tokens.honey,
    hard: tokens.blue,
    reactivation: tokens.green,
    transition: colors.muted,
  } satisfies Record<Phase, string>;
}

/**
 * Year ring: twelve months from January at the top, coloured by typical phase,
 * with a dot for today. Phase is also written in words, never by colour alone.
 */
export function SeasonRing({
  calendar,
  today,
  info,
}: {
  calendar: Calendar | null;
  today: Date;
  info: MonthInfo | null;
}) {
  const { colors } = useTheme();
  const phaseColors = usePhaseColors();
  const month = today.getMonth();
  const daysInMonth = new Date(today.getFullYear(), month + 1, 0).getDate();
  const angle =
    ((month + (today.getDate() - 1) / daysInMonth) / 12) * 2 * Math.PI -
    Math.PI / 2;
  const slot = CIRCUMFERENCE / 12;
  return (
    <View
      accessible
      accessibilityLabel={
        info
          ? `Calendario típico del año. Hoy es ${monthLong[month]}, fase típica: ${phaseLabels[info.phase]}`
          : "Calendario del año sin configurar"
      }
      style={{ alignSelf: "center", width: SIZE, height: SIZE }}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {Array.from({ length: 12 }, (_, i) => {
          const entry = calendar?.[i] ?? null;
          return (
            <Circle
              key={i}
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={entry ? phaseColors[entry.phase] : colors.border}
              strokeOpacity={i === month ? 1 : 0.55}
              strokeWidth={i === month ? 20 : 14}
              strokeDasharray={`${slot - 3} ${CIRCUMFERENCE}`}
              strokeDashoffset={-i * slot}
              rotation={-90}
              origin={`${CENTER},${CENTER}`}
            />
          );
        })}
        <Circle
          cx={CENTER + RADIUS * Math.cos(angle)}
          cy={CENTER + RADIUS * Math.sin(angle)}
          r={8}
          fill={colors.text}
          stroke={colors.card}
          strokeWidth={3}
        />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 42,
          left: 34,
          right: 34,
          bottom: 42,
          justifyContent: "center",
          alignItems: "center",
          gap: 2,
        }}
      >
        {info ? (
          <>
            <Label muted size={11} maxFontSizeMultiplier={1.2} style={{ textAlign: "center" }}>
              Fase típica
            </Label>
            <Label bold size={15} maxFontSizeMultiplier={1.2} style={{ textAlign: "center" }}>
              {phaseLabels[info.phase]}
            </Label>
            <Label muted size={12} maxFontSizeMultiplier={1.2} style={{ textAlign: "center" }}>
              {monthLong[month]}
            </Label>
          </>
        ) : (
          <>
            <Label bold size={15} maxFontSizeMultiplier={1.2} style={{ textAlign: "center" }}>
              Sin calendario
            </Label>
            <Label muted size={12} maxFontSizeMultiplier={1.2} style={{ textAlign: "center" }}>
              {monthLong[month]}
            </Label>
          </>
        )}
      </View>
    </View>
  );
}

import { useEffect, useState } from "react";
import { View } from "react-native";
import Svg, { Line, Polyline, Rect, Text as SvgText } from "react-native-svg";
import type { AudioSample } from "../db/types";
import { clips } from "../services/iot/ClipStore";
import { decodeWav } from "../services/iot/wav";
import { powerSpectrum, preprocess } from "../services/ai/acoustics";
import { Label } from "./ui";
import { useTheme } from "./ui/theme";
type Charts = {
  spectrum: number[];
  cells: { x: number; y: number; power: number }[];
};
export function AcousticChart({ sample }: { sample?: AudioSample }) {
  const [chart, setChart] = useState<Charts | null>(null),
    [error, setError] = useState<string | null>(null);
  const { colors } = useTheme();
  useEffect(() => {
    let cancelled = false;
    setChart(null);
    setError(null);
    if (sample?.local_audio_uri)
      void clips
        .read(sample.local_audio_uri)
        .then((buffer) => {
          const { pcm, sampleRate } = decodeWav(new Uint8Array(buffer));
          const features = preprocess(pcm, sampleRate),
            cells: Charts["cells"] = [];
          for (let t = 0; t < 24; t++) {
            const offset = Math.floor(
              (Math.max(0, pcm.length - 2048) * t) / 23,
            );
            const window = new Float32Array(2048);
            window.set(pcm.subarray(offset, offset + 2048));
            const power = powerSpectrum(window);
            for (let y = 0; y < 24; y++) {
              const hz = (y * 1000) / 23,
                index = Math.round((hz * 2048) / sampleRate);
              cells.push({ x: t, y: 23 - y, power: power[index] ?? 0 });
            }
          }
          if (!cancelled)
            setChart({
              spectrum: features.spectrum.slice(
                0,
                Math.floor((1000 * 2048) / sampleRate) + 1,
              ),
              cells,
            });
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    return () => {
      cancelled = true;
    };
  }, [sample?.id, sample?.local_audio_uri]);
  if (!sample?.local_audio_uri)
    return (
      <Label muted>
        La muestra contiene telemetría. Se necesita un clip local para
        visualizar el espectro.
      </Label>
    );
  if (!chart)
    return <Label muted>{error ?? "Analizando el clip local…"}</Label>;
  const max = Math.max(...chart.spectrum, 1e-12),
    points = chart.spectrum
      .map(
        (v, i) =>
          `${32 + (i / (chart.spectrum.length - 1)) * 280},${100 - Math.max(0, (10 * Math.log10(Math.max(v, 1e-12) / max) + 60) / 60) * 80}`,
      )
      .join(" ");
  return (
    <View style={{ gap: 12 }}>
      <Label bold size={12}>
        Espectro de frecuencia · 0–1000 Hz
      </Label>
      <Svg
        viewBox="0 0 330 124"
        height={124}
        accessibilityLabel="Espectro calculado del clip de audio"
      >
        <Line x1="32" y1="101" x2="312" y2="101" stroke={colors.border} />
        <Polyline
          points={points}
          fill="none"
          stroke="#0284C7"
          strokeWidth="2"
        />
        {[0, 250, 500, 750, 1000].map((hz) => (
          <SvgText
            key={hz}
            x={32 + (hz / 1000) * 280}
            y="118"
            fill={colors.muted}
            fontSize="9"
            textAnchor="middle"
          >
            {hz}
          </SvgText>
        ))}
      </Svg>
      <Label bold size={12}>
        Espectrograma · Frecuencia / tiempo
      </Label>
      <Svg
        viewBox="0 0 330 150"
        height={150}
        accessibilityLabel="Espectrograma calculado del clip de audio"
      >
        {chart.cells.map((cell) => {
          const intensity = Math.max(
            0,
            Math.min(
              1,
              (10 * Math.log10(Math.max(cell.power, 1e-12) / max) + 65) / 65,
            ),
          );
          return (
            <Rect
              key={`${cell.x}-${cell.y}`}
              x={32 + cell.x * 11.65}
              y={cell.y * 5.25}
              width={11.8}
              height={5.4}
              fill={`rgb(${Math.round(15 + intensity * 230)},${Math.round(35 + intensity * 125)},${Math.round(70 - intensity * 50)})`}
            />
          );
        })}
        <SvgText x="0" y="10" fill={colors.muted} fontSize="9">
          1kHz
        </SvgText>
        <SvgText x="8" y="126" fill={colors.muted} fontSize="9">
          0Hz
        </SvgText>
        <SvgText x="32" y="145" fill={colors.muted} fontSize="9">
          0 s
        </SvgText>
        <SvgText
          x="312"
          y="145"
          fill={colors.muted}
          fontSize="9"
          textAnchor="end"
        >
          {sample.duration_seconds} s
        </SvgText>
      </Svg>
    </View>
  );
}

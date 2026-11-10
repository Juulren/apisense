import { useState } from "react";
import { Pressable, View } from "react-native";
import { Icon, Label, Segmented } from "./ui";
import {
  activityLabels,
  cellsLabels,
  eggsLabels,
  populationLabels,
  queenLabels,
  storesLabels,
  type CheckinInput,
} from "../services/Checkin";

// One-tap, optional, nothing pre-filled: tapping the chosen option again clears it.
function Choice<T extends string>({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: T | null;
  labels: Record<T, string>;
  onChange: (value: T | null) => void;
}) {
  const options = (Object.keys(labels) as T[]).map((key) => ({
    value: key,
    label: labels[key],
  }));
  return (
    <View style={{ gap: 8 }}>
      <Label bold>{label}</Label>
      <Segmented<T | "">
        value={value ?? ""}
        options={options}
        onChange={(next) => onChange(next === value ? null : (next as T))}
      />
    </View>
  );
}

export function CheckinFields({
  value,
  onChange,
}: {
  value: CheckinInput;
  onChange: (next: CheckinInput) => void;
}) {
  const [more, setMore] = useState(false);
  const set = <K extends keyof CheckinInput>(key: K, next: CheckinInput[K]) =>
    onChange({ ...value, [key]: next });
  return (
    <View style={{ gap: 16 }}>
      <Choice
        label="Actividad en la piquera"
        value={value.activity}
        labels={activityLabels}
        onChange={(v) => set("activity", v)}
      />
      <Choice
        label="Reservas de miel"
        value={value.stores}
        labels={storesLabels}
        onChange={(v) => set("stores", v)}
      />
      <Choice
        label="Población"
        value={value.population}
        labels={populationLabels}
        onChange={(v) => set("population", v)}
      />
      <Pressable
        testID="checkin-more"
        accessibilityRole="button"
        accessibilityState={{ expanded: more }}
        onPress={() => setMore(!more)}
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Icon name={more ? "expand-less" : "expand-more"} />
        <Label bold>Más detalles (reina, huevos, celdas)</Label>
      </Pressable>
      {more ? (
        <View style={{ gap: 16 }}>
          <Choice
            label="Reina"
            value={value.queen_state}
            labels={queenLabels}
            onChange={(v) => set("queen_state", v)}
          />
          <Choice
            label="Huevos"
            value={value.eggs_state}
            labels={eggsLabels}
            onChange={(v) => set("eggs_state", v)}
          />
          <Choice
            label="Celdas reales"
            value={value.queen_cells}
            labels={cellsLabels}
            onChange={(v) => set("queen_cells", v)}
          />
        </View>
      ) : null}
    </View>
  );
}

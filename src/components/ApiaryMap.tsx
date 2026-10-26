import MapView, { Marker } from "react-native-maps";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { Apiary } from "../db/types";
import { Label } from "./ui";
import { useTheme } from "./ui/theme";
export function ApiaryMap({
  apiary,
  demo = false,
}: {
  apiary: Apiary;
  demo?: boolean;
}) {
  const { colors } = useTheme();
  if (apiary.latitude === null || apiary.longitude === null)
    return <Label muted>Este apiario no tiene coordenadas guardadas.</Label>;
  if (demo)
    return (
      <View style={{ gap: 12 }} testID="demo-map">
        <Label bold>Ubicación de referencia · Demo</Label>
        <View
          accessible
          accessibilityLabel={`Esquema local de ${apiary.name}; latitud ${apiary.latitude}, longitud ${apiary.longitude}`}
          style={{ backgroundColor: colors.green, borderRadius: 20 }}
        >
          <Svg width="100%" height={180} viewBox="0 0 320 180">
            {[40, 80, 120, 160].map((y) => (
              <Line
                key={y}
                x1={0}
                y1={y}
                x2={320}
                y2={y}
                stroke={colors.border}
              />
            ))}
            {[40, 80, 120, 160, 200, 240, 280].map((x) => (
              <Line
                key={x}
                x1={x}
                y1={0}
                x2={x}
                y2={180}
                stroke={colors.border}
              />
            ))}
            <Circle cx={160} cy={90} r={42} fill={colors.card} />
            <Path
              d="M160 48 C131 48 125 78 141 97 L160 119 L179 97 C195 78 189 48 160 48 Z"
              fill={colors.greenText}
            />
            <Circle cx={160} cy={73} r={10} fill={colors.card} />
          </Svg>
        </View>
        <Label>{apiary.name}</Label>
        <Label muted>
          {apiary.latitude.toFixed(4)}, {apiary.longitude.toFixed(4)}
        </Label>
        <Label muted size={12}>
          Esquema ilustrativo sin cartografía. Funciona sin internet ni claves
          de mapas.
        </Label>
      </View>
    );
  return (
    <MapView
      style={{ height: 260, borderRadius: 20 }}
      initialRegion={{
        latitude: apiary.latitude,
        longitude: apiary.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }}
    >
      <Marker
        coordinate={{ latitude: apiary.latitude, longitude: apiary.longitude }}
        title={apiary.name}
      />
    </MapView>
  );
}

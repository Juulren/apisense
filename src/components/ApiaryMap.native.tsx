import MapView, { Marker } from "react-native-maps";
import type { Apiary } from "../db/types";
import { Label } from "./ui";
export function ApiaryMap({ apiary }: { apiary: Apiary }) {
  if (apiary.latitude === null || apiary.longitude === null)
    return <Label muted>Este apiario no tiene coordenadas guardadas.</Label>;
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

import { createElement } from "react";
import { View } from "react-native";
import type { Apiary } from "../db/types";
import { Label } from "./ui";
export function ApiaryMap({ apiary }: { apiary: Apiary }) {
  if (apiary.latitude === null || apiary.longitude === null)
    return <Label muted>Este apiario no tiene coordenadas guardadas.</Label>;
  const lat = apiary.latitude,
    lon = apiary.longitude;
  const query = new URLSearchParams({
    bbox: `${lon - 0.02},${lat - 0.02},${lon + 0.02},${lat + 0.02}`,
    layer: "mapnik",
    marker: `${lat},${lon}`,
  });
  return (
    <View style={{ height: 260, borderRadius: 20, overflow: "hidden" }}>
      {createElement("iframe", {
        title: `Mapa de ${apiary.name}`,
        src: `https://www.openstreetmap.org/export/embed.html?${query}`,
        style: { border: 0, width: "100%", height: "100%" },
        loading: "lazy",
        credentialless: "",
        referrerPolicy: "no-referrer",
      })}
    </View>
  );
}

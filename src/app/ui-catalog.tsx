import { useState } from "react";
import { View } from "react-native";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Metric,
  Row,
  Section,
  Segmented,
  Toggle,
} from "../components/ui";
import { Screen } from "../components/ui/Screen";
import { useTheme } from "../components/ui/theme";
export default function Catalog() {
  const theme = useTheme();
  const [offline, setOffline] = useState(false);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");
  return (
    <Screen
      title="Componentes UI"
      subtitle="Apisense · Especificación de Stitch"
      back
      nav={false}
    >
      <Section title="Botones y acciones">
        <Card>
          <Button
            label="Entrar al Apiario"
            icon="arrow-forward"
            onPress={() => setNotice("Acción primaria seleccionada")}
          />
          <Button
            label="Anotar inspección"
            icon="add-circle-outline"
            onPress={() => setNotice("Acción de campo seleccionada")}
          />
          <Button
            label="Escuchar zumbido"
            variant="audio"
            icon="volume-up"
            onPress={() => setNotice("Ejemplo de botón de audio")}
          />
          <Button
            label="Sincronizar"
            variant="sync"
            icon="cloud-upload"
            onPress={() => setNotice("Ejemplo de sincronización")}
          />
          <Button
            label="Descartar"
            variant="secondary"
            compact
            onPress={() => setNotice("Aviso descartado")}
          />
          <Button
            label="Probar modo demo"
            variant="ghost"
            onPress={() => setNotice("Ejemplo de acción secundaria")}
          />
          <Button label="Acción no disponible" disabled onPress={() => {}} />
          <Button label="Cargando" loading onPress={() => {}} />
          {notice ? <Label>{notice}</Label> : null}
        </Card>
      </Section>
      <Section title="Selección y apariencia">
        <Card>
          <Segmented
            value={theme.preference}
            options={[
              { value: "light", label: "Claro" },
              { value: "dark", label: "Oscuro" },
              { value: "system", label: "Sistema" },
            ]}
            onChange={theme.setPreference}
          />
          <Toggle label="Modo offline" value={offline} onChange={setOffline} />
          <Field
            label="Nombre de colmena"
            value={value}
            onChangeText={setValue}
            placeholder="Colmena 01"
          />
        </Card>
      </Section>
      <Section title="Estados y telemetría">
        <Row>
          <Badge label="Tranquila" />
          <Badge label="Atención" tone="amber" />
          <Badge label="Sensor conectado" tone="blue" />
        </Row>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Metric label="Frecuencia" value="250" unit="Hz" icon="graphic-eq" />
          <Metric label="Batería" value="98" unit="%" icon="battery-full" />
        </View>
        <Card tone="amber">
          <Label bold>Atención sugerida</Label>
          <Label>
            Revisa la muestra y confirma el estado durante tu próxima
            inspección.
          </Label>
        </Card>
      </Section>
    </Screen>
  );
}

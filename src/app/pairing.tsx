import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { AppScreen, Empty } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Segmented,
  Section,
} from "../components/ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import type { DiscoveredMic } from "../services/iot/BleTransport";
export default function Pairing() {
  const { hiveId } = useLocalSearchParams<{ hiveId?: string }>(),
    app = useApp(),
    task = useTask();
  const [selected, setSelected] = useState(hiveId ?? ""),
    [devices, setDevices] = useState<DiscoveredMic[]>([]),
    [logicalId, setLogicalId] = useState(""),
    [calibration, setCalibration] = useState("0"),
    [broker, setBroker] = useState(process.env.EXPO_PUBLIC_MQTT_URL ?? ""),
    [username, setUsername] = useState(""),
    [password, setPassword] = useState(""),
    [notice, setNotice] = useState("");
  const hive =
      app.data.hives.find((h) => h.id === selected) ?? app.data.hives[0],
    mic = app.data.microphones.find((m) => m.hive_id === hive?.id);
  const scan = () =>
    task.run(async () => {
      setDevices([]);
      await app.workspace?.ble.scan((device) =>
        setDevices((prev) =>
          prev.some((d) => d.id === device.id) ? prev : [...prev, device],
        ),
      );
    }, "Búsqueda completada");
  const connect = (device: DiscoveredMic) =>
    task.run(async () => {
      if (!app.workspace || !hive) throw new Error("Selecciona una colmena");
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          logicalId,
        )
      )
        throw new Error("Introduce el UUID lógico configurado en el firmware");
      const existing = await app.workspace.repo.get(
        "iot_microphones",
        logicalId,
      );
      if (existing && existing.hive_id !== hive.id)
        throw new Error("Este micrófono ya está vinculado a otra colmena");
      await app.workspace.repo.save("iot_microphones", {
        id: logicalId,
        hive_id: hive.id,
        mac_address: device.id,
        firmware_version: existing?.firmware_version ?? "unknown",
        battery_level: existing?.battery_level ?? 0,
        sampling_rate_hz: existing?.sampling_rate_hz ?? 16000,
        is_online: 0,
        last_seen_at: existing?.last_seen_at ?? null,
        calibration_db: existing?.calibration_db ?? 0,
      });
      const w = app.workspace;
      await w.ble.connect(
        device.id,
        (frame) => w.ingestion.ingest(frame, "ble"),
        (error) => setNotice(error.message),
      );
      await app.refresh();
    }, "Micrófono vinculado. Esperando telemetría compatible.");
  const saveCalibration = () =>
    task.run(async () => {
      if (!mic || !app.workspace)
        throw new Error("Primero vincula un micrófono");
      const offset = Number(calibration);
      if (!Number.isFinite(offset) || Math.abs(offset) > 120)
        throw new Error("Usa un offset entre -120 y 120 dB");
      await app.workspace.repo.save("iot_microphones", {
        ...mic,
        calibration_db: offset,
      });
      await app.refresh();
    }, "Offset relativo guardado");
  return (
    <AppScreen
      title="Micrófonos IoT"
      subtitle="Vincula y calibra tus sensores"
      back
    >
      <Segmented
        value={hive?.id ?? ""}
        onChange={setSelected}
        options={app.data.hives.map((h) => ({ value: h.id, label: h.code }))}
      />
      {!hive ? (
        <Empty>Crea una colmena antes de vincular un micrófono.</Empty>
      ) : (
        <>
          <Card>
            <Badge
              label={
                app.workspace?.demo
                  ? "Sensor simulado"
                  : mic
                    ? "Micrófono registrado"
                    : "Sin vincular"
              }
              tone="blue"
            />
            <Label bold>{hive.code}</Label>
            <Label muted size={12}>
              {mic
                ? `${mic.mac_address} · Firmware ${mic.firmware_version}`
                : "Busca un sensor Bluetooth compatible."}
            </Label>
            <Field
              label="UUID lógico del micrófono (firmware)"
              placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx"
              value={logicalId}
              onChangeText={setLogicalId}
              autoCapitalize="none"
            />
            <Button
              label="Buscar micrófonos BLE"
              icon="bluetooth-searching"
              loading={task.busy}
              disabled={app.workspace?.demo}
              onPress={scan}
            />
            {app.workspace?.demo ? (
              <Label muted size={12}>
                La demo usa micrófonos simulados. El hardware real se vincula
                desde una cuenta de campo.
              </Label>
            ) : (
              <Label muted size={12}>
                Bluetooth necesita un build nativo y los UUID de servicio del
                firmware configurados.
              </Label>
            )}
            {devices.map((device) => (
              <Button
                key={device.id}
                label={`${device.name} · ${device.id}`}
                variant="secondary"
                disabled={task.busy}
                onPress={() => connect(device)}
              />
            ))}
          </Card>
          <Section title="Calibración relativa">
            <Card>
              <Field
                label="Offset de nivel (dB)"
                value={calibration}
                onChangeText={setCalibration}
                keyboardType="numbers-and-punctuation"
              />
              <Label muted size={12}>
                Offset guardado: {mic?.calibration_db ?? 0} dB. Utiliza una
                fuente de referencia conocida; este ajuste no convierte el
                micrófono en un sonómetro SPL.
              </Label>
              <Button
                label="Guardar calibración"
                variant="secondary"
                disabled={!mic}
                loading={task.busy}
                onPress={saveCalibration}
              />
            </Card>
          </Section>
          <Section
            title="Conexión MQTT"
            caption="Transporte cifrado WSS; credenciales solo durante esta sesión"
          >
            <Card>
              <Field
                label="Broker MQTT (wss://)"
                value={broker}
                onChangeText={setBroker}
                autoCapitalize="none"
                placeholder="wss://broker.example.com/mqtt"
              />
              <Field
                label="Usuario del broker"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
              <Field
                label="Contraseña del broker"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Button
                label="Conectar MQTT"
                variant="sync"
                disabled={app.workspace?.demo}
                onPress={() =>
                  task.run(async () => {
                    const w = app.workspace;
                    if (!w) return;
                    w.mqtt.start(
                      { url: broker, userId: w.userId, username, password },
                      (frame) => w.ingestion.ingest(frame, "mqtt"),
                      (error) => setNotice(error.message),
                    );
                  }, "Cliente iniciado; esperando conexión y telemetría del broker")
                }
              />
              <Button
                label="Desconectar MQTT"
                variant="secondary"
                onPress={() => {
                  app.workspace?.mqtt.stop();
                  setNotice("MQTT desconectado");
                }}
              />
            </Card>
          </Section>
        </>
      )}
      {task.message || notice ? <Label>{task.message ?? notice}</Label> : null}
    </AppScreen>
  );
}

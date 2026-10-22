import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import type { Repository } from "../../db/Repository";
import { openRepository } from "../../db/openRepository";
import { Button, Card, Field, Label } from "../ui";

// This public phrase protects disposable fixtures only, never a real account.
const testPassphrase = "solo datos sinteticos de prueba entre pestanas";
const markerKey = "qa-tabs-marker";

export function WebStorageQA() {
  return __DEV__ && Platform.OS === "web" ? <SessionControls /> : null;
}

function SessionControls() {
  const [session, setSession] = useState("issue18");
  const [marker, setMarker] = useState("Marca A");
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("Sin almacén de prueba abierto.");
  const repository = useRef<Repository | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const current = repository.current;
      repository.current = null;
      void current?.close().catch(() => {});
    };
  }, []);

  async function run(action: () => Promise<string>) {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const message = await action();
      if (mounted.current) setNotice(message);
    } catch (error) {
      if (mounted.current)
        setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      running.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <Card>
      <Label bold>Prueba entre pestañas (solo desarrollo)</Label>
      <Label>
        Usa la misma sesión en dos pestañas del mismo origen. Solo guarda marcas
        sintéticas; no sincroniza con Supabase.
      </Label>
      <Field
        label="Sesión de prueba entre pestañas"
        value={session}
        onChangeText={setSession}
        editable={!opened && !busy}
      />
      <Label>Estado del almacén: {opened ? "abierto" : "cerrado"}</Label>
      <Button
        label="Abrir almacén de prueba"
        disabled={opened || busy}
        onPress={() =>
          run(async () => {
            if (!/^[a-zA-Z0-9-]{1,48}$/.test(session))
              throw new Error(
                "Usa entre 1 y 48 letras, números o guiones para la sesión.",
              );
            // Prefixing prevents fixtures from opening any real Supabase UUID.
            const current = await openRepository(
              `qa-tabs-${session.toLowerCase()}`,
              testPassphrase,
            );
            if (!mounted.current) {
              await current.close();
              return "Prueba cancelada.";
            }
            repository.current = current;
            setOpened(true);
            return `Almacén abierto. Marca guardada: ${(await current.setting(markerKey)) ?? "ninguna"}`;
          })
        }
      />
      <Field
        label="Marca de prueba"
        value={marker}
        onChangeText={setMarker}
        editable={!busy}
      />
      <Button
        label="Guardar marca de prueba"
        disabled={!opened || busy}
        onPress={() =>
          run(async () => {
            if (!repository.current)
              throw new Error("Abre el almacén de prueba.");
            await repository.current.setSetting(markerKey, marker);
            return `Marca guardada: ${marker}`;
          })
        }
      />
      <Button
        label="Leer marca guardada"
        variant="secondary"
        disabled={!opened || busy}
        onPress={() =>
          run(async () => {
            if (!repository.current)
              throw new Error("Abre el almacén de prueba.");
            return `Marca leída: ${(await repository.current.setting(markerKey)) ?? "ninguna"}`;
          })
        }
      />
      <Button
        label="Cerrar almacén de prueba"
        variant="secondary"
        disabled={!opened || busy}
        onPress={() =>
          run(async () => {
            const current = repository.current;
            repository.current = null;
            try {
              await current?.close();
            } finally {
              if (mounted.current) setOpened(false);
            }
            return "Almacén cerrado; bloqueo liberado.";
          })
        }
      />
      <View accessibilityLiveRegion="polite">
        <Label>{notice}</Label>
      </View>
    </Card>
  );
}

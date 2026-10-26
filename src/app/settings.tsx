import { useState } from "react";
import { router } from "expo-router";
import { AppScreen } from "../components/AppScreen";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Segmented,
  Section,
  Toggle,
} from "../components/ui";
import { useTheme } from "../components/ui/theme";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { dateLabel } from "../state/selectors";
export default function Settings() {
  const app = useApp(),
    task = useTask(),
    theme = useTheme();
  const [minutes, setMinutes] = useState(""),
    [name, setName] = useState(""),
    [apiaryId, setApiaryId] = useState("");
  const apiary =
    app.data.apiaries.find((a) => a.id === apiaryId) ?? app.data.apiaries[0];
  const interval = () =>
    task.run(async () => {
      if (!apiary || !app.workspace) throw new Error("Crea primero un apiario");
      const value = Number(minutes);
      if (!Number.isInteger(value) || value < 1 || value > 10080)
        throw new Error("Usa un número entero de 1 a 10080 minutos");
      await app.workspace.repo.save("apiaries", {
        ...apiary,
        check_interval_minutes: value,
      });
      await app.refresh();
    }, "Intervalo guardado localmente");
  return (
    <AppScreen
      title="Ajustes y configuración"
      subtitle={apiary?.name ?? "Tu configuración de campo"}
    >
      <Section
        title="Apariencia y modo oscuro"
        caption="Contraste y legibilidad para trabajo de campo"
      >
        <Card>
          <Segmented
            value={theme.preference}
            options={[
              { value: "light", label: "Claro" },
              { value: "dark", label: "Oscuro" },
              { value: "system", label: "Sistema" },
            ]}
            onChange={(value) => {
              void task.run(() => app.saveSetting("theme", value));
            }}
          />
        </Card>
      </Section>
      <Section title="Resúmenes y avisos">
        <Card>
          {app.data.apiaries.length > 1 ? (
            <Segmented
              value={apiary?.id ?? ""}
              onChange={setApiaryId}
              options={app.data.apiaries.map((a) => ({
                value: a.id,
                label: a.name,
              }))}
            />
          ) : null}
          <Label muted>
            Intervalo actual: {apiary?.check_interval_minutes ?? "—"} minutos
          </Label>
          <Field
            label="Nuevo intervalo de análisis (minutos)"
            value={minutes}
            onChangeText={setMinutes}
            placeholder="15"
            keyboardType="number-pad"
          />
          <Button
            label="Guardar intervalo"
            variant="secondary"
            disabled={!apiary}
            loading={task.busy}
            onPress={interval}
          />
          <Toggle
            label="Avisos dentro de la app"
            caption="Mostrar cambios acústicos en el inicio"
            value={app.data.settings.alerts !== "0"}
            onChange={(v) => {
              void task.run(() => app.saveSetting("alerts", v ? "1" : "0"));
            }}
          />
          <Badge
            label="Reglas experimentales · Sin modelo validado"
            tone="amber"
          />
          <Label muted size={12}>
            El análisis local periódico funciona con la app abierta. En la nube,
            el cron requiere un proyecto Supabase configurado.
          </Label>
        </Card>
      </Section>
      <Section title="Guardado local y sincronización">
        <Card>
          <Toggle
            label="Modo sin conexión"
            value={app.data.settings.offline === "1"}
            onChange={(v) => {
              void task.run(() => app.saveSetting("offline", v ? "1" : "0"));
            }}
          />
          <Label bold>{app.data.pending} registros en cola local</Label>
          <Label muted size={12}>
            {app.workspace?.demo
              ? "La demo permanece aislada; su cola no se envía a Supabase."
              : app.syncState.lastSyncedAt
                ? `Última sincronización: ${dateLabel(app.syncState.lastSyncedAt)}`
                : "Aún no hay una sincronización confirmada."}
          </Label>
          {app.syncState.error ? (
            <Label color="#B45309">{app.syncState.error}</Label>
          ) : null}
          <Button
            label="Forzar sincronización local a nube"
            variant="sync"
            icon="cloud-upload"
            loading={task.busy || app.syncState.status === "syncing"}
            disabled={!app.workspace?.sync || app.data.settings.offline === "1"}
            onPress={() =>
              task.run(async () => {
                await app.workspace?.sync?.sync();
                await app.refresh();
              }, "Sincronización revisada")
            }
          />
          <Label muted size={12}>
            Las lecturas y notas se guardan primero en SQLite. Los clips remotos
            se almacenan en un bucket privado.
          </Label>
        </Card>
      </Section>
      <Section title="Perfil de campo">
        <Card>
          <Field
            label="Nombre para el saludo"
            value={name}
            onChangeText={setName}
            placeholder={app.data.settings.name || "Tu nombre"}
            maxLength={50}
          />
          <Button
            label="Guardar nombre"
            variant="secondary"
            onPress={() =>
              task.run(async () => {
                if (!name.trim()) throw new Error("Escribe tu nombre");
                await app.saveSetting("name", name.trim());
              }, "Nombre guardado")
            }
          />
        </Card>
      </Section>
      <Button
        label="Ver catálogo de componentes"
        variant="ghost"
        onPress={() => router.push("/ui-catalog")}
      />
      <Button
        label={app.workspace?.demo ? "Salir de la demo" : "Cerrar sesión local"}
        variant="secondary"
        onPress={() =>
          task.run(async () => {
            await app.logout();
            router.replace("/");
          })
        }
      />
      {task.message ? <Label>{task.message}</Label> : null}
    </AppScreen>
  );
}

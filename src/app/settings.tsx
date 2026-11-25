import { useState } from "react";
import { router } from "expo-router";
import { AppScreen } from "../components/AppScreen";
import {
  Button,
  Card,
  Label,
  Segmented,
  Section,
  Toggle,
} from "../components/ui";
import { ApiaryProfile } from "../components/ApiaryProfile";
import { ProfileSection } from "../components/ProfileSection";
import { useTheme } from "../components/ui/theme";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { dateLabel } from "../state/selectors";
export default function Settings() {
  const app = useApp(),
    task = useTask(),
    theme = useTheme();
  const [apiaryId, setApiaryId] = useState("");
  const apiary =
    app.data.apiaries.find((a) => a.id === apiaryId) ?? app.data.apiaries[0];
  return (
    <AppScreen
      title="Ajustes y configuración"
      subtitle={apiary?.name ?? "Tu configuración de campo"}
    >
      <ProfileSection />
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
      <Section
        title="Mi apiario"
        caption="Ubicación, temporadas, recordatorios y clima"
      >
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
        <ApiaryProfile apiary={apiary} />
      </Section>
      <Section title="Guardado local y sincronización">
        <Card>
          <Toggle
            testID="offline-toggle"
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
            <Label tone="warning">{app.syncState.error}</Label>
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
            Tus observaciones se guardan primero en este teléfono y se
            sincronizan cuando hay internet.
          </Label>
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

import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";
import { AppScreen } from "../../components/AppScreen";
import {
  Button,
  Card,
  Icon,
  Label,
  Row,
  Segmented,
  Toggle,
  type IconName,
} from "../../components/ui";
import { useTheme } from "../../components/ui/theme";
import { useApp } from "../../state/AppProvider";
import { useTask } from "../../state/useTask";
import { useAccountEmail } from "../../state/useAccountEmail";
import { startAt } from "../../state/startAt";
import { syncProblem } from "../../services/HeaderStatus";
import { playDone } from "../../services/sounds";

/** A card that opens another screen. */
function LinkRow({
  icon,
  title,
  caption,
  label,
  href,
  testID,
}: {
  icon: IconName;
  title: string;
  caption: string;
  label: string;
  href: Href;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={{ minHeight: 64 }}
    >
      <Card style={{ padding: 16 }}>
        <Row>
          <Icon name={icon} size={22} />
          <View style={{ flex: 1 }}>
            <Label bold size={16}>
              {title}
            </Label>
            <Label muted size={12}>
              {caption}
            </Label>
          </View>
          <Icon name="chevron-right" size={22} color={colors.muted} />
        </Row>
      </Card>
    </Pressable>
  );
}

export default function Settings() {
  const app = useApp(),
    task = useTask(),
    // Apart, so changing the theme does not leave the sign-out button spinning.
    exit = useTask(),
    theme = useTheme();
  const [leaving, setLeaving] = useState(false);
  // An unanswered "¿Cerrar sesión?" is not waiting on the way back.
  useFocusEffect(useCallback(() => () => setLeaving(false), []));
  const demo = app.workspace?.demo ?? true;
  const email = useAccountEmail(demo);
  const name = app.data.settings.name || "";
  const apiaries = app.data.apiaries;
  const apiaryCaption =
    apiaries.length > 1
      ? `${apiaries.length} apiarios`
      : (apiaries[0]?.name ?? "Sin apiario");
  const offline = app.data.settings.offline === "1";
  const pending = demo ? 0 : app.data.pending;
  const logout = () =>
    exit.run(async () => {
      await app.logout();
      startAt("/");
    });
  return (
    <AppScreen title="Ajustes">
      <LinkRow
        testID="settings-account"
        icon="person"
        title={name || "Mi cuenta"}
        caption={demo ? "Mi cuenta · Demo" : (email ?? "Mi cuenta")}
        label={name ? `Mi cuenta, ${name}` : "Mi cuenta"}
        href="/settings/account"
      />
      <LinkRow
        testID="settings-apiary"
        icon="place"
        title="Mi apiario"
        caption={apiaryCaption}
        label={`Mi apiario, ${apiaryCaption}`}
        href="/settings/apiary"
      />
      <Card style={{ padding: 16, gap: 12 }}>
        <Label bold accessibilityRole="header">
          Apariencia
        </Label>
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
      <Card style={{ padding: 16 }}>
        <Toggle
          testID="sounds-toggle"
          label="Sonidos"
          caption="Un tono suave al guardar"
          value={app.data.settings.sounds !== "0"}
          onChange={(v) => {
            // Turning them on lets the person hear what they will get.
            if (v) playDone();
            void task.run(() => app.saveSetting("sounds", v ? "1" : "0"));
          }}
        />
      </Card>
      <Card style={{ padding: 16, gap: 8 }}>
        <Toggle
          testID="offline-toggle"
          label="Sin conexión"
          caption={
            demo
              ? "Demo: no se envía nada"
              : pending > 0
                ? `${pending} sin enviar`
                : undefined
          }
          value={offline}
          onChange={(v) => {
            void task.run(() => app.saveSetting("offline", v ? "1" : "0"));
          }}
        />
        {!demo && !offline && app.syncState.status === "error" ? (
          <Label tone="warning" size={12}>
            {syncProblem(app.syncState.error)}
          </Label>
        ) : null}
      </Card>
      {demo ? (
        <Button
          testID="logout"
          label="Salir de la demo"
          icon="logout"
          variant="secondary"
          loading={exit.busy}
          onPress={logout}
        />
      ) : leaving ? (
        <Card style={{ padding: 16, gap: 12 }}>
          <Label bold accessibilityRole="header">
            ¿Cerrar sesión?
          </Label>
          <Label accessibilityLiveRegion="polite">
            Para volver a entrar necesitas internet.
            {pending > 0
              ? ` Lo que está sin enviar (${pending}) se queda en este teléfono hasta que vuelvas a entrar con esta cuenta.`
              : ""}
          </Label>
          <Button
            testID="logout-confirm"
            label="Cerrar sesión"
            variant="secondary"
            loading={exit.busy}
            onPress={logout}
          />
          <Button
            label="Cancelar"
            variant="ghost"
            onPress={() => setLeaving(false)}
          />
        </Card>
      ) : (
        <Button
          testID="logout"
          label="Cerrar sesión"
          icon="logout"
          variant="secondary"
          onPress={() => setLeaving(true)}
        />
      )}
      {(exit.message ?? task.message) ? (
        <Label accessibilityLiveRegion="polite">
          {exit.message ?? task.message}
        </Label>
      ) : null}
    </AppScreen>
  );
}

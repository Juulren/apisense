import { useState } from "react";
import { Alert, Image, Pressable, View } from "react-native";
import { Redirect, router } from "expo-router";
import {
  Badge,
  Button,
  Card,
  Field,
  Icon,
  Label,
  Row,
  Segmented,
  Toggle,
} from "../components/ui";
import { Screen } from "../components/ui/Screen";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { DEMO_ONLY } from "../config/runtime";
import { cleanName, isEmail, newPasswordProblem } from "../services/Profile";
import { startAt } from "../state/startAt";
import { StartAt } from "../components/StartAt";
export default function Login() {
  const app = useApp(),
    task = useTask();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [visible, setVisible] = useState(false),
    [offline, setOffline] = useState(false),
    [mode, setMode] = useState<"login" | "register">("login");
  if (app.workspace) return <StartAt href="/dashboard" />;
  if (DEMO_ONLY) return <Redirect href="/" />;
  const submit = () =>
    task.run(async () => {
      if (offline) {
        await app.offlineLogin();
        startAt("/dashboard");
        return;
      }
      if (!isEmail(email))
        throw new Error("Escribe un correo electrónico válido");
      if (mode === "register") {
        const problem = newPasswordProblem(password, email);
        if (problem) throw new Error(problem);
        task.setMessage(await app.register(email, password, cleanName(name)));
      } else {
        // Existing accounts keep working whatever the current policy is.
        if (!password) throw new Error("Escribe tu contraseña");
        await app.login(email, password);
        startAt("/dashboard");
      }
    });
  return (
    <Screen header={false}>
      <View
        style={{
          alignItems: "center",
          gap: 12,
          paddingTop: 16,
          paddingBottom: 16,
        }}
      >
        <Image
          source={require("../../assets/brand-logo.png")}
          style={{ width: 90, height: 90, borderRadius: 45 }}
        />
        <Label bold size={32}>
          Apisense
        </Label>
        <Label size={16}>Protección temprana, colmenas sanas</Label>
      </View>
      <Card style={{ padding: 24, gap: 24 }}>
        <Badge label="ACCESO APICULTOR" />
        <View style={{ gap: 6 }}>
          <Label bold size={24}>
            {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </Label>
          <Label muted>Tu apiario cuidado en todo momento</Label>
        </View>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "login", label: "Iniciar sesión" },
            { value: "register", label: "Registrarme" },
          ]}
        />
        {mode === "register" && !offline ? (
          <Field
            testID="login-name"
            label="Tu nombre (opcional)"
            autoComplete="name"
            autoCapitalize="words"
            maxLength={50}
            placeholder="Cómo quieres que te saludemos"
            value={name}
            onChangeText={setName}
          />
        ) : null}
        <Field
          testID="login-email"
          label="Correo electrónico"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="apicultor@colmena.bio"
          value={email}
          onChangeText={setEmail}
          editable={!offline}
        />
        <View style={{ gap: 8 }}>
          <Field
            testID="login-password"
            label="Contraseña"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            secureTextEntry={!visible}
            placeholder={
              mode === "register" ? "Mínimo 10 caracteres" : "Tu contraseña"
            }
            value={password}
            onChangeText={setPassword}
            editable={!offline}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              visible ? "Ocultar contraseña" : "Mostrar contraseña"
            }
            onPress={() => setVisible(!visible)}
            style={{
              alignSelf: "flex-end",
              padding: 8,
              minHeight: 48,
              justifyContent: "center",
            }}
          >
            <Row>
              <Icon
                name={visible ? "visibility-off" : "visibility"}
                size={18}
              />
              <Label size={12}>
                {visible ? "Ocultar" : "Mostrar"} contraseña
              </Label>
            </Row>
          </Pressable>
        </View>
        {mode === "login" && !offline ? (
          <Button
            label="Olvidé mi contraseña"
            variant="ghost"
            icon="lock-reset"
            disabled={task.busy || app.busy}
            onPress={() => router.push("/forgot-password")}
          />
        ) : null}
        <Card>
          <Toggle
            label="Modo sin internet (Campo)"
            caption="Utiliza la sesión ya guardada en este dispositivo"
            value={offline}
            onChange={setOffline}
          />
        </Card>
        <Button
          label={
            offline
              ? "Abrir sesión guardada"
              : mode === "register"
                ? "Crear cuenta"
                : "Entrar al Apiario"
          }
          icon="arrow-forward"
          loading={task.busy || app.busy}
          onPress={submit}
        />
        <Button
          label="Probar modo demo"
          variant="ghost"
          icon="eco"
          disabled={task.busy || app.busy}
          onPress={() =>
            task.run(async () => {
              await app.enterDemo();
              startAt("/dashboard");
            })
          }
        />
        {app.restorable ? (
          <Card tone="amber">
            <Label bold>No se puede abrir la base de este teléfono</Label>
            <Label size={13}>
              Falta la llave que la protege (por ejemplo, tras reinstalar o
              cambiar de teléfono). Tus datos sincronizados siguen en tu cuenta.
            </Label>
            <Button
              label="Restaurar desde la nube"
              icon="cloud-download"
              variant="secondary"
              loading={task.busy || app.busy}
              onPress={() =>
                Alert.alert(
                  "Restaurar desde la nube",
                  "Se borrará la copia local de este teléfono y se volverá a descargar de tu cuenta. Lo que no se hubiera sincronizado antes se perderá. No se puede deshacer.",
                  [
                    { text: "Cancelar", style: "cancel" },
                    {
                      text: "Borrar y restaurar",
                      style: "destructive",
                      onPress: () =>
                        task.run(async () => {
                          await app.restoreFromCloud();
                          startAt("/dashboard");
                        }),
                    },
                  ],
                )
              }
            />
          </Card>
        ) : null}
        {task.message || app.error ? (
          <Label tone="warning">{task.message ?? app.error}</Label>
        ) : null}
      </Card>
      <Label muted size={12} style={{ textAlign: "center" }}>
        Guardado local primero · Sincronización al recuperar red
      </Label>
    </Screen>
  );
}

import { useState } from "react";
import { Image, Pressable, View } from "react-native";
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
export default function Login() {
  const app = useApp(),
    task = useTask();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [visible, setVisible] = useState(false),
    [offline, setOffline] = useState(false),
    [mode, setMode] = useState<"login" | "register">("login");
  if (app.workspace) return <Redirect href="/dashboard" />;
  const submit = () =>
    task.run(async () => {
      if (offline) {
        await app.offlineLogin();
        router.replace("/dashboard");
        return;
      }
      if (!/^\S+@\S+\.\S+$/.test(email.trim()))
        throw new Error("Escribe un correo electrónico válido");
      if (password.length < 8)
        throw new Error("La contraseña debe tener al menos 8 caracteres");
      if (mode === "register") {
        task.setMessage(await app.register(email, password));
      } else {
        await app.login(email, password);
        router.replace("/dashboard");
      }
    });
  return (
    <Screen header={false} nav={false}>
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
        <Field
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
            label="Contraseña"
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            secureTextEntry={!visible}
            placeholder="Mínimo 8 caracteres"
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
            style={{ alignSelf: "flex-end", padding: 8, minHeight: 44 }}
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
              router.replace("/dashboard");
            })
          }
        />
        {task.message || app.error ? (
          <Label color="#B45309">{task.message ?? app.error}</Label>
        ) : null}
      </Card>
      <Label muted size={12} style={{ textAlign: "center" }}>
        Guardado local primero · Sincronización al recuperar red
      </Label>
    </Screen>
  );
}

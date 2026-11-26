import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, View } from "react-native";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { Button, Card, Field, Icon, Label, Row } from "../components/ui";
import { Screen } from "../components/ui/Screen";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { DEMO_ONLY } from "../config/runtime";
import { cleanName, isEmail, newPasswordProblem } from "../services/Profile";
import { OPEN_FAILED } from "../services/AuthMessages";
import { startAt } from "../state/startAt";
import { StartAt } from "../components/StartAt";

// "Entrar" and, as a screen of its own so that back returns here, "Crear cuenta".
export default function Login() {
  const app = useApp(),
    task = useTask();
  const registering =
    useLocalSearchParams<{ mode?: string }>().mode === "register";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState(""),
    [visible, setVisible] = useState(false);
  if (app.workspace) return <StartAt href="/dashboard" />;
  if (DEMO_ONLY) return <Redirect href="/" />;
  if (app.busy)
    return (
      <Screen header={false}>
        <View style={{ alignItems: "center", paddingTop: 64, gap: 24 }}>
          <Brand />
          <ActivityIndicator accessibilityLabel="Abriendo tu sesión" />
        </View>
      </Screen>
    );
  const submit = () =>
    task.run(async () => {
      if (!isEmail(email))
        throw new Error("Escribe un correo electrónico válido");
      if (registering) {
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
  const form = (
    <>
      <Field
        testID="login-email"
        label="Correo"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="tu@correo.com"
        value={email}
        onChangeText={setEmail}
      />
      <View style={{ gap: 8 }}>
        <Field
          testID="login-password"
          label="Contraseña"
          autoComplete={registering ? "new-password" : "current-password"}
          secureTextEntry={!visible}
          placeholder={registering ? "Mínimo 10 caracteres" : "Tu contraseña"}
          value={password}
          onChangeText={setPassword}
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
            <Icon name={visible ? "visibility-off" : "visibility"} size={18} />
            <Label size={12}>
              {visible ? "Ocultar" : "Mostrar"} contraseña
            </Label>
          </Row>
        </Pressable>
      </View>
      <Button
        testID="login-submit"
        label={registering ? "Crear cuenta" : "Entrar"}
        loading={task.busy}
        onPress={submit}
      />
    </>
  );
  // `app.error` is technical text. When the data can be restored, the card
  // below already says what happened.
  const problem =
    task.message ?? (app.error && !app.restorable ? OPEN_FAILED : null);
  const message = problem ? (
    <Label accessibilityLiveRegion="polite">{problem}</Label>
  ) : null;
  if (registering)
    return (
      <Screen title="Crear cuenta" back>
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
        {form}
        {message}
      </Screen>
    );
  return (
    <Screen header={false}>
      <View style={{ alignItems: "center", paddingTop: 24, gap: 12 }}>
        <Brand />
      </View>
      {form}
      <Button
        label="Olvidé mi contraseña"
        variant="ghost"
        disabled={task.busy}
        onPress={() => router.push("/forgot-password")}
      />
      <Label muted size={12} style={{ textAlign: "center" }}>
        Entra con internet antes de salir al apiario.
      </Label>
      {app.restorable ? (
        <Card tone="amber">
          <Label bold>No se pueden abrir los datos de este teléfono</Label>
          <Label size={13}>
            Falta la llave que los protege (por ejemplo, tras reinstalar o
            cambiar de teléfono). Lo que ya se había sincronizado sigue en tu
            cuenta.
          </Label>
          <Button
            label="Restaurar desde la nube"
            icon="cloud-download"
            variant="secondary"
            loading={task.busy}
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
      {message}
      <Button
        testID="login-register"
        label="Crear cuenta"
        variant="secondary"
        disabled={task.busy}
        onPress={() =>
          router.push({ pathname: "/login", params: { mode: "register" } })
        }
      />
      <Button
        testID="login-demo"
        label="Probar la demo"
        variant="ghost"
        icon="eco"
        disabled={task.busy}
        onPress={() =>
          task.run(async () => {
            await app.enterDemo();
            startAt("/dashboard");
          })
        }
      />
    </Screen>
  );
}

function Brand() {
  return (
    <>
      <Image
        source={require("../../assets/brand-logo.png")}
        style={{ width: 72, height: 72, borderRadius: 36 }}
      />
      <Label bold size={24} accessibilityRole="header">
        Apisense
      </Label>
    </>
  );
}

import { ActivityIndicator, Image, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Badge, Button, Card, Icon, Label } from "../components/ui";
import { Screen } from "../components/ui/Screen";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { DEMO_ONLY, SECURITY_QA } from "../config/runtime";
import { startAt } from "../state/startAt";
import { StartAt } from "../components/StartAt";
// Only the demo-only build has a welcome; the app goes straight to signing in.
export default function Welcome() {
  const app = useApp(),
    task = useTask();
  if (app.workspace) return <StartAt href="/dashboard" />;
  // A replace, not a push: back from signing in must not come here and bounce.
  if (!DEMO_ONLY) return <Redirect href="/login" />;
  return (
    <Screen header={false}>
      <View style={{ alignItems: "center", paddingTop: 64, gap: 18 }}>
        <Image
          source={require("../../assets/brand-logo.png")}
          style={{ width: 112, height: 112, borderRadius: 56 }}
        />
        <Label bold size={38}>
          Apisense
        </Label>
        <Label size={19} style={{ textAlign: "center" }}>
          Protección temprana,{"\n"}colmenas sanas
        </Label>
        <Badge label="Tu apiario, contigo" />
      </View>
      <Card>
        <Icon name="cloud-done" color="#0284C7" size={32} />
        <Label bold size={21}>
          El campo no siempre tiene señal.
        </Label>
        <Label muted>
          Tus observaciones y lecturas se guardan primero en este dispositivo. La
          sincronización continúa cuando vuelves a conectarte.
        </Label>
        <Label muted size={12}>
          Conserva una sesión iniciada antes de salir al apiario.
        </Label>
      </Card>
      {app.busy ? (
        <ActivityIndicator accessibilityLabel="Restaurando sesión" />
      ) : (
        <>
          <Badge label="Demo sin conexión · Datos sintéticos" tone="blue" />
          <Button
            label="Entrar a la demo"
            variant="ghost"
            icon="eco"
            loading={task.busy}
            onPress={() =>
              task.run(async () => {
                await app.enterDemo();
                startAt("/dashboard");
              })
            }
          />
        </>
      )}
      {SECURITY_QA ? (
        <Button
          label="Verificar cifrado nativo"
          onPress={() => router.push("/security-check")}
        />
      ) : null}
      {task.message || app.error ? (
        <Label tone="warning">{task.message ?? app.error}</Label>
      ) : null}
    </Screen>
  );
}

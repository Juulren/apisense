import { useEffect, useState } from "react";
import { useURL } from "expo-linking";
import { Redirect, router } from "expo-router";
import { ActivityIndicator } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { Button, Label } from "../../components/ui";
import { completeAuthCallback } from "../../services/supabase";
import { useApp } from "../../state/AppProvider";
import { DEMO_ONLY } from "../../config/runtime";

export default function AuthCallback() {
  const url = useURL();
  const app = useApp();
  const [message, setMessage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!url || DEMO_ONLY) return;
    let mounted = true;
    void Promise.resolve()
      .then(() => completeAuthCallback(url))
      .then(() => {
        if (mounted) setConfirmed(true);
      })
      .catch((error: unknown) => {
        if (mounted)
          setMessage(
            error instanceof Error
              ? error.message
              : "No se pudo confirmar la sesión.",
          );
      });
    return () => {
      mounted = false;
    };
  }, [url]);
  if (DEMO_ONLY) return <Redirect href="/" />;
  if (confirmed && app.workspace && !app.busy)
    return <Redirect href="/dashboard" />;
  const error =
    message ??
    (confirmed
      ? (app.error ??
        (!app.busy && !app.workspace
          ? "No hay una sesión activa. Vuelve a iniciar sesión con tu cuenta confirmada."
          : null))
      : null);
  return (
    <Screen header={false}>
      <Label bold size={24}>
        Confirmación de tu cuenta
      </Label>
      {error ? (
        <>
          <Label>{error}</Label>
          <Button
            label="Volver a iniciar sesión"
            onPress={() => router.replace("/login")}
          />
        </>
      ) : (
        <>
          <ActivityIndicator accessibilityLabel="Confirmando sesión" />
          <Label>
            {confirmed
              ? "Abriendo tu base cifrada…"
              : "Comprobando el enlace de confirmación…"}
          </Label>
        </>
      )}
    </Screen>
  );
}

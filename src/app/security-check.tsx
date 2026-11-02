import { useState } from "react";
import { Redirect, router } from "expo-router";
import { Screen } from "../components/ui/Screen";
import { Button, Label } from "../components/ui";
import { SECURITY_QA } from "../config/runtime";

export default function SecurityCheck() {
  const [results, setResults] = useState<string[]>([]);
  const [state, setState] = useState<"ready" | "running" | "passed" | "failed">(
    "ready",
  );
  if (!SECURITY_QA) return <Redirect href="/" />;
  const run = async () => {
    setState("running");
    setResults([]);
    try {
      const { runNativeSecurityChecks } =
        await import("../validation/nativeSecurity");
      await runNativeSecurityChecks((result) =>
        setResults((previous) => [...previous, result]),
      );
      setState("passed");
    } catch {
      // Native exceptions can contain SQL or paths; don't publish them in UI/logs.
      setState("failed");
    }
  };
  return (
    <Screen nav={false} header={false}>
      <Label bold size={24}>
        Comprobación nativa de cifrado
      </Label>
      <Label>
        Solo datos sintéticos. No accede a tus cuentas ni a Supabase.
      </Label>
      <Button
        label="Comprobar cifrado"
        loading={state === "running"}
        onPress={() => void run()}
      />
      {results.map((result) => (
        <Label key={result}>{result}</Label>
      ))}
      {state === "passed" ? (
        <Label>Validación de cifrado completada</Label>
      ) : null}
      {state === "failed" ? <Label>Validación de cifrado fallida</Label> : null}
      <Button
        label="Volver al inicio"
        disabled={state === "running"}
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}

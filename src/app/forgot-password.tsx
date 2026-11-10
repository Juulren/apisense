import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Redirect, router } from "expo-router";
import { Button, Card, Field, Label } from "../components/ui";
import { Screen } from "../components/ui/Screen";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { DEMO_ONLY } from "../config/runtime";
import {
  isEmail,
  isRecoveryCode,
  newPasswordProblem,
} from "../services/Profile";

// Three steps: ask for a code by email, check it, then set the new password.
// The account only opens after the last step. The first answer is the same
// whether or not the address has an account.
export default function ForgotPassword() {
  const app = useApp(),
    task = useTask();
  const [email, setEmail] = useState(""),
    [code, setCode] = useState(""),
    [password, setPassword] = useState(""),
    [step, setStep] = useState<"email" | "code" | "password">("email");
  const verified = useRef(false);
  const cancel = app.cancelRecovery;
  // Leaving after the code was accepted abandons the recovery session.
  useEffect(
    () => () => {
      if (verified.current) void cancel();
    },
    [cancel],
  );
  if (app.workspace) return <Redirect href="/dashboard" />;
  if (DEMO_ONLY) return <Redirect href="/" />;
  const send = () =>
    task.run(async () => {
      if (!isEmail(email))
        throw new Error("Escribe un correo electrónico válido");
      await app.requestPasswordReset(email);
      setStep("code");
      task.setMessage(
        "Si ese correo tiene una cuenta, te enviamos un código. Puede tardar un minuto.",
      );
    });
  const check = () =>
    task.run(async () => {
      if (!isRecoveryCode(code)) throw new Error("Escribe el código del correo (solo números)");
      await app.verifyRecoveryCode(email, code);
      verified.current = true;
      setStep("password");
      task.setMessage("Código correcto. Elige tu contraseña nueva.");
    });
  const change = () =>
    task.run(async () => {
      const problem = newPasswordProblem(password, email);
      if (problem) throw new Error(problem);
      await app.setRecoveredPassword(password, email);
      verified.current = false;
      router.replace("/dashboard");
    });
  return (
    <Screen
      title="Recuperar contraseña"
      subtitle="Te enviamos un código por correo"
      back
      header
    >
      <Card style={{ padding: 24, gap: 20 }}>
        <Field
          testID="reset-email"
          label="Correo electrónico"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          placeholder="apicultor@colmena.bio"
          value={email}
          onChangeText={setEmail}
          editable={step === "email"}
        />
        {step === "email" ? (
          <Button
            label="Enviar código"
            icon="mail"
            loading={task.busy}
            onPress={send}
          />
        ) : null}
        {step === "code" ? (
          <View style={{ gap: 20 }}>
            <Field
              testID="reset-code"
              label="Código del correo"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChangeText={setCode}
            />
            <Button
              label="Verificar código"
              icon="check"
              loading={task.busy}
              onPress={check}
            />
            <Button
              label="Pedir otro código"
              variant="ghost"
              icon="refresh"
              disabled={task.busy}
              onPress={send}
            />
          </View>
        ) : null}
        {step === "password" ? (
          <View style={{ gap: 20 }}>
            <Field
              testID="reset-password"
              label="Contraseña nueva"
              autoComplete="new-password"
              secureTextEntry
              placeholder="Mínimo 10 caracteres"
              value={password}
              onChangeText={setPassword}
            />
            <Button
              label="Cambiar contraseña"
              icon="lock-reset"
              loading={task.busy}
              onPress={change}
            />
          </View>
        ) : null}
        {task.message ? <Label tone="warning">{task.message}</Label> : null}
      </Card>
    </Screen>
  );
}

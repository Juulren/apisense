import { useEffect, useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Button, Card, Field, Label, Section } from "./ui";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { supabase } from "../services/supabase";
import { newPasswordProblem } from "../services/Profile";

/** "Mi perfil": the name shown in the greeting, and the account's own controls. */
export function ProfileSection() {
  const app = useApp(),
    task = useTask();
  const demo = app.workspace?.demo ?? true;
  const [draft, setDraft] = useState<string | null>(null),
    [email, setEmail] = useState<string | null>(null),
    [panel, setPanel] = useState<"none" | "password" | "delete">("none"),
    [current, setCurrent] = useState(""),
    [next, setNext] = useState("");
  const saved = app.data.settings.name ?? "";
  const name = draft ?? saved;
  useEffect(() => {
    let mounted = true;
    if (!demo && supabase)
      void supabase.auth
        .getSession()
        .then(({ data }) => {
          if (mounted) setEmail(data.session?.user.email ?? null);
        })
        .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [demo]);
  const close = () => {
    setPanel("none");
    setCurrent("");
    setNext("");
  };
  const offline = app.data.settings.offline === "1";
  return (
    <Section
      title="Mi perfil"
      caption={
        demo
          ? "Modo demo: el nombre solo se guarda en este dispositivo"
          : "Tu cuenta de Apisense"
      }
    >
      <Card>
        <Field
          testID="profile-name"
          label="Tu nombre"
          value={name}
          onChangeText={setDraft}
          placeholder="Cómo quieres que te saludemos"
          maxLength={50}
          autoCapitalize="words"
        />
        <Button
          label="Guardar nombre"
          variant="secondary"
          disabled={draft === null || draft.trim() === saved}
          loading={task.busy && panel === "none"}
          onPress={() =>
            task.run(async () => {
              const result = await app.saveName(name);
              setDraft(null);
              task.setMessage(
                result.synced || demo
                  ? "Nombre guardado"
                  : "Nombre guardado en este dispositivo; se enviará a tu cuenta al volver la conexión",
              );
            })
          }
        />
        {!demo ? (
          <View style={{ gap: 4 }}>
            <Label muted size={12}>
              Correo de la cuenta
            </Label>
            <Label bold>{email ?? "—"}</Label>
          </View>
        ) : null}
      </Card>
      {!demo ? (
        <Card>
          {panel === "password" ? (
            <View style={{ gap: 16 }}>
              <Field
                testID="profile-current-password"
                label="Contraseña actual"
                secureTextEntry
                autoComplete="current-password"
                value={current}
                onChangeText={setCurrent}
              />
              <Field
                testID="profile-new-password"
                label="Contraseña nueva"
                secureTextEntry
                autoComplete="new-password"
                placeholder="Mínimo 10 caracteres"
                value={next}
                onChangeText={setNext}
              />
              <Button
                label="Guardar contraseña"
                loading={task.busy}
                onPress={() =>
                  task.run(async () => {
                    const problem = newPasswordProblem(next, email ?? "");
                    if (problem) throw new Error(problem);
                    await app.changePassword(current, next);
                    close();
                    task.setMessage("Contraseña actualizada");
                  })
                }
              />
              <Button label="Cancelar" variant="ghost" onPress={close} />
            </View>
          ) : (
            <Button
              label="Cambiar contraseña"
              variant="secondary"
              icon="lock"
              disabled={offline || panel === "delete"}
              onPress={() => setPanel("password")}
            />
          )}
          {offline ? (
            <Label muted size={12}>
              Desactiva el modo sin conexión para cambiar la contraseña o
              borrar la cuenta.
            </Label>
          ) : null}
        </Card>
      ) : null}
      {task.message ? <Label>{task.message}</Label> : null}
      {!demo ? (
        <Card>
          <Label bold>Borrar mi cuenta</Label>
          {panel === "delete" ? (
            <View style={{ gap: 16 }}>
              <Label tone="warning">
                Se borrarán para siempre tu cuenta y todos tus datos en la nube
                (apiarios, colmenas, inspecciones, lecturas y avisos), y también
                los de este dispositivo. Lo que aún no se haya sincronizado (
                {app.data.pending} registros) se perderá. No se puede deshacer.
              </Label>
              <Field
                testID="delete-password"
                label="Tu contraseña, para confirmar"
                secureTextEntry
                autoComplete="current-password"
                value={current}
                onChangeText={setCurrent}
              />
              <Button
                label="Borrar cuenta y datos"
                variant="secondary"
                icon="delete-forever"
                loading={task.busy}
                disabled={current.length === 0}
                onPress={() =>
                  task.run(async () => {
                    await app.deleteAccount(current);
                    router.replace("/");
                  })
                }
              />
              <Button label="Cancelar" variant="ghost" onPress={close} />
            </View>
          ) : (
            <Button
              label="Borrar mi cuenta"
              variant="secondary"
              icon="delete-forever"
              disabled={offline || panel === "password"}
              onPress={() => setPanel("delete")}
            />
          )}
        </Card>
      ) : null}
    </Section>
  );
}

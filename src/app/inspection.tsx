import { useEffect, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { AppScreen } from "../components/AppScreen";
import { CheckinFields } from "../components/CheckinFields";
import { Fold } from "../components/ui/Fold";
import {
  Button,
  Card,
  Field,
  Icon,
  Label,
  Row,
  Segmented,
} from "../components/ui";
import { useTheme } from "../components/ui/theme";
import {
  chosenHive,
  emptyCheckin,
  hasUnsavedCheckin,
  saveCheckin,
} from "../services/Checkin";
import { useApp } from "../state/AppProvider";
import { useTask } from "../state/useTask";
import { useDoneSound } from "../state/useDoneSound";

export default function Inspection() {
  const { hiveId } = useLocalSearchParams<{ hiveId?: string }>(),
    app = useApp(),
    task = useTask(),
    navigation = useNavigation(),
    { colors } = useTheme(),
    done = useDoneSound();
  const [selected, setSelected] = useState(hiveId ?? ""),
    [changing, setChanging] = useState(false),
    [form, setForm] = useState(emptyCheckin);
  const hives = app.data.hives;
  const hive = chosenHive(hives, selected);
  useEffect(() => {
    setSelected(hiveId ?? "");
  }, [hiveId]);
  // Back must not throw away what was written. Without a session there is
  // nothing to keep, and leaving must not be blocked.
  usePreventRemove(
    !!app.workspace && hasUnsavedCheckin(form),
    ({ data }) => {
      Alert.alert(
        "¿Descartar la nota?",
        "Lo que escribiste o marcaste no se ha guardado.",
        [
          { text: "Seguir editando", style: "cancel" },
          {
            text: "Descartar",
            style: "destructive",
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      );
    },
  );
  // One row once the hive is known; chips while it still has to be chosen.
  const choosing = changing || !hive;
  const canChange = hives.length > 1;
  const save = () =>
    task.run(
      async () => {
        if (!app.workspace || !hive) throw new Error("Elige una colmena");
        await saveCheckin(app.workspace.repo, hive.id, form);
        await app.refresh();
        setForm(emptyCheckin);
        done();
      },
      app.workspace?.demo
        ? "Guardada en la demo."
        : "Guardada en este teléfono. Se envía cuando haya internet.",
    );
  return (
    <AppScreen title="Anotar" back>
      {hive ? (
        <Pressable
          testID="inspection-hive"
          accessibilityRole={canChange ? "button" : undefined}
          accessibilityState={canChange ? { expanded: changing } : undefined}
          accessibilityLabel={
            canChange ? `Colmena ${hive.code}. Cambiar` : `Colmena ${hive.code}`
          }
          disabled={!canChange}
          onPress={() => setChanging(!changing)}
          style={{ minHeight: 64 }}
        >
          <Card style={{ padding: 16 }}>
            <Row>
              <Icon name="hive" size={22} />
              <View style={{ flex: 1 }}>
                <Label bold size={16}>
                  {hive.code}
                </Label>
                <Label muted size={12}>
                  Colmena
                </Label>
              </View>
              {canChange ? (
                <Label bold color={colors.amberText}>
                  {changing ? "Cerrar" : "Cambiar"}
                </Label>
              ) : null}
            </Row>
          </Card>
        </Pressable>
      ) : null}
      {choosing && hives.length ? (
        <View style={{ gap: 8 }}>
          {hive ? null : <Label bold>Elige la colmena</Label>}
          <Segmented
            scroll
            value={hive?.id ?? ""}
            onChange={(id) => {
              setSelected(id);
              setChanging(false);
              task.setMessage(null);
            }}
            options={hives.map((h) => ({ value: h.id, label: h.code }))}
          />
        </View>
      ) : null}
      {hives.length ? null : <Label muted>Primero añade una colmena.</Label>}
      <Field
        label="Nota"
        testID="inspection-notes"
        placeholder="¿Qué viste o hiciste?"
        multiline
        numberOfLines={4}
        style={{ minHeight: 110, textAlignVertical: "top" }}
        value={form.notes}
        onChangeText={(notes) => setForm({ ...form, notes })}
        maxLength={5000}
      />
      <Fold title="Más datos" testID="fold-more-data">
        <Card>
          <CheckinFields value={form} onChange={setForm} />
          <Field
            label="Etiquetas (separadas por comas)"
            placeholder="Alimentación, ventilación, revisión de cría"
            value={form.tags}
            onChangeText={(tags) => setForm({ ...form, tags })}
            maxLength={300}
          />
        </Card>
      </Fold>
      <Button
        testID="inspection-save"
        label="Guardar"
        icon="save-alt"
        disabled={!hive}
        loading={task.busy}
        onPress={save}
      />
      {task.message ? (
        <Label accessibilityLiveRegion="polite">{task.message}</Label>
      ) : null}
    </AppScreen>
  );
}

import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { AppScreen } from "../../components/AppScreen";
import { Segmented } from "../../components/ui";
import { ApiaryProfile } from "../../components/ApiaryProfile";
import { NewApiaryForm } from "../../components/NewApiaryForm";
import { useApp } from "../../state/AppProvider";

export default function MyApiary() {
  const app = useApp();
  // `advanced` is how "Temporada: elegir calendario" lands on the calendar.
  const params = useLocalSearchParams<{ id?: string; advanced?: string }>();
  const [selected, setSelected] = useState(params.id ?? "");
  const apiary =
    app.data.apiaries.find((a) => a.id === selected) ?? app.data.apiaries[0];
  return (
    <AppScreen title="Mi apiario" back>
      {app.data.apiaries.length > 1 ? (
        <Segmented
          value={apiary?.id ?? ""}
          onChange={setSelected}
          options={app.data.apiaries.map((a) => ({
            value: a.id,
            label: a.name,
          }))}
        />
      ) : null}
      {apiary ? (
        // Keyed here so a message or a draft never carries to another apiary.
        <ApiaryProfile
          key={apiary.id}
          apiary={apiary}
          advanced={params.advanced === "1" && apiary.id === params.id}
        />
      ) : (
        <NewApiaryForm onCreated={setSelected} />
      )}
    </AppScreen>
  );
}

import { useState } from "react";
import { Pressable } from "react-native";
import { Label } from "./ui";

/** The one line every alert keeps, with the explanation behind a tap. */
export function NotDiagnosis() {
  const [open, setOpen] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      onPress={() => setOpen(!open)}
      style={{ minHeight: 48, justifyContent: "center" }}
    >
      <Label size={13}>No es un diagnóstico · ¿Qué significa?</Label>
      {open ? (
        <Label muted size={13}>
          Suena distinto de lo normal en esta colmena. El nodo no sabe por qué:
          revísala.
        </Label>
      ) : null}
    </Pressable>
  );
}

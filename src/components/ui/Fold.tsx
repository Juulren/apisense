import { useState, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Card, Icon, Label, Row } from "./index";

/**
 * A section that stays closed until asked for (progressive disclosure): the
 * screen starts short and the rare controls are one tap away. The whole header
 * is the touch target (48dp minimum).
 */
export function Fold({
  title,
  children,
  testID,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  testID?: string;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        testID={testID}
        onPress={() => setOpen(!open)}
        style={{ minHeight: 48, justifyContent: "center" }}
      >
        <Card style={{ paddingVertical: 12 }}>
          <Row>
            <Label bold style={{ flex: 1 }}>
              {title}
            </Label>
            <Icon name={open ? "expand-less" : "expand-more"} size={24} />
          </Row>
        </Card>
      </Pressable>
      {open ? children : null}
    </View>
  );
}

import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router, usePathname, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Label, Row, type IconName } from ".";
import { useTheme } from "./theme";
import { useApp } from "../../state/AppProvider";

// Material 3 navigation bar: the whole destination is the touch target (about
// 80 dp tall, never below 48 dp); the visual is a 64x32 dp pill behind a 24 dp
// icon, 4 dp above a one-line 12 sp label. Pressed feedback is a state layer on
// the pill itself, so the highlight always matches the shape the user sees.
const PILL_WIDTH = 64;
const PILL_HEIGHT = 32;
const INDICATOR = "rgba(245,158,11,0.26)";

const items: {
  route: Href;
  label: string;
  icon: IconName;
  prefix: string[];
}[] = [
  {
    route: "/dashboard",
    label: "Inicio",
    icon: "dashboard",
    prefix: ["/dashboard", "/hives"],
  },
  {
    route: "/monitor",
    label: "Acústica",
    icon: "graphic-eq",
    prefix: ["/monitor", "/pairing"],
  },
  {
    route: "/history",
    label: "Diagnóstico",
    icon: "health-and-safety",
    prefix: ["/history", "/hive", "/inspection"],
  },
  {
    route: "/settings",
    label: "Ajustes",
    icon: "settings",
    prefix: ["/settings"],
  },
];

const matches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix + "/");

function useKeyboardVisible() {
  const [visible, setVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () =>
      setVisible(true),
    );
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setVisible(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return visible;
}

// Active indicator: grows from the centre and fades in, like the M3 motion.
function Indicator({ selected }: { selected: boolean }) {
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [selected, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.4 + 0.6 * progress.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: PILL_HEIGHT / 2, backgroundColor: INDICATOR },
        style,
      ]}
    />
  );
}

export function BottomNav() {
  const { colors } = useTheme();
  const { workspace, busy } = useApp();
  const path = usePathname();
  const inset = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const visible = items.some((item) =>
    item.prefix.some((prefix) => matches(path, prefix)),
  );
  if (!workspace || busy || !visible || keyboardVisible) return null;
  return (
    <View
      style={{
        backgroundColor: colors.card,
        paddingBottom: inset.bottom,
        borderTopWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Row
        style={{
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          paddingHorizontal: 4,
          gap: 0,
        }}
      >
        {items.map((item) => {
          const selected = item.prefix.some((prefix) => matches(path, prefix));
          return (
            <Pressable
              key={item.label}
              // Plain native styles only: no ripple, because the platform ripple
              // is rectangular and would not match the round indicator.
              cssInterop={false}
              testID={`nav-${item.label}`}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => {
                if (path !== item.route) router.navigate(item.route);
              }}
              style={{
                flex: 1,
                minHeight: 80,
                paddingTop: 12,
                paddingBottom: 16,
                alignItems: "center",
                gap: 4,
              }}
            >
              {({ pressed }) => (
                <>
                  <View
                    style={{
                      width: PILL_WIDTH,
                      height: PILL_HEIGHT,
                      borderRadius: PILL_HEIGHT / 2,
                      overflow: "hidden",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Indicator selected={selected} />
                    {pressed ? (
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFill,
                          { backgroundColor: colors.text, opacity: 0.1 },
                        ]}
                      />
                    ) : null}
                    <Icon
                      name={item.icon}
                      color={selected ? colors.amberText : colors.muted}
                    />
                  </View>
                  <Label
                    size={12}
                    bold={selected}
                    maxFontSizeMultiplier={1.3}
                    color={selected ? colors.text : colors.muted}
                    style={{ textAlign: "center" }}
                  >
                    {item.label}
                  </Label>
                </>
              )}
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

import { useEffect, useState } from "react";
import {
  Keyboard,
  Pressable,
  useWindowDimensions,
  View,
} from "react-native";
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

// Material 3 style active indicator: a pill behind the icon that fades and
// grows in instead of the whole bar re-rendering on each navigation.
function Indicator({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(selected ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [selected, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.6 + 0.4 * progress.value }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: 56,
          height: 28,
          borderRadius: 14,
          backgroundColor: colors.amber,
        },
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
  const { fontScale } = useWindowDimensions();
  const keyboardVisible = useKeyboardVisible();
  const largeText = fontScale > 1.2;
  const visible = items.some((item) =>
    item.prefix.some((prefix) => matches(path, prefix)),
  );
  if (!workspace || busy || !visible || keyboardVisible) return null;
  return (
    <View
      style={{
        backgroundColor: colors.card,
        paddingBottom: Math.max(inset.bottom, 8),
        borderTopWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Row
        style={{
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          paddingHorizontal: 12,
          paddingTop: 8,
          gap: 0,
          flexWrap: largeText ? "wrap" : "nowrap",
        }}
      >
        {items.map((item) => {
          const selected = item.prefix.some((prefix) => matches(path, prefix));
          const color = selected ? colors.amberText : colors.muted;
          return (
            <Pressable
              key={item.label}
              testID={`nav-${item.label}`}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              android_ripple={{ color: colors.border, borderless: false }}
              onPress={() => {
                if (path !== item.route) router.navigate(item.route);
              }}
              style={{
                flexGrow: 1,
                flexBasis: largeText ? "48%" : 0,
                minHeight: 48,
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
              }}
            >
              <View
                style={{
                  height: 28,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Indicator selected={selected} />
                <Icon name={item.icon} color={color} />
              </View>
              <Label
                size={11}
                bold={selected}
                color={color}
                style={{ textAlign: "center" }}
              >
                {item.label}
              </Label>
            </Pressable>
          );
        })}
      </Row>
    </View>
  );
}

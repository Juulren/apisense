import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Icon, Label, Row, type IconName } from ".";
import { tokens, useTheme } from "./theme";
const navigation: {
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
    prefix: ["/settings", "/ui-catalog"],
  },
];
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  nav = true,
  header = true,
  status = "Local",
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  nav?: boolean;
  header?: boolean;
  status?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  const path = usePathname();
  const inset = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: inset.top,
      }}
    >
      {header ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 480,
              alignSelf: "center",
              paddingHorizontal: 20,
              paddingVertical: 16,
            }}
          >
            <Row>
              <Row style={{ flex: 1, justifyContent: "flex-start", gap: 10 }}>
                {back ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                    onPress={() =>
                      router.canGoBack()
                        ? router.back()
                        : router.replace("/dashboard")
                    }
                    style={{ padding: 6 }}
                  >
                    <Icon name="arrow-back" />
                  </Pressable>
                ) : (
                  <Image
                    source={require("../../../assets/brand-logo.png")}
                    style={{ width: 30, height: 30, borderRadius: 15 }}
                  />
                )}
                <Label bold size={18}>
                  Apisense
                </Label>
                <Label muted size={11}>
                  Apiario
                </Label>
              </Row>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver estado de sincronización"
                onPress={() => router.push("/settings")}
              >
                <Badge label={status} tone="green" />
              </Pressable>
            </Row>
          </View>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          gap: 24,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          paddingBottom: 32,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {title ? (
          <View style={{ gap: 6 }}>
            <Row>
              <Label bold size={24} style={{ flex: 1 }}>
                {title}
              </Label>
              {action}
            </Row>
            {subtitle ? <Label muted>{subtitle}</Label> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
      {nav ? (
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
            }}
          >
            {navigation.map((item) => {
              const selected = item.prefix.some(
                (prefix) => path === prefix || path.startsWith(prefix + "/"),
              );
              const color = selected ? tokens.audio : colors.muted;
              return (
                <Pressable
                  key={item.label}
                  testID={`nav-${item.label}`}
                  accessibilityRole="tab"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected }}
                  onPress={() => router.navigate(item.route)}
                  style={{
                    flex: 1,
                    minHeight: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                  }}
                >
                  <Icon name={item.icon} color={color} />
                  <Label size={11} bold={selected} color={color}>
                    {item.label}
                  </Label>
                </Pressable>
              );
            })}
          </Row>
        </View>
      ) : null}
    </View>
  );
}

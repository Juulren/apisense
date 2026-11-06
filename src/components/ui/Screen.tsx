import { useCallback, useRef, type ReactNode } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Icon, Label, Row } from ".";
import { useTheme } from "./theme";
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  header = true,
  status = "Local",
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  header?: boolean;
  status?: string;
  action?: ReactNode;
}) {
  const { colors } = useTheme();
  const inset = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.2;
  const scroll = useRef<ScrollView>(null);
  useFocusEffect(
    useCallback(() => {
      let frame: number | undefined;
      const shown = Keyboard.addListener("keyboardDidShow", () => {
        frame = requestAnimationFrame(() => {
          const input = TextInput.State.currentlyFocusedInput();
          if (input)
            scroll.current?.scrollResponderScrollNativeHandleToKeyboard(
              input,
              16,
              true,
            );
        });
      });
      return () => {
        shown.remove();
        if (frame !== undefined) cancelAnimationFrame(frame);
      };
    }, []),
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
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
            <Row
              style={
                largeText
                  ? { flexDirection: "column", alignItems: "stretch" }
                  : undefined
              }
            >
              <Row
                style={{
                  flex: largeText ? undefined : 1,
                  justifyContent: "flex-start",
                  gap: 10,
                  flexWrap: largeText ? "wrap" : "nowrap",
                }}
              >
                {back ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Volver"
                    onPress={() =>
                      router.canGoBack()
                        ? router.back()
                        : router.replace("/dashboard")
                    }
                    style={{
                      minWidth: 48,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
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
                style={{
                  minHeight: 48,
                  justifyContent: "center",
                  alignSelf: largeText ? "flex-start" : undefined,
                }}
              >
                <Badge label={status} tone="green" />
              </Pressable>
            </Row>
          </View>
        </View>
      ) : null}
      <ScrollView
        ref={scroll}
        keyboardDismissMode="on-drag"
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
              <Label
                bold
                size={24}
                accessibilityRole="header"
                style={{ flex: 1 }}
              >
                {title}
              </Label>
              {action}
            </Row>
            {subtitle ? <Label muted>{subtitle}</Label> : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

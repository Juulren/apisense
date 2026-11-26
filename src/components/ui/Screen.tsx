import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge, Icon, Label, Row } from ".";
import { useTheme } from "./theme";
import { scrollToReveal } from "../../services/KeyboardScroll";
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  header = true,
  status = "Local",
  action,
  onRefresh,
  pullEnabled = true,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  back?: boolean;
  header?: boolean;
  status?: string;
  action?: ReactNode;
  /** With it, pulling the content down reloads the screen's data. */
  onRefresh?: () => Promise<unknown>;
  /** Off while something inside needs the downward drag (the map). */
  pullEnabled?: boolean;
}) {
  const { colors } = useTheme();
  const inset = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const largeText = fontScale > 1.2;
  const scroll = useRef<ScrollView>(null);
  const viewport = useRef<View>(null);
  const offset = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const pull = () => {
    setRefreshing(true);
    void onRefresh?.()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  };
  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const shown = Keyboard.addListener("keyboardDidShow", (event) => {
        clearTimeout(timer);
        // Measured after the layout settles: the bottom bar hides and the screen
        // shrinks when the keyboard appears.
        timer = setTimeout(() => {
          const input = TextInput.State.currentlyFocusedInput();
          input?.measureInWindow((_x, inputTop, _width, inputHeight) => {
            viewport.current?.measureInWindow((_vx, viewTop, _vw, height) => {
              const y = scrollToReveal({
                offset: offset.current,
                inputTop,
                inputHeight,
                viewTop,
                viewBottom: Math.min(
                  viewTop + height,
                  event.endCoordinates.screenY,
                ),
                margin: 16,
              });
              if (y !== null) scroll.current?.scrollTo({ y, animated: true });
            });
          });
        }, 120);
      });
      return () => {
        shown.remove();
        clearTimeout(timer);
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
      <View ref={viewport} collapsable={false} style={{ flex: 1 }}>
      <ScrollView
        ref={scroll}
        keyboardDismissMode="on-drag"
        onScroll={(e) => {
          offset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              enabled={pullEnabled}
              refreshing={refreshing}
              onRefresh={pull}
              colors={[colors.amberText]}
              tintColor={colors.amberText}
              progressBackgroundColor={colors.card}
            />
          ) : undefined
        }
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
      </View>
    </KeyboardAvoidingView>
  );
}

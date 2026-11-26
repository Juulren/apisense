import { useCallback, useRef, useState, type ReactNode } from "react";
import {
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
import { Badge, IconButton, Label, Row } from ".";
import { useTheme } from "./theme";
import { scrollToReveal } from "../../services/KeyboardScroll";
export function Screen({
  children,
  title,
  subtitle,
  back = false,
  header = true,
  status,
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
      {/* The bar only takes room when it has something to say. */}
      {header && (back || title || action || status) ? (
        <View
          style={{
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Row
            style={{
              width: "100%",
              maxWidth: 480,
              alignSelf: "center",
              paddingHorizontal: back ? 8 : 20,
              paddingVertical: 8,
              minHeight: 64,
              gap: 8,
              flexWrap: largeText ? "wrap" : "nowrap",
              justifyContent: "flex-end",
            }}
          >
            {back ? (
              <IconButton
                icon="arrow-back"
                label="Volver"
                onPress={() =>
                  router.canGoBack()
                    ? router.back()
                    : router.replace("/dashboard")
                }
              />
            ) : null}
            <Label
              bold
              size={20}
              accessibilityRole="header"
              style={{ flex: 1 }}
            >
              {title ?? ""}
            </Label>
            {status ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${status}. Ver estado de sincronización`}
                onPress={() => router.push("/settings")}
                style={{ minHeight: 48, justifyContent: "center" }}
              >
                <Badge label={status} tone={status === "Demo" ? "blue" : "amber"} />
              </Pressable>
            ) : null}
            {action}
          </Row>
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
        {subtitle ? <Label muted>{subtitle}</Label> : null}
        {children}
      </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

import { useState, type ComponentProps, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
  type TextInputProps,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { tokens, useTheme } from "./theme";

export type IconName = ComponentProps<typeof MaterialIcons>["name"];
export function Icon({
  name,
  color,
  size = 24,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <MaterialIcons
      name={name}
      size={size}
      color={color ?? colors.text}
      accessible={false}
    />
  );
}
export function Label({
  children,
  muted = false,
  size = 14,
  bold = false,
  color,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  size?: number;
  bold?: boolean;
  color?: string;
  style?: ComponentProps<typeof Text>["style"];
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: color ?? (muted ? colors.muted : colors.text),
          fontFamily: bold ? "JakartaBold" : "Jakarta",
          fontSize: size,
          lineHeight: size * 1.45,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  tone,
  style,
}: {
  children: ReactNode;
  tone?: "amber" | "green" | "blue";
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: tone ? colors[tone] : colors.card,
          borderColor: tone
            ? colors[(tone + "Text") as "amberText"] + "22"
            : colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  icon,
  variant = "primary",
  disabled,
  loading,
  compact = false,
}: {
  label: string;
  onPress: () => void | Promise<void>;
  icon?: IconName;
  variant?: "primary" | "secondary" | "audio" | "sync" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const background = {
    primary: tokens.honey,
    secondary: colors.card,
    audio: tokens.audio,
    sync: tokens.sync,
    ghost: "transparent",
  }[variant];
  const foreground =
    variant === "primary"
      ? "#141C29"
      : variant === "secondary"
        ? colors.text
        : variant === "ghost"
          ? colors.amberText
          : "#FFFFFF";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: !!disabled || !!loading,
        busy: !!loading,
      }}
      aria-disabled={!!disabled || !!loading}
      aria-busy={!!loading}
      disabled={disabled || loading}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed, hovered }) => [
        {
          minHeight: compact ? 44 : variant === "primary" ? 52 : 48,
          paddingHorizontal: 18,
          paddingVertical: 12,
          borderRadius: variant === "secondary" ? 12 : 16,
          backgroundColor: background,
          borderWidth: 1,
          borderColor: focused
            ? tokens.blue
            : variant === "secondary"
              ? colors.border
              : "transparent",
          opacity: disabled ? 0.45 : pressed ? 0.7 : hovered ? 0.88 : 1,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : icon ? (
        <Icon name={icon} color={foreground} size={20} />
      ) : null}
      <Label bold size={13} color={foreground}>
        {label}
      </Label>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Label bold>{label}</Label>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          {
            minHeight: 52,
            borderRadius: 12,
            borderWidth: focused ? 2 : 1,
            borderColor: error
              ? tokens.danger
              : focused
                ? tokens.honey
                : colors.border,
            backgroundColor: colors.soft,
            color: colors.text,
            fontFamily: "Jakarta",
            fontSize: 15,
            padding: 14,
          },
          props.style,
        ]}
      />
      {error ? <Label color={tokens.danger}>{error}</Label> : null}
    </View>
  );
}
export function Badge({
  label,
  tone = "green",
}: {
  label: string;
  tone?: "green" | "amber" | "blue" | "neutral";
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: tone === "neutral" ? colors.soft : colors[tone],
        borderRadius: 99,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text
        style={{
          fontFamily: "Inter",
          fontSize: 11,
          color: tone === "neutral" ? colors.muted : colors[`${tone}Text`],
        }}
      >
        {label}
      </Text>
    </View>
  );
}
export function Section({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ gap: 14 }}>
      <View>
        <Label bold size={18}>
          {title}
        </Label>
        {caption ? (
          <Label muted size={12}>
            {caption}
          </Label>
        ) : null}
      </View>
      {children}
    </View>
  );
}
export function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
  caption,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  caption?: string;
}) {
  const { colors } = useTheme();
  return (
    <Row>
      <View style={{ flex: 1 }}>
        <Label bold>{label}</Label>
        {caption ? (
          <Label muted size={12}>
            {caption}
          </Label>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: tokens.honey }}
        thumbColor="#FFFFFF"
      />
    </Row>
  );
}
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="radio"
          accessibilityLabel={option.label}
          accessibilityState={{ checked: option.value === value }}
            aria-checked={option.value === value}
          onPress={() => onChange(option.value)}
          style={{
            flexGrow: 1,
            flexBasis: 80,
            borderWidth: option.value === value ? 2 : 1,
            borderColor: option.value === value ? tokens.honey : colors.border,
            borderRadius: 12,
            padding: 12,
            minHeight: 48,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              option.value === value ? colors.amber : colors.card,
          }}
        >
          <Label
            size={12}
            bold
            color={option.value === value ? colors.amberText : colors.muted}
          >
            {option.label}
          </Label>
        </Pressable>
      ))}
    </View>
  );
}
export function Metric({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: IconName;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: 130, gap: 8 }}>
      <Icon name={icon} color={tokens.blue} />
      <Label muted size={12}>
        {label}
      </Label>
      <Text
        style={{
          color: colors.text,
          fontFamily: "InterBold",
          fontSize: 27,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
        <Text style={{ fontSize: 13 }}> {unit}</Text>
      </Text>
    </Card>
  );
}
const styles = StyleSheet.create({
  card: { borderRadius: 24, borderWidth: 1, padding: 20, gap: 16 },
});

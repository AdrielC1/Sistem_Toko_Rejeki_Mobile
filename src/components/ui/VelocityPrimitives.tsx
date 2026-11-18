import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
} from "lucide-react-native";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";

export interface SurfaceCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SurfaceCard({ children, style, testID }: SurfaceCardProps) {
  return (
    <View testID={testID} style={[styles.surfaceCard, style]}>
      {children}
    </View>
  );
}

export interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  style,
  testID,
  accessibilityLabel,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const displayLabel = loading && loadingLabel ? loadingLabel : label;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.primaryButton,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={TOKENS.colors.onPrimary} />
      ) : (
        icon
      )}
      <Text style={styles.primaryButtonText}>{displayLabel}</Text>
    </Pressable>
  );
}

export type SecondaryButtonVariant =
  | "outlined"
  | "tonal"
  | "danger-outline"
  | "danger";

export interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: SecondaryButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

export function SecondaryButton({
  label,
  onPress,
  variant = "outlined",
  disabled = false,
  loading = false,
  loadingLabel,
  icon,
  style,
  testID,
  accessibilityLabel,
}: SecondaryButtonProps) {
  const isDisabled = disabled || loading;
  const displayLabel = loading && loadingLabel ? loadingLabel : label;

  const variantContainerStyle =
    variant === "tonal"
      ? styles.secondaryTonal
      : variant === "danger-outline"
        ? styles.secondaryDangerOutline
        : variant === "danger"
          ? styles.secondaryDangerFill
          : styles.secondaryOutlined;

  const variantTextStyle =
    variant === "tonal"
      ? styles.secondaryTonalText
      : variant === "danger-outline"
        ? styles.secondaryDangerOutlineText
        : variant === "danger"
          ? styles.secondaryDangerFillText
          : styles.secondaryOutlinedText;

  const spinnerColor =
    variant === "tonal"
      ? TOKENS.colors.onSurface
      : variant === "danger-outline"
        ? TOKENS.colors.destructive
        : variant === "danger"
          ? TOKENS.colors.onPrimary
          : TOKENS.colors.primary;

  return (
    <Pressable
      testID={testID}
      onPress={() => {
        onPress();
      }}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? displayLabel}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.secondaryButtonBase,
        variantContainerStyle,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        icon
      )}
      <Text style={[styles.secondaryButtonTextBase, variantTextStyle]}>
        {displayLabel}
      </Text>
    </Pressable>
  );
}

export interface InputTrailingAction {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

export type InputFieldHandle = React.ComponentRef<typeof TextInput>;

export interface InputFieldProps
  extends Omit<TextInputProps, "style" | "value" | "onChangeText"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  helperText?: string;
  error?: string | null;
  invalid?: boolean;
  leadingIcon?: React.ReactNode;
  trailingAction?: InputTrailingAction;
  monospace?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  inputRef?: React.Ref<InputFieldHandle>;
}

export function InputField({
  label,
  value,
  onChangeText,
  helperText,
  error,
  invalid = false,
  leadingIcon,
  trailingAction,
  monospace = false,
  containerStyle,
  inputStyle,
  inputRef,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...textInputProps
}: InputFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const isInvalid = invalid || Boolean(error);

  return (
    <View style={[styles.fieldWrapper, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          isInvalid && !isFocused && styles.inputContainerInvalid,
        ]}
      >
        {leadingIcon ? (
          <View style={styles.leadingIconSlot}>{leadingIcon}</View>
        ) : null}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholderTextColor={TOKENS.colors.muted}
          accessibilityLabel={accessibilityLabel ?? label}
          onFocus={(event) => {
            setIsFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setIsFocused(false);
            onBlur?.(event);
          }}
          style={[
            styles.textInput,
            monospace && styles.textInputMono,
            leadingIcon ? styles.textInputWithLeading : null,
            trailingAction ? styles.textInputWithTrailing : null,
            inputStyle,
          ]}
          {...textInputProps}
        />
        {trailingAction ? (
          <Pressable
            testID={trailingAction.testID}
            onPress={trailingAction.onPress}
            accessibilityRole="button"
            accessibilityLabel={trailingAction.accessibilityLabel}
            style={({ pressed }) => [
              styles.trailingActionButton,
              pressed && styles.trailingActionPressed,
            ]}
          >
            {trailingAction.icon}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.fieldErrorText}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.fieldHelperText}>{helperText}</Text>
      ) : null}
    </View>
  );
}

export type FeedbackBannerVariant = "error" | "warning" | "success" | "info";

export interface FeedbackBannerProps {
  variant: FeedbackBannerVariant;
  message: string;
  title?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function FeedbackBanner({
  variant,
  message,
  title,
  icon,
  style,
  testID,
}: FeedbackBannerProps) {
  const containerVariant =
    variant === "error"
      ? styles.bannerError
      : variant === "warning"
        ? styles.bannerWarning
        : variant === "success"
          ? styles.bannerSuccess
          : styles.bannerInfo;

  const textColorStyle =
    variant === "error"
      ? styles.bannerErrorText
      : variant === "warning"
        ? styles.bannerWarningText
        : variant === "success"
          ? styles.bannerSuccessText
          : styles.bannerInfoText;

  const defaultIcon =
    variant === "error" ? (
      <AlertCircle size={18} color={TOKENS.colors.onErrorContainer} />
    ) : variant === "warning" ? (
      <TriangleAlert size={18} color={TOKENS.colors.warningText} />
    ) : variant === "success" ? (
      <CheckCircle2 size={18} color={TOKENS.colors.successText} />
    ) : (
      <Info size={18} color={TOKENS.colors.onPrimaryFixed} />
    );

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.bannerBase, containerVariant, style]}
    >
      <View style={styles.bannerIconSlot}>{icon ?? defaultIcon}</View>
      <View style={styles.bannerTextWrapper}>
        {title ? (
          <Text style={[styles.bannerTitle, textColorStyle]}>{title}</Text>
        ) : null}
        <Text style={[styles.bannerMessage, textColorStyle]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surfaceCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    borderRadius: TOKENS.radii.lg,
    padding: TOKENS.spacing.lg,
    // Subtle surface marker against #f9f9ff viewport canvas
    shadowColor: TOKENS.colors.onSurface,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  primaryButton: {
    minHeight: TOKENS.spacing.touchTarget,
    backgroundColor: TOKENS.colors.primary,
    borderRadius: TOKENS.radii.md,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: TOKENS.spacing.sm,
  },
  primaryButtonText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onPrimary,
    textAlign: "center",
    flexShrink: 1,
  },
  secondaryButtonBase: {
    minHeight: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.md,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: TOKENS.spacing.sm,
  },
  secondaryOutlined: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.primary,
  },
  secondaryTonal: {
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
  },
  secondaryDangerOutline: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 1,
    borderColor: TOKENS.colors.destructive,
  },
  secondaryDangerFill: {
    backgroundColor: TOKENS.colors.destructive,
    borderWidth: 1,
    borderColor: TOKENS.colors.destructive,
  },
  secondaryButtonTextBase: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    textAlign: "center",
    flexShrink: 1,
  },
  secondaryOutlinedText: {
    color: TOKENS.colors.primary,
  },
  secondaryTonalText: {
    color: TOKENS.colors.onSurface,
  },
  secondaryDangerOutlineText: {
    color: TOKENS.colors.destructive,
  },
  secondaryDangerFillText: {
    color: TOKENS.colors.onPrimary,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  fieldWrapper: {
    width: "100%",
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurface,
    marginBottom: TOKENS.spacing.xs,
  },
  inputContainer: {
    minHeight: TOKENS.spacing.touchTarget,
    backgroundColor: TOKENS.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: TOKENS.colors.outline,
    borderRadius: TOKENS.radii.md,
    flexDirection: "row",
    alignItems: "center",
  },
  inputContainerFocused: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderWidth: 2,
    borderColor: TOKENS.colors.primary,
  },
  inputContainerInvalid: {
    borderColor: TOKENS.colors.error,
  },
  leadingIconSlot: {
    paddingLeft: TOKENS.spacing.md,
    paddingRight: TOKENS.spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    minHeight: TOKENS.spacing.touchTarget - 4,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.body,
    color: TOKENS.colors.onSurface,
  },
  textInputMono: {
    fontFamily: FONT_FAMILY.mono,
  },
  textInputWithLeading: {
    paddingLeft: 0,
  },
  textInputWithTrailing: {
    paddingRight: 0,
  },
  trailingActionButton: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderTopRightRadius: TOKENS.radii.md,
    borderBottomRightRadius: TOKENS.radii.md,
  },
  trailingActionPressed: {
    opacity: 0.75,
  },
  fieldHelperText: {
    marginTop: TOKENS.spacing.xs,
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  fieldErrorText: {
    marginTop: TOKENS.spacing.xs,
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onErrorContainer,
  },
  bannerBase: {
    width: "100%",
    borderWidth: 1,
    borderRadius: TOKENS.radii.sm,
    paddingHorizontal: TOKENS.spacing.md,
    paddingVertical: TOKENS.spacing.sm,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
  },
  bannerIconSlot: {
    paddingTop: 2,
    flexShrink: 0,
  },
  bannerTextWrapper: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bannerTitle: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
  },
  bannerMessage: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
  },
  bannerError: {
    backgroundColor: TOKENS.colors.errorContainer,
    borderColor: TOKENS.colors.error,
  },
  bannerErrorText: {
    color: TOKENS.colors.onErrorContainer,
  },
  bannerWarning: {
    backgroundColor: TOKENS.colors.warningBg,
    borderColor: TOKENS.colors.warning,
  },
  bannerWarningText: {
    color: TOKENS.colors.warningText,
  },
  bannerSuccess: {
    backgroundColor: TOKENS.colors.successBg,
    borderColor: TOKENS.colors.success,
  },
  bannerSuccessText: {
    color: TOKENS.colors.successText,
  },
  bannerInfo: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  bannerInfoText: {
    color: TOKENS.colors.onPrimaryFixed,
  },
});

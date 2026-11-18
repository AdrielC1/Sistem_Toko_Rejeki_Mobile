import type { UserRole } from "@/types";

export const FONT_FAMILY = {
  heading: "HankenGrotesk_600SemiBold",
  body: "Inter_400Regular",
  bodySemiBold: "Inter_600SemiBold",
  mono: "JetBrainsMono_400Regular",
  monoSemiBold: "JetBrainsMono_600SemiBold",
} as const;

export const TOKENS = {
  colors: {
    primary: "#00478d",
    primaryContainer: "#005eb8",
    onPrimary: "#ffffff",
    primaryFixed: "#d6e3ff",
    onPrimaryFixed: "#00468c",
    background: "#f9f9ff",
    surfaceCard: "#ffffff",
    surfaceContainerLow: "#f2f3fb",
    surfaceContainer: "#ecedf6",
    onSurface: "#191c21",
    onSurfaceVariant: "#424752",
    muted: "#525866",
    outline: "#727783",
    borderSubtle: "#e2e8f0",
    success: "#10b981",
    successBg: "#d1fae5",
    successText: "#065f46",
    kasirAvatar: "#047857",
    warning: "#f59e0b",
    warningBg: "#fef3c7",
    warningText: "#78350f",
    error: "#ef4444",
    destructive: "#dc2626",
    errorContainer: "#ffdad6",
    onErrorContainer: "#93000a",
    ownerAvatar: "#7c3aed",
    ownerBg: "#ede9fe",
    ownerText: "#5b21b6",
    modalBackdrop: "rgba(25, 28, 33, 0.55)",
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    touchTarget: 48,
    logoBox: 64,
    tabBarHeight: 64,
  },
  radii: {
    sm: 8,
    md: 12,
    lg: 16,
  },
  typography: {
    label: 13,
    body: 16,
    heading: 20,
    display: 24,
  },
  lineHeight: {
    label: 18,
    body: 24,
    heading: 24,
    display: 29,
  },
} as const;

export interface RoleStyleSpec {
  label: string;
  avatarBg: string;
  badgeBg: string;
  badgeText: string;
  icon: "shield-check" | "user";
}

export const ROLE_STYLES: Record<UserRole, RoleStyleSpec> = {
  owner: {
    label: "Owner",
    avatarBg: TOKENS.colors.ownerAvatar,
    badgeBg: TOKENS.colors.ownerBg,
    badgeText: TOKENS.colors.ownerText,
    icon: "shield-check",
  },
  admin: {
    label: "Admin",
    avatarBg: TOKENS.colors.primary,
    badgeBg: TOKENS.colors.primaryFixed,
    badgeText: TOKENS.colors.onPrimaryFixed,
    icon: "shield-check",
  },
  kasir: {
    label: "Kasir",
    avatarBg: TOKENS.colors.kasirAvatar,
    badgeBg: TOKENS.colors.successBg,
    badgeText: TOKENS.colors.successText,
    icon: "user",
  },
};

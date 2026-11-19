import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  KeyRound,
  Pencil,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react-native";
import { EmptyStateCard } from "@/components/common/EmptyStateCard";
import { RoleBadge } from "@/components/common/RoleBadge";
import {
  FeedbackBanner,
  InputField,
  PrimaryButton,
  SecondaryButton,
  SurfaceCard,
} from "@/components/ui/VelocityPrimitives";
import { useAuth } from "@/context/AuthContext";
import { useSystemStatus } from "@/context/SystemStatusContext";
import {
  createStaffUser,
  deleteStaffUser,
  fetchStaffUsers,
  resetStaffPassword,
  updateStaffUser,
  type StaffAccountRecord,
} from "@/services/api/usersApi";
import { FONT_FAMILY, TOKENS } from "@/theme/tokens";
import type { UserRole } from "@/types";

const ROLE_OPTIONS: { id: UserRole; label: string }[] = [
  { id: "kasir", label: "Kasir" },
  { id: "admin", label: "Admin" },
  { id: "owner", label: "Owner" },
];

export default function PengaturanAccountsScreen() {
  const router = useRouter();
  const { user: activeUser, serverConfig } = useAuth();
  const { healthState, isDeviceConnected, dbOnline } = useSystemStatus();

  const [accounts, setAccounts] = useState<StaffAccountRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [banner, setBanner] = useState<{
    variant: "success" | "error";
    message: string;
  } | null>(null);

  // Add / Edit modal state
  const [editorState, setEditorState] = useState<{
    mode: "create" | "edit";
    target?: StaffAccountRecord;
  } | null>(null);
  const [formUsername, setFormUsername] = useState<string>("");
  const [formFullName, setFormFullName] = useState<string>("");
  const [formPassword, setFormPassword] = useState<string>("");
  const [formRole, setFormRole] = useState<UserRole>("kasir");
  const [formActive, setFormActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Reset Password modal state
  const [resetTarget, setResetTarget] = useState<StaffAccountRecord | null>(
    null
  );
  const [newPassword, setNewPassword] = useState<string>("");

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<StaffAccountRecord | null>(
    null
  );

  const canWriteOnline =
    isDeviceConnected &&
    dbOnline &&
    healthState !== "offline" &&
    healthState !== "read_only";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetchStaffUsers(serverConfig);
        if (!active) {
          return;
        }
        if (res.ok) {
          setAccounts(res.users);
        } else {
          setBanner({
            variant: "error",
            message: res.error ?? "Gagal memuat akun staf.",
          });
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [serverConfig]);

  const reloadAccounts = async () => {
    const res = await fetchStaffUsers(serverConfig);
    if (res.ok) {
      setAccounts(res.users);
    }
  };

  const openCreateModal = () => {
    setFormUsername("");
    setFormFullName("");
    setFormPassword("");
    setFormRole("kasir");
    setFormActive(true);
    setEditorState({ mode: "create" });
  };

  const openEditModal = (acc: StaffAccountRecord) => {
    setFormUsername(acc.username);
    setFormFullName(acc.fullName);
    setFormPassword("");
    setFormRole(acc.role);
    setFormActive(acc.isActive);
    setEditorState({ mode: "edit", target: acc });
  };

  const handleSaveAccount = async () => {
    if (!editorState || isSubmitting || !canWriteOnline) {
      return;
    }
    if (!formFullName.trim()) {
      setBanner({ variant: "error", message: "Nama lengkap wajib diisi." });
      return;
    }
    if (
      editorState.mode === "create" &&
      (!formUsername.trim() || formPassword.length < 6)
    ) {
      setBanner({
        variant: "error",
        message: "Username dan kata sandi (minimal 6 karakter) wajib diisi.",
      });
      return;
    }

    setIsSubmitting(true);
    setBanner(null);
    try {
      const res =
        editorState.mode === "create"
          ? await createStaffUser(serverConfig, {
              username: formUsername.trim(),
              fullName: formFullName.trim(),
              password: formPassword,
              role: formRole,
            })
          : await updateStaffUser(serverConfig, editorState.target!.id, {
              fullName: formFullName.trim(),
              role: formRole,
              isActive: formActive,
            });

      if (res.ok) {
        setEditorState(null);
        await reloadAccounts();
        setBanner({
          variant: "success",
          message:
            editorState.mode === "create"
              ? "Akun staf berhasil ditambahkan."
              : "Data akun staf diperbarui.",
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menyimpan data akun.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget || isSubmitting || !canWriteOnline) {
      return;
    }
    if (newPassword.length < 6) {
      setBanner({
        variant: "error",
        message: "Kata sandi baru minimal 6 karakter.",
      });
      return;
    }
    setIsSubmitting(true);
    setBanner(null);
    try {
      const res = await resetStaffPassword(
        serverConfig,
        resetTarget.id,
        newPassword
      );
      if (res.ok) {
        setResetTarget(null);
        setNewPassword("");
        setBanner({
          variant: "success",
          message: `Kata sandi @${resetTarget.username} berhasil diubah.`,
        });
      } else {
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal mengatur ulang kata sandi.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deleteTarget || !canWriteOnline || isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setBanner(null);
    try {
      const res = await deleteStaffUser(serverConfig, deleteTarget.id);
      if (res.ok) {
        const deletedUsername = deleteTarget.username;
        setDeleteTarget(null);
        await reloadAccounts();
        setBanner({
          variant: "success",
          message: `Akun @${deletedUsername} dihapus.`,
        });
      } else {
        setDeleteTarget(null);
        setBanner({
          variant: "error",
          message: res.error ?? "Gagal menghapus akun staf.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <ChevronLeft size={22} color={TOKENS.colors.onSurface} />
        </Pressable>
        <Text style={styles.topTitle}>Akun &amp; Peran Staf</Text>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {banner ? (
          <FeedbackBanner
            testID="accounts-feedback-banner"
            variant={banner.variant}
            message={banner.message}
          />
        ) : null}

        {/* Tombol 1 Baris Penuh di Paling Atas Halaman: Tambah Akun */}
        <PrimaryButton
          testID="accounts-add-button"
          label="Tambah Akun"
          disabled={!canWriteOnline}
          icon={<UserPlus size={18} color={TOKENS.colors.onPrimary} />}
          onPress={openCreateModal}
        />

        {accounts.length === 0 ? (
          <EmptyStateCard
            icon={<Users size={24} color={TOKENS.colors.primary} />}
            title={isLoading ? "Memuat Daftar Akun..." : "Belum Ada Akun Staf"}
            description="Tambahkan akun kasir, admin, atau owner untuk mengatur akses aplikasi."
          />
        ) : (
          accounts.map((acc) => {
            const isSelf =
              acc.id === activeUser?.id ||
              (Boolean(activeUser?.username) &&
                acc.username.toLowerCase() ===
                  activeUser?.username.toLowerCase());
            const deleteDisabled = isSelf || !canWriteOnline || isSubmitting;

            return (
              <SurfaceCard
                key={acc.id}
                testID={`account-card-${acc.username}`}
                style={styles.card}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.identityCol}>
                    <View style={styles.nameLine}>
                      <Text style={styles.accName}>{acc.fullName}</Text>
                      {isSelf ? (
                        <Text style={styles.selfBadge}>Anda</Text>
                      ) : null}
                    </View>
                    <Text style={styles.accUsername}>{`@${acc.username}`}</Text>
                  </View>
                  <View style={styles.badgesCol}>
                    <RoleBadge role={acc.role} />
                    {!acc.isActive ? (
                      <Text style={styles.inactiveChip}>Nonaktif</Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.actionsRow}>
                  <SecondaryButton
                    testID={`account-edit-${acc.username}`}
                    variant="tonal"
                    label="Ubah"
                    disabled={!canWriteOnline || isSubmitting}
                    icon={
                      <Pencil size={15} color={TOKENS.colors.onPrimaryFixed} />
                    }
                    onPress={() => openEditModal(acc)}
                    style={styles.actionBtn}
                  />
                  <SecondaryButton
                    testID={`account-reset-pw-${acc.username}`}
                    variant="outlined"
                    label="Sandi"
                    disabled={!canWriteOnline || isSubmitting}
                    icon={<KeyRound size={15} color={TOKENS.colors.primary} />}
                    onPress={() => {
                      setNewPassword("");
                      setResetTarget(acc);
                    }}
                    style={styles.actionBtn}
                  />
                  <Pressable
                    testID={`account-delete-${acc.username}`}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isSelf
                        ? `Akun sendiri @${acc.username} tidak dapat dihapus`
                        : `Hapus akun @${acc.username}`
                    }
                    accessibilityState={{ disabled: deleteDisabled }}
                    disabled={deleteDisabled}
                    onPress={() => {
                      if (!isSelf) {
                        setDeleteTarget(acc);
                      }
                    }}
                    style={[
                      styles.deleteBtn,
                      deleteDisabled && styles.deleteBtnDisabled,
                    ]}
                  >
                    <Trash2
                      size={18}
                      color={
                        deleteDisabled
                          ? TOKENS.colors.outline
                          : TOKENS.colors.destructive
                      }
                    />
                  </Pressable>
                </View>
              </SurfaceCard>
            );
          })
        )}
      </ScrollView>

      {/* Modal Tambah / Ubah Akun (Tombol Sebaris: Kiri Batal, Kanan Simpan) */}
      <Modal
        visible={editorState !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setEditorState(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setEditorState(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editorState?.mode === "create"
                ? "Tambah Akun Staf Baru"
                : `Ubah Akun @${editorState?.target?.username ?? ""}`}
            </Text>

            {editorState?.mode === "create" ? (
              <InputField
                testID="account-form-username"
                label="Username"
                value={formUsername}
                onChangeText={setFormUsername}
                autoCapitalize="none"
                monospace
              />
            ) : null}

            <InputField
              testID="account-form-fullname"
              label="Nama Lengkap"
              value={formFullName}
              onChangeText={setFormFullName}
            />

            {editorState?.mode === "create" ? (
              <InputField
                testID="account-form-password"
                label="Kata Sandi Awal"
                value={formPassword}
                onChangeText={setFormPassword}
                secureTextEntry
              />
            ) : null}

            <Text style={styles.fieldLabel}>Peran (Role)</Text>
            <View style={styles.roleChips}>
              {ROLE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.id}
                  onPress={() => setFormRole(opt.id)}
                  style={[
                    styles.roleChip,
                    formRole === opt.id && styles.roleChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      formRole === opt.id && styles.roleChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {editorState?.mode === "edit" ? (
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Status Akun Aktif</Text>
                <Switch value={formActive} onValueChange={setFormActive} />
              </View>
            ) : null}

            <View style={styles.modalActionsRow}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                disabled={isSubmitting}
                onPress={() => setEditorState(null)}
                style={styles.modalBtnHalf}
              />
              <PrimaryButton
                testID="account-form-submit"
                label="Simpan"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={() => {
                  void handleSaveAccount();
                }}
                style={styles.modalBtnHalf}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Ubah / Reset Kata Sandi (Tombol Sebaris: Kiri Batal, Kanan Simpan) */}
      <Modal
        visible={resetTarget !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setResetTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.backdrop}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setResetTarget(null)}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {`Ubah Kata Sandi @${resetTarget?.username ?? ""}`}
            </Text>
            <InputField
              testID="account-reset-pw-input"
              label="Kata Sandi Baru (min. 6 karakter)"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <View style={styles.modalActionsRow}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                disabled={isSubmitting}
                onPress={() => setResetTarget(null)}
                style={styles.modalBtnHalf}
              />
              <PrimaryButton
                testID="account-reset-pw-submit"
                label="Simpan"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={() => {
                  void handleResetPassword();
                }}
                style={styles.modalBtnHalf}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal Konfirmasi Hapus Akun (Tombol Sebaris: Kiri Batal, Kanan Hapus) */}
      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setDeleteTarget(null)}
          />
          <View style={styles.modalCard}>
            <View style={styles.deleteHeaderRow}>
              <View style={styles.deleteIconBadge}>
                <Trash2 size={20} color={TOKENS.colors.destructive} />
              </View>
              <Text style={styles.modalTitle}>
                {`Hapus Akun @${deleteTarget?.username ?? ""}?`}
              </Text>
            </View>
            <Text style={styles.deleteBodyText}>
              {`Akun staf "${deleteTarget?.fullName ?? ""}" akan dihapus permanen dari akses aplikasi kasir.`}
            </Text>
            <View style={styles.modalActionsRow}>
              <SecondaryButton
                variant="tonal"
                label="Batal"
                disabled={isSubmitting}
                onPress={() => setDeleteTarget(null)}
                style={styles.modalBtnHalf}
              />
              <SecondaryButton
                testID="account-delete-confirm-button"
                variant="danger"
                label="Ya, Hapus"
                loading={isSubmitting}
                disabled={isSubmitting}
                onPress={() => {
                  void handleConfirmDeleteAccount();
                }}
                style={styles.modalBtnHalf}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TOKENS.colors.background,
  },
  topBar: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: TOKENS.colors.borderSubtle,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: TOKENS.spacing.sm,
    paddingBottom: TOKENS.spacing.sm,
    gap: TOKENS.spacing.sm,
  },
  backBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.heading,
    lineHeight: TOKENS.lineHeight.heading,
    color: TOKENS.colors.onSurface,
  },
  scrollContent: {
    padding: TOKENS.spacing.md,
    gap: TOKENS.spacing.md,
  },
  card: {
    gap: TOKENS.spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: TOKENS.spacing.sm,
  },
  identityCol: {
    flex: 1,
    gap: 2,
  },
  nameLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  accName: {
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  selfBadge: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    color: TOKENS.colors.onPrimaryFixed,
    backgroundColor: TOKENS.colors.primaryFixed,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 6,
  },
  accUsername: {
    fontFamily: FONT_FAMILY.mono,
    fontSize: TOKENS.typography.label,
    lineHeight: TOKENS.lineHeight.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  badgesCol: {
    alignItems: "flex-end",
    gap: TOKENS.spacing.xs,
  },
  inactiveChip: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.destructive,
    backgroundColor: TOKENS.colors.errorContainer,
    paddingHorizontal: TOKENS.spacing.xs,
    borderRadius: TOKENS.radii.sm,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TOKENS.spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  deleteBtn: {
    width: TOKENS.spacing.touchTarget,
    height: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnDisabled: {
    backgroundColor: TOKENS.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    opacity: 0.55,
  },
  backdrop: {
    flex: 1,
    backgroundColor: TOKENS.colors.modalBackdrop,
    justifyContent: "center",
    padding: TOKENS.spacing.md,
  },
  modalCard: {
    backgroundColor: TOKENS.colors.surfaceCard,
    borderRadius: TOKENS.radii.lg,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    padding: TOKENS.spacing.lg,
    gap: TOKENS.spacing.sm,
  },
  modalTitle: {
    flex: 1,
    fontFamily: FONT_FAMILY.heading,
    fontSize: TOKENS.typography.body,
    lineHeight: TOKENS.lineHeight.body,
    color: TOKENS.colors.onSurface,
  },
  fieldLabel: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  roleChips: {
    flexDirection: "row",
    gap: TOKENS.spacing.sm,
  },
  roleChip: {
    flex: 1,
    minHeight: TOKENS.spacing.touchTarget,
    borderRadius: TOKENS.radii.sm,
    borderWidth: 1,
    borderColor: TOKENS.colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  roleChipActive: {
    backgroundColor: TOKENS.colors.primaryFixed,
    borderColor: TOKENS.colors.primary,
  },
  roleChipText: {
    fontFamily: FONT_FAMILY.bodySemiBold,
    fontSize: TOKENS.typography.label,
    color: TOKENS.colors.onSurfaceVariant,
  },
  roleChipTextActive: {
    color: TOKENS.colors.onPrimaryFixed,
  },
  switchRow: {
    minHeight: TOKENS.spacing.touchTarget,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 6,
  },
  modalBtnHalf: {
    flex: 1,
  },
  deleteHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteIconBadge: {
    width: 38,
    height: 38,
    borderRadius: TOKENS.radii.md,
    backgroundColor: TOKENS.colors.errorContainer,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  deleteBodyText: {
    fontFamily: FONT_FAMILY.body,
    fontSize: TOKENS.typography.label,
    lineHeight: 19,
    color: TOKENS.colors.onSurfaceVariant,
  },
});

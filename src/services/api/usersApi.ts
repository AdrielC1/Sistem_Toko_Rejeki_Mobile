import { apiRequestWithFailover } from "@/services/api/apiClient";
import type { ServerUrlConfig, UserRole } from "@/types";

export interface StaffAccountRecord {
  id: string;
  username: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export async function fetchStaffUsers(config: ServerUrlConfig): Promise<{
  ok: boolean;
  users: StaffAccountRecord[];
  error?: string;
}> {
  const res = await apiRequestWithFailover<StaffAccountRecord[]>(
    config,
    "/api/users",
    { method: "GET", timeoutMs: 8000 }
  );

  if (!res.ok || !Array.isArray(res.data)) {
    return {
      ok: false,
      users: [],
      error: res.error ?? "Gagal memuat daftar akun staf.",
    };
  }

  return {
    ok: true,
    users: res.data,
  };
}

export async function createStaffUser(
  config: ServerUrlConfig,
  payload: {
    username: string;
    fullName: string;
    password: string;
    role: UserRole;
  }
): Promise<{ ok: boolean; user: StaffAccountRecord | null; error?: string }> {
  const res = await apiRequestWithFailover<StaffAccountRecord>(
    config,
    "/api/users",
    {
      method: "POST",
      timeoutMs: 10000,
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok || !res.data) {
    return {
      ok: false,
      user: null,
      error: res.error ?? "Gagal menambahkan akun staf baru.",
    };
  }

  return {
    ok: true,
    user: res.data,
  };
}

export async function updateStaffUser(
  config: ServerUrlConfig,
  id: string,
  payload: { fullName?: string; role?: UserRole; isActive?: boolean }
): Promise<{ ok: boolean; user: StaffAccountRecord | null; error?: string }> {
  const res = await apiRequestWithFailover<StaffAccountRecord>(
    config,
    `/api/users/${encodeURIComponent(id)}`,
    {
      method: "PUT",
      timeoutMs: 10000,
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      user: null,
      error: res.error ?? "Gagal memperbarui akun staf.",
    };
  }

  return {
    ok: true,
    user: res.data,
  };
}

export async function resetStaffPassword(
  config: ServerUrlConfig,
  id: string,
  password: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/users/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      timeoutMs: 10000,
      body: JSON.stringify({ password }),
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal mengatur ulang kata sandi akun.",
    };
  }

  return { ok: true };
}

export async function deleteStaffUser(
  config: ServerUrlConfig,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiRequestWithFailover<unknown>(
    config,
    `/api/users/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      timeoutMs: 10000,
    }
  );

  if (!res.ok) {
    return {
      ok: false,
      error: res.error ?? "Gagal menghapus akun staf.",
    };
  }

  return { ok: true };
}

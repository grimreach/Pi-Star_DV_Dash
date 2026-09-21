import { create } from "zustand";
import { api, ApiError } from "../lib/api";

interface AuthState {
  status: "unknown" | "authenticated" | "anonymous";
  username: string | null;
  defaultPassword: boolean;
  error: string | null;
  checkSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Resolves to null on success, or an error message to show. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "unknown",
  username: null,
  defaultPassword: false,
  error: null,

  checkSession: async () => {
    try {
      const data = await api.get<{ user: { username: string }; defaultPassword: boolean }>("/auth/session");
      set({ status: "authenticated", username: data.user.username, defaultPassword: data.defaultPassword });
    } catch {
      set({ status: "anonymous", username: null });
    }
  },

  login: async (username, password) => {
    set({ error: null });
    try {
      const data = await api.post<{ user: { username: string }; defaultPassword: boolean }>("/auth/login", {
        username,
        password,
      });
      set({ status: "authenticated", username: data.user.username, defaultPassword: data.defaultPassword });
      return true;
    } catch (err) {
      set({ error: err instanceof ApiError ? err.message : "Login failed" });
      return false;
    }
  },

  logout: async () => {
    await api.post("/auth/logout");
    set({ status: "anonymous", username: null });
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      await api.post("/auth/password", { currentPassword, newPassword });
      set({ defaultPassword: newPassword === "pi-star" });
      return null;
    } catch (err) {
      return err instanceof ApiError ? err.message : "Password change failed";
    }
  },
}));

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { API_URL } from "@/lib/config";
import type { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** true once persisted state has been read from localStorage (avoids SSR flash). */
  hydrated: boolean;
  setAuth: (data: { user: User; accessToken: string; refreshToken: string }) => void;
  logout: () => void;
  /** Exchanges the refresh token for a new token pair. Returns false if it failed. */
  refresh: () => Promise<boolean>;
}

/**
 * Auth store. Tokens are persisted to localStorage so a refresh of the page
 * keeps you logged in. (Trade-off: localStorage is readable by JS, so it's
 * vulnerable to XSS — acceptable for this local learning project; a production
 * build would prefer httpOnly cookies via a same-origin proxy.)
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      setAuth: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) return false;
        try {
          const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: rt }),
          });
          if (!res.ok) {
            set({ user: null, accessToken: null, refreshToken: null });
            return false;
          }
          const data = await res.json();
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: "clever-sloth-auth",
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    },
  ),
);

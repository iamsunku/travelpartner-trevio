"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User, ViewKey } from "@/types";
import { ROLE_USERS } from "@/lib/mock-data";
import { api } from "@/lib/api";
import { mapApiUser } from "@/lib/api-mappers";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  apiConnected: boolean;
  login: (role: Role) => void;
  loginWithApi: (role: Role) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: Role) => void;
  setApiConnected: (connected: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      apiConnected: false,
      login: (role) =>
        set({
          user: ROLE_USERS[role],
          token: null,
          isAuthenticated: true,
        }),
      loginWithApi: async (role) => {
        const fallback = ROLE_USERS[role];
        try {
          const { user, token } = await api.login(fallback.email, role);
          set({
            user: mapApiUser(user),
            token,
            isAuthenticated: true,
            apiConnected: true,
          });
          return true;
        } catch {
          set({
            user: fallback,
            token: null,
            isAuthenticated: true,
            apiConnected: false,
          });
          return false;
        }
      },
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          apiConnected: false,
        }),
      switchRole: (role) =>
        set({
          user: ROLE_USERS[role],
          isAuthenticated: true,
        }),
      setApiConnected: (connected) => set({ apiConnected: connected }),
    }),
    { name: "tpp-auth" }
  )
);

interface AppState {
  activeView: ViewKey;
  sidebarOpen: boolean;
  theme: "light" | "dark";
  setView: (view: ViewKey) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark") => void;
  syncViewFromUrl: () => void;
}

function updateUrlView(view: ViewKey) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  window.history.replaceState({}, "", url.toString());
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeView: "dashboard",
      sidebarOpen: false,
      theme: "light",
      setView: (view) => {
        set({ activeView: view, sidebarOpen: false });
        updateUrlView(view);
      },
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
      syncViewFromUrl: () => {
        if (typeof window === "undefined") return;
        const view = new URLSearchParams(window.location.search).get("view") as ViewKey | null;
        if (view && view !== get().activeView) {
          set({ activeView: view });
        } else if (!view) {
          updateUrlView(get().activeView);
        }
      },
    }),
    { name: "tpp-app" }
  )
);

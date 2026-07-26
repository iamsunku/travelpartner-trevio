"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, ViewKey } from "@/types";
import { api, ApiError } from "@/lib/api";
import { mapApiUser } from "@/lib/api-mappers";
import { SEARCH_ITEMS } from "@/lib/search-config";
import { pushRecentView } from "@/lib/recent-views";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  apiConnected: boolean;
  loginWithApi: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setApiConnected: (connected: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      apiConnected: false,
      loginWithApi: async (email, password) => {
        try {
          const { user, token } = await api.login(email, password);
          set({
            user: mapApiUser(user),
            token,
            isAuthenticated: true,
            apiConnected: true,
          });
          return { ok: true };
        } catch (e) {
          const message = e instanceof ApiError ? e.message : "Unable to reach the server. Please try again.";
          return { ok: false, error: message };
        }
      },
      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          apiConnected: false,
        }),
      setApiConnected: (connected) => set({ apiConnected: connected }),
    }),
    { name: "tpp-auth" }
  )
);

interface AppState {
  activeView: ViewKey;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  setView: (view: ViewKey) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
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
      sidebarCollapsed: false,
      theme: "light",
      setView: (view) => {
        const label = SEARCH_ITEMS.find((s) => s.key === view)?.label ?? view;
        pushRecentView(view, label);
        set({ activeView: view, sidebarOpen: false });
        updateUrlView(view);
      },
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
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

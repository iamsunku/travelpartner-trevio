"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Role, User, ViewKey } from "@/types";
import { ROLE_USERS } from "@/lib/mock-data";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (role: Role) => void;
  logout: () => void;
  switchRole: (role: Role) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (role) =>
        set({
          user: ROLE_USERS[role],
          isAuthenticated: true,
        }),
      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
        }),
      switchRole: (role) =>
        set({
          user: ROLE_USERS[role],
          isAuthenticated: true,
        }),
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeView: "dashboard",
      sidebarOpen: false,
      theme: "light",
      setView: (view) => set({ activeView: view, sidebarOpen: false }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setTheme: (theme) => set({ theme }),
    }),
    { name: "tpp-app" }
  )
);

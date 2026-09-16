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
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            apiConnected: false,
          });
          const message = e instanceof ApiError ? e.message : "Unable to reach the server. Please try again.";
          return { ok: false, error: message };
        }
      },
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          apiConnected: false,
        });
        try {
          localStorage.removeItem("tpp-auth");
        } catch {
          /* ignore */
        }
      },
      setApiConnected: (connected) => set({ apiConnected: connected }),
    }),
    {
      name: "tpp-auth",
      partialize: (s) => ({ user: s.user, token: s.token }),
    }
  )
);

interface AppState {
  activeView: ViewKey;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  theme: "light" | "dark";
  quotePrefill: QuotePrefill | null;
  wizardQuotationId: string | null;
  setView: (view: ViewKey) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setTheme: (theme: "light" | "dark") => void;
  setQuotePrefill: (prefill: QuotePrefill | null) => void;
  setWizardQuotationId: (id: string | null) => void;
  openQuotationWizard: (quotationId?: string | null) => void;
  closeQuotationWizard: () => void;
  syncViewFromUrl: () => void;
}

export type QuotePrefill = {
  leadId?: string;
  customerName?: string;
  contactEmail?: string;
  contactPhone?: string;
  service?: string;
  budget?: number;
  enquiryRef?: string;
  destination?: string;
};

function updateUrlView(view: ViewKey, quoteId?: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  if (view === "quotation-wizard" && quoteId) {
    url.searchParams.set("quoteId", quoteId);
  } else {
    url.searchParams.delete("quoteId");
  }
  window.history.replaceState({}, "", url.toString());
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeView: "dashboard",
      sidebarOpen: false,
      sidebarCollapsed: false,
      theme: "light",
      quotePrefill: null,
      wizardQuotationId: null,
      setView: (view) => {
        const label = SEARCH_ITEMS.find((s) => s.key === view)?.label ?? view;
        pushRecentView(view, label);
        const quoteId = view === "quotation-wizard" ? get().wizardQuotationId : null;
        set({
          activeView: view,
          sidebarOpen: false,
          ...(view !== "quotation-wizard"
            ? { wizardQuotationId: null, quotePrefill: null }
            : {}),
        });
        updateUrlView(view, quoteId);
      },
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setQuotePrefill: (prefill) => set({ quotePrefill: prefill }),
      setWizardQuotationId: (id) => {
        set({ wizardQuotationId: id });
        if (get().activeView === "quotation-wizard") {
          updateUrlView("quotation-wizard", id);
        }
      },
      openQuotationWizard: (quotationId) => {
        const id = quotationId || null;
        set({
          activeView: "quotation-wizard",
          wizardQuotationId: id,
          sidebarOpen: false,
        });
        updateUrlView("quotation-wizard", id);
        pushRecentView("quotation-wizard", id ? "Edit quotation" : "New quotation");
      },
      closeQuotationWizard: () => {
        set({
          activeView: "quotations",
          wizardQuotationId: null,
          quotePrefill: null,
          sidebarOpen: false,
        });
        updateUrlView("quotations", null);
      },
      syncViewFromUrl: () => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        const view = params.get("view") as ViewKey | null;
        const quoteId = params.get("quoteId");
        if (view && view !== get().activeView) {
          set({
            activeView: view,
            wizardQuotationId: view === "quotation-wizard" ? (quoteId || null) : null,
          });
        } else if (view === "quotation-wizard" && quoteId !== get().wizardQuotationId) {
          set({ wizardQuotationId: quoteId || null });
        } else if (!view) {
          updateUrlView(get().activeView, get().wizardQuotationId);
        }
      },
    }),
    {
      name: "tpp-app",
      partialize: (s) => ({
        activeView: s.activeView,
        sidebarCollapsed: s.sidebarCollapsed,
        theme: s.theme,
        // Do not persist wizard id — reopen from list / URL only
      }),
    }
  )
);

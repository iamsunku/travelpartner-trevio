"use client";

import { useAuthStore } from "@/store/app-store";
import { LoginScreen } from "@/components/auth/login-screen";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";

export default function Home() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <ThemeProvider>
      {isAuthenticated ? <AppShell /> : <LoginScreen />}
    </ThemeProvider>
  );
}

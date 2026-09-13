"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/app-store";
import { LoginScreen } from "@/components/auth/login-screen";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/shared/theme-provider";

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsub = useAuthStore.persist.onFinishHydration(finish);
    if (useAuthStore.persist.hasHydrated()) finish();
    return unsub;
  }, []);

  return (
    <ThemeProvider>
      {!hydrated ? (
        <div className="min-h-screen bg-background" aria-busy="true" />
      ) : isAuthenticated ? (
        <AppShell />
      ) : (
        <LoginScreen />
      )}
    </ThemeProvider>
  );
}

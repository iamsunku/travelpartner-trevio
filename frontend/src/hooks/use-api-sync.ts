"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { checkApiHealth } from "@/lib/api";

/** Loads live data from the backend when authenticated and API is reachable. */
export function useApiSync() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const setApiConnected = useAuthStore((s) => s.setApiConnected);
  const hydrateFromApi = useDemoDataStore((s) => s.hydrateFromApi);
  const ran = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      ran.current = false;
      return;
    }
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const healthy = await checkApiHealth();
      setApiConnected(healthy);
      if (healthy) {
        await hydrateFromApi(user?.agencyId);
      }
    })();
  }, [isAuthenticated, user?.agencyId, hydrateFromApi, setApiConnected]);
}

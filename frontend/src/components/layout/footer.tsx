"use client";

import { useAppStore } from "@/store/app-store";

export function Footer() {
  const setView = useAppStore((s) => s.setView);

  return (
    <footer className="mt-auto border-t border-border bg-muted/30 px-4 lg:px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src="/trevio-logo.png" alt="Trevio Global" className="h-5 w-auto" />
          <span>© 2026 Trevio Global · All rights reserved</span>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" className="hover:text-foreground transition-colors" onClick={() => setView("settings")}>
            Privacy
          </button>
          <button type="button" className="hover:text-foreground transition-colors" onClick={() => setView("settings")}>
            Terms
          </button>
          <button type="button" className="hover:text-foreground transition-colors" onClick={() => setView("support")}>
            Support
          </button>
          <span>Powered by Trevio Global Platform</span>
        </div>
      </div>
    </footer>
  );
}

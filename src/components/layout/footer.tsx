"use client";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30 px-4 lg:px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <img src="/trevio-logo.png" alt="Trevio Global" className="h-5 w-auto" />
          <span>© 2025 Trevio Global · All rights reserved</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          <a href="#" className="hover:text-foreground transition-colors">Support</a>
          <span>Powered by Trevio Global Platform</span>
        </div>
      </div>
    </footer>
  );
}

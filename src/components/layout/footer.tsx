"use client";

import { Globe, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/30 px-4 lg:px-6 py-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
            <Globe className="w-3 h-3 text-white" />
          </div>
          <span>© 2025 Travel Partner Pro · All rights reserved</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
          <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          <a href="#" className="hover:text-foreground transition-colors">Support</a>
          <span className="flex items-center gap-1">
            Built with <Heart className="w-3 h-3 text-rose-500 fill-rose-500" /> for travel agents
          </span>
        </div>
      </div>
    </footer>
  );
}

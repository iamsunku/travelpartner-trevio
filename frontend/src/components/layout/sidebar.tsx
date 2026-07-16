"use client";

import { X } from "lucide-react";
import { useAppStore, useAuthStore } from "@/store/app-store";
import { getNavForUser } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function Sidebar() {
  const { activeView, setView, sidebarOpen, setSidebarOpen } = useAppStore();
  const { user } = useAuthStore();

  if (!user) return null;
  const sections = getNavForUser(user);

  return (
    <>
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-[260px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-sidebar-border shrink-0">
          <img src="/trevio-logo.png" alt="Trevio Global" className="h-8 w-auto" />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-4 scroll-thin">
          <div className="space-y-6 pb-4">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="px-2.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/65">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const active = activeView === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => setView(item.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all relative group",
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent"
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-white/90" />
                        )}
                        <item.icon
                          className={cn(
                            "w-[18px] h-[18px] shrink-0",
                            active ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge && (
                          <Badge
                            variant={active ? "secondary" : "default"}
                            className="text-[9px] h-4 px-1.5 bg-rose-500 text-white border-0"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {user.role !== "super_admin" && (
          <div className="p-3 border-t border-sidebar-border shrink-0">
            <div className="rounded-xl bg-gradient-to-br from-[#2A7BBD] to-[#00A79D] p-3.5 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
              <p className="text-[11px] font-semibold relative tracking-tight">Enterprise Plan</p>
              <p className="text-[10px] text-white/80 mt-0.5 relative leading-relaxed">Unlock unlimited API calls</p>
              <Button size="sm" variant="secondary" className="w-full mt-2.5 h-7 text-xs bg-white text-[#2A7BBD] hover:bg-white/90">
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe, ChevronDown, LogOut, X, Sparkles,
} from "lucide-react";
import { useAppStore, useAuthStore } from "@/store/app-store";
import { getNavForRole, ROLE_LABELS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { avatarGradient, initials } from "@/components/shared/ui-helpers";
import type { Role } from "@/types";

const ALL_ROLES: Role[] = ["super_admin", "agency_admin", "branch_manager", "employee", "accountant", "customer"];

export function Sidebar() {
  const { activeView, setView, sidebarOpen, setSidebarOpen } = useAppStore();
  const { user, switchRole, logout } = useAuthStore();
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false);

  if (!user) return null;
  const sections = getNavForRole(user.role);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-[270px] shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-sm">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">Travel Partner</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Pro Platform</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User card with role switcher */}
        <div className="p-3 border-b border-sidebar-border shrink-0 relative">
          <button
            onClick={() => setRoleSwitcherOpen(!roleSwitcherOpen)}
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left"
          >
            <Avatar className="w-9 h-9 border border-sidebar-border">
              <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs font-semibold", avatarGradient(user.name))}>
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{ROLE_LABELS[user.role]}</p>
            </div>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", roleSwitcherOpen && "rotate-180")} />
          </button>

          <AnimatePresence>
            {roleSwitcherOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-1"
              >
                <div className="rounded-lg border border-sidebar-border bg-popover p-1.5 space-y-0.5">
                  <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Switch role (demo)
                  </p>
                  {ALL_ROLES.map((r) => (
                    <button
                      key={r}
                      onClick={() => { switchRole(r); setRoleSwitcherOpen(false); setView("dashboard"); }}
                      className={cn(
                        "w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-sidebar-accent transition-colors flex items-center justify-between",
                        r === user.role && "bg-primary/10 text-primary font-medium"
                      )}
                    >
                      {ROLE_LABELS[r]}
                      {r === user.role && <Badge variant="secondary" className="text-[9px] h-4 px-1">current</Badge>}
                    </button>
                  ))}
                  <div className="h-px bg-sidebar-border my-1" />
                  <button
                    onClick={logout}
                    className="w-full text-left px-2 py-1.5 rounded-md text-xs hover:bg-rose-50 dark:hover:bg-rose-500/10 text-rose-600 flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-3 scroll-thin">
          <nav className="space-y-5 pb-4">
            {sections.map((section) => (
              <div key={section.title}>
                <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
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
                        <item.icon className={cn("w-[18px] h-[18px] shrink-0", active ? "text-sidebar-primary-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                        <span className="flex-1 text-left truncate">{item.label}</span>
                        {item.badge && (
                          <Badge variant={active ? "secondary" : "default"} className="text-[9px] h-4 px-1.5 bg-rose-500 text-white border-0">
                            {item.badge}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer upgrade card */}
        {user.role !== "super_admin" && user.role !== "customer" && (
          <div className="p-3 border-t border-sidebar-border shrink-0">
            <div className="rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 p-3 text-white relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/10" />
              <p className="text-xs font-semibold relative">Enterprise Plan</p>
              <p className="text-[10px] text-teal-50 mt-0.5 relative">Unlock unlimited API calls</p>
              <Button size="sm" variant="secondary" className="w-full mt-2 h-7 text-xs bg-white text-teal-700 hover:bg-teal-50">
                Upgrade Plan
              </Button>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

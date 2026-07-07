"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Search,
  Bell,
  Moon,
  Sun,
  ChevronDown,
  LogOut,
  UserCircle,
  Settings,
  MessageSquare,
  Menu,
  Sparkles,
} from "lucide-react";
import { useAppStore, useAuthStore } from "@/store/app-store";
import { ROLE_LABELS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { avatarGradient, initials } from "@/components/shared/ui-helpers";
import { useDemoDataStore } from "@/store/demo-data-store";
import type { Role } from "@/types";

const ALL_ROLES: Role[] = ["super_admin", "agency_admin", "branch_manager", "employee", "accountant"];

export function Topbar() {
  const { toggleSidebar, setView } = useAppStore();
  const { user, logout, switchRole } = useAuthStore();
  const notifications = useDemoDataStore((s) => s.notifications);
  const markNotificationRead = useDemoDataStore((s) => s.markNotificationRead);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!user) return null;

  const unread = notifications.filter((n) => !n.read).length;
  const isDark = mounted && (resolvedTheme === "dark" || theme === "dark");

  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-30 h-14 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center h-full px-4 lg:px-6 gap-3">
          <button
            onClick={toggleSidebar}
            className="lg:hidden shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            className="relative w-full max-w-md min-w-0 hidden sm:block cursor-pointer"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              readOnly
              placeholder="Search bookings, customers, flights..."
              className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary cursor-pointer"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden lg:block pointer-events-none">
              ⌘K
            </kbd>
          </div>

          <div className="flex-1 min-w-4" aria-hidden />

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setView("support")}
                >
                  <MessageSquare className="w-[18px] h-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Messages</TooltipContent>
            </Tooltip>

            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 relative text-muted-foreground hover:text-foreground"
                    >
                      <Bell className="w-[18px] h-[18px]" />
                      {unread > 0 && (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 pulse-dot" />
                      )}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Notifications</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-[360px] p-0" align="end" sideOffset={8}>
                <div className="p-3 border-b border-border flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">Notifications</p>
                    <p className="text-xs text-muted-foreground">{unread} unread</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setView("notifications")}>
                    View all
                  </Button>
                </div>
                <ScrollArea className="h-[360px] scroll-thin">
                  <div className="divide-y divide-border">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={cn("p-3 hover:bg-muted/50 cursor-pointer flex gap-2.5", !n.read && "bg-primary/5")}
                    onClick={() => markNotificationRead(n.id)}
                  >
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full mt-1.5 shrink-0",
                            n.priority === "high" ? "bg-rose-500" : n.priority === "medium" ? "bg-amber-500" : "bg-slate-400"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={toggleTheme}
                >
                  {mounted && isDark ? (
                    <Sun className="w-[18px] h-[18px]" />
                  ) : (
                    <Moon className="w-[18px] h-[18px]" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isDark ? "Light mode" : "Dark mode"}</TooltipContent>
            </Tooltip>

            <div className="hidden sm:block w-px h-6 bg-border mx-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-lg hover:bg-muted transition-colors">
                  <Avatar className="w-8 h-8 border border-border">
                    <AvatarFallback
                      className={cn("bg-gradient-to-br text-white text-xs font-semibold", avatarGradient(user.name))}
                    >
                      {initials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block text-left">
                    <p className="text-xs font-semibold leading-tight">{user.name}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{ROLE_LABELS[user.role]}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground hidden md:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{user.name}</span>
                    <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setView("settings")}>
                  <UserCircle className="w-4 h-4 mr-2" /> My Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("settings")}>
                  <Settings className="w-4 h-4 mr-2" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Sparkles className="w-4 h-4 mr-2" /> Switch role (demo)
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {ALL_ROLES.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => {
                          switchRole(r);
                          setView("dashboard");
                        }}
                        className="flex items-center justify-between"
                      >
                        {ROLE_LABELS[r]}
                        {r === user.role && (
                          <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-2">
                            current
                          </Badge>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-600">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}

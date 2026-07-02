"use client";

import { useState } from "react";
import {
  Menu, Search, Bell, Moon, Sun, ChevronDown, LogOut, UserCircle,
  Settings, MessageSquare, Menu as MenuIcon, X,
} from "lucide-react";
import { useAppStore, useAuthStore } from "@/store/app-store";
import { ROLE_LABELS } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { avatarGradient, initials, StatusBadge } from "@/components/shared/ui-helpers";
import { NOTIFICATIONS } from "@/lib/mock-data";

export function Topbar() {
  const { toggleSidebar, activeView, setView } = useAppStore();
  const { user, logout } = useAuthStore();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  if (!user) return null;
  const unread = NOTIFICATIONS.filter((n) => !n.read).length;

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 lg:px-6">
      <button
        onClick={toggleSidebar}
        className="lg:hidden text-muted-foreground hover:text-foreground"
      >
        <MenuIcon className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-md hidden sm:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search bookings, customers, flights..."
          className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 hidden md:block">⌘K</kbd>
      </div>

      <div className="flex-1 sm:hidden" />

      {/* Right actions */}
      <div className="flex items-center gap-1.5">
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setView("support")}>
          <MessageSquare className="w-[18px] h-[18px]" />
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative">
              <Bell className="w-[18px] h-[18px]" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 pulse-dot" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[360px] p-0" align="end">
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
                {NOTIFICATIONS.map((n) => (
                  <div
                    key={n.id}
                    className={cn("p-3 hover:bg-muted/50 cursor-pointer flex gap-2.5", !n.read && "bg-primary/5")}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      n.priority === "high" ? "bg-rose-500" : n.priority === "medium" ? "bg-amber-500" : "bg-slate-400"
                    )} />
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

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleTheme}>
          {theme === "light" ? <Moon className="w-[18px] h-[18px]" /> : <Sun className="w-[18px] h-[18px]" />}
        </Button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-muted transition-colors">
              <Avatar className="w-8 h-8 border border-border">
                <AvatarFallback className={cn("bg-gradient-to-br text-white text-xs font-semibold", avatarGradient(user.name))}>
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
            <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-600">
              <LogOut className="w-4 h-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

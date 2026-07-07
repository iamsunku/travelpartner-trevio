"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { getNavForRole } from "@/lib/nav-config";
import { filterSearchItems } from "@/lib/search-config";
import { useAuthStore } from "@/store/app-store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { ViewKey } from "@/types";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const setView = useAppStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);

  const allowedViews = useMemo(() => {
    if (!user) return [] as ViewKey[];
    return getNavForRole(user.role).flatMap((s) => s.items.map((i) => i.key));
  }, [user]);

  const results = useMemo(() => filterSearchItems(query, allowedViews), [query, allowedViews]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof results>();
    results.forEach((item) => {
      const list = map.get(item.section) ?? [];
      list.push(item);
      map.set(item.section, list);
    });
    return map;
  }, [results]);

  const navigate = useCallback(
    (key: ViewKey) => {
      setView(key);
      setOpen(false);
      setQuery("");
    },
    [setView]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (!user) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search Trevio" description="Jump to any module">
      <CommandInput placeholder="Search modules, bookings, customers..." value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Array.from(grouped.entries()).map(([section, items], idx) => (
          <div key={section}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={section}>
              {items.map((item) => (
                <CommandItem key={item.key} value={`${item.label} ${item.keywords.join(" ")}`} onSelect={() => navigate(item.key)}>
                  <item.icon className="w-4 h-4 mr-2 text-muted-foreground" />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function useGlobalSearch() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

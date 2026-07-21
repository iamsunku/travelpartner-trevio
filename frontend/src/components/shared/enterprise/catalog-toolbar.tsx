"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CatalogToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** When false, renders inline without Card wrapper */
  bordered?: boolean;
}

export function CatalogToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters,
  actions,
  className,
  bordered = true,
}: CatalogToolbarProps) {
  const inner = (
    <div className={cn("flex flex-col sm:flex-row gap-3 sm:items-center", className)}>
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
        <Input
          className="pl-9 h-9"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={searchPlaceholder}
        />
      </div>
      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
      {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );

  if (!bordered) return inner;

  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="p-4">{inner}</CardContent>
    </Card>
  );
}

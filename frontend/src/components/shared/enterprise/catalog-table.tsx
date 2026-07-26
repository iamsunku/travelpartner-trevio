"use client";

import { TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface CatalogTableProps {
  children: React.ReactNode;
  className?: string;
  /** Max height with vertical scroll; omit for natural height */
  maxHeight?: string | false;
}

export function CatalogTable({ children, className, maxHeight = "60vh" }: CatalogTableProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-[var(--shadow-card)] overflow-x-auto scroll-thin",
        maxHeight && "overflow-y-auto",
        className
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}

export function CatalogTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHeader
      className={cn(
        "sticky top-0 bg-card/95 backdrop-blur-sm z-10 [&_tr]:border-border [&_th]:h-11 [&_th]:text-helper [&_th]:font-semibold [&_th]:text-muted-foreground [&_th]:uppercase [&_th]:tracking-wide",
        className
      )}
    >
      {children}
    </TableHeader>
  );
}

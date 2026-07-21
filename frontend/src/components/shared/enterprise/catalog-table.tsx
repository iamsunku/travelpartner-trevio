"use client";

import { TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface CatalogTableProps {
  children: React.ReactNode;
  className?: string;
  /** Max height with vertical scroll; omit for natural height */
  maxHeight?: string;
}

export function CatalogTable({ children, className, maxHeight = "60vh" }: CatalogTableProps) {
  return (
    <div
      className={cn("rounded-lg border border-border/80 overflow-x-auto scroll-thin", maxHeight && "overflow-y-auto", className)}
      style={maxHeight ? { maxHeight } : undefined}
    >
      {children}
    </div>
  );
}

export function CatalogTableHead({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHeader className={cn("sticky top-0 bg-card z-10 shadow-[0_1px_0_0_hsl(var(--border))]", className)}>
      {children}
    </TableHeader>
  );
}

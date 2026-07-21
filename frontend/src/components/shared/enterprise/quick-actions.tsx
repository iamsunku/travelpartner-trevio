"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface QuickActionItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  variant?: "default" | "primary" | "destructive";
  disabled?: boolean;
}

export function QuickActionsBar({
  actions,
  className,
  label = "Quick actions",
}: {
  actions: QuickActionItem[];
  className?: string;
  label?: string;
}) {
  if (!actions.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="toolbar" aria-label={label}>
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              "disabled:opacity-50 disabled:pointer-events-none",
              action.variant === "primary"
                ? "border-[#2A7BBD] bg-[#2A7BBD]/10 text-[#2A7BBD] hover:bg-[#2A7BBD]/15"
                : action.variant === "destructive"
                  ? "border-destructive/30 text-destructive hover:bg-destructive/5"
                  : "border-border/80 bg-card hover:bg-muted/50 text-foreground/90"
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

export function WorkflowLinks({
  items,
  className,
}: {
  items: { label: string; onClick: () => void }[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav className={cn("flex flex-wrap items-center gap-1 text-xs text-muted-foreground", className)} aria-label="Workflow">
      {items.map((item, i) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          {i > 0 && <span aria-hidden>→</span>}
          <button type="button" onClick={item.onClick} className="text-[#2A7BBD] hover:underline font-medium">
            {item.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

"use client";

import {
  CheckCircle, Edit, FileText, GitBranch, MessageSquare, Plus, Send, Shield, User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ActivityTimelineAction =
  | "created"
  | "updated"
  | "edited"
  | "status_changed"
  | "note"
  | "approval"
  | "proposal_created"
  | "sent"
  | "viewed"
  | "assigned"
  | "archived"
  | "duplicated"
  | string;

export interface ActivityTimelineItem {
  id: string;
  action: ActivityTimelineAction;
  summary?: string | null;
  createdByName?: string | null;
  createdAt: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  versionNumber?: number | null;
}

const ACTION_META: Record<string, { icon: LucideIcon; label: string; color: string }> = {
  created: { icon: Plus, label: "Created", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  updated: { icon: Edit, label: "Updated", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" },
  edited: { icon: Edit, label: "Edited", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" },
  status_changed: { icon: GitBranch, label: "Status changed", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" },
  note: { icon: MessageSquare, label: "Note", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  approval: { icon: Shield, label: "Approval", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" },
  proposal_created: { icon: FileText, label: "Proposal created", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400" },
  sent: { icon: Send, label: "Sent", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400" },
  viewed: { icon: User, label: "Viewed", color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400" },
  assigned: { icon: User, label: "Assigned", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400" },
  activated: { icon: CheckCircle, label: "Activated", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  archived: { icon: FileText, label: "Archived", color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400" },
  duplicated: { icon: FileText, label: "Duplicated", color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400" },
  version_saved: { icon: Edit, label: "Version saved", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400" },
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function actionLabel(action: string) {
  return ACTION_META[action]?.label ?? action.replace(/_/g, " ");
}

export function ActivityTimeline({
  items,
  emptyMessage = "No activity yet",
  className,
  compact,
}: {
  items: ActivityTimelineItem[];
  emptyMessage?: string;
  className?: string;
  compact?: boolean;
}) {
  if (!items.length) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{emptyMessage}</p>;
  }

  return (
    <ol className={cn("relative", className)} aria-label="Activity timeline">
      {items.map((item, idx) => {
        const meta = ACTION_META[item.action] ?? { icon: Edit, label: actionLabel(item.action), color: "bg-muted text-muted-foreground" };
        const Icon = meta.icon;
        const isLast = idx === items.length - 1;

        return (
          <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast && (
              <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border/80" aria-hidden />
            )}
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-[1]", meta.color)}>
              <Icon className="w-3.5 h-3.5" aria-hidden />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className={cn("font-medium capitalize", compact ? "text-xs" : "text-sm")}>
                  {meta.label}
                  {item.versionNumber != null && (
                    <span className="text-muted-foreground font-normal"> · v{item.versionNumber}</span>
                  )}
                </p>
                <time className="text-[10px] text-muted-foreground tabular-nums" dateTime={item.createdAt}>
                  {formatWhen(item.createdAt)}
                </time>
              </div>
              {item.summary && (
                <p className={cn("text-muted-foreground mt-0.5", compact ? "text-[10px]" : "text-xs")}>{item.summary}</p>
              )}
              {(item.fromStatus || item.toStatus) && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {item.fromStatus} → {item.toStatus}
                </p>
              )}
              {item.createdByName && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.createdByName}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatFullINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

const STATUS_STYLES: Record<string, string> = {
  Confirmed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Ticketed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Completed: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Partial: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  Cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  Refunded: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  Failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  Paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Trial: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Suspended: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  "On Leave": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Inactive: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  New: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Qualified: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  "Follow-up": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Quotation Sent": "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  Negotiation: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  Won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Lost: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  Draft: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  Sent: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Accepted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  Expired: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  Valid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  Expired_visa: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  None: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  "To Do": "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  "In Progress": "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Review: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Platinum: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Gold: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Silver: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  Starter: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  Growth: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  Enterprise: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
  Medium: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400",
  High: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Urgent: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400";
  return (
    <Badge variant="secondary" className={cn("font-medium border-0", style, className)}>
      {status}
    </Badge>
  );
}

export function PageHeader({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-teal-400 to-emerald-500",
  "from-amber-400 to-orange-500",
  "from-rose-400 to-pink-500",
  "from-violet-400 to-purple-500",
  "from-cyan-400 to-teal-500",
  "from-orange-400 to-red-500",
];

export function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

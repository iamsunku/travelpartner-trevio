"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bell, CheckCheck, Plane, CreditCard, Server, Users, Briefcase, Target, FileSpreadsheet,
  AlertTriangle, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useDemoDataStore } from "@/store/demo-data-store";
import type { Notification } from "@/types";
import { PageShell, PageHeader, MetricCard, SectionHeader } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  booking: { icon: Plane, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400", label: "Booking" },
  payment: { icon: CreditCard, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", label: "Payment" },
  api: { icon: Server, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", label: "API" },
  customer: { icon: Users, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400", label: "Customer" },
  internal: { icon: Briefcase, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", label: "Internal" },
  proposal: { icon: FileSpreadsheet, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400", label: "Proposal" },
  requirement: { icon: Target, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400", label: "Trip Requirement" },
  reminder: { icon: Bell, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", label: "Reminder" },
  mention: { icon: Users, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", label: "Mention" },
  task: { icon: Target, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", label: "Task" },
};

const FILTER_TABS = ["all", "booking", "payment", "proposal", "requirement", "api", "customer", "internal", "task"] as const;

const PRIORITY_DOT: Record<string, string> = {
  high: "bg-rose-500", medium: "bg-amber-500", low: "bg-emerald-500",
};

const PREFERENCES = [
  { key: "booking", label: "Booking Notifications", desc: "New bookings, status changes, cancellations", icon: Plane },
  { key: "payment", label: "Payment Alerts", desc: "Payments received, refunds, failures", icon: CreditCard },
  { key: "api", label: "API & System", desc: "Rate limits, sync status, errors", icon: Server },
  { key: "customer", label: "Customer Activity", desc: "Enquiries, registrations, feedback", icon: Users },
  { key: "internal", label: "Internal & Tasks", desc: "Task assignments, mentions, approvals", icon: Briefcase },
];

export function NotificationsView() {
  const { toast } = useToast();
  const items = useDemoDataStore((s) => s.notifications);
  const markNotificationRead = useDemoDataStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useDemoDataStore((s) => s.markAllNotificationsRead);
  const [filter, setFilter] = useState<string>("all");
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    booking: true, payment: true, api: true, customer: true, internal: true,
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    FILTER_TABS.slice(1).forEach((t) => { c[t] = items.filter((n) => n.type === t).length; });
    return c;
  }, [items]);

  const filtered = filter === "all" ? items : items.filter((n) => n.type === filter);
  const unreadCount = items.filter((n) => !n.read).length;

  const toggleRead = (id: string) => {
    const item = items.find((n) => n.id === id);
    if (item && !item.read) markNotificationRead(id);
  };

  const markAllRead = () => {
    markAllNotificationsRead();
    toast({ title: "All caught up!", description: `${unreadCount} notifications marked as read.` });
  };

  return (
    <PageShell>
      <PageHeader
        title="Notifications"
        subtitle={`${unreadCount} unread of ${items.length} total`}
        action={
          <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="w-4 h-4 mr-1.5" /> Mark all read
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={Bell} label="Total" value={String(items.length)} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={0} />
        <MetricCard icon={AlertTriangle} label="Unread" value={String(unreadCount)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={1} />
        <MetricCard icon={Plane} label="Booking" value={String(counts.booking || 0)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={2} />
        <MetricCard icon={CreditCard} label="Payment" value={String(counts.payment || 0)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={3} />
      </div>

      <Card>
        <CardContent className="p-2">
          <div className="flex items-center gap-1 overflow-x-auto">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-1.5" />
            {FILTER_TABS.map((t) => {
              const meta = t === "all" ? null : TYPE_META[t];
              const Icon = meta?.icon || Bell;
              const isActive = filter === t;
              return (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium capitalize transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t === "all" ? "All" : meta?.label || t}
                  <span className={cn(
                    "ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold",
                    isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                  )}>
                    {counts[t] || 0}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Notification list */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[640px] overflow-y-auto scroll-thin divide-y divide-border">
                {filtered.map((n, i) => {
                  const meta = TYPE_META[n.type];
                  const Icon = meta?.icon || Bell;
                  return (
                    <motion.button
                      key={n.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => toggleRead(n.id)}
                      className={cn(
                        "w-full flex items-start gap-3 p-3 text-left hover:bg-muted/40 transition-colors",
                        !n.read && "bg-primary/[0.04] dark:bg-primary/5",
                      )}
                    >
                      <div className="relative shrink-0">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", meta?.color)}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <span className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card", PRIORITY_DOT[n.priority])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn("text-sm truncate", !n.read && "font-semibold")}>{n.title}</p>
                          <span className="text-[10px] text-muted-foreground shrink-0">{n.time}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Badge variant="outline" className="text-[9px] h-4 capitalize">{n.type}</Badge>
                          {n.priority === "high" && (
                            <span className="flex items-center gap-0.5 text-[10px] text-rose-600 font-medium">
                              <AlertTriangle className="w-2.5 h-2.5" /> High priority
                            </span>
                          )}
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary ml-auto" />}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-center py-16">
                    <Bell className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No notifications in this category.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preferences */}
        <div>
          <Card>
            <CardHeader className="pb-2">
              <SectionHeader title="Notification Preferences" description="Choose what you want to be notified about" />
            </CardHeader>
            <CardContent className="space-y-1">
              {PREFERENCES.map((p) => {
                const Icon = p.icon;
                const meta = TYPE_META[p.key];
                const enabled = prefs[p.key];
                return (
                  <div key={p.key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta?.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.label}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">{p.desc}</p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={(v) => {
                        setPrefs((prev) => ({ ...prev, [p.key]: v }));
                        toast({ title: `${p.label} ${v ? "enabled" : "disabled"}` });
                      }}
                    />
                  </div>
                );
              })}
              <Separator className="my-2" />
              <div className="flex items-center justify-between p-2.5">
                <div>
                  <p className="text-sm font-medium">Email digest</p>
                  <p className="text-[11px] text-muted-foreground">Daily summary at 9 AM</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-2.5">
                <div>
                  <p className="text-sm font-medium">Push notifications</p>
                  <p className="text-[11px] text-muted-foreground">Browser & mobile app</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between p-2.5">
                <div>
                  <p className="text-sm font-medium">Do not disturb</p>
                  <p className="text-[11px] text-muted-foreground">10 PM – 7 AM</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}

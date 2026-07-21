"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import {
  Plane, Hotel, Palmtree, TrendingUp, TrendingDown, Wallet,
  Users, Target, Receipt, DollarSign, Calendar, ArrowUpRight, ArrowRight,
  Bell, Plus, FileSpreadsheet, CreditCard, Building2, Activity,
  Server, Zap, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuthStore, useAppStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { api } from "@/lib/api";
import { mapApiAgency } from "@/lib/api-mappers";
import type { Agency } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TOP_DESTINATIONS, RECENT_ACTIVITIES } from "@/lib/mock-data";
import { formatINR, formatFullINR, StatusBadge, avatarGradient, initials, MetricCard, BrandHero, SectionHeader, PageShell } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function QuickAction({
  icon: Icon,
  label,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-2.5 p-3 rounded-xl border border-border/80 bg-card hover:border-primary/35 hover:bg-primary/[0.03] transition-all duration-200 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.04]",
          color
        )}
      >
        <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </div>
      <span className="text-[11px] font-medium text-center leading-tight text-foreground/90">{label}</span>
    </button>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">{message}</div>
  );
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  booking: Plane,
  payment: CreditCard,
  quotation: FileSpreadsheet,
  refund: Receipt,
  visa: CheckCircle2,
  task: Target,
};

const chartTooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  fontSize: 12,
  boxShadow: "0 8px 28px rgba(15, 23, 42, 0.08)",
  background: "var(--card)",
  color: "var(--card-foreground)",
};

export function DashboardView() {
  const { user } = useAuthStore();
  if (!user) return null;
  if (user.role === "super_admin") return <SuperAdminDashboard />;
  if (user.role === "employee") return <EmployeeDashboard />;
  return <AgencyDashboard />;
}

function AgencyDashboard() {
  const setView = useAppStore((s) => s.setView);
  const bookings = useDemoDataStore((s) => s.bookings);
  const tasks = useDemoDataStore((s) => s.tasks);
  const dashboardStats = useDemoDataStore((s) => s.dashboardStats);
  const financeStats = useDemoDataStore((s) => s.financeStats);
  const walletBalance = useDemoDataStore((s) => s.walletBalance);
  const payments = useDemoDataStore((s) => s.payments);
  const userName = useAuthStore((s) => s.user?.name);
  const [destinationInsights, setDestinationInsights] = useState<{
    topDestinations: Array<{ id: string; name: string; country: string; productCount: number; hotelCount: number; activityCount: number; transferCount: number }>;
    productsPerDestination: Array<{ id: string; name: string; country: string; productCount: number; hotelCount: number; activityCount: number; transferCount: number }>;
  } | null>(null);
  const [packageInsights, setPackageInsights] = useState<{
    totalPackages: number;
    featuredPackages: Array<{ id: string; packageName: string; finalPrice: number; currency: string; destination?: { name: string } }>;
    topSellingPackages: Array<{ id: string; packageName: string; finalPrice: number; currency: string; destination?: { name: string }; componentCount: number }>;
  } | null>(null);
  const recentBookings = bookings.slice(0, 6);
  const myTasks = tasks.filter((t) => t.assignedTo === userName).slice(0, 4);
  const pendingPayments = payments.filter((p) => p.status === "Pending");
  const pendingPaymentsTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  useEffect(() => {
    api.getDashboard()
      .then((data) => {
        if (data.destinationInsights) setDestinationInsights(data.destinationInsights);
        if (data.packageInsights) setPackageInsights(data.packageInsights);
      })
      .catch(() => undefined);
  }, []);

  const topDestinationsDisplay = destinationInsights?.topDestinations?.length
    ? destinationInsights.topDestinations.map((d) => ({
        destination: d.name,
        bookings: d.productCount,
        revenue: d.productCount * 10000,
        growth: 0,
        id: d.id,
      }))
    : TOP_DESTINATIONS.map((d) => ({ ...d, id: undefined as string | undefined }));

  const pieData = financeStats?.byService?.map((s: { service: string; revenue: number }) => ({
    name: s.service,
    value: s.revenue,
  })) || [];

  const stats = [
    { icon: Plane, label: "Total Bookings", value: dashboardStats?.bookings?.toLocaleString() || "0", change: 12.5, trend: "up" as const, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400", subtitle: "All time" },
    { icon: Calendar, label: "Today's Bookings", value: String(Math.floor((dashboardStats?.bookings || 0) / 10)), change: 8.2, trend: "up" as const, color: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400", subtitle: "vs yesterday" },
    { icon: DollarSign, label: "Today's Revenue", value: formatINR((financeStats?.summary?.totalRevenue || 0) / 10), change: 15.3, trend: "up" as const, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", subtitle: "Estimated" },
    { icon: Receipt, label: "Pending Payments", value: formatINR(pendingPaymentsTotal), change: 5.1, trend: "down" as const, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", subtitle: `${pendingPayments.length} invoices` },
    { icon: Wallet, label: "Wallet Balance", value: formatINR(walletBalance), change: 22.4, trend: "up" as const, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", subtitle: "Available" },
    { icon: TrendingUp, label: "Commission Earned", value: formatINR(financeStats?.summary?.totalCommission || 0), change: 18.7, trend: "up" as const, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", subtitle: "This month" },
    { icon: Users, label: "Total Customers", value: dashboardStats?.customers?.toLocaleString() || "0", change: 6.4, trend: "up" as const, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400", subtitle: "Active" },
    { icon: Target, label: "New Enquiries", value: dashboardStats?.leads?.toLocaleString() || "0", change: 11.2, trend: "up" as const, color: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400", subtitle: "This week" },
  ];

  return (
    <div className="space-y-6">
      <BrandHero
        eyebrow={greeting}
        title={userName || "Welcome"}
        subtitle={
          <>
            You have <span className="font-semibold text-white">3 pending approvals</span> and{" "}
            <span className="font-semibold text-white">5 new enquiries</span> today. Review priorities
            before starting new bookings.
          </>
        }
        actions={
          <>
            <Button
              className="bg-white text-[#2A7BBD] hover:bg-white/90 shadow-sm h-9"
              onClick={() => setView("bookings")}
            >
              <Plus className="w-4 h-4 mr-1.5" /> New Booking
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 border-white/25 text-white hover:bg-white/20 h-9"
              onClick={() => setView("quotations")}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Create Quote
            </Button>
          </>
        }
      />

      <section>
        <div className="mb-3">
          <SectionHeader title="Key metrics" description="Performance snapshot across bookings, revenue, and pipeline" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <MetricCard key={s.label} {...s} index={i} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader
              title="Revenue overview"
              description="Monthly revenue and commission trend"
              action={
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#2A7BBD]" /> Revenue
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#00A79D]" /> Commission
                  </span>
                </div>
              }
            />
          </CardHeader>
          <CardContent className="px-2 pb-4 sm:px-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={financeStats?.monthly || []} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatFullINR(v)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.25} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="commission" stroke="var(--chart-2)" strokeWidth={2.25} fill="url(#comGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader title="Booking mix" description="Revenue by service type" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {pieData.map((_: unknown, i: number) => (
                    <Cell key={i} fill={`var(--chart-${i + 1})`} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-1">
              {pieData.map((d: { name: string; value: number }, i: number) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `var(--chart-${i + 1})` }} />
                  <span className="text-muted-foreground truncate">{d.name}</span>
                  <span className="font-semibold tabular-nums ml-auto">{formatINR(d.value)}</span>
                </div>
              ))}
              {pieData.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No service data yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3 pt-5 px-5">
          <SectionHeader title="Quick actions" description="Jump into the most common workflows" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <QuickAction icon={Plane} label="Book Flight" color="bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" onClick={() => setView("flights")} />
            <QuickAction icon={Hotel} label="Book Hotel" color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" onClick={() => setView("hotels")} />
            <QuickAction icon={Palmtree} label="Holiday" color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" onClick={() => setView("holiday")} />
            <QuickAction icon={FileSpreadsheet} label="Quotation" color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" onClick={() => setView("quotations")} />
            <QuickAction icon={Users} label="Add Customer" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" onClick={() => setView("customers")} />
            <QuickAction icon={Target} label="Add Lead" color="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400" onClick={() => setView("crm")} />
            <QuickAction icon={CreditCard} label="Collect Payment" color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" onClick={() => setView("payments")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader
              title="Recent bookings"
              description="Latest reservations across your agency"
              action={
                <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setView("bookings")}>
                  View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/80">
              {recentBookings.length === 0 && <EmptyRow message="No bookings to show yet" />}
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/35 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                    {b.service === "Flight" && <Plane className="w-4 h-4 text-teal-600" />}
                    {b.service === "Hotel" && <Hotel className="w-4 h-4 text-amber-600" />}
                    {b.service === "Holiday" && <Palmtree className="w-4 h-4 text-rose-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{b.route} · {b.travelDate}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold tabular-nums">{formatFullINR(b.amount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{b.bookingRef}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <StatusBadge status={b.status} />
                    <StatusBadge status={b.paymentStatus} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/80 shadow-none">
            <CardHeader className="pb-2 pt-5 px-5">
              <SectionHeader
                title="My tasks"
                action={
                  <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setView("tasks")}>
                    Open
                  </Button>
                }
              />
            </CardHeader>
            <CardContent className="space-y-1.5 px-3 pb-4">
              {myTasks.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No tasks assigned</p>
              )}
              {myTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                      t.priority === "Urgent" ? "bg-rose-500" : t.priority === "High" ? "bg-amber-500" : "bg-sky-500"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-snug line-clamp-2">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge status={t.status} className="text-[9px] h-4" />
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {t.dueDate}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-none">
            <CardHeader className="pb-2 pt-5 px-5">
              <SectionHeader title="Activity feed" />
            </CardHeader>
            <CardContent className="space-y-3.5 px-5 pb-5">
              {RECENT_ACTIVITIES.slice(0, 5).map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] || Activity;
                return (
                  <div key={a.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug">
                        <span className="font-medium">{a.user}</span> {a.action}{" "}
                        <span className="text-muted-foreground">{a.target}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">{a.time}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3 pt-5 px-5">
          <SectionHeader title="Products per destination" description="Linked hotels, activities, and transfers" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          {destinationInsights?.productsPerDestination?.length ? (
            <div className="space-y-2">
              {destinationInsights.productsPerDestination.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 p-2 rounded-lg border border-border/80">
                  <button type="button" className="text-sm font-medium text-left hover:text-[#2A7BBD]" onClick={() => setView("destinations")}>
                    {d.name}
                  </button>
                  <div className="flex gap-3 text-xs text-muted-foreground tabular-nums">
                    <span>{d.hotelCount} hotels</span>
                    <span>{d.activityCount} activities</span>
                    <span>{d.transferCount} transfers</span>
                    <span className="font-semibold text-foreground">{d.productCount} total</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Link products to destinations to see distribution here.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-3 pt-5 px-5">
          <SectionHeader title="Top destinations" description="Destinations with the most linked products" />
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topDestinationsDisplay.map((d, i) => (
              <div
                key={d.destination}
                className="flex items-center gap-3 p-3 rounded-xl border border-border/80 hover:border-primary/30 hover:bg-primary/[0.02] transition-colors cursor-pointer"
                onClick={() => d.id && setView("destinations")}
              >
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#2A7BBD] to-[#00A79D] flex items-center justify-center text-white text-[11px] font-semibold shrink-0 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.destination}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {destinationInsights ? `${d.bookings} products` : `${d.bookings} bookings · ${formatINR(d.revenue)}`}
                  </p>
                </div>
                {!destinationInsights && (
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-0.5 tabular-nums">
                    <TrendingUp className="w-3 h-3" />
                    {d.growth}%
                  </span>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-3 pt-5 px-5">
            <SectionHeader title="Featured packages" description={`${packageInsights?.totalPackages ?? 0} packages in catalog`} />
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {packageInsights?.featuredPackages?.length ? packageInsights.featuredPackages.map((p) => (
              <button key={p.id} type="button" className="w-full flex items-center justify-between p-2 rounded-lg border border-border/80 hover:border-primary/30 text-left" onClick={() => setView("packages")}>
                <span className="text-sm font-medium">{p.packageName}</span>
                <span className="text-xs text-[#2A7BBD] font-semibold tabular-nums">₹{p.finalPrice.toLocaleString("en-IN")}</span>
              </button>
            )) : (
              <p className="text-sm text-muted-foreground">Mark packages as featured to highlight them here.</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-3 pt-5 px-5">
            <SectionHeader title="Top packages" description="Published packages by value" />
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-2">
            {packageInsights?.topSellingPackages?.length ? packageInsights.topSellingPackages.map((p, i) => (
              <button key={p.id} type="button" className="w-full flex items-center gap-3 p-2 rounded-lg border border-border/80 hover:border-primary/30 text-left" onClick={() => setView("packages")}>
                <span className="w-6 h-6 rounded bg-gradient-to-br from-[#2A7BBD] to-[#00A79D] text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.packageName}</p>
                  <p className="text-[11px] text-muted-foreground">{p.destination?.name} · {p.componentCount} components</p>
                </div>
                <span className="text-xs font-semibold text-[#2A7BBD] tabular-nums">₹{p.finalPrice.toLocaleString("en-IN")}</span>
              </button>
            )) : (
              <p className="text-sm text-muted-foreground">Publish packages to see top listings.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SuperAdminDashboard() {
  const setView = useAppStore((s) => s.setView);
  const monthlyRevenue = useDemoDataStore((s) => s.financeStats?.monthly) || [];
  const platformNotifications = useDemoDataStore((s) => s.notifications);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  useEffect(() => {
    api
      .getAgencies()
      .then((res) => {
        if (res.agencies) setAgencies(res.agencies.map(mapApiAgency));
      })
      .catch(() => undefined);
  }, []);

  const totalRevenue = agencies.reduce((s, a) => s + a.monthlyRevenue, 0);
  const totalWallet = agencies.reduce((s, a) => s + a.walletBalance, 0);
  const totalCommission = agencies.reduce((s, a) => s + a.commissionEarned, 0);
  const totalBookings = agencies.reduce((s, a) => s + a.totalBookings, 0);

  return (
    <div className="space-y-6">
      <BrandHero
        eyebrow="Platform overview"
        title="Super Admin Console"
        subtitle={
          <>
            Managing <span className="font-semibold text-white">{agencies.length} agencies</span>
            {" · "}
            {formatINR(totalRevenue)} monthly platform revenue
          </>
        }
        actions={
          <>
            <Button className="bg-white text-[#2A7BBD] hover:bg-white/90 shadow-sm h-9" onClick={() => setView("agencies")}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Agency
            </Button>
            <Button
              variant="outline"
              className="bg-white/10 border-white/25 text-white hover:bg-white/20 h-9"
              onClick={() => setView("monitoring")}
            >
              <Activity className="w-4 h-4 mr-1.5" /> System Health
            </Button>
          </>
        }
      />

      <section>
        <div className="mb-3">
          <SectionHeader title="Platform metrics" description="Agency network health and commercial performance" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          <MetricCard icon={Building2} label="Active Agencies" value={String(agencies.filter((a) => a.status === "Active").length)} change={9.1} trend="up" color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" subtitle={`${agencies.length} total onboarded`} index={0} />
          <MetricCard icon={DollarSign} label="Platform Revenue" value={formatINR(totalRevenue)} change={14.2} trend="up" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle="This month" index={1} />
          <MetricCard icon={Wallet} label="Agency Wallets" value={formatINR(totalWallet)} change={7.8} trend="up" color="bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" subtitle="Total balance" index={2} />
          <MetricCard icon={TrendingUp} label="Commission Earned" value={formatINR(totalCommission)} change={19.4} trend="up" color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" subtitle="All agencies" index={3} />
          <MetricCard icon={Plane} label="Total Bookings" value={totalBookings.toLocaleString()} change={11.6} trend="up" color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" subtitle="All time" index={4} />
          <MetricCard icon={Users} label="Total Customers" value="12,847" change={8.9} trend="up" color="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" subtitle="Across agencies" index={5} />
          <MetricCard icon={Server} label="API Health" value="99.9%" change={0.1} trend="up" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle="All vendors" index={6} />
          <MetricCard icon={AlertTriangle} label="Active Alerts" value="2" change={50} trend="down" color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" subtitle="1 critical" index={7} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader title="Platform revenue" description="All agencies · last 12 months" />
          </CardHeader>
          <CardContent className="px-2 pb-4 sm:px-4">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenue} margin={{ left: -8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="platGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(v: number) => formatFullINR(v)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.25} fill="url(#platGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader title="API usage" description="Vendor distribution" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Flight APIs", value: 60 },
                    { name: "Hotel APIs", value: 40 },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {[1, 2].map((c, i) => (
                    <Cell key={i} fill={`var(--chart-${c})`} />
                  ))}
                </Pie>
                <Tooltip contentStyle={chartTooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-1">
              {[
                { n: "Flight APIs", c: 1 },
                { n: "Hotel APIs", c: 2 },
              ].map((d) => (
                <div key={d.n} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: `var(--chart-${d.c})` }} />
                  <span className="text-muted-foreground">{d.n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2 pt-5 px-5">
          <SectionHeader
            title="Agency performance"
            description="Revenue, wallets, and plan status by agency"
            action={
              <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setView("agencies")}>
                Manage all <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/80 max-h-80 overflow-y-auto scroll-thin">
            {agencies.length === 0 && <EmptyRow message="No agencies loaded" />}
            {agencies.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/35 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2A7BBD] to-[#00A79D] flex items-center justify-center text-white font-semibold text-sm shrink-0">
                  {initials(a.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {a.owner} · {a.branches} branches · {a.employees} employees
                  </p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold tabular-nums">{formatINR(a.monthlyRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.totalBookings} bookings</p>
                </div>
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold text-emerald-600 tabular-nums">{formatINR(a.walletBalance)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">wallet</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={a.status} />
                  <StatusBadge status={a.plan} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader
              title="System monitoring"
              action={<Zap className="w-4 h-4 text-amber-500" />}
            />
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5">
            {[
              { label: "Server CPU", value: 42, color: "bg-emerald-500" },
              { label: "Memory Usage", value: 67, color: "bg-amber-500" },
              { label: "Database Load", value: 28, color: "bg-emerald-500" },
              { label: "API Response Time", value: 89, color: "bg-[#2A7BBD]" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-semibold tabular-nums">{m.value}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", m.color)} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader
              title="Platform alerts"
              action={<Bell className="w-4 h-4 text-rose-500" />}
            />
          </CardHeader>
          <CardContent className="space-y-1 px-3 pb-4">
            {platformNotifications.slice(0, 5).map((n) => (
              <div key={n.id} className="flex gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                    n.priority === "high" ? "bg-rose-500" : n.priority === "medium" ? "bg-amber-500" : "bg-slate-400"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmployeeDashboard() {
  const { user } = useAuthStore();
  const setView = useAppStore((s) => s.setView);
  const tasks = useDemoDataStore((s) => s.tasks);
  const leads = useDemoDataStore((s) => s.leads);
  const bookings = useDemoDataStore((s) => s.bookings);
  const myTasks = tasks.filter((t) => t.assignedTo === user?.name);
  const myLeads = leads.filter((l) => l.assignedTo === user?.name);
  const allMyBookings = bookings.filter((b) => b.agent === user?.name);
  const myBookings = allMyBookings.slice(0, 5);
  const myCommission = allMyBookings.reduce((s, b) => s + b.commission, 0);
  const myCustomerCount = new Set(allMyBookings.map((b) => b.customerName)).size;
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  return (
    <div className="space-y-6">
      <BrandHero
        eyebrow={greeting}
        title={user?.name || "Welcome"}
        subtitle={
          <>
            You have <span className="font-semibold text-white">{myBookings.length} recent bookings</span> and{" "}
            <span className="font-semibold text-white">{myLeads.length} active leads</span> in your pipeline.
          </>
        }
        actions={
          <Button className="bg-white text-[#2A7BBD] hover:bg-white/90 shadow-sm h-9" onClick={() => setView("bookings")}>
            <Plus className="w-4 h-4 mr-1.5" /> New Booking
          </Button>
        }
      />

      <section>
        <div className="mb-3">
          <SectionHeader title="My performance" description="Bookings, tasks, commission, and customers" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={Target} label="My Bookings" value={String(allMyBookings.length)} color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" subtitle="All time" index={0} />
          <MetricCard icon={TrendingUp} label="My Tasks" value={String(myTasks.length)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle="Assigned to you" index={1} />
          <MetricCard icon={Wallet} label="My Commission" value={formatINR(myCommission)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" subtitle="All time" index={2} />
          <MetricCard icon={Users} label="My Customers" value={String(myCustomerCount)} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" subtitle="From your bookings" index={3} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader
              title="My recent bookings"
              action={
                <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setView("bookings")}>
                  View all <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/80">
              {myBookings.length === 0 && <EmptyRow message="No bookings yet" />}
              {myBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/35 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-muted/80 flex items-center justify-center shrink-0">
                    {b.service === "Flight" && <Plane className="w-4 h-4 text-teal-600" />}
                    {b.service === "Hotel" && <Hotel className="w-4 h-4 text-amber-600" />}
                    {b.service === "Holiday" && <Palmtree className="w-4 h-4 text-rose-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{b.route} · {b.travelDate}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold tabular-nums">{formatFullINR(b.amount)}</p>
                    <p className="text-[10px] text-emerald-600 mt-0.5">+{formatFullINR(b.commission)} comm.</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2 pt-5 px-5">
            <SectionHeader
              title={`My tasks (${myTasks.length})`}
              action={
                <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setView("tasks")}>
                  Open
                </Button>
              }
            />
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto scroll-thin px-3 pb-4">
            {myTasks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">No tasks assigned</p>
            )}
            {myTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/80">
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                    t.priority === "Urgent" ? "bg-rose-500" : t.priority === "High" ? "bg-amber-500" : "bg-sky-500"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug line-clamp-2">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <StatusBadge status={t.status} className="text-[9px] h-4" />
                    <span className="text-[10px] text-muted-foreground">{t.dueDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2 pt-5 px-5">
          <SectionHeader
            title={`My leads (${myLeads.length})`}
            action={
              <Button variant="ghost" size="sm" className="text-xs h-8 text-primary" onClick={() => setView("crm")}>
                View CRM <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            }
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/80">
            {myLeads.length === 0 && <EmptyRow message="No leads assigned" />}
            {myLeads.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/35 transition-colors">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={cn("bg-gradient-to-br text-white text-[10px] font-semibold", avatarGradient(l.customerName))}>
                    {initials(l.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.customerName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.service} · {l.source}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold tabular-nums">{formatFullINR(l.value)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">due {l.expectedClose}</p>
                </div>
                <StatusBadge status={l.stage} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

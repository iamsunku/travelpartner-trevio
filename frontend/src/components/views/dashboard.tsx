"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Plane, Hotel, Bus, Palmtree, TrendingUp, TrendingDown, Wallet,
  Users, Target, Receipt, DollarSign, Calendar, ArrowUpRight, ArrowRight,
  Bell, Plus, FileSpreadsheet, CreditCard, Building2, Activity,
  Server, Globe, Zap, AlertTriangle, CheckCircle2, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useAuthStore, useAppStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { api } from "@/lib/api";
import { mapApiAgency } from "@/lib/api-mappers";
import type { Agency, ViewKey } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { TOP_DESTINATIONS, RECENT_ACTIVITIES } from "@/lib/mock-data";
import { formatINR, formatFullINR, StatusBadge, avatarGradient, initials } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

function StatCard({ icon: Icon, label, value, change, trend, color, subtitle }: {
  icon: React.ElementType; label: string; value: string; change?: number; trend?: "up" | "down"; color: string; subtitle?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
              <Icon className="w-5 h-5" />
            </div>
            {change !== undefined && trend && (
              <span className={cn("text-xs font-medium flex items-center gap-0.5", trend === "up" ? "text-emerald-600" : "text-rose-600")}>
                {trend === "up" ? <ArrowUpRight className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(change)}%
              </span>
            )}
          </div>
          <p className="text-2xl font-bold mt-3 tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function QuickAction({ icon: Icon, label, color, onClick }: { icon: React.ElementType; label: string; color: string; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all group">
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
    </button>
  );
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  booking: Plane, payment: CreditCard, quotation: FileSpreadsheet, refund: Receipt, visa: CheckCircle2, task: Target,
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
  const recentBookings = bookings.slice(0, 6);
  const myTasks = tasks.filter((t) => t.assignedTo === userName).slice(0, 4);
  const pendingPayments = payments.filter((p) => p.status === "Pending");
  const pendingPaymentsTotal = pendingPayments.reduce((s, p) => s + p.amount, 0);

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
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2A7BBD] via-[#1f6ba8] to-[#00A79D] text-white p-5 lg:p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/15 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-white/80 text-sm">Welcome back,</p>
            <h1 className="text-2xl font-bold">{useAuthStore.getState().user?.name} 👋</h1>
            <p className="text-white/80 text-sm mt-1">
              You have <span className="font-semibold text-white">3 pending approvals</span> and <span className="font-semibold text-white">5 new enquiries</span> today.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-white text-[#2A7BBD] hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> New Booking
            </Button>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Create Quote
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Revenue Overview</CardTitle>
              <CardDescription className="text-xs">Monthly revenue & commission trend</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Commission</span>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={financeStats?.monthly || []} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="comGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }} formatter={(v: number) => formatFullINR(v)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#revGrad)" />
                <Area type="monotone" dataKey="commission" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#comGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Booking Distribution</CardTitle>
            <CardDescription className="text-xs">By service type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={financeStats?.byService?.map((s: any) => ({ name: s.service, value: s.revenue })) || []} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {(financeStats?.byService?.map((s: any) => ({ name: s.service, value: s.revenue })) || []).map((_, i) => <Cell key={i} fill={`var(--chart-${i + 1})`} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {(financeStats?.byService?.map((s: any) => ({ name: s.service, value: s.revenue })) || []).map((d: any, i: number) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(--chart-${i + 1})` }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="font-medium ml-auto">{formatINR(d.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            <QuickAction icon={Plane} label="Book Flight" color="bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" onClick={() => setView("flights")} />
            <QuickAction icon={Hotel} label="Book Hotel" color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" onClick={() => setView("hotels")} />
            <QuickAction icon={Bus} label="Book Bus" color="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" onClick={() => setView("bus")} />
            <QuickAction icon={Palmtree} label="Holiday" color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" onClick={() => setView("holiday")} />
            <QuickAction icon={FileSpreadsheet} label="Quotation" color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" onClick={() => setView("quotations")} />
            <QuickAction icon={Users} label="Add Customer" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" onClick={() => setView("customers")} />
            <QuickAction icon={Target} label="Add Lead" color="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400" onClick={() => setView("crm")} />
            <QuickAction icon={CreditCard} label="Collect Payment" color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" onClick={() => setView("payments")} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent Bookings</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs h-7">View all <ArrowRight className="w-3 h-3 ml-1" /></Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {recentBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {b.service === "Flight" && <Plane className="w-4 h-4 text-teal-600" />}
                    {b.service === "Hotel" && <Hotel className="w-4 h-4 text-amber-600" />}
                    {b.service === "Bus" && <Bus className="w-4 h-4 text-cyan-600" />}
                    {b.service === "Holiday" && <Palmtree className="w-4 h-4 text-rose-600" />}
                    {(b.service === "Visa" || b.service === "Insurance") && <FileSpreadsheet className="w-4 h-4 text-violet-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.route} · {b.travelDate}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">{formatFullINR(b.amount)}</p>
                    <p className="text-[10px] text-muted-foreground">{b.bookingRef}</p>
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">My Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myTasks.map((t) => (
                <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", t.priority === "Urgent" ? "bg-rose-500" : t.priority === "High" ? "bg-amber-500" : "bg-sky-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium leading-tight line-clamp-2">{t.title}</p>
                    <div className="flex items-center gap-2 mt-1">
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

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {RECENT_ACTIVITIES.slice(0, 5).map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] || Activity;
                return (
                  <div key={a.id} className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-tight">
                        <span className="font-medium">{a.user}</span> {a.action}{" "}
                        <span className="text-muted-foreground">{a.target}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Top Destinations</CardTitle>
          <CardDescription className="text-xs">Best performing routes this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TOP_DESTINATIONS.map((d, i) => (
              <div key={d.destination} className="flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-primary/30 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{d.destination}</p>
                  <p className="text-[11px] text-muted-foreground">{d.bookings} bookings · {formatINR(d.revenue)}</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />{d.growth}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SuperAdminDashboard() {
  const monthlyRevenue = useDemoDataStore((s) => s.financeStats?.monthly) || [];
  const platformNotifications = useDemoDataStore((s) => s.notifications);
  const [agencies, setAgencies] = useState<Agency[]>([]);

  useEffect(() => {
    api.getAgencies()
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
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2A7BBD] via-[#1d6298] to-[#00897F] text-white p-5 lg:p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/15 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-white/80 text-sm flex items-center gap-1.5">
              <Globe className="w-4 h-4" /> Platform Overview
            </p>
            <h1 className="text-2xl font-bold">Super Admin Console</h1>
            <p className="text-white/80 text-sm mt-1">
              Managing <span className="font-semibold text-white">{agencies.length} agencies</span> · {formatINR(totalRevenue)} monthly revenue
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button className="bg-white text-[#2A7BBD] hover:bg-white/90">
              <Plus className="w-4 h-4 mr-1.5" /> Add Agency
            </Button>
            <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              <Activity className="w-4 h-4 mr-1.5" /> System Health
            </Button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard icon={Building2} label="Active Agencies" value={String(agencies.filter((a) => a.status === "Active").length)} change={9.1} trend="up" color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" subtitle={`${agencies.length} total onboarded`} />
        <StatCard icon={DollarSign} label="Platform Revenue" value={formatINR(totalRevenue)} change={14.2} trend="up" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle="This month" />
        <StatCard icon={Wallet} label="Agency Wallets" value={formatINR(totalWallet)} change={7.8} trend="up" color="bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" subtitle="Total balance" />
        <StatCard icon={TrendingUp} label="Commission Earned" value={formatINR(totalCommission)} change={19.4} trend="up" color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" subtitle="All agencies" />
        <StatCard icon={Plane} label="Total Bookings" value={totalBookings.toLocaleString()} change={11.6} trend="up" color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" subtitle="All time" />
        <StatCard icon={Users} label="Total Customers" value="12,847" change={8.9} trend="up" color="bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" subtitle="Across agencies" />
        <StatCard icon={Server} label="API Health" value="99.9%" change={0.1} trend="up" color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle="All vendors" />
        <StatCard icon={AlertTriangle} label="Active Alerts" value="2" change={50} trend="down" color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" subtitle="1 critical" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Platform Revenue</CardTitle>
            <CardDescription className="text-xs">All agencies · last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyRevenue} margin={{ left: -16, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="platGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} formatter={(v: number) => formatFullINR(v)} />
                <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#platGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">API Usage</CardTitle>
            <CardDescription className="text-xs">Vendor distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={[
                  { name: "Flight APIs", value: 42 },
                  { name: "Hotel APIs", value: 28 },
                  { name: "Bus APIs", value: 16 },
                  { name: "Train APIs", value: 14 },
                ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {[1, 2, 4, 5].map((c, i) => <Cell key={i} fill={`var(--chart-${c})`} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              {[
                { n: "Flight APIs", c: 1 },
                { n: "Hotel APIs", c: 2 },
                { n: "Bus APIs", c: 4 },
                { n: "Train APIs", c: 5 },
              ].map((d) => (
                <div key={d.n} className="flex items-center gap-1.5 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: `var(--chart-${d.c})` }} />
                  <span className="text-muted-foreground">{d.n}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Agency Performance</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs h-7">Manage all <ArrowRight className="w-3 h-3 ml-1" /></Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border max-h-80 overflow-y-auto scroll-thin">
            {agencies.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {initials(a.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.owner} · {a.branches} branches · {a.employees} employees</p>
                </div>
                <div className="text-right hidden md:block">
                  <p className="text-sm font-semibold">{formatINR(a.monthlyRevenue)}</p>
                  <p className="text-[10px] text-muted-foreground">{a.totalBookings} bookings</p>
                </div>
                <div className="text-right hidden lg:block">
                  <p className="text-sm font-semibold text-emerald-600">{formatINR(a.walletBalance)}</p>
                  <p className="text-[10px] text-muted-foreground">wallet</p>
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> System Monitoring</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Server CPU", value: 42, color: "bg-emerald-500" },
              { label: "Memory Usage", value: 67, color: "bg-amber-500" },
              { label: "Database Load", value: 28, color: "bg-emerald-500" },
              { label: "API Response Time", value: 89, color: "bg-teal-500" },
            ].map((m) => (
              <div key={m.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium">{m.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", m.color)} style={{ width: `${m.value}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Bell className="w-4 h-4 text-rose-500" /> Platform Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {platformNotifications.slice(0, 5).map((n) => (
              <div key={n.id} className="flex gap-2.5 p-2 rounded-lg hover:bg-muted/50">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", n.priority === "high" ? "bg-rose-500" : n.priority === "medium" ? "bg-amber-500" : "bg-slate-400")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight">{n.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{n.time}</p>
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
  const tasks = useDemoDataStore((s) => s.tasks);
  const leads = useDemoDataStore((s) => s.leads);
  const bookings = useDemoDataStore((s) => s.bookings);
  const myTasks = tasks.filter((t) => t.assignedTo === user?.name);
  const myLeads = leads.filter((l) => l.assignedTo === user?.name);
  const allMyBookings = bookings.filter((b) => b.agent === user?.name);
  const myBookings = allMyBookings.slice(0, 5);
  const myCommission = allMyBookings.reduce((s, b) => s + b.commission, 0);
  const myCustomerCount = new Set(allMyBookings.map((b) => b.customerName)).size;

  return (
    <div className="space-y-5">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2A7BBD] via-[#2878b8] to-[#00A79D] text-white p-5 lg:p-6"
      >
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white/15 blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-white/80 text-sm">Good morning,</p>
            <h1 className="text-2xl font-bold">{user?.name} 🌟</h1>
            <p className="text-white/80 text-sm mt-1">
              You have <span className="font-semibold text-white">{myBookings.length} recent bookings</span> and <span className="font-semibold text-white">{myLeads.length} active leads</span>.
            </p>
          </div>
          <Button className="bg-white text-[#2A7BBD] hover:bg-white/90">
            <Plus className="w-4 h-4 mr-1.5" /> New Booking
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Target} label="My Bookings" value={String(allMyBookings.length)} color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" subtitle="All time" />
        <StatCard icon={TrendingUp} label="My Tasks" value={String(myTasks.length)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle="Assigned to you" />
        <StatCard icon={Wallet} label="My Commission" value={formatINR(myCommission)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" subtitle="All time" />
        <StatCard icon={Users} label="My Customers" value={String(myCustomerCount)} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" subtitle="From your bookings" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {myBookings.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {b.service === "Flight" && <Plane className="w-4 h-4 text-teal-600" />}
                    {b.service === "Hotel" && <Hotel className="w-4 h-4 text-amber-600" />}
                    {b.service === "Bus" && <Bus className="w-4 h-4 text-cyan-600" />}
                    {b.service === "Holiday" && <Palmtree className="w-4 h-4 text-rose-600" />}
                    {(b.service === "Visa" || b.service === "Insurance") && <FileSpreadsheet className="w-4 h-4 text-violet-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{b.customerName}</p>
                    <p className="text-xs text-muted-foreground truncate">{b.route} · {b.travelDate}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">{formatFullINR(b.amount)}</p>
                    <p className="text-[10px] text-emerald-600">+{formatFullINR(b.commission)} comm.</p>
                  </div>
                  <StatusBadge status={b.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">My Tasks ({myTasks.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-80 overflow-y-auto scroll-thin">
            {myTasks.map((t) => (
              <div key={t.id} className="flex items-start gap-2 p-2 rounded-lg border border-border">
                <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", t.priority === "Urgent" ? "bg-rose-500" : t.priority === "High" ? "bg-amber-500" : "bg-sky-500")} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight line-clamp-2">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={t.status} className="text-[9px] h-4" />
                    <span className="text-[10px] text-muted-foreground">{t.dueDate}</span>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">My Leads ({myLeads.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {myLeads.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className={cn("bg-gradient-to-br text-white text-[10px] font-semibold", avatarGradient(l.customerName))}>
                    {initials(l.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{l.customerName}</p>
                  <p className="text-xs text-muted-foreground">{l.service} · {l.source}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold">{formatFullINR(l.value)}</p>
                  <p className="text-[10px] text-muted-foreground">due {l.expectedClose}</p>
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

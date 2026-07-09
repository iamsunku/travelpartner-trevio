"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Building2, DollarSign, Percent, Ticket, Users, Award, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api, type ApiPlatformAnalytics, type ApiEmployeeAnalytics } from "@/lib/api";
import { PageHeader, formatINR, formatFullINR, initials, avatarGradient } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

function KpiCard({ icon: Icon, label, value, subtitle, color }: {
  icon: React.ElementType; label: string; value: string; subtitle?: string; color: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", color)}>
            <Icon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold mt-3 tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {subtitle && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function AnalyticsView() {
  const [range, setRange] = useState<"monthly" | "yearly">("monthly");
  const [platform, setPlatform] = useState<ApiPlatformAnalytics | null>(null);
  const [employeeData, setEmployeeData] = useState<ApiEmployeeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([api.getAnalyticsPlatform(range), api.getAnalyticsEmployees(range)])
      .then(([p, e]) => {
        if (cancelled) return;
        setPlatform(p);
        setEmployeeData(e);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform Analytics"
        subtitle="Super Admin — revenue, bookings & employee performance across the platform"
        action={
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={range === "monthly" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setRange("monthly")}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={range === "yearly" ? "default" : "ghost"}
              className="h-7 text-xs px-3"
              onClick={() => setRange("yearly")}
            >
              Yearly
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading analytics…
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          Couldn&apos;t load analytics from the server. Please try again.
        </div>
      )}

      {!loading && !error && platform && employeeData && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard icon={DollarSign} label="Platform Revenue" value={formatINR(platform.summary.totalRevenue)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" subtitle={range === "monthly" ? "Last 12 months" : "Last 5 years"} />
            <KpiCard icon={Percent} label="Commission Earned" value={formatINR(platform.summary.totalCommission)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" subtitle="All agencies" />
            <KpiCard icon={Ticket} label="Total Bookings" value={platform.summary.totalBookings.toLocaleString()} color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" subtitle="Confirmed" />
            <KpiCard icon={Building2} label="Active Agencies" value={String(platform.summary.activeAgencies)} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" subtitle="On platform" />
            <KpiCard icon={Users} label="Total Users" value={platform.summary.totalUsers.toLocaleString()} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" subtitle="Across roles" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue &amp; Commission Trend</CardTitle>
                <CardDescription className="text-xs">{range === "monthly" ? "Monthly" : "Yearly"} platform-wide</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={platform.trend} margin={{ left: -16, right: 8, top: 8 }}>
                    <defs>
                      <linearGradient id="analyticsRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="analyticsComGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 100000}L`} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} formatter={(v: number) => formatFullINR(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#analyticsRevGrad)" />
                    <Area type="monotone" dataKey="commission" stroke="var(--chart-2)" strokeWidth={2.5} fill="url(#analyticsComGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Bookings Trend</CardTitle>
                <CardDescription className="text-xs">Volume over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={platform.trend} margin={{ left: -16, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                    <Bar dataKey="bookings" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Agency Performance</CardTitle>
              <CardDescription className="text-xs">Revenue &amp; commission by agency</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agency</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platform.byAgency.map((a) => (
                    <TableRow key={a.agency}>
                      <TableCell className="font-medium">{a.agency}</TableCell>
                      <TableCell className="text-right">{a.bookings}</TableCell>
                      <TableCell className="text-right">{formatFullINR(a.revenue)}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatFullINR(a.commission)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex flex-row items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <div>
                <CardTitle className="text-base">Employee Performance</CardTitle>
                <CardDescription className="text-xs">Top performers by revenue, target vs achieved</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Target vs Achieved</TableHead>
                    <TableHead className="text-right">Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeData.topPerformers.map((e) => {
                    const pct = e.target > 0 ? Math.round((e.achieved / e.target) * 100) : 0;
                    return (
                      <TableRow key={e.id}>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className={cn("bg-gradient-to-br text-white text-[10px] font-semibold", avatarGradient(e.name))}>
                                {initials(e.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium leading-tight">{e.name}</p>
                              <p className="text-[11px] text-muted-foreground">{e.designation}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.department}</TableCell>
                        <TableCell className="text-right">{e.bookings}</TableCell>
                        <TableCell className="text-right">{formatFullINR(e.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn("font-medium", pct >= 100 ? "text-emerald-600" : "text-amber-600")}>{pct}%</span>
                          <span className="text-[11px] text-muted-foreground ml-1">({formatINR(e.achieved)} / {formatINR(e.target)})</span>
                        </TableCell>
                        <TableCell className="text-right text-sm">{e.attendance}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

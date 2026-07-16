"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Server,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  PageShell,
  PageHeader,
  SectionHeader,
  MetricCard,
} from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

interface Summary {
  totalRequests: number;
  errorCount: number;
  errorRate: number;
  avgResponseTime: number;
  uptime: number;
  statusCodeDistribution: Record<number, number>;
  timeRange: string;
}

interface Endpoint {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
  errorCount: number;
  errorRate: number;
}

interface ApiError {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  errorMessage: string;
  createdAt: string;
}

interface UserActivity {
  userId: string;
  requestCount: number;
  avgResponseTime: number;
  errorCount: number;
}

const BRAND_COLORS = ["#2A7BBD", "#00A79D", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];

const TIME_RANGES = [
  { value: 24, label: "24h" },
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
] as const;

function methodBadgeClass(method: string) {
  switch (method) {
    case "GET":
      return "bg-sky-100 text-[#2A7BBD] dark:bg-sky-500/15 dark:text-sky-400";
    case "POST":
      return "bg-teal-100 text-[#00A79D] dark:bg-teal-500/15 dark:text-teal-400";
    case "PUT":
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    case "DELETE":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function errorRateBadgeClass(rate: number) {
  if (rate > 10) return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400";
  if (rate > 0) return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
}

export function AnalyticsDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [errors, setErrors] = useState<ApiError[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 60000);
    return () => clearInterval(interval);
  }, [hours]);

  async function fetchAnalytics() {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [summaryRes, endpointsRes, errorsRes, activityRes] =
        await Promise.all([
          fetch("/api/analytics/summary", { headers }),
          fetch(`/api/analytics/endpoints?hours=${hours}`, { headers }),
          fetch(`/api/analytics/errors?hours=${hours}`, { headers }),
          fetch(`/api/analytics/user-activity?hours=${hours}`, { headers }),
        ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (endpointsRes.ok) setEndpoints((await endpointsRes.json()).stats || []);
      if (errorsRes.ok) setErrors((await errorsRes.json()).errors || []);
      if (activityRes.ok)
        setUserActivity((await activityRes.json()).activity || []);

      setLoading(false);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-96">
          <p className="text-sm text-muted-foreground">Loading analytics...</p>
        </div>
      </PageShell>
    );
  }

  if (!summary) {
    return (
      <PageShell>
        <div className="flex items-center justify-center h-96">
          <p className="text-sm text-muted-foreground">No analytics data available</p>
        </div>
      </PageShell>
    );
  }

  const statusChartData = Object.entries(summary.statusCodeDistribution).map(
    ([code, count]) => ({
      name: `${code}`,
      value: count,
    })
  );

  const endpointChartData = endpoints
    .slice(0, 10)
    .map((e) => ({
      name: `${e.method} ${e.endpoint.substring(0, 30)}`,
      requests: e.count,
      avgTime: e.avgResponseTime,
    }));

  const userActivityData = userActivity
    .slice(0, 5)
    .map((u) => ({
      name: u.userId.substring(0, 8),
      requests: u.requestCount,
      avgTime: u.avgResponseTime,
    }));

  const clientServerErrors =
    (summary.statusCodeDistribution[400] || 0) +
    (summary.statusCodeDistribution[500] || 0);

  return (
    <PageShell>
      <PageHeader
        title="Performance Analytics"
        subtitle="API performance, errors, and user activity metrics"
        action={
          <div className="flex gap-2">
            {TIME_RANGES.map((range) => (
              <Button
                key={range.value}
                size="sm"
                variant={hours === range.value ? "default" : "outline"}
                className={cn(
                  hours === range.value &&
                    "bg-gradient-to-r from-[#2A7BBD] to-[#00A79D] hover:opacity-90 border-0"
                )}
                onClick={() => setHours(range.value)}
              >
                {range.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MetricCard
          icon={Activity}
          label="Total Requests"
          value={summary.totalRequests.toLocaleString("en-IN")}
          color="bg-sky-100 text-[#2A7BBD] dark:bg-sky-500/15 dark:text-sky-400"
          subtitle={`${summary.uptime}% uptime`}
          index={0}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Errors"
          value={summary.errorCount.toLocaleString("en-IN")}
          color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
          subtitle={`${summary.errorRate}% error rate`}
          index={1}
        />
        <MetricCard
          icon={Clock}
          label="Avg Response Time"
          value={`${summary.avgResponseTime}ms`}
          color="bg-teal-100 text-[#00A79D] dark:bg-teal-500/15 dark:text-teal-400"
          subtitle={summary.avgResponseTime < 200 ? "Excellent" : "Good"}
          index={2}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Status 200"
          value={(summary.statusCodeDistribution[200] || 0).toLocaleString("en-IN")}
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
          subtitle="Successful"
          index={3}
        />
        <MetricCard
          icon={Server}
          label="Status 4xx/5xx"
          value={clientServerErrors.toLocaleString("en-IN")}
          color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          subtitle="Client & Server"
          index={4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <SectionHeader title="Status Code Distribution" description="Response breakdown by HTTP status" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {statusChartData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={BRAND_COLORS[index % BRAND_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <SectionHeader title="Top Endpoints" description="Most requested API routes" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={endpointChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
                <Legend />
                <Bar dataKey="requests" fill="#2A7BBD" name="Requests" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <SectionHeader title="Endpoint Response Times" description="Average latency across top endpoints" />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={endpointChartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgTime"
                stroke="#00A79D"
                strokeWidth={2.5}
                name="Avg Response Time (ms)"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <SectionHeader title="Top Active Users" description="Request volume by user" />
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={userActivityData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} />
              <Legend />
              <Bar dataKey="requests" fill="#00A79D" name="Requests" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <SectionHeader title="Endpoint Performance" description="Latency and error rates by route" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Requests</TableHead>
                  <TableHead className="text-right">Avg Time</TableHead>
                  <TableHead className="text-right">Error Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.slice(0, 15).map((ep, idx) => (
                  <TableRow key={idx} className="hover:bg-muted/40">
                    <TableCell className="text-sm max-w-xs truncate">{ep.endpoint}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("font-medium border-0 text-xs", methodBadgeClass(ep.method))}>
                        {ep.method}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{ep.count}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{ep.avgResponseTime}ms</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className={cn("font-medium border-0 text-xs", errorRateBadgeClass(ep.errorRate))}>
                        {ep.errorRate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {errors.length > 0 && (
        <Card className="border-border/80 shadow-none">
          <CardHeader className="pb-2">
            <SectionHeader
              title="Recent Errors"
              description="Latest API failures in the selected window"
              action={
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                  <Zap className="w-3 h-3 mr-1" />
                  {errors.length} logged
                </Badge>
              }
            />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {errors.slice(0, 10).map((err) => (
                <div
                  key={err.id}
                  className="p-3 rounded-lg border border-rose-200/80 bg-rose-50/50 dark:bg-rose-500/5 dark:border-rose-500/20"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-rose-700 dark:text-rose-400">
                        {err.method} {err.endpoint}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {err.statusCode} — {err.errorMessage}
                      </p>
                    </div>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {new Date(err.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}

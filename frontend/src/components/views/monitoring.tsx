"use client";

import { useState, Fragment } from "react";
import {
  Cpu, MemoryStick, HardDrive, Wifi, Server, Activity, ShieldAlert, AlertTriangle,
  CheckCircle2, Clock, Zap, Eye, RefreshCw, Lock, KeyRound, Globe, Ban,
} from "lucide-react";
import {
  RadialBarChart, RadialBar, ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from "recharts";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PageShell, PageHeader, BrandHero, SectionHeader, MetricCard, DemoModuleBanner } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

interface HealthMetric { name: string; value: number; fill: string; icon: React.ElementType; }
const HEALTH: HealthMetric[] = [
  { name: "CPU", value: 42, fill: "var(--brand-blue)", icon: Cpu },
  { name: "Memory", value: 68, fill: "var(--brand-teal)", icon: MemoryStick },
  { name: "Disk", value: 31, fill: "#f59e0b", icon: HardDrive },
  { name: "Network", value: 57, fill: "#06b6d4", icon: Wifi },
];

const RESPONSE_DATA = [
  { t: "00h", amadeus: 320, tbo: 210, booking: 480 },
  { t: "04h", amadeus: 290, tbo: 198, booking: 510 },
  { t: "08h", amadeus: 412, tbo: 240, booking: 720 },
  { t: "12h", amadeus: 580, tbo: 310, booking: 1024 },
  { t: "16h", amadeus: 690, tbo: 340, booking: 1180 },
  { t: "20h", amadeus: 420, tbo: 252, booking: 690 },
  { t: "Now", amadeus: 312, tbo: 198, booking: 540 },
];

interface ApiHealth {
  id: string;
  vendor: string;
  uptime: number;
  avgResponse: number;
  status: "Operational" | "Degraded" | "Down";
  lastIncident: string;
}
const API_HEALTH: ApiHealth[] = [
  { id: "h-1", vendor: "Amadeus", uptime: 99.98, avgResponse: 312, status: "Operational", lastIncident: "None in 30 days" },
  { id: "h-2", vendor: "TBO Holidays", uptime: 99.95, avgResponse: 198, status: "Operational", lastIncident: "None in 30 days" },
  { id: "h-3", vendor: "Booking.com", uptime: 98.42, avgResponse: 540, status: "Degraded", lastIncident: "429 Rate limit · 2h ago" },
  { id: "h-6", vendor: "Hotelbeds", uptime: 99.72, avgResponse: 412, status: "Operational", lastIncident: "None in 30 days" },
  { id: "h-7", vendor: "Sabre", uptime: 99.91, avgResponse: 286, status: "Operational", lastIncident: "Slow response · 3d ago" },
  { id: "h-8", vendor: "Skyscanner", uptime: 88.14, avgResponse: 1820, status: "Down", lastIncident: "Outage · 8 min ago" },
];

interface ErrorLog {
  id: string;
  timestamp: string;
  service: string;
  message: string;
  severity: "Low" | "Medium" | "High" | "Urgent";
  stack: string;
}
const ERROR_LOGS: ErrorLog[] = [
  { id: "er-1", timestamp: "2025-01-20 14:32:11", service: "booking-service", message: "NullPointerException at BookingService.confirm():142", severity: "High", stack: "at com.tp.booking.BookingService.confirm(BookingService.java:142) ~[booking-service.jar:1.4.2]" },
  { id: "er-2", timestamp: "2025-01-20 14:31:42", service: "payment-gateway", message: "Razorpay webhook signature mismatch", severity: "Urgent", stack: "at com.tp.payment.RazorpayHandler.verify(RazorpayHandler.java:78) ~[payment-gateway.jar:2.1.0]" },
  { id: "er-4", timestamp: "2025-01-20 14:29:25", service: "redis-cache", message: "Connection pool exhausted (max: 50)", severity: "Medium", stack: "at redis.clients.jedis.JedisFactory.makeObject(JedisFactory.java:89)" },
  { id: "er-6", timestamp: "2025-01-20 14:27:48", service: "auth-service", message: "JWT expired for user u-cu-2", severity: "Low", stack: "at io.jsonwebtoken.impl.DefaultJwtParser.parse(DefaultJwtParser.java:232)" },
  { id: "er-7", timestamp: "2025-01-20 14:26:55", service: "hotel-search", message: "Booking.com returned 429 Too Many Requests", severity: "Medium", stack: "at com.tp.search.BookingComProvider.search(BookingComProvider.java:124)" },
  { id: "er-8", timestamp: "2025-01-20 14:25:11", service: "notification-svc", message: "WhatsApp template rejected by provider", severity: "Low", stack: "at com.tp.notify.WhatsappSender.send(WhatsappSender.java:67)" },
  { id: "er-9", timestamp: "2025-01-20 14:24:32", service: "flight-search", message: "NDC response parse failure from Amadeus", severity: "High", stack: "at com.tp.search.amadeus.NdcParser.parse(NdcParser.java:312)" },
  { id: "er-10", timestamp: "2025-01-20 14:23:18", service: "wallet-service", message: "Insufficient balance for debit txn wt-12", severity: "Medium", stack: "at com.tp.wallet.WalletService.debit(WalletService.java:94)" },
];

interface SecurityAlert {
  id: string;
  type: string;
  message: string;
  severity: "Low" | "Medium" | "High" | "Urgent";
  time: string;
  icon: React.ElementType;
}
const SECURITY_ALERTS: SecurityAlert[] = [
  { id: "sa-1", type: "Brute Force", message: "Failed login spike — 142 attempts from IP 45.83.12.99 in 5 min", severity: "Urgent", time: "5 min ago", icon: Ban },
  { id: "sa-2", type: "Key Rotation", message: "Production API key for Sabre rotated by admin@travelpartner.pro", severity: "Low", time: "22 min ago", icon: KeyRound },
  { id: "sa-3", type: "Suspicious IP", message: "Login from new geo (Lagos, NG) for user agency_admin@wanderlust", severity: "High", time: "1 hour ago", icon: Globe },
  { id: "sa-4", type: "Permission Escalation", message: "Employee role change attempt blocked for user em-4", severity: "Medium", time: "2 hours ago", icon: Lock },
  { id: "sa-5", type: "Rate Limit", message: "Booking.com API rate limit hit — 1240 calls in 60s", severity: "Medium", time: "3 hours ago", icon: Zap },
];

const ACTIVITY_FEED = [
  { id: "a-1", text: "Amadeus flight search responded in 312ms", time: "just now", type: "ok" },
  { id: "a-2", text: "Booking.com rate limit warning (429)", time: "2 min ago", type: "warn" },
  { id: "a-3", text: "IRCTC adapter recovering after timeout", time: "8 min ago", type: "warn" },
  { id: "a-4", text: "Daily backup completed (4.2 GB)", time: "12 min ago", type: "ok" },
  { id: "a-5", text: "New agency onboarded: Voyage Vista", time: "25 min ago", type: "info" },
  { id: "a-6", text: "Webhook delivery to crm.wanderlust.in succeeded", time: "38 min ago", type: "ok" },
  { id: "a-7", text: "Auto-scaler added 2 pods to flight-search", time: "52 min ago", type: "info" },
  { id: "a-8", text: "Sabre key rotation completed", time: "1 hour ago", type: "ok" },
  { id: "a-9", text: "SSL cert renewed for api.travelpartner.pro", time: "2 hours ago", type: "info" },
  { id: "a-10", text: "Redis memory at 68% — within threshold", time: "3 hours ago", type: "info" },
];

const SEV_COLOR: Record<string, string> = {
  Urgent: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  High: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Medium: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-400",
};

export function MonitoringView() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const operational = API_HEALTH.filter((a) => a.status === "Operational").length;
  const degraded = API_HEALTH.filter((a) => a.status === "Degraded").length;
  const down = API_HEALTH.filter((a) => a.status === "Down").length;

  return (
    <PageShell>
      <PageHeader
        title="System Monitoring"
        subtitle="Real-time platform health, API status, and incident tracking"
        action={
          <Button variant="outline" onClick={() => toast({ title: "Demo — not persisted", description: "Monitoring metrics are sample data." })}>
            <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
          </Button>
        }
      />
      <DemoModuleBanner />

      <BrandHero
        eyebrow="Platform Status"
        title="All Systems Operational"
        subtitle="Last updated just now · 4 regions · 28 services"
        actions={
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold">{operational}</p>
              <p className="text-[11px] text-white/75">Operational</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-200">{degraded}</p>
              <p className="text-[11px] text-white/75">Degraded</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-200">{down}</p>
              <p className="text-[11px] text-white/75">Down</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <MetricCard icon={CheckCircle2} label="Operational APIs" value={String(operational)} color="bg-teal-100 text-brand-teal dark:bg-teal-500/15 dark:text-teal-400" index={0} />
        <MetricCard icon={AlertTriangle} label="Degraded" value={String(degraded)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={1} />
        <MetricCard icon={ShieldAlert} label="Down" value={String(down)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={2} />
        <MetricCard icon={Activity} label="Error Logs" value={String(ERROR_LOGS.length)} color="bg-sky-100 text-primary dark:bg-sky-500/15 dark:text-sky-400" subtitle="Last 24h" index={3} />
      </div>

      {/* Health gauges + response time */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <SectionHeader title="System Health" description="Live server resource usage" />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <RadialBarChart innerRadius="25%" outerRadius="100%" data={HEALTH} startAngle={90} endAngle={-270}>
                <RadialBar dataKey="value" cornerRadius={8} background />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {HEALTH.map((h) => (
                <div key={h.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: h.fill }} />
                  <span className="text-muted-foreground">{h.name}</span>
                  <span className="font-semibold ml-auto">{h.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <SectionHeader
              title="Server Response Time"
              description="Avg response (ms) across top vendors — last 24h"
              action={
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Amadeus</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-brand-teal" /> TBO</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Booking.com</span>
                </div>
              }
            />
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={RESPONSE_DATA} margin={{ left: -16, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" axisLine={false} tickLine={false} tickFormatter={(v) => `${v}ms`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", fontSize: 12 }} formatter={(v: number) => `${v}ms`} />
                <Line type="monotone" dataKey="amadeus" stroke="var(--brand-blue)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="tbo" stroke="var(--brand-teal)" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="booking" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* API health + activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>API Health</CardTitle>
            <CardDescription className="text-xs">Per-vendor uptime and incident history</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-auto scroll-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Uptime</TableHead>
                    <TableHead className="text-right">Avg Resp</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Incident</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {API_HEALTH.map((a) => {
                    const dotColor = a.status === "Operational" ? "bg-emerald-500" : a.status === "Degraded" ? "bg-amber-500" : "bg-rose-500";
                    const textColor = a.status === "Operational" ? "text-emerald-600" : a.status === "Degraded" ? "text-amber-600" : "text-rose-600";
                    return (
                      <TableRow key={a.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{a.vendor}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={a.uptime < 99 ? "text-rose-600 font-semibold" : a.uptime < 99.9 ? "text-amber-600 font-semibold" : "font-semibold"}>
                            {a.uptime.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{a.avgResponse}ms</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span className={cn("w-2 h-2 rounded-full", dotColor, a.status !== "Operational" && "animate-pulse")} />
                            <span className={textColor}>{a.status}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.lastIncident}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Live Activity</CardTitle>
              <CardDescription className="text-xs">Real-time platform events</CardDescription>
            </div>
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5 animate-pulse" /> Live
            </Badge>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[320px] pr-3">
              <div className="space-y-2">
                {ACTIVITY_FEED.map((a) => {
                  const color = a.type === "ok" ? "bg-emerald-500" : a.type === "warn" ? "bg-amber-500" : "bg-cyan-500";
                  const icon = a.type === "ok" ? <CheckCircle2 className="w-3 h-3 text-white" /> : a.type === "warn" ? <AlertTriangle className="w-3 h-3 text-white" /> : <Activity className="w-3 h-3 text-white" />;
                  return (
                    <div key={a.id} className="flex items-start gap-2.5 text-xs">
                      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5", color)}>{icon}</div>
                      <div className="min-w-0">
                        <p className="leading-snug">{a.text}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{a.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Error logs + Security */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Recent Errors</CardTitle>
              <CardDescription className="text-xs">{ERROR_LOGS.length} errors in last hour</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto scroll-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ERROR_LOGS.map((e) => (
                    <Fragment key={e.id}>
                      <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap font-mono">{e.timestamp}</TableCell>
                        <TableCell><code className="text-xs px-1.5 py-0.5 rounded bg-muted">{e.service}</code></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border-0", SEV_COLOR[e.severity])}>{e.severity}</Badge>
                        </TableCell>
                        <TableCell className="text-xs max-w-md truncate">{e.message}</TableCell>
                        <TableCell className="text-right">
                          <Eye className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", expanded === e.id && "rotate-180")} />
                        </TableCell>
                      </TableRow>
                      {expanded === e.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30 py-2">
                            <div className="rounded-md bg-rose-950/95 text-rose-100 p-3 font-mono text-[11px] overflow-x-auto scroll-thin">
                              <p className="text-rose-300">Exception: {e.message}</p>
                              <p className="mt-1.5 opacity-80">  at {e.stack}</p>
                              <p className="mt-1 opacity-60">  at com.tp.Application.bootstrap(Application.java:42)</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-rose-500" /> Security Alerts</CardTitle>
              <CardDescription className="text-xs">{SECURITY_ALERTS.filter((s) => s.severity === "Urgent" || s.severity === "High").length} require attention</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[360px] pr-3">
              <div className="space-y-2">
                {SECURITY_ALERTS.map((s) => (
                  <div key={s.id} className="rounded-lg border p-2.5 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                          s.severity === "Urgent" ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" :
                          s.severity === "High" ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" :
                          "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400")}>
                          <s.icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-semibold">{s.type}</p>
                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 border-0", SEV_COLOR[s.severity])}>{s.severity}</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{s.message}</p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{s.time}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

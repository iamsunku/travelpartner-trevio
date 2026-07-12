"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  KeyRound, Plus, MoreHorizontal, Copy, RotateCw, Ban, Activity, Webhook, Search,
  CheckCircle2, AlertTriangle, XCircle, Server, Trash2, Clock,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

interface ApiKey {
  id: string;
  provider: string;
  keyMasked: string;
  environment: "Sandbox" | "Production";
  status: "Active" | "Revoked";
  created: string;
  lastUsed: string;
}

const INITIAL_KEYS: ApiKey[] = [
  { id: "k-1", provider: "Amadeus", keyMasked: "sk_live_••••a92f", environment: "Production", status: "Active", created: "2024-08-12", lastUsed: "2 min ago" },
  { id: "k-2", provider: "TBO Holidays", keyMasked: "sk_live_••••71b3", environment: "Production", status: "Active", created: "2024-09-04", lastUsed: "12 min ago" },
  { id: "k-3", provider: "Booking.com", keyMasked: "sk_live_••••c418", environment: "Production", status: "Active", created: "2024-07-22", lastUsed: "1 hour ago" },
  { id: "k-6", provider: "Hotelbeds", keyMasked: "sk_test_••••0f2c", environment: "Sandbox", status: "Revoked", created: "2024-10-08", lastUsed: "2 days ago" },
  { id: "k-7", provider: "Sabre", keyMasked: "sk_live_••••8a1d", environment: "Production", status: "Active", created: "2024-05-19", lastUsed: "45 min ago" },
];

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

interface LogEntry {
  id: string;
  timestamp: string;
  api: string;
  endpoint: string;
  method: typeof HTTP_METHODS[number];
  status: number;
  responseMs: number;
  requestId: string;
}

const LOG_ENTRIES: LogEntry[] = [
  { id: "lg-1", timestamp: "2025-01-20 14:32:11", api: "Amadeus", endpoint: "/v2/shopping/flight-offers", method: "POST", status: 200, responseMs: 342, requestId: "req_8aB2kX" },
  { id: "lg-2", timestamp: "2025-01-20 14:31:58", api: "TBO", endpoint: "/flight/search", method: "GET", status: 200, responseMs: 218, requestId: "req_K3m9pL" },
  { id: "lg-3", timestamp: "2025-01-20 14:31:42", api: "Booking.com", endpoint: "/v2/hotels/search", method: "GET", status: 429, responseMs: 1024, requestId: "req_P4nQ8m" },
  { id: "lg-6", timestamp: "2025-01-20 14:30:32", api: "Amadeus", endpoint: "/v1/booking/flight-orders", method: "POST", status: 201, responseMs: 892, requestId: "req_W5xK9p" },
  { id: "lg-7", timestamp: "2025-01-20 14:30:11", api: "Hotelbeds", endpoint: "/hotels/availability", method: "GET", status: 200, responseMs: 412, requestId: "req_T3pR7q" },
  { id: "lg-8", timestamp: "2025-01-20 14:29:48", api: "Sabre", endpoint: "/v1/shop/flights", method: "POST", status: 400, responseMs: 198, requestId: "req_F6dB1t" },
  { id: "lg-9", timestamp: "2025-01-20 14:29:25", api: "TBO", endpoint: "/hotel/book", method: "POST", status: 200, responseMs: 1240, requestId: "req_H9kL4w" },
  { id: "lg-10", timestamp: "2025-01-20 14:29:02", api: "Booking.com", endpoint: "/v2/reservations", method: "POST", status: 201, responseMs: 758, requestId: "req_J2mN8r" },
  { id: "lg-12", timestamp: "2025-01-20 14:28:11", api: "Amadeus", endpoint: "/v1/shopping/flight-dates", method: "GET", status: 200, responseMs: 264, requestId: "req_V4tX6y" },
  { id: "lg-14", timestamp: "2025-01-20 14:27:22", api: "Hotelbeds", endpoint: "/bookings/confirm", method: "PUT", status: 200, responseMs: 638, requestId: "req_C3fK7b" },
  { id: "lg-15", timestamp: "2025-01-20 14:26:55", api: "Sabre", endpoint: "/v2/order/flights", method: "POST", status: 200, responseMs: 1102, requestId: "req_E5rT9d" },
];

interface Webhook {
  id: string;
  url: string;
  events: string[];
  status: "Active" | "Paused";
  lastDelivery: string;
}

const INITIAL_WEBHOOKS: Webhook[] = [
  { id: "wh-1", url: "https://api.wanderlust.in/webhooks/bookings", events: ["booking.created", "booking.confirmed", "booking.cancelled"], status: "Active", lastDelivery: "2 min ago" },
  { id: "wh-2", url: "https://crm.wanderlust.in/hooks/payments", events: ["payment.success", "payment.refunded"], status: "Active", lastDelivery: "8 min ago" },
  { id: "wh-3", url: "https://erp.skyhigh.com/wh/ticket", events: ["ticket.issued", "ticket.failed"], status: "Paused", lastDelivery: "2 days ago" },
  { id: "wh-4", url: "https://hooks.royalroutes.in/wallet", events: ["wallet.credit", "wallet.debit"], status: "Active", lastDelivery: "1 hour ago" },
];

function statusColor(code: number) {
  if (code >= 500) return "text-rose-600 bg-rose-50 dark:bg-rose-500/15 dark:text-rose-400";
  if (code >= 400) return "text-amber-600 bg-amber-50 dark:bg-amber-500/15 dark:text-amber-400";
  return "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-400";
}

function methodColor(m: string) {
  switch (m) {
    case "GET": return "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400";
    case "POST": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    case "PUT": return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    case "DELETE": return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400";
    default: return "bg-muted text-muted-foreground";
  }
}

export function ApiManagementView() {
  const { toast } = useToast();
  const [env, setEnv] = useState<"Sandbox" | "Production">("Production");
  const [tab, setTab] = useState("keys");
  const [keys, setKeys] = useState<ApiKey[]>(INITIAL_KEYS);
  const [webhooks, setWebhooks] = useState<Webhook[]>(INITIAL_WEBHOOKS);
  const [genOpen, setGenOpen] = useState(false);
  const [whOpen, setWhOpen] = useState(false);
  const [genProvider, setGenProvider] = useState("Amadeus");
  const [whForm, setWhForm] = useState({ url: "", events: "" });

  // Log filters
  const [logApiFilter, setLogApiFilter] = useState("all");
  const [logStatusFilter, setLogStatusFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");

  const visibleKeys = useMemo(
    () => keys.filter((k) => env === "Production" ? k.environment === "Production" : k.environment === "Sandbox"),
    [keys, env]
  );

  const filteredLogs = useMemo(() => {
    return LOG_ENTRIES.filter((l) => {
      const a = logApiFilter === "all" || l.api === logApiFilter;
      const s = logStatusFilter === "all"
        || (logStatusFilter === "2xx" && l.status < 300)
        || (logStatusFilter === "4xx" && l.status >= 400 && l.status < 500)
        || (logStatusFilter === "5xx" && l.status >= 500);
      const q = l.endpoint.toLowerCase().includes(logSearch.toLowerCase()) || l.requestId.toLowerCase().includes(logSearch.toLowerCase());
      return a && s && q;
    });
  }, [logApiFilter, logStatusFilter, logSearch]);

  function generateKey() {
    const newKey: ApiKey = {
      id: `k-${keys.length + 1}`,
      provider: genProvider,
      keyMasked: `sk_${env === "Production" ? "live" : "test"}_••••${Math.random().toString(16).slice(2, 6)}`,
      environment: env,
      status: "Active",
      created: new Date().toISOString().slice(0, 10),
      lastUsed: "Never",
    };
    setKeys([newKey, ...keys]);
    setGenOpen(false);
    toast({ title: "API key generated", description: `${genProvider} ${env} key created.` });
  }

  function revokeKey(id: string) {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, status: "Revoked" } : k));
    toast({ title: "Key revoked", description: "The API key has been revoked.", variant: "destructive" });
  }
  function rotateKey(id: string) {
    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, keyMasked: `sk_${k.environment === "Production" ? "live" : "test"}_••••${Math.random().toString(16).slice(2, 6)}`, lastUsed: "Never", created: new Date().toISOString().slice(0, 10) } : k));
    toast({ title: "Key rotated", description: "New key generated. Old key expires in 24h." });
  }

  function addWebhook() {
    if (!whForm.url || !whForm.events) {
      toast({ title: "Missing fields", description: "URL and events required.", variant: "destructive" });
      return;
    }
    const newWh: Webhook = {
      id: `wh-${webhooks.length + 1}`,
      url: whForm.url,
      events: whForm.events.split(",").map((e) => e.trim()).filter(Boolean),
      status: "Active",
      lastDelivery: "Never",
    };
    setWebhooks([newWh, ...webhooks]);
    setWhOpen(false);
    setWhForm({ url: "", events: "" });
    toast({ title: "Webhook added", description: newWh.url });
  }
  function toggleWebhook(id: string) {
    setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, status: w.status === "Active" ? "Paused" : "Active" } : w));
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Management"
        subtitle="Manage API keys, monitor logs, and configure webhooks"
        action={
          <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700" onClick={() => setGenOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Generate Key
          </Button>
        }
      />

      {/* Environment switch */}
      <Card className="relative overflow-hidden">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", env === "Production" ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" : "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400")}>
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">Active Environment</p>
              <p className="text-xs text-muted-foreground">Switching affects all API calls in this workspace</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn("text-sm font-medium", env === "Sandbox" ? "text-amber-600" : "text-muted-foreground")}>Sandbox</span>
            <Switch checked={env === "Production"} onCheckedChange={(c) => setEnv(c ? "Production" : "Sandbox")} />
            <span className={cn("text-sm font-medium", env === "Production" ? "text-rose-600" : "text-muted-foreground")}>Production</span>
            <Badge variant="outline" className={env === "Production" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
              {env}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="keys" className="flex items-center gap-1.5"><KeyRound className="w-4 h-4" /> API Keys</TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> Logs</TabsTrigger>
          <TabsTrigger value="webhooks" className="flex items-center gap-1.5"><Webhook className="w-4 h-4" /> Webhooks</TabsTrigger>
        </TabsList>

        {/* API KEYS */}
        <TabsContent value="keys" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[28rem] overflow-auto scroll-thin">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>API Key</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleKeys.map((k) => (
                      <TableRow key={k.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{k.provider}</TableCell>
                        <TableCell>
                          <code className="text-xs px-2 py-1 rounded bg-muted font-mono">{k.keyMasked}</code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={k.environment === "Production" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                            {k.environment}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={k.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-600 border-slate-200"}>
                            {k.status === "Active" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                            {k.status === "Revoked" && <Ban className="w-3 h-3 mr-1" />}
                            {k.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{k.created}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{k.lastUsed}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => toast({ title: "Key copied", description: "Full key copied to clipboard." })}>
                                <Copy className="w-4 h-4 mr-2" /> Copy Key
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => rotateKey(k.id)} disabled={k.status === "Revoked"}>
                                <RotateCw className="w-4 h-4 mr-2" /> Rotate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-rose-600" onClick={() => revokeKey(k.id)} disabled={k.status === "Revoked"}>
                                <Ban className="w-4 h-4 mr-2" /> Revoke
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Live API Logs</CardTitle>
                <CardDescription className="text-xs">Real-time request monitoring across all vendors</CardDescription>
              </div>
              <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5 animate-pulse" />
                Streaming
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col md:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Search endpoint or request ID..." className="pl-8" value={logSearch} onChange={(e) => setLogSearch(e.target.value)} />
                </div>
                <Select value={logApiFilter} onValueChange={setLogApiFilter}>
                  <SelectTrigger className="w-full md:w-[160px]"><SelectValue placeholder="API" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All APIs</SelectItem>
                    {[...new Set(LOG_ENTRIES.map((l) => l.api))].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={logStatusFilter} onValueChange={setLogStatusFilter}>
                  <SelectTrigger className="w-full md:w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="2xx">2xx Success</SelectItem>
                    <SelectItem value="4xx">4xx Client</SelectItem>
                    <SelectItem value="5xx">5xx Server</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="max-h-[24rem] overflow-auto scroll-thin rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>API</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Response</TableHead>
                      <TableHead>Request ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((l) => (
                      <TableRow key={l.id} className="hover:bg-muted/40 font-mono text-xs">
                        <TableCell className="text-muted-foreground whitespace-nowrap">{l.timestamp}</TableCell>
                        <TableCell className="font-sans font-medium">{l.api}</TableCell>
                        <TableCell><Badge variant="outline" className={cn("font-mono text-[10px] px-1.5 py-0", methodColor(l.method))}>{l.method}</Badge></TableCell>
                        <TableCell className="text-muted-foreground">{l.endpoint}</TableCell>
                        <TableCell>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold", statusColor(l.status))}>
                            {l.status >= 500 ? <XCircle className="w-3 h-3" /> : l.status >= 400 ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                            {l.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={l.responseMs > 1500 ? "text-rose-600" : l.responseMs > 800 ? "text-amber-600" : "text-emerald-600"}>
                            {l.responseMs}ms
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-[10px]">{l.requestId}</TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-10">No log entries match your filters.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEBHOOKS */}
        <TabsContent value="webhooks" className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">{webhooks.length} webhook endpoints configured</p>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={() => setWhOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Webhook
            </Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {webhooks.map((w) => (
              <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={cn("hover:shadow-md transition-shadow", w.status === "Paused" && "opacity-75")}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", w.status === "Active" ? "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" : "bg-slate-100 text-slate-500 dark:bg-slate-500/15")}>
                          <Webhook className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Last delivery: {w.lastDelivery}</p>
                          <p className="text-sm font-mono truncate">{w.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={w.status === "Active"} onCheckedChange={() => toggleWebhook(w.id)} />
                        <StatusBadge status={w.status} className="text-[10px] px-1.5 py-0" />
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex flex-wrap gap-1">
                      {w.events.map((ev) => (
                        <Badge key={ev} variant="outline" className="text-[10px] font-mono bg-muted/60">{ev}</Badge>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => toast({ title: "Test sent", description: `Ping sent to ${w.url}` })}>
                        <Activity className="w-3.5 h-3.5 mr-1" /> Test
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setWebhooks((prev) => prev.filter((x) => x.id !== w.id))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Generate Key Dialog */}
      <Dialog open={genOpen} onOpenChange={setGenOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-teal-600" /> Generate API Key</DialogTitle>
            <DialogDescription>Create a new API key in the {env} environment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={genProvider} onValueChange={setGenProvider}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Amadeus", "Sabre", "TBO Holidays", "Booking.com", "Hotelbeds", "Kiwi.com"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs">
              <p className="text-muted-foreground">Environment: <Badge variant="outline" className={env === "Production" ? "bg-rose-50 text-rose-700 border-rose-200 ml-1" : "bg-amber-50 text-amber-700 border-amber-200 ml-1"}>{env}</Badge></p>
              <p className="text-muted-foreground mt-1.5">Keys are shown in full only once at creation. Store securely.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={generateKey}>
              <KeyRound className="w-4 h-4 mr-1.5" /> Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Webhook Dialog */}
      <Dialog open={whOpen} onOpenChange={setWhOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Webhook className="w-5 h-5 text-teal-600" /> Add Webhook</DialogTitle>
            <DialogDescription>Register a new endpoint to receive event notifications.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">Endpoint URL</Label>
              <Input id="wh-url" placeholder="https://yourapp.com/webhooks/..." value={whForm.url} onChange={(e) => setWhForm({ ...whForm, url: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-events">Events (comma-separated)</Label>
              <Input id="wh-events" placeholder="booking.created, payment.success" value={whForm.events} onChange={(e) => setWhForm({ ...whForm, events: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">e.g. booking.created, payment.success, ticket.issued</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhOpen(false)}>Cancel</Button>
            <Button className="bg-gradient-to-r from-teal-600 to-emerald-600" onClick={addWebhook}>
              <Plus className="w-4 h-4 mr-1.5" /> Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

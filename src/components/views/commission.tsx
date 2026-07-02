"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plane, Building2, Palmtree, Users, Percent, IndianRupee, Edit,
  CheckCircle2, Clock, Award, TrendingUp, Wallet, ArrowDownLeft,
} from "lucide-react";
import { WALLET_TXNS, REVENUE_DATA } from "@/lib/mock-data";
import {
  formatINR, formatFullINR, StatusBadge, PageHeader,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RULE_CARDS = [
  { id: "airline", title: "Airline Commission", icon: Plane, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400", type: "Percentage", rate: "2% - 5%", scope: "All domestic & international flights", desc: "Tier-based commission on base fare, varies by airline and route class." },
  { id: "hotel", title: "Hotel Commission", icon: Building2, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", type: "Percentage", rate: "8% - 15%", scope: "All hotel bookings via API partners", desc: "Higher rates for luxury and long-stay bookings." },
  { id: "package", title: "Holiday Package", icon: Palmtree, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", type: "Markup", rate: "10% - 20%", scope: "Custom & packaged holidays", desc: "Built-in markup over net rate from suppliers." },
  { id: "employee", title: "Employee Incentive", icon: Users, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", type: "Percentage", rate: "0.5% - 1.5%", scope: "Of booking value, paid monthly", desc: "Tiered incentive for sales team based on targets achieved." },
];

const AIRLINE_RATES = [
  { airline: "IndiGo", code: "6E", domestic: 3, international: 2, color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400" },
  { airline: "Vistara", code: "UK", domestic: 4, international: 3, color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400" },
  { airline: "Air India", code: "AI", domestic: 3, international: 4, color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400" },
  { airline: "SpiceJet", code: "SG", domestic: 2.5, international: 0, color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400" },
  { airline: "Akasa Air", code: "QP", domestic: 3.5, international: 0, color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400" },
  { airline: "Emirates", code: "EK", domestic: 0, international: 5, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" },
  { airline: "Singapore Airlines", code: "SQ", domestic: 0, international: 4.5, color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400" },
  { airline: "Qatar Airways", code: "QR", domestic: 0, international: 5, color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400" },
];

const SETTLEMENTS = [
  { month: "January 2025", totalCommission: 147000, employeePayouts: 42000, agencyShare: 105000, status: "Pending" as const, settledOn: "—" },
  { month: "December 2024", totalCommission: 198000, employeePayouts: 56000, agencyShare: 142000, status: "Settled" as const, settledOn: "05 Jan 2025" },
  { month: "November 2024", totalCommission: 169000, employeePayouts: 48500, agencyShare: 120500, status: "Settled" as const, settledOn: "05 Dec 2024" },
  { month: "October 2024", totalCommission: 178000, employeePayouts: 51000, agencyShare: 127000, status: "Settled" as const, settledOn: "05 Nov 2024" },
  { month: "September 2024", totalCommission: 161000, employeePayouts: 46000, agencyShare: 115000, status: "Settled" as const, settledOn: "05 Oct 2024" },
  { month: "August 2024", totalCommission: 146000, employeePayouts: 41500, agencyShare: 104500, status: "Settled" as const, settledOn: "05 Sep 2024" },
];

function EditRuleDialog({ rule, open, onOpenChange }: { rule: typeof RULE_CARDS[number] | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [rate, setRate] = useState("");
  if (!rule) return null;
  const r = rule;
  function save() {
    toast({ title: "Rule updated", description: `${r.title} rate updated successfully` });
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {rule.title}</DialogTitle>
          <DialogDescription>Modify the commission rate and applicable scope.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>New Rate</Label>
            <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder={rule.rate} />
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <p><span className="font-medium text-foreground">Current:</span> {rule.rate}</p>
            <p className="mt-0.5"><span className="font-medium text-foreground">Scope:</span> {rule.scope}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-teal-600 hover:bg-teal-700">Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommissionRulesTab() {
  const { toast } = useToast();
  const [editRule, setEditRule] = useState<typeof RULE_CARDS[number] | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function openEdit(rule: typeof RULE_CARDS[number]) {
    setEditRule(rule);
    setEditOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {RULE_CARDS.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", r.color)}>
                    <r.icon className="w-5 h-5" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-sm font-semibold mt-3">{r.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{r.desc}</p>
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">{r.type}</p>
                    <p className="text-base font-bold text-teal-600">{r.rate}</p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">Active</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Airline Commission Rates</CardTitle>
          <CardDescription>Carrier-wise commission percentage on base fare</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-96 overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Airline</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="text-right">Domestic</TableHead>
                  <TableHead className="text-right">International</TableHead>
                  <TableHead className="text-right">Effective Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {AIRLINE_RATES.map((a) => (
                  <TableRow key={a.code} className="hover:bg-muted/40">
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold", a.color)}>{a.code}</span>
                        <span className="text-sm font-medium">{a.airline}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{a.code}</TableCell>
                    <TableCell className="text-right text-xs">{a.domestic > 0 ? `${a.domestic}%` : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{a.international > 0 ? `${a.international}%` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className={cn("text-[10px]", a.color)}>{Math.max(a.domestic, a.international)}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditRuleDialog rule={editRule} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}

function MonthlySettlementTab() {
  const totalCommission = SETTLEMENTS.reduce((s, m) => s + m.totalCommission, 0);
  const totalPayouts = SETTLEMENTS.reduce((s, m) => s + m.employeePayouts, 0);
  const totalAgency = SETTLEMENTS.reduce((s, m) => s + m.agencyShare, 0);
  const pendingMonths = SETTLEMENTS.filter((m) => m.status === "Pending").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-500/10 dark:to-emerald-500/10 border-teal-200/50 dark:border-teal-500/20">
          <CardContent className="p-4">
            <Award className="w-5 h-5 text-teal-600 mb-2" />
            <p className="text-xl font-bold">{formatINR(totalCommission)}</p>
            <p className="text-[11px] text-muted-foreground">Total Commission (6 months)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Users className="w-5 h-5 text-violet-600 mb-2" />
            <p className="text-xl font-bold">{formatINR(totalPayouts)}</p>
            <p className="text-[11px] text-muted-foreground">Employee Payouts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Wallet className="w-5 h-5 text-emerald-600 mb-2" />
            <p className="text-xl font-bold">{formatINR(totalAgency)}</p>
            <p className="text-[11px] text-muted-foreground">Agency Share</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Clock className="w-5 h-5 text-amber-600 mb-2" />
            <p className="text-xl font-bold">{pendingMonths}</p>
            <p className="text-[11px] text-muted-foreground">Pending Settlements</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Settlement History</CardTitle>
          <CardDescription>Commission settlement status by month</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-96 overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Commission</TableHead>
                  <TableHead className="text-right">Employee Payouts</TableHead>
                  <TableHead className="text-right">Agency Share</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Settled On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SETTLEMENTS.map((m) => (
                  <TableRow key={m.month} className="hover:bg-muted/40">
                    <TableCell className="text-sm font-medium">{m.month}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatFullINR(m.totalCommission)}</TableCell>
                    <TableCell className="text-right text-xs text-violet-600">{formatFullINR(m.employeePayouts)}</TableCell>
                    <TableCell className="text-right text-xs text-emerald-600">{formatFullINR(m.agencyShare)}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.settledOn}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MyCommissionTab() {
  const chartData = REVENUE_DATA.map((d) => ({ month: d.month, commission: d.commission }));
  const maxCommission = Math.max(...chartData.map((d) => d.commission));
  const myCommissionCredits = WALLET_TXNS.filter((t) => t.source === "Commission");
  const totalEarned = myCommissionCredits.reduce((s, t) => s + t.amount, 0);
  const lastMonth = REVENUE_DATA[REVENUE_DATA.length - 1].commission;
  const prevMonth = REVENUE_DATA[REVENUE_DATA.length - 2].commission;
  const growth = ((lastMonth - prevMonth) / prevMonth) * 100;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white border-0">
          <CardContent className="p-4">
            <Award className="w-5 h-5 text-white/80 mb-2" />
            <p className="text-2xl font-bold tracking-tight">{formatFullINR(totalEarned)}</p>
            <p className="text-[11px] text-white/80">Total Commission Earned (Recent)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <TrendingUp className="w-5 h-5 text-emerald-600 mb-2" />
            <p className="text-2xl font-bold tracking-tight">{formatINR(lastMonth)}</p>
            <p className="text-[11px] text-muted-foreground">Last Month ({REVENUE_DATA[REVENUE_DATA.length - 1].month})</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <Percent className="w-5 h-5 text-amber-600 mb-2" />
            <p className={cn("text-2xl font-bold tracking-tight", growth >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {growth >= 0 ? "+" : ""}{growth.toFixed(1)}%
            </p>
            <p className="text-[11px] text-muted-foreground">Month-over-month Growth</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Commission Earned · Last 12 Months</CardTitle>
          <CardDescription>Monthly commission credits to your wallet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="commBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" />
                    <stop offset="95%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => [formatFullINR(v), "Commission"]}
                  cursor={{ fill: "rgba(13,148,136,0.05)" }}
                />
                <Bar dataKey="commission" radius={[6, 6, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.commission === maxCommission ? "#f59e0b" : "url(#commBar)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Peak month ·
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> Other months
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Commission Credits</CardTitle>
          <CardDescription>Latest commission payouts to your wallet</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-80 overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myCommissionCredits.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 flex items-center justify-center"><ArrowDownLeft className="w-3 h-3" /></span>
                        <span className="text-xs">{t.description}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold text-emerald-600">+{formatFullINR(t.amount)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatFullINR(t.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CommissionView() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Commission"
        subtitle="Configure commission rules, track monthly settlements and monitor your earnings."
      />
      <Tabs defaultValue="rules">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="rules">Commission Rules</TabsTrigger>
          <TabsTrigger value="settlement">Monthly Settlement</TabsTrigger>
          <TabsTrigger value="my">My Commission</TabsTrigger>
        </TabsList>
        <TabsContent value="rules" className="mt-4"><CommissionRulesTab /></TabsContent>
        <TabsContent value="settlement" className="mt-4"><MonthlySettlementTab /></TabsContent>
        <TabsContent value="my" className="mt-4"><MyCommissionTab /></TabsContent>
      </Tabs>
    </div>
  );
}

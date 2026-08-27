"use client";

import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plane, Building2, Palmtree, Users, Percent, Edit,
  Clock, Award, TrendingUp, Wallet, ArrowDownLeft, Save,
} from "lucide-react";
import { api } from "@/lib/api";
import { mapApiCommission, type MappedCommission } from "@/lib/api-mappers";
import {
  formatINR, formatFullINR, StatusBadge, PageShell, PageHeader, MetricCard, SectionHeader, BrandHero,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

type RuleCard = {
  id: string;
  title: string;
  icon?: typeof Plane;
  color?: string;
  type: string;
  rate: string;
  scope: string;
  desc: string;
};

const DEFAULT_RULE_CARDS: RuleCard[] = [
  { id: "airline", title: "Airline Commission", icon: Plane, color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400", type: "Percentage", rate: "2% - 5%", scope: "All domestic & international flights", desc: "Tier-based commission on base fare, varies by airline and route class." },
  { id: "hotel", title: "Hotel Commission", icon: Building2, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400", type: "Percentage", rate: "8% - 15%", scope: "All hotel bookings via API partners", desc: "Higher rates for luxury and long-stay bookings." },
  { id: "package", title: "Holiday Package", icon: Palmtree, color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400", type: "Markup", rate: "10% - 20%", scope: "Custom & packaged holidays", desc: "Built-in markup over net rate from suppliers." },
  { id: "employee", title: "Employee Incentive", icon: Users, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400", type: "Percentage", rate: "0.5% - 1.5%", scope: "Of booking value, paid monthly", desc: "Tiered incentive for sales team based on targets achieved." },
];

const RULE_ICON: Record<string, typeof Plane> = {
  airline: Plane,
  hotel: Building2,
  package: Palmtree,
  employee: Users,
};

const RULE_COLOR: Record<string, string> = {
  airline: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400",
  hotel: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  package: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
  employee: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
};

function EditRuleDialog({
  rule,
  open,
  onOpenChange,
  onSave,
}: {
  rule: RuleCard | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (updated: RuleCard) => void;
}) {
  const [rate, setRate] = useState("");
  const [scope, setScope] = useState("");
  const [desc, setDesc] = useState("");

  useEffect(() => {
    if (rule) {
      setRate(rule.rate);
      setScope(rule.scope);
      setDesc(rule.desc);
    }
  }, [rule]);

  if (!rule) return null;
  const current = rule;

  function save() {
    onSave({
      ...current,
      rate: rate || current.rate,
      scope: scope || current.scope,
      desc: desc || current.desc,
    });
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
            <Label>Rate</Label>
            <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder={rule.rate} />
          </div>
          <div>
            <Label>Scope</Label>
            <Input value={scope} onChange={(e) => setScope(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} className="bg-primary hover:bg-primary/90">Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CommissionRulesTab({ data }: { data: MappedCommission | null }) {
  const { toast } = useToast();
  const [rules, setRules] = useState<RuleCard[]>(DEFAULT_RULE_CARDS);
  const [editRule, setEditRule] = useState<RuleCard | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (Array.isArray(data?.rules) && data.rules.length > 0) {
      setRules(
        data.rules.map((r) => ({
          id: r.id,
          title: r.title,
          type: r.type,
          rate: r.rate,
          scope: r.scope,
          desc: r.desc,
          icon: RULE_ICON[r.id] || Percent,
          color: RULE_COLOR[r.id] || "bg-muted text-muted-foreground",
        }))
      );
    } else {
      setRules(DEFAULT_RULE_CARDS);
    }
  }, [data?.rules]);

  const persist = async () => {
    setSaving(true);
    try {
      const payload = rules.map(({ id, title, type, rate, scope, desc }) => ({
        id, title, type, rate, scope, desc,
      }));
      await api.saveCommissionRules(payload);
      toast({ title: "Commission rules saved" });
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof Error ? e.message : "Could not save rules",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={persist} disabled={saving} className="bg-primary hover:bg-primary/90">
          <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving…" : "Save Rules"}
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rules.map((rule) => {
          const Icon = rule.icon || RULE_ICON[rule.id] || Percent;
          const color = rule.color || RULE_COLOR[rule.id] || "bg-muted text-muted-foreground";
          return (
            <Card key={rule.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color)}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{rule.title}</p>
                      <p className="text-[11px] text-muted-foreground">{rule.type}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => { setEditRule(rule); setEditOpen(true); }}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <p className="text-lg font-bold text-primary dark:text-brand-teal">{rule.rate}</p>
                <p className="text-xs text-muted-foreground">{rule.scope}</p>
                <p className="text-xs">{rule.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <EditRuleDialog
        rule={editRule}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSave={(updated) => {
          setRules((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
        }}
      />
    </div>
  );
}

function MonthlySettlementTab({ data }: { data: MappedCommission | null }) {
  const list = (data?.monthly || []).map((m) => ({
    month: m.label,
    totalCommission: m.commission,
    bookings: m.bookings,
    status: "Settled" as const,
  }));

  const totalCommission = data?.summary.totalCommission ?? 0;
  const paidCommission = data?.summary.paidCommission ?? 0;
  const pendingCommission = data?.summary.pendingCommission ?? 0;
  const totalBookings = data?.summary.totalBookings ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={Award} label="Total Commission" value={formatINR(totalCommission)} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={0} />
        <MetricCard icon={Wallet} label="Paid (Credits)" value={formatINR(paidCommission)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={1} />
        <MetricCard icon={Clock} label="Pending" value={formatINR(pendingCommission)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
        <MetricCard icon={Users} label="Bookings" value={String(totalBookings)} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" index={3} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader title="Monthly Commission Totals" description="Commission earned by month from live bookings" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-96 overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Total Commission</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No monthly commission data yet.
                    </TableCell>
                  </TableRow>
                ) : list.map((m) => (
                  <TableRow key={m.month} className="hover:bg-muted/40">
                    <TableCell className="text-sm font-medium">{m.month}</TableCell>
                    <TableCell className="text-right text-xs">{m.bookings}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatFullINR(m.totalCommission)}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
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

function MyCommissionTab({ data }: { data: MappedCommission | null }) {
  const chartData = data
    ? data.monthly.map((m) => ({ month: m.label, commission: m.commission }))
    : [];

  const maxCommission = Math.max(...chartData.map((d) => d.commission), 0);
  const myCommissionCredits = data?.credits ?? [];
  const totalEarned = data ? data.summary.totalCommission : 0;
  const lastMonth = chartData.length ? chartData[chartData.length - 1].commission : 0;
  const prevMonth = chartData.length > 1 ? chartData[chartData.length - 2].commission : 0;
  const growth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BrandHero
          eyebrow="Total Earned"
          title={formatFullINR(totalEarned)}
          subtitle="Commission earned in recent months"
          className="sm:col-span-1"
        />
        <MetricCard icon={TrendingUp} label="Last Month" value={formatINR(lastMonth)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={0} />
        <MetricCard
          icon={Percent}
          label="Month-over-month Growth"
          value={`${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`}
          color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"
          index={1}
        />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader title="Commission Earned · Last 12 Months" description="Monthly commission credits to your wallet" />
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="commBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-blue)" />
                    <stop offset="95%" stopColor="var(--brand-teal)" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => [formatFullINR(v), "Commission"]}
                  cursor={{ fill: "rgba(42,123,189,0.05)" }}
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
            <span className="w-2.5 h-2.5 rounded-sm bg-brand-teal" /> Other months
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader title="Recent Commission Credits" description="Latest commission payouts to your wallet" />
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
                {myCommissionCredits.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      No wallet commission credits yet — totals above come from booking commissions.
                    </TableCell>
                  </TableRow>
                )}
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
  const [data, setData] = useState<MappedCommission | null>(null);

  useEffect(() => {
    api.getCommission()
      .then((res) => {
        setData(mapApiCommission(res));
      })
      .catch(() => undefined);
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Commission"
        subtitle="Live settlement totals, wallet credits and editable commission rules."
      />
      <Tabs defaultValue="settlement">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="settlement">Monthly Settlement</TabsTrigger>
          <TabsTrigger value="my">My Commission</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
        </TabsList>
        <TabsContent value="settlement" className="mt-4"><MonthlySettlementTab data={data} /></TabsContent>
        <TabsContent value="my" className="mt-4"><MyCommissionTab data={data} /></TabsContent>
        <TabsContent value="rules" className="mt-4"><CommissionRulesTab data={data} /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

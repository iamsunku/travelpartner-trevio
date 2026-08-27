"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, ArrowLeftRight, Search, TrendingUp, RefreshCw,
  Wallet as WalletIcon, Loader2, ArrowDownLeft, ArrowUpRight, Award,
} from "lucide-react";
import { useDemoDataStore } from "@/store/demo-data-store";
import { useAuthStore } from "@/store/app-store";
import { api } from "@/lib/api";
import { mapApiWalletTxn } from "@/lib/api-mappers";
import {
  formatINR, formatFullINR, PageShell, PageHeader,
} from "@/components/shared/ui-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { payWithRazorpay } from "@/lib/razorpay";
import { cn } from "@/lib/utils";

function AddMoneyDialog({
  open,
  onOpenChange,
  onCredited,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCredited?: () => void;
}) {
  const { toast } = useToast();
  const walletTopUp = useDemoDataStore((s) => s.walletTopUp);
  const [amount, setAmount] = useState("");
  const [paying, setPaying] = useState(false);

  async function proceed() {
    const value = Number(amount) || 0;
    if (value <= 0) {
      toast({ title: "Enter amount", description: "Please enter a valid amount to add", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      const result = await payWithRazorpay({
        amount: value,
        name: "Trevio Global",
        description: `Wallet top-up ₹${value.toLocaleString("en-IN")}`,
      });
      if (!result.success) {
        toast({
          title: "Top-up failed",
          description: result.error || "Payment was not completed.",
          variant: "destructive",
        });
        return;
      }
      try {
        await walletTopUp(value, "Razorpay", {
          orderId: result.orderId,
          paymentId: result.paymentId,
          signature: result.signature,
          demo: result.demo,
        });
        toast({
          title: result.demo ? "Demo top-up" : "Top-up successful",
          description: result.demo
            ? `${formatFullINR(value)} added in demo mode (no real charge).`
            : `${formatFullINR(value)} added to wallet via Razorpay.`,
        });
        onOpenChange(false);
        setAmount("");
        onCredited?.();
      } catch (e) {
        toast({
          title: "Wallet credit failed",
          description: e instanceof Error ? e.message : "Payment succeeded but wallet was not credited.",
          variant: "destructive",
        });
      }
    } finally {
      setPaying(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!paying) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add money</DialogTitle>
          <DialogDescription>Top up this agency wallet via Razorpay.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 10000" className="h-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {[5000, 10000, 25000, 50000].map((v) => (
              <Button key={v} type="button" size="sm" variant="outline" onClick={() => setAmount(String(v))}>
                {formatINR(v)}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={paying} onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={paying} onClick={proceed} className="bg-teal-600 hover:bg-teal-700">
            {paying ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
            Pay now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone?: () => void;
}) {
  const { toast } = useToast();
  const walletTransfer = useDemoDataStore((s) => s.walletTransfer);
  const balance = useDemoDataStore((s) => s.walletBalance);
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState("");

  function submit() {
    const value = Number(amount) || 0;
    if (!to.trim() || value <= 0) {
      toast({ title: "Enter details", description: "Recipient and amount are required", variant: "destructive" });
      return;
    }
    if (value > balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    walletTransfer(value, `Transfer to ${to}`);
    toast({ title: "Transfer initiated", description: `${formatFullINR(value)} → ${to}` });
    onOpenChange(false);
    setAmount("");
    setTo("");
    onDone?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer funds</DialogTitle>
          <DialogDescription>Send money to a bank account or agent wallet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>To (account / agent)</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Name or account ref" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label>Amount (₹)</Label>
            <Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-10" />
          </div>
          <p className="text-xs text-muted-foreground">Available: {formatFullINR(balance)}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildBalanceTrend(
  balance: number,
  txns: { date: string; type: string; amount: number; balance: number }[],
): { day: string; balance: number }[] {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));
  const days: { day: string; balance: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    let dayBal: number | undefined;
    for (const t of sorted) {
      if (t.date.slice(0, 10) <= key) dayBal = t.balance;
    }
    days.push({ day: label, balance: Math.max(0, i === 0 ? balance : (dayBal ?? balance)) });
  }
  return days;
}

function StatTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: "teal" | "green" | "rose" | "amber";
}) {
  const tones = {
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  };
  return (
    <Card className="shadow-none">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", tones[tone])}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold tabular-nums tracking-tight mt-0.5 truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function WalletView() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [agencyName, setAgencyName] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const balance = useDemoDataStore((s) => s.walletBalance);
  const walletTxns = useDemoDataStore((s) => s.walletTxns);

  async function refreshWallet() {
    setLoading(true);
    try {
      const res = await api.getWallet(user?.agencyId || undefined);
      useDemoDataStore.setState({
        walletBalance: res.balance,
        walletTxns: (res.transactions ?? []).map(mapApiWalletTxn),
      });
      setAgencyName(res.agencyName || "");
    } catch (e) {
      toast({
        title: "Could not load wallet",
        description: e instanceof Error ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshWallet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.agencyId]);

  const commissionThisMonth = useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return walletTxns
      .filter((t) => t.type === "Credit" && t.source === "Commission" && t.date.startsWith(ym))
      .reduce((s, t) => s + t.amount, 0);
  }, [walletTxns]);
  const totalCredited = walletTxns.filter((t) => t.type === "Credit").reduce((s, t) => s + t.amount, 0);
  const totalDebited = walletTxns.filter((t) => t.type === "Debit").reduce((s, t) => s + t.amount, 0);

  const filtered = walletTxns.filter((t) => {
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!t.description.toLowerCase().includes(q) && !t.source.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const balanceData = useMemo(() => buildBalanceTrend(balance, walletTxns), [balance, walletTxns]);
  const chartDomain = useMemo(() => {
    const vals = balanceData.map((d) => d.balance);
    const max = Math.max(...vals, balance, 1000);
    return [0, Math.ceil(max * 1.15)] as [number, number];
  }, [balanceData, balance]);

  return (
    <PageShell className="space-y-5">
      <PageHeader
        title="Wallet"
        subtitle={agencyName ? `${agencyName} prepaid balance` : "Top-ups, transfers & commission credits"}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={loading} onClick={() => void refreshWallet()}>
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1", loading && "animate-spin")} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTransferOpen(true)}>
              <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> Transfer
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setAddOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add money
            </Button>
          </div>
        }
      />

      {/* Balance hero — solid colors, always readable */}
      <Card className="overflow-hidden border-teal-200/60 dark:border-teal-900/40 shadow-none">
        <CardContent className="p-0">
          <div className="bg-gradient-to-br from-[#1e6bb8] to-[#0d9488] text-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <p className="text-white/80 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                  <WalletIcon className="w-3.5 h-3.5" />
                  Available balance
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                </p>
                <p className="text-3xl sm:text-4xl font-semibold mt-2 tabular-nums tracking-tight">
                  {formatFullINR(balance)}
                </p>
                <p className="text-sm text-white/85 mt-2 flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {formatINR(commissionThisMonth)} commission this month
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {agencyName ? (
                  <Badge className="bg-white/15 text-white border-white/25 hover:bg-white/20">
                    {agencyName}
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  className="bg-white text-teal-800 hover:bg-white/90"
                  onClick={() => setAddOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add money
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats row — even 3 columns */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile icon={Award} label="Commission this month" value={formatFullINR(commissionThisMonth)} tone="amber" />
        <StatTile icon={ArrowDownLeft} label="Total credited" value={formatFullINR(totalCredited)} tone="green" />
        <StatTile icon={ArrowUpRight} label="Total debited" value={formatFullINR(totalDebited)} tone="rose" />
      </div>

      {/* Chart + empty hint */}
      <Card className="shadow-none">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-sm font-semibold">Balance trend · 7 days</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {walletTxns.length > 0 ? "From your statement history" : "No activity yet — line stays flat until you top up"}
              </p>
            </div>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <defs>
                  <linearGradient id="walletBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={chartDomain}
                  tick={{ fontSize: 11, fill: "#6b7280" }}
                  tickFormatter={(v) => formatINR(v)}
                  width={52}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 12 }}
                  formatter={(v: number) => [formatFullINR(v), "Balance"]}
                />
                <Area type="monotone" dataKey="balance" stroke="#1e6bb8" strokeWidth={2.5} fill="url(#walletBal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Statement */}
      <Card className="shadow-none">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Wallet statement</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Credits, debits and running balance</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-[140px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Credit">Credit</SelectItem>
                  <SelectItem value="Debit">Debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center">
              <WalletIcon className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
              <p className="text-sm font-medium">
                {loading ? "Loading transactions…" : "No transactions yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Top up the wallet to start using prepaid balance for bookings and payouts.
              </p>
              {!loading && (
                <Button className="mt-4 bg-teal-600 hover:bg-teal-700" size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add money
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => {
                      const isCredit = t.type === "Credit";
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                          </TableCell>
                          <TableCell>
                            <span className={cn(
                              "inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md",
                              isCredit
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
                            )}>
                              {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                              {t.type}
                            </span>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{t.source}</Badge></TableCell>
                          <TableCell className="text-xs">{t.description}</TableCell>
                          <TableCell className={cn("text-right text-xs font-semibold tabular-nums", isCredit ? "text-emerald-600" : "text-rose-600")}>
                            {isCredit ? "+" : "-"}{formatFullINR(t.amount)}
                          </TableCell>
                          <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                            {formatFullINR(t.balance)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-[11px] text-muted-foreground px-3 py-2 border-t bg-muted/20">
                Showing {filtered.length} of {walletTxns.length}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddMoneyDialog open={addOpen} onOpenChange={setAddOpen} onCredited={refreshWallet} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} onDone={refreshWallet} />
    </PageShell>
  );
}

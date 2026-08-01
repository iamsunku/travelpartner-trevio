"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, ArrowLeftRight, Search, TrendingUp,
  Wallet as WalletIcon, Loader2, IndianRupee, ArrowDownLeft, ArrowUpRight, Award,
} from "lucide-react";
import { useDemoDataStore } from "@/store/demo-data-store";
import {
  formatINR, formatFullINR, PageShell, PageHeader, MetricCard, SectionHeader,
} from "@/components/shared/ui-helpers";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { payWithRazorpay } from "@/lib/razorpay";
import { cn } from "@/lib/utils";

function AddMoneyDialog() {
  const { toast } = useToast();
  const walletTopUp = useDemoDataStore((s) => s.walletTopUp);
  const [open, setOpen] = useState(false);
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
            ? `${formatFullINR(value)} added in demo mode (no real charge). Configure Razorpay for live payments.`
            : `${formatFullINR(value)} added to wallet via Razorpay.`,
        });
        setOpen(false);
        setAmount("");
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
    <Dialog open={open} onOpenChange={(v) => { if (!paying) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur">
          <Plus className="w-4 h-4 mr-1" /> Add Money
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Money to Wallet</DialogTitle>
          <DialogDescription>Top-up via Razorpay checkout. Live keys required in production.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8 text-lg font-semibold" disabled={paying} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1000, 5000, 10000, 50000, 100000].map((a) => (
              <button key={a} type="button" onClick={() => setAmount(String(a))} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground" disabled={paying}>+{formatINR(a)}</button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={paying}>Cancel</Button>
          <Button onClick={proceed} disabled={paying}>
            {paying ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Processing…</> : "Proceed to Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog() {
  const { toast } = useToast();
  const walletTransfer = useDemoDataStore((s) => s.walletTransfer);
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  function submit() {
    if (!to || !amount || Number(amount) <= 0) {
      toast({ title: "Missing details", description: "Enter recipient and amount", variant: "destructive" });
      return;
    }
    walletTransfer(Number(amount), `Transfer to ${to}`);
    toast({ title: "Transfer initiated", description: `${formatFullINR(Number(amount))} to ${to}` });
    setOpen(false); setTo(""); setAmount("");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
          <ArrowLeftRight className="w-4 h-4 mr-1" /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Money</DialogTitle>
          <DialogDescription>Transfer funds to a bank account or another agent wallet.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Transfer To</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger><SelectValue placeholder="Select recipient" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Bank Account (HDFC ****1234)">Bank Account (HDFC ****1234)</SelectItem>
                <SelectItem value="Agent: Rahul Khanna">Agent: Rahul Khanna</SelectItem>
                <SelectItem value="Agent: Deepa Rao">Agent: Deepa Rao</SelectItem>
                <SelectItem value="Vendor: IndiGo Airlines">Vendor: IndiGo Airlines</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8 text-lg font-semibold" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-primary hover:bg-primary/90">Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WalletView() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const balance = useDemoDataStore((s) => s.walletBalance);
  const walletTxns = useDemoDataStore((s) => s.walletTxns);

  const commissionThisMonth = walletTxns.filter((t) => t.type === "Credit" && t.source === "Commission").reduce((s, t) => s + t.amount, 0);
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

  // Wallet balance over time (synthetic)
  const balanceData = [
    { day: "Mon", balance: 820000 },
    { day: "Tue", balance: 838000 },
    { day: "Wed", balance: 832000 },
    { day: "Thu", balance: 855000 },
    { day: "Fri", balance: 841000 },
    { day: "Sat", balance: 848000 },
    { day: "Sun", balance: 845000 },
  ];

  return (
    <PageShell>
      <PageHeader title="Wallet" subtitle="Manage your prepaid wallet, top-ups, transfers and commission credits." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-2">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-blue via-primary to-brand-teal text-white">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.18),transparent_55%)]" />
            <div className="absolute -bottom-16 -left-10 w-48 h-48 rounded-full bg-brand-teal/30 blur-3xl" />
            <div className="relative z-10 p-5 lg:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-white/75 text-[11px] font-medium uppercase tracking-[0.14em] flex items-center gap-1.5">
                    <WalletIcon className="w-3.5 h-3.5" /> Available Balance
                  </p>
                  <p className="text-3xl lg:text-[34px] font-semibold mt-2 tracking-tight tabular-nums">{formatFullINR(balance)}</p>
                  <p className="text-white/85 text-sm mt-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{formatINR(commissionThisMonth)} commission this month
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Badge className="bg-white/15 text-white border-white/20 font-medium">Travel Partner Wallet</Badge>
                  <p className="text-[10px] text-white/60 font-mono">WAL-AG-001</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-5">
                <AddMoneyDialog />
                <TransferDialog />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="space-y-3">
          <MetricCard
            icon={Award}
            label="Commission Credited (This Month)"
            value={formatFullINR(commissionThisMonth)}
            color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
            index={0}
          />
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              icon={ArrowDownLeft}
              label="Total Credited"
              value={formatINR(totalCredited)}
              color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
              index={1}
            />
            <MetricCard
              icon={ArrowUpRight}
              label="Total Debited"
              value={formatINR(totalDebited)}
              color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400"
              index={2}
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <SectionHeader title="Wallet Balance · Last 7 Days" description="Daily wallet balance trend" />
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="walletBal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-teal)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--brand-teal)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number) => [formatFullINR(v), "Balance"]}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--brand-blue)" strokeWidth={2.5} fill="url(#walletBal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <SectionHeader title="Wallet Statement" description="All transactions in chronological order" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row gap-2 px-4 pb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search description or source..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Transactions</SelectItem>
                <SelectItem value="Credit">Credit Only</SelectItem>
                <SelectItem value="Debit">Debit Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border max-h-[60vh] overflow-y-auto scroll-thin mx-4">
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
                    <TableRow key={t.id} className="hover:bg-muted/40">
                      <TableCell className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}</TableCell>
                      <TableCell>
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md",
                          isCredit ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" : "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400"
                        )}>
                          {isCredit ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                          {t.type}
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{t.source}</Badge></TableCell>
                      <TableCell className="text-xs">{t.description}</TableCell>
                      <TableCell className={cn("text-right text-xs font-semibold", isCredit ? "text-emerald-600" : "text-rose-600")}>
                        {isCredit ? "+" : "-"}{formatFullINR(t.amount)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{formatFullINR(t.balance)}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No transactions found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 px-4 pb-4">Showing {filtered.length} of {walletTxns.length} transactions</p>
        </CardContent>
      </Card>
    </PageShell>
  );
}

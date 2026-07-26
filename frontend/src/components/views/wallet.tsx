"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, ArrowLeftRight, Search, TrendingUp, CreditCard,
  Smartphone, Building2, Wallet as WalletIcon, Loader2, CheckCircle2,
  ShieldCheck, Lock, IndianRupee, ArrowDownLeft, ArrowUpRight, Award,
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
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { key: "Card", icon: CreditCard, label: "Card", color: "text-amber-600 bg-amber-100 dark:bg-amber-500/15" },
  { key: "UPI", icon: Smartphone, label: "UPI", color: "text-teal-600 bg-teal-100 dark:bg-teal-500/15" },
  { key: "Net Banking", icon: Building2, label: "Net Banking", color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-500/15" },
  { key: "Wallet", icon: WalletIcon, label: "Wallet", color: "text-rose-600 bg-rose-100 dark:bg-rose-500/15" },
];

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra", "Yes Bank"];

function RazorpayModal({ amount, open, onOpenChange, onSuccess, title = "Add Money" }: {
  amount: number; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void; title?: string;
}) {
  const { toast } = useToast();
  const [method, setMethod] = useState("Card");
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [upi, setUpi] = useState("");
  const [bank, setBank] = useState("");
  const [status, setStatus] = useState<"form" | "processing" | "success">("form");

  function formatCardNumber(v: string) {
    return v.replace(/\s/g, "").replace(/(\d{4})/g, "$1 ").trim().slice(0, 19);
  }
  function pay() {
    setStatus("processing");
    setTimeout(() => {
      setStatus("success");
      setTimeout(() => {
        onSuccess();
        setStatus("form");
        onOpenChange(false);
        toast({ title: "Top-up Successful", description: `${formatFullINR(amount)} added to wallet via ${method}` });
        setCard({ number: "", expiry: "", cvv: "", name: "" });
        setUpi(""); setBank("");
      }, 1200);
    }, 1800);
  }
  const canPay =
    method === "Card" ? card.number.replace(/\s/g, "").length >= 12 && card.expiry && card.cvv.length >= 3 :
    method === "UPI" ? upi.includes("@") :
    method === "Net Banking" ? !!bank : true;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (status === "form") onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" showCloseButton={status === "form"}>
        <div className="bg-gradient-to-r from-violet-600 via-violet-700 to-indigo-700 text-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-white/20 flex items-center justify-center font-bold text-xs">R</div>
              <div>
                <p className="text-xs font-medium">Razorpay Secure</p>
                <p className="text-[10px] text-white/70">Test Mode</p>
              </div>
            </div>
            <ShieldCheck className="w-4 h-4 text-white/80" />
          </div>
          <div className="mt-3">
            <p className="text-[11px] text-white/70">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{formatFullINR(amount)}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {status === "form" && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                      method === m.key ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10" : "border-border hover:border-violet-300"
                    )}
                  >
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center", m.color)}>
                      <m.icon className="w-3.5 h-3.5" />
                    </div>
                    <span className={cn("text-[10px] font-medium", method === m.key ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground")}>{m.label}</span>
                  </button>
                ))}
              </div>

              {method === "Card" && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px]">Card Number</Label>
                    <div className="relative">
                      <Input placeholder="4111 1111 1111 1111" value={card.number} onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })} className="text-sm" />
                      <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px]">Cardholder Name</Label>
                    <Input placeholder="Name on card" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} className="text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Expiry</Label>
                      <Input placeholder="MM/YY" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} className="text-sm" maxLength={5} />
                    </div>
                    <div>
                      <Label className="text-[11px]">CVV</Label>
                      <Input type="password" placeholder="•••" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) })} className="text-sm" maxLength={3} />
                    </div>
                  </div>
                </div>
              )}

              {method === "UPI" && (
                <div className="space-y-2">
                  <Label className="text-[11px]">UPI ID</Label>
                  <Input placeholder="yourname@upi" value={upi} onChange={(e) => setUpi(e.target.value)} className="text-sm" />
                  <div className="flex flex-wrap gap-1.5">
                    {["@oksbi", "@okhdfcbank", "@paytm", "@ybl"].map((s) => (
                      <button key={s} onClick={() => setUpi((upi.split("@")[0] || "customer") + s)} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground">{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {method === "Net Banking" && (
                <div className="space-y-2">
                  <Label className="text-[11px]">Select Bank</Label>
                  <Select value={bank} onValueChange={setBank}>
                    <SelectTrigger><SelectValue placeholder="Choose your bank" /></SelectTrigger>
                    <SelectContent>
                      {BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {method === "Wallet" && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><WalletIcon className="w-3.5 h-3.5" /> Travel Partner Wallet</p>
                  <p className="mt-1">Available balance: {formatFullINR(845000)}</p>
                </div>
              )}

              <Button onClick={pay} disabled={!canPay} className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700">
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Pay {formatFullINR(amount)}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Secured by Razorpay · 256-bit encryption
              </p>
            </motion.div>
          )}

          {status === "processing" && (
            <motion.div key="p" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
              <p className="text-sm font-medium">Processing payment...</p>
              <p className="text-[11px] text-muted-foreground">Please don't close this window</p>
            </motion.div>
          )}

          {status === "success" && (
            <motion.div key="s" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-8 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold">Top-up Successful!</p>
              <p className="text-xl font-bold text-emerald-600">{formatFullINR(amount)}</p>
              <p className="text-[11px] text-muted-foreground">via {method}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function AddMoneyDialog() {
  const { toast } = useToast();
  const walletTopUp = useDemoDataStore((s) => s.walletTopUp);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState("");

  function proceed() {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Enter amount", description: "Please enter a valid amount to add", variant: "destructive" });
      return;
    }
    setOpen(false);
    setPayOpen(true);
  }
  function onSuccess() {
    walletTopUp(Number(amount) || 0, "Razorpay");
    setAmount("");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-white/20 hover:bg-white/30 text-white border border-white/20 backdrop-blur">
            <Plus className="w-4 h-4 mr-1" /> Add Money
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Money to Wallet</DialogTitle>
            <DialogDescription>Top-up your wallet balance via secure Razorpay checkout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8 text-lg font-semibold" />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[1000, 5000, 10000, 50000, 100000].map((a) => (
                <button key={a} onClick={() => setAmount(String(a))} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground">+{formatINR(a)}</button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={proceed} className="bg-primary hover:bg-primary/90">Proceed to Pay</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RazorpayModal amount={Number(amount) || 0} open={payOpen} onOpenChange={setPayOpen} onSuccess={onSuccess} />
    </>
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

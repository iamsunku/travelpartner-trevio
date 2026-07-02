"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, CreditCard, Smartphone, Building2, Wallet, Loader2,
  CheckCircle2, ShieldCheck, Lock, IndianRupee, TrendingUp, Clock,
  RefreshCw, AlertCircle,
} from "lucide-react";
import { PAYMENTS, CUSTOMERS } from "@/lib/mock-data";
import {
  formatINR, formatFullINR, StatusBadge, PageHeader,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent,
} from "@/components/ui/card";
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
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const METHOD_ICON: Record<string, React.ElementType> = {
  Razorpay: ShieldCheck, UPI: Smartphone, Card: CreditCard,
  "Net Banking": Building2, Cash: IndianRupee, "Bank Transfer": Building2, Wallet: Wallet,
};

const METHOD_COLORS: Record<string, string> = {
  Razorpay: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  UPI: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  Card: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Net Banking": "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Cash: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  "Bank Transfer": "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400",
  Wallet: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

const PAYMENT_METHODS = [
  { key: "Card", icon: CreditCard, label: "Card", color: "text-amber-600 bg-amber-100 dark:bg-amber-500/15" },
  { key: "UPI", icon: Smartphone, label: "UPI", color: "text-teal-600 bg-teal-100 dark:bg-teal-500/15" },
  { key: "Net Banking", icon: Building2, label: "Net Banking", color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-500/15" },
  { key: "Wallet", icon: Wallet, label: "Wallet", color: "text-rose-600 bg-rose-100 dark:bg-rose-500/15" },
];

const BANKS = ["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra", "Yes Bank"];

function RazorpayModal({ amount, open, onOpenChange, onSuccess }: {
  amount: number; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void;
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
        toast({ title: "Payment Successful", description: `${formatFullINR(amount)} collected via ${method}` });
        setCard({ number: "", expiry: "", cvv: "", name: "" });
        setUpi("");
        setBank("");
      }, 1200);
    }, 1800);
  }

  const canPay =
    method === "Card" ? card.number.replace(/\s/g, "").length >= 12 && card.expiry && card.cvv.length >= 3 :
    method === "UPI" ? upi.includes("@") :
    method === "Net Banking" ? !!bank :
    true;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (status === "form") onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden" showCloseButton={status === "form"}>
        {/* Razorpay-style header */}
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
            <p className="text-[11px] text-white/70">Amount Payable</p>
            <p className="text-2xl font-bold tracking-tight">{formatFullINR(amount)}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {status === "form" && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
              {/* Method tabs */}
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

              {/* Card form */}
              {method === "Card" && (
                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px]">Card Number</Label>
                    <div className="relative">
                      <Input
                        placeholder="4111 1111 1111 1111"
                        value={card.number}
                        onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                        className="text-sm"
                      />
                      <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px]">Cardholder Name</Label>
                    <Input placeholder="Name on card" value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} className="text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px]">Expiry (MM/YY)</Label>
                      <Input placeholder="12/26" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} className="text-sm" maxLength={5} />
                    </div>
                    <div>
                      <Label className="text-[11px]">CVV</Label>
                      <Input type="password" placeholder="•••" value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) })} className="text-sm" maxLength={3} />
                    </div>
                  </div>
                </div>
              )}

              {/* UPI form */}
              {method === "UPI" && (
                <div className="space-y-2">
                  <Label className="text-[11px]">UPI ID</Label>
                  <Input placeholder="yourname@upi" value={upi} onChange={(e) => setUpi(e.target.value)} className="text-sm" />
                  <div className="flex flex-wrap gap-1.5">
                    {["@oksbi", "@okhdfcbank", "@paytm", "@ybl"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setUpi((upi.split("@")[0] || "customer") + s)}
                        className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Net Banking */}
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

              {/* Wallet */}
              {method === "Wallet" && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" /> Travel Partner Wallet</p>
                  <p className="mt-1">Available balance: {formatFullINR(845000)}</p>
                </div>
              )}

              <Button
                onClick={pay}
                disabled={!canPay}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
              >
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Pay {formatFullINR(amount)}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Secured by Razorpay · 256-bit encryption
              </p>
            </motion.div>
          )}

          {status === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8 flex flex-col items-center gap-3">
              <Loader2 className="w-12 h-12 text-violet-600 animate-spin" />
              <p className="text-sm font-medium">Processing payment...</p>
              <p className="text-[11px] text-muted-foreground">Please don't close this window</p>
            </motion.div>
          )}

          {status === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-8 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold">Payment Successful!</p>
              <p className="text-xl font-bold text-emerald-600">{formatFullINR(amount)}</p>
              <p className="text-[11px] text-muted-foreground">via {method}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function CollectPaymentDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");

  function proceedToPay() {
    if (!customer || !amount || Number(amount) <= 0) {
      toast({ title: "Missing details", description: "Select customer and enter valid amount", variant: "destructive" });
      return;
    }
    setOpen(false);
    setPayOpen(true);
  }

  function onSuccess() {
    setCustomer("");
    setAmount("");
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
            <Plus className="w-4 h-4 mr-1" /> Collect Payment
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect Payment</DialogTitle>
            <DialogDescription>Enter payment details to proceed to secure checkout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Customer</Label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {CUSTOMERS.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
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
            <div className="flex flex-wrap gap-1.5">
              {[1000, 5000, 10000, 25000].map((a) => (
                <button key={a} onClick={() => setAmount(String(a))} className="text-[10px] px-2 py-1 rounded-md bg-muted hover:bg-muted/70 text-muted-foreground">+{formatINR(a)}</button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={proceedToPay} className="bg-teal-600 hover:bg-teal-700">Proceed to Pay</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RazorpayModal
        amount={Number(amount) || 0}
        open={payOpen}
        onOpenChange={setPayOpen}
        onSuccess={onSuccess}
      />
    </>
  );
}

export function PaymentsView() {
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = useMemo(() => {
    return PAYMENTS.filter((p) => {
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.txnId.toLowerCase().includes(q) && !p.customerName.toLowerCase().includes(q) && !p.bookingRef.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [search, methodFilter, statusFilter, typeFilter]);

  const totalCollected = PAYMENTS.filter((p) => p.status === "Success" && p.type === "Payment").reduce((s, p) => s + p.amount, 0);
  const pending = PAYMENTS.filter((p) => p.status === "Pending").reduce((s, p) => s + p.amount, 0);
  const refunded = PAYMENTS.filter((p) => p.type === "Refund").reduce((s, p) => s + p.amount, 0);
  const today = PAYMENTS.filter((p) => p.date === "2025-01-20" && p.status === "Success").reduce((s, p) => s + p.amount, 0);
  const razorpayPct = Math.round((PAYMENTS.filter((p) => p.gateway === "Razorpay").length / PAYMENTS.length) * 100);

  const stats = [
    { icon: IndianRupee, label: "Total Collected", value: formatINR(totalCollected), color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400", change: "+12.4%" },
    { icon: Clock, label: "Pending", value: formatINR(pending), color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
    { icon: RefreshCw, label: "Refunded", value: formatINR(refunded), color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
    { icon: TrendingUp, label: "Today's Collection", value: formatINR(today), color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400", change: "+5.1%" },
    { icon: ShieldCheck, label: "via Razorpay", value: `${razorpayPct}%`, color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Payments"
        subtitle="Collect payments, track transactions and manage refunds via integrated gateways."
        action={<CollectPaymentDialog />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", s.color)}>
                    <s.icon className="w-4 h-4" />
                  </div>
                  {s.change && <span className="text-[11px] text-emerald-600 font-medium">{s.change}</span>}
                </div>
                <p className="text-xl font-bold mt-2 tracking-tight">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-2 mb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search txn id, customer, booking ref..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full lg:w-[140px] h-9"><SelectValue placeholder="Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {["Razorpay", "UPI", "Card", "Net Banking", "Cash", "Bank Transfer", "Wallet"].map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[120px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {["Success", "Pending", "Failed", "Refunded"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {["Payment", "Refund", "Wallet Credit", "Commission"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border max-h-[60vh] overflow-y-auto scroll-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Txn ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Gateway</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const Icon = METHOD_ICON[p.method] || IndianRupee;
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono text-[11px] font-medium">{p.txnId}</TableCell>
                      <TableCell className="text-xs">{p.customerName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.bookingRef}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{formatFullINR(p.amount)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          <span className={cn("w-6 h-6 rounded-md flex items-center justify-center", METHOD_COLORS[p.method])}>
                            <Icon className="w-3 h-3" />
                          </span>
                          <span className="text-xs">{p.method}</span>
                        </span>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{p.type}</Badge></TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.gateway || "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">No transactions found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Showing {filtered.length} of {PAYMENTS.length} transactions</p>
        </CardContent>
      </Card>
    </div>
  );
}

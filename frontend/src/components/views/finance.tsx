"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  IndianRupee, TrendingUp, Receipt, FileText, Plus, Eye,
  Building2, Plane, ShoppingBag, Zap, Users, FileDown,
  CheckCircle2, Clock, AlertCircle, Calculator,
} from "lucide-react";
import { api, apiFetchBlob, type SupplierPayoutRecord } from "@/lib/api";
import { mapApiFinance, type MappedFinance } from "@/lib/api-mappers";
import {
  formatINR, formatFullINR, StatusBadge, PageShell, PageHeader, MetricCard, SectionHeader, BrandHero,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent, CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const EXPENSE_CATEGORY_COLORS: Record<string, string> = {
  Salaries: "#0d9488",
  "Office Rent": "#f59e0b",
  Marketing: "#f43f5e",
  "API Costs": "#8b5cf6",
  Software: "#06b6d4",
  Travel: "#10b981",
  Utilities: "#f97316",
  Other: "#64748b",
};

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Salaries: Users, "Office Rent": Building2, Marketing: TrendingUp, "API Costs": Plane,
  Software: Calculator, Travel: Plane, Utilities: Zap, Other: ShoppingBag,
};

function OverviewTab({ data }: { data: MappedFinance | null }) {
  const totalRevenue = data?.summary.totalRevenue ?? 0;
  const gstCollected = data?.summary.totalGst ?? 0;
  const tdsDeducted = data?.summary.totalTds ?? 0;
  const totalExpenses = data?.summary.totalExpenses ?? 0;
  const netProfit = data?.summary.netProfit ?? totalRevenue - totalExpenses - tdsDeducted;

  const chartData = (data?.monthly ?? []).map((m) => ({
    month: m.label,
    revenue: m.revenue,
    profit: m.profit,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard icon={IndianRupee} label="Total Revenue" value={formatINR(totalRevenue)} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={0} />
        <MetricCard icon={Receipt} label="GST Collected" value={formatINR(gstCollected)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={1} />
        <MetricCard icon={FileText} label="TDS Deducted" value={formatINR(tdsDeducted)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={2} />
        <MetricCard icon={TrendingUp} label="Net Profit" value={formatINR(netProfit)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={3} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader title="Revenue vs Profit" description="Monthly revenue and net profit from live bookings, GST and expenses" />
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--brand-blue)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--brand-blue)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatINR(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  formatter={(v: number, name) => [formatFullINR(v), name === "revenue" ? "Revenue" : "Profit"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--brand-blue)" strokeWidth={2.5} fill="url(#revArea)" />
                <Area type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={2.5} fill="url(#profArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Revenue</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Net Profit</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GstTab({ data }: { data: MappedFinance | null }) {
  const list = (data?.gstFilings?.length
    ? data.gstFilings.map((g) => ({
        month: g.month,
        taxable: g.taxable,
        cgst: g.cgst,
        sgst: g.sgst,
        igst: g.igst,
        status: g.status || "Pending",
      }))
    : (data?.monthly || []).map((m) => ({
        month: m.label,
        taxable: Math.max(0, m.revenue - m.gst),
        cgst: Math.round(m.gst / 2),
        sgst: m.gst - Math.round(m.gst / 2),
        igst: 0,
        status: "Pending",
      })));

  const totalTaxable = list.reduce((s, g) => s + g.taxable, 0);
  const outputTax = data?.summary.totalGst ?? list.reduce((s, g) => s + g.cgst + g.sgst + g.igst, 0);
  const inputTax = Math.round(outputTax * 0.42);
  const netPayable = outputTax - inputTax;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard icon={Receipt} label="Output Tax (Sales)" value={formatFullINR(outputTax)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={0} />
        <MetricCard icon={ShoppingBag} label="Input Tax Credit (est.)" value={formatFullINR(inputTax)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={1} />
        <MetricCard icon={IndianRupee} label="Net GST Payable" value={formatFullINR(netPayable)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={2} />
      </div>

      <Card>
        <CardHeader>
          <SectionHeader title="GST Filing Status" description={`Taxable base ₹${totalTaxable.toLocaleString("en-IN")} from issued invoices`} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-96 overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Taxable Value</TableHead>
                  <TableHead className="text-right">CGST</TableHead>
                  <TableHead className="text-right">SGST</TableHead>
                  <TableHead className="text-right">IGST</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">No GST rows yet — generate booking invoices to populate.</TableCell></TableRow>
                ) : list.map((g) => (
                  <TableRow key={g.month} className="hover:bg-muted/40">
                    <TableCell className="text-sm font-medium">{g.month}</TableCell>
                    <TableCell className="text-right text-xs">{formatFullINR(g.taxable)}</TableCell>
                    <TableCell className="text-right text-xs">{g.cgst > 0 ? formatFullINR(g.cgst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{g.sgst > 0 ? formatFullINR(g.sgst) : "—"}</TableCell>
                    <TableCell className="text-right text-xs">{g.igst > 0 ? formatFullINR(g.igst) : "—"}</TableCell>
                    <TableCell><StatusBadge status={g.status} /></TableCell>
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

type FinanceInvoiceRow = {
  id: string;
  no: string;
  customer: string;
  amount: number;
  gst: number;
  total: number;
  status: string;
  date: string;
};

async function openInvoicePrint(invoiceId: string) {
  const blob = await apiFetchBlob(`/api/finance/invoices/${invoiceId}/print`);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function AddTdsDialog({ onRefresh }: { onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState("194C");
  const [nature, setNature] = useState("");
  const [partyName, setPartyName] = useState("");
  const [amount, setAmount] = useState("");
  const [rate, setRate] = useState("2");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nature || !amount || !rate || !date) {
      toast({ title: "Missing fields", description: "Nature, amount, rate and date are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.createTds({
        section,
        nature,
        partyName: partyName || undefined,
        amount: Number(amount),
        rate: Number(rate),
        date,
        status: "Pending",
      });
      toast({ title: "TDS recorded", description: `${section}: ${formatFullINR(Math.round(Number(amount) * (Number(rate) / 100)))}` });
      setOpen(false);
      setNature(""); setPartyName(""); setAmount(""); setRate("2");
      onRefresh();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Could not create TDS", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Add TDS
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add TDS Entry</DialogTitle>
          <DialogDescription>Record a TDS deduction against a payment.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Section</Label>
              <Select value={section} onValueChange={setSection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["194C", "194H", "194J", "194I", "194A"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rate (%)</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Nature of Payment</Label>
            <Input placeholder="e.g. Vendor payment" value={nature} onChange={(e) => setNature(e.target.value)} />
          </div>
          <div>
            <Label>Party Name</Label>
            <Input placeholder="Optional" value={partyName} onChange={(e) => setPartyName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? "Saving…" : "Add TDS"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TdsTab({ data, onRefresh }: { data: MappedFinance | null; onRefresh: () => void }) {
  const list = data?.tds ?? [];
  const totalDeducted = list.reduce((s, t) => s + t.deducted, 0);
  const totalAmount = list.reduce((s, t) => s + t.amount, 0);
  const pending = list.filter((t) => t.status === "Pending").reduce((s, t) => s + t.deducted, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard icon={FileText} label="Total Deducted" value={formatFullINR(totalDeducted)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={0} />
        <MetricCard icon={IndianRupee} label="Transaction Value" value={formatINR(totalAmount)} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={1} />
        <MetricCard icon={Clock} label="Pending Deposit" value={formatFullINR(pending)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <SectionHeader title="TDS Deductions" description="Section-wise TDS deducted and deposit status" />
          <AddTdsDialog onRefresh={onRefresh} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-96 overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Section</TableHead>
                  <TableHead>Nature of Payment</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">TDS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                      No TDS entries yet — add one to start the ledger.
                    </TableCell>
                  </TableRow>
                ) : list.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/40">
                    <TableCell><Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">{t.section}</Badge></TableCell>
                    <TableCell className="text-xs">{t.nature}{t.partyName ? ` · ${t.partyName}` : ""}</TableCell>
                    <TableCell className="text-right text-xs">{formatFullINR(t.amount)}</TableCell>
                    <TableCell className="text-right text-xs">{t.rate}%</TableCell>
                    <TableCell className="text-right text-xs font-semibold text-rose-600">{formatFullINR(t.deducted)}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
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

function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: FinanceInvoiceRow | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [printing, setPrinting] = useState(false);
  if (!invoice) return null;

  async function downloadPdf() {
    if (!invoice) return;
    setPrinting(true);
    try {
      await openInvoicePrint(invoice.id);
    } catch (e) {
      toast({
        title: "Print failed",
        description: e instanceof Error ? e.message : "Could not open invoice",
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{invoice.no} <StatusBadge status={invoice.status} /></DialogTitle>
          <DialogDescription>{invoice.customer} · Issued {new Date(invoice.date).toLocaleDateString("en-IN")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Customer</span><span className="font-medium">{invoice.customer}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Invoice No</span><span className="font-mono">{invoice.no}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span>{new Date(invoice.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatFullINR(invoice.amount)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>{formatFullINR(invoice.gst)}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-primary dark:text-brand-teal">{formatFullINR(invoice.total)}</span></div>
          </div>
          <Button variant="outline" size="sm" className="w-full" disabled={printing} onClick={downloadPdf}>
            <FileDown className="w-3.5 h-3.5 mr-1" /> {printing ? "Opening…" : "Open Printable Invoice"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GenerateInvoiceDialog({ onRefresh }: { onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [bookings, setBookings] = useState<Array<{ id: string; bookingRef: string; customerName: string; amount: number }>>([]);
  const [bookingId, setBookingId] = useState("");
  const [invoiceType, setInvoiceType] = useState("Tax Invoice");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api.getBookings()
      .then((res) => {
        setBookings(
          (res.bookings || []).map((b) => ({
            id: b.id,
            bookingRef: b.bookingRef,
            customerName: b.customerName,
            amount: b.amount,
          }))
        );
      })
      .catch(() => setBookings([]));
  }, [open]);

  async function generate() {
    if (!bookingId) {
      toast({ title: "Select a booking", description: "Choose a booking to invoice", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.createBookingInvoice(bookingId, { invoiceType });
      toast({ title: "Invoice generated", description: "Booking invoice created from live ledger" });
      setOpen(false);
      setBookingId("");
      onRefresh();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Could not create invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Generate Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Generate Invoice</DialogTitle>
          <DialogDescription>Create a GST invoice from an existing booking.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Booking</Label>
            <Select value={bookingId} onValueChange={setBookingId}>
              <SelectTrigger><SelectValue placeholder="Select booking" /></SelectTrigger>
              <SelectContent>
                {bookings.length === 0 ? (
                  <SelectItem value="__none" disabled>No bookings available</SelectItem>
                ) : bookings.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bookingRef} · {b.customerName} · {formatINR(b.amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Invoice Type</Label>
            <Select value={invoiceType} onValueChange={setInvoiceType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Tax Invoice", "Proforma", "Credit Note"].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generate} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicesTab({ data, onRefresh }: { data: MappedFinance | null; onRefresh: () => void }) {
  const { toast } = useToast();
  const list: FinanceInvoiceRow[] = (data?.invoices || []).map((inv, idx) => ({
    id: inv.id || `inv-${idx}`,
    no: inv.ref,
    customer: inv.customer,
    amount: inv.amount,
    gst: inv.gst,
    total: inv.total,
    status: inv.status || "Pending",
    date: inv.date,
  }));

  const [selected, setSelected] = useState<FinanceInvoiceRow | null>(null);
  const [open, setOpen] = useState(false);

  const total = list.reduce((s, i) => s + i.total, 0);
  const paid = list.filter((i) => i.status === "Paid").reduce((s, i) => s + i.total, 0);
  const pending = list.filter((i) => i.status === "Pending").reduce((s, i) => s + i.total, 0);
  const overdue = list.filter((i) => i.status === "Overdue" || i.status === "Cancelled").reduce((s, i) => s + i.total, 0);

  function openInv(inv: FinanceInvoiceRow) { setSelected(inv); setOpen(true); }

  async function printInv(inv: FinanceInvoiceRow, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await openInvoicePrint(inv.id);
    } catch (err) {
      toast({
        title: "Print failed",
        description: err instanceof Error ? err.message : "Could not open invoice",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <MetricCard icon={FileText} label="Total Invoiced" value={formatINR(total)} color="bg-primary/10 text-primary dark:bg-primary/15 dark:text-brand-teal" index={0} />
          <MetricCard icon={CheckCircle2} label="Paid" value={formatINR(paid)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={1} />
          <MetricCard icon={Clock} label="Pending" value={formatINR(pending)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
          <MetricCard icon={AlertCircle} label="Other" value={formatINR(overdue)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={3} />
        </div>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <SectionHeader title="Invoices" description="Live booking invoices with GST and payment status" />
          <GenerateInvoiceDialog onRefresh={onRefresh} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border max-h-[60vh] overflow-y-auto scroll-thin mx-4 mb-4">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Invoice No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                      No invoices yet — generate one from a booking.
                    </TableCell>
                  </TableRow>
                ) : list.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openInv(inv)}>
                    <TableCell className="font-mono text-xs font-medium">{inv.no}</TableCell>
                    <TableCell className="text-xs">{inv.customer}</TableCell>
                    <TableCell className="text-right text-xs">{formatFullINR(inv.amount)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatFullINR(inv.gst)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatFullINR(inv.total)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-0.5">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => printInv(inv, e)}>
                          <FileDown className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openInv(inv); }}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <InvoiceDetailDialog invoice={selected} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function AddExpenseDialog({ onRefresh }: { onRefresh: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!category || !amount || !description || !date) {
      toast({ title: "Missing fields", description: "Category, description, amount and date required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await api.createExpense({
        category,
        description,
        amount: Number(amount),
        date,
        paidBy: paidBy || undefined,
      });
      toast({ title: "Expense added", description: `${category}: ${formatFullINR(Number(amount))}` });
      setOpen(false);
      setCategory(""); setDescription(""); setAmount(""); setPaidBy("");
      onRefresh();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "Could not add expense", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-1" /> Add Expense
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Expense</DialogTitle>
          <DialogDescription>Record a new business expense.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {["Office Rent", "Salaries", "API Costs", "Marketing", "Software", "Travel", "Utilities", "Other"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (₹)</Label>
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input placeholder="Expense description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Paid By</Label>
              <Input placeholder="Optional" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? "Saving…" : "Add Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesTab({ data, onRefresh }: { data: MappedFinance | null; onRefresh: () => void }) {
  const expenses = data?.expenses ?? [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = (data?.expenseByCategory || []).map((c) => ({
    name: c.name,
    value: c.value,
    color: EXPENSE_CATEGORY_COLORS[c.name] || EXPENSE_CATEGORY_COLORS.Other,
  }));

  return (
    <div className="space-y-4">
      <BrandHero
        eyebrow="Expenses"
        title={formatFullINR(total)}
        subtitle={`${expenses.length} expense entries on the live ledger`}
        actions={<AddExpenseDialog onRefresh={onRefresh} />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <SectionHeader title="By Category" description="Expense distribution" />
          </CardHeader>
          <CardContent>
            {byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No category data yet</p>
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={byCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>
                        {byCategory.map((c, i) => <Cell key={i} fill={c.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                        formatter={(v: number, n) => [formatFullINR(v), n]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-2">
                  {byCategory.map((c) => (
                    <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                      <span className="truncate">{c.name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <SectionHeader title="Expense List" description="Recent business expenses" />
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border max-h-96 overflow-y-auto scroll-thin mx-4 mb-4">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Paid By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                        No expenses yet — add one to populate the ledger.
                      </TableCell>
                    </TableRow>
                  ) : expenses.map((e) => {
                    const Icon = CATEGORY_ICON[e.category] || Receipt;
                    return (
                      <TableRow key={e.id} className="hover:bg-muted/40">
                        <TableCell>
                          <span className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center"><Icon className="w-3 h-3" /></span>
                            <span className="text-xs font-medium">{e.category}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-xs">{e.description}</TableCell>
                        <TableCell className="text-right text-xs font-semibold text-rose-600">{formatFullINR(e.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                        <TableCell className="text-xs">{e.paidBy || "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PayoutsTab() {
  const { toast } = useToast();
  const [payouts, setPayouts] = useState<SupplierPayoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = () => {
    setLoading(true);
    api.getSupplierPayouts()
      .then((res) => setPayouts(res.payouts || []))
      .catch(() => setPayouts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const filtered = payouts.filter((p) => filter === "All" || p.status === filter);

  async function markPaid(p: SupplierPayoutRecord) {
    setBusyId(p.id);
    try {
      await api.updateSupplierPayout(p.id, {
        amountPaid: p.amount,
        paymentDate: new Date().toISOString().slice(0, 10),
        paymentMode: "NEFT",
      });
      toast({ title: "Payout marked paid" });
      refresh();
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <SectionHeader title="Supplier payouts" description="Due dates, reminders, and payment status for supplier invoices" />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["All", "Pending", "Partial", "Overdue", "Scheduled", "Paid"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Booking</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              )}
              {!loading && filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">
                    <p className="font-medium">{p.supplierName}</p>
                    {p.serviceType && <p className="text-muted-foreground">{p.serviceType}</p>}
                  </TableCell>
                  <TableCell className="text-xs">{p.booking?.bookingRef || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {formatFullINR(p.amountPaid)} / {formatFullINR(p.amount)}
                  </TableCell>
                  <TableCell className="text-xs">{p.dueDate || "—"}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell>
                    {p.status !== "Paid" && (
                      <Button size="sm" variant="outline" disabled={busyId === p.id} onClick={() => markPaid(p)}>
                        Mark paid
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-xs py-8 text-muted-foreground">No payouts yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export function FinanceView() {
  const [data, setData] = useState<MappedFinance | null>(null);

  const refresh = () => {
    api.getFinance()
      .then((res) => setData(mapApiFinance(res)))
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Finance"
        subtitle="Live ledgers for revenue, GST, TDS, invoices and expenses from your agency data."
      />
      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/60 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          <TabsTrigger value="tds">TDS</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab data={data} /></TabsContent>
        <TabsContent value="gst" className="mt-4"><GstTab data={data} /></TabsContent>
        <TabsContent value="tds" className="mt-4"><TdsTab data={data} onRefresh={refresh} /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesTab data={data} onRefresh={refresh} /></TabsContent>
        <TabsContent value="payouts" className="mt-4"><PayoutsTab /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><ExpensesTab data={data} onRefresh={refresh} /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

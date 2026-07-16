"use client";

import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  IndianRupee, TrendingUp, Receipt, FileText, Wallet, Plus, Eye,
  CreditCard, Building2, Plane, ShoppingBag, Zap, Users, FileDown,
  CheckCircle2, Clock, AlertCircle, Calculator, Percent,
} from "lucide-react";
import { REVENUE_DATA, CUSTOMERS } from "@/lib/mock-data";
import { api } from "@/lib/api";
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
import { cn } from "@/lib/utils";

const INVOICES = [
  { id: "inv-1", no: "INV-2025-001", customer: "TechCorp India Pvt Ltd", amount: 320000, gst: 57600, total: 377600, status: "Paid" as const, date: "2025-01-15" },
  { id: "inv-2", no: "INV-2025-002", customer: "Karthik Venkat", amount: 28400, gst: 5112, total: 33512, status: "Paid" as const, date: "2025-01-12" },
  { id: "inv-3", no: "INV-2025-003", customer: "Rohit Gupta", amount: 18900, gst: 3402, total: 22302, status: "Pending" as const, date: "2025-01-18" },
  { id: "inv-4", no: "INV-2025-004", customer: "Kavya Reddy", amount: 78000, gst: 14040, total: 92040, status: "Paid" as const, date: "2025-01-19" },
  { id: "inv-5", no: "INV-2025-005", customer: "Amit Patel", amount: 440000, gst: 79200, total: 519200, status: "Overdue" as const, date: "2024-12-22" },
  { id: "inv-6", no: "INV-2025-006", customer: "Sanjay Kumar", amount: 68000, gst: 12240, total: 80240, status: "Pending" as const, date: "2025-01-18" },
  { id: "inv-7", no: "INV-2025-007", customer: "Pooja Mehta", amount: 45000, gst: 8100, total: 53100, status: "Paid" as const, date: "2025-01-20" },
  { id: "inv-8", no: "INV-2025-008", customer: "Imran Khan", amount: 234000, gst: 42120, total: 276120, status: "Overdue" as const, date: "2024-11-30" },
];

const EXPENSES = [
  { id: "ex-1", category: "Office Rent", description: "Mumbai office monthly rent", amount: 85000, date: "2025-01-05", paidBy: "Vikram Iyer" },
  { id: "ex-2", category: "Salaries", description: "Staff salaries - January 2025", amount: 412000, date: "2025-01-01", paidBy: "Vikram Iyer" },
  { id: "ex-3", category: "API Costs", description: "IndiGo & Vistara flight API usage", amount: 38000, date: "2025-01-15", paidBy: "System" },
  { id: "ex-4", category: "Marketing", description: "Google Ads & Meta campaigns", amount: 45000, date: "2025-01-12", paidBy: "Priya Nair" },
  { id: "ex-5", category: "Software", description: "CRM + Accounting tools subscriptions", amount: 18500, date: "2025-01-08", paidBy: "Vikram Iyer" },
  { id: "ex-6", category: "Travel", description: "Sales team field travel reimbursements", amount: 22500, date: "2025-01-17", paidBy: "Rahul Khanna" },
  { id: "ex-7", category: "Utilities", description: "Internet, electricity & phone bills", amount: 12800, date: "2025-01-10", paidBy: "Vikram Iyer" },
];

const GST_FILINGS = [
  { month: "January 2025", taxable: 2850000, cgst: 256500, sgst: 256500, igst: 0, status: "Pending" as const },
  { month: "December 2024", taxable: 3850000, cgst: 0, sgst: 0, igst: 693000, status: "Filed" as const },
  { month: "November 2024", taxable: 3280000, cgst: 0, sgst: 0, igst: 590400, status: "Filed" as const },
  { month: "October 2024", taxable: 3450000, cgst: 0, sgst: 0, igst: 621000, status: "Filed" as const },
  { month: "September 2024", taxable: 3120000, cgst: 0, sgst: 0, igst: 561600, status: "Filed" as const },
];

const TDS_DEDUCTIONS = [
  { id: "tds-1", section: "194C", nature: "Contractor / Vendor Payments", amount: 1240000, rate: 1, deducted: 12400, status: "Deposited" as const, date: "2025-01-15" },
  { id: "tds-2", section: "194J", nature: "Professional Fees", amount: 285000, rate: 10, deducted: 28500, status: "Deposited" as const, date: "2025-01-12" },
  { id: "tds-3", section: "194I", nature: "Rent (Building)", amount: 85000, rate: 10, deducted: 8500, status: "Deposited" as const, date: "2025-01-05" },
  { id: "tds-4", section: "192", nature: "Salary (Jan 2025)", amount: 412000, rate: 5, deducted: 20600, status: "Pending" as const, date: "2025-01-31" },
  { id: "tds-5", section: "194C", nature: "Tour Operator Payments", amount: 580000, rate: 1, deducted: 5800, status: "Pending" as const, date: "2025-01-20" },
];

const EXPENSE_CATEGORIES = [
  { name: "Salaries", value: 412000, color: "#0d9488" },
  { name: "Office Rent", value: 85000, color: "#f59e0b" },
  { name: "Marketing", value: 45000, color: "#f43f5e" },
  { name: "API Costs", value: 38000, color: "#8b5cf6" },
  { name: "Software", value: 18500, color: "#06b6d4" },
  { name: "Travel", value: 22500, color: "#10b981" },
  { name: "Utilities", value: 12800, color: "#f97316" },
];

const CATEGORY_ICON: Record<string, React.ElementType> = {
  Salaries: Users, "Office Rent": Building2, Marketing: TrendingUp, "API Costs": Plane,
  Software: Calculator, Travel: Plane, Utilities: Zap,
};

function OverviewTab({ data }: { data: MappedFinance | null }) {
  const totalRevenue = data ? data.summary.totalRevenue : REVENUE_DATA.reduce((s, d) => s + d.revenue, 0);
  const gstCollected = data ? data.summary.totalGst : Math.round(totalRevenue * 0.18);
  const tdsDeducted = TDS_DEDUCTIONS.reduce((s, t) => s + t.deducted, 0);
  const totalExpenses = data ? data.summary.totalExpenses : EXPENSES.reduce((s, e) => s + e.amount, 0);
  const netProfit = data ? data.summary.netProfit : totalRevenue - totalExpenses - tdsDeducted;

  const chartData = data
    ? data.monthly.map((m) => ({
        month: m.label,
        revenue: m.revenue,
        profit: m.profit,
      }))
    : REVENUE_DATA.map((d) => ({
        month: d.month,
        revenue: d.revenue,
        profit: Math.round(d.revenue * 0.22),
      }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard icon={IndianRupee} label="Total Revenue (12mo)" value={formatINR(totalRevenue)} color="bg-[#2A7BBD]/10 text-[#2A7BBD] dark:bg-[#2A7BBD]/15 dark:text-[#00A79D]" change={18.4} trend="up" index={0} />
        <MetricCard icon={Receipt} label="GST Collected" value={formatINR(gstCollected)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={1} />
        <MetricCard icon={FileText} label="TDS Deducted" value={formatINR(tdsDeducted)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={2} />
        <MetricCard icon={TrendingUp} label="Net Profit" value={formatINR(netProfit)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" change={12.1} trend="up" index={3} />
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <SectionHeader title="Revenue vs Profit" description="Monthly revenue and net profit comparison" />
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2A7BBD" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#2A7BBD" stopOpacity={0} />
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
                <Area type="monotone" dataKey="revenue" stroke="#2A7BBD" strokeWidth={2.5} fill="url(#revArea)" />
                <Area type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={2.5} fill="url(#profArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex gap-4 mt-2 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-[#2A7BBD]" /> Revenue</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Net Profit</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GstTab({ data }: { data: MappedFinance | null }) {
  const list = data
    ? data.monthly.map((m) => ({
        month: m.label,
        taxable: m.revenue,
        cgst: Math.round(m.gst / 2),
        sgst: Math.round(m.gst / 2),
        igst: 0,
        status: "Filed" as const,
      }))
    : GST_FILINGS;

  const totalTaxable = data ? data.summary.totalRevenue : GST_FILINGS.reduce((s, g) => s + g.taxable, 0);
  const outputTax = data ? data.summary.totalGst : Math.round(totalTaxable * 0.18);
  const inputTax = Math.round(outputTax * 0.42);
  const netPayable = outputTax - inputTax;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard icon={Receipt} label="Output Tax (Sales)" value={formatFullINR(outputTax)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={0} />
        <MetricCard icon={ShoppingBag} label="Input Tax Credit (ITC)" value={formatFullINR(inputTax)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={1} />
        <MetricCard icon={IndianRupee} label="Net GST Payable" value={formatFullINR(netPayable)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={2} />
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <SectionHeader title="GST Filing Status" description="Monthly GST returns (GSTR-1 & GSTR-3B)" />
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
                {list.map((g) => (
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

function TdsTab() {
  const totalDeducted = TDS_DEDUCTIONS.reduce((s, t) => s + t.deducted, 0);
  const totalAmount = TDS_DEDUCTIONS.reduce((s, t) => s + t.amount, 0);
  const pending = TDS_DEDUCTIONS.filter((t) => t.status === "Pending").reduce((s, t) => s + t.deducted, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard icon={FileText} label="Total Deducted" value={formatFullINR(totalDeducted)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={0} />
        <MetricCard icon={IndianRupee} label="Transaction Value" value={formatINR(totalAmount)} color="bg-[#2A7BBD]/10 text-[#2A7BBD] dark:bg-[#2A7BBD]/15 dark:text-[#00A79D]" index={1} />
        <MetricCard icon={Clock} label="Pending Deposit" value={formatFullINR(pending)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader>
          <SectionHeader title="TDS Deductions" description="Section-wise TDS deducted and deposit status" />
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
                {TDS_DEDUCTIONS.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/40">
                    <TableCell><Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400">{t.section}</Badge></TableCell>
                    <TableCell className="text-xs">{t.nature}</TableCell>
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

function InvoiceDetailDialog({ invoice, open, onOpenChange }: { invoice: typeof INVOICES[number] | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  if (!invoice) return null;
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
            <div className="flex justify-between"><span className="text-muted-foreground">GST @ 18%</span><span>{formatFullINR(invoice.gst)}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-[#2A7BBD] dark:text-[#00A79D]">{formatFullINR(invoice.total)}</span></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={() => toast({ title: "PDF generated", description: `${invoice.no}.pdf downloaded` })}>
              <FileDown className="w-3.5 h-3.5 mr-1" /> Download PDF
            </Button>
            {invoice.status !== "Paid" && (
              <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90" onClick={() => toast({ title: "Payment reminder sent", description: `Reminder emailed to ${invoice.customer}` })}>
                <CreditCard className="w-3.5 h-3.5 mr-1" /> Send Reminder
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GenerateInvoiceDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  function generate() {
    if (!customer || !amount) {
      toast({ title: "Missing fields", description: "Customer and amount are required", variant: "destructive" });
      return;
    }
    toast({ title: "Invoice generated", description: `INV-2025-009 created for ${customer}` });
    setOpen(false); setCustomer(""); setAmount("");
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
          <DialogDescription>Create a new GST invoice for a customer.</DialogDescription>
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
            <Label>Taxable Amount (₹)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} className="pl-8" />
            </div>
          </div>
          {amount && (
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatFullINR(Number(amount))}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST @ 18%</span><span>{formatFullINR(Math.round(Number(amount) * 0.18))}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-[#2A7BBD] dark:text-[#00A79D]">{formatFullINR(Math.round(Number(amount) * 1.18))}</span></div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={generate} className="bg-primary hover:bg-primary/90">Generate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicesTab({ data }: { data: MappedFinance | null }) {
  const { toast } = useToast();
  const list = data
    ? data.invoices.map((inv, idx) => ({
        id: `inv-${idx}`,
        no: inv.ref,
        customer: inv.customer,
        amount: inv.amount,
        gst: inv.gst,
        total: inv.total,
        status: "Paid" as const,
        date: inv.date,
      }))
    : INVOICES;

  const [selected, setSelected] = useState<typeof list[number] | null>(null);
  const [open, setOpen] = useState(false);

  const total = list.reduce((s, i) => s + i.total, 0);
  const paid = list.filter((i) => i.status === "Paid").reduce((s, i) => s + i.total, 0);
  const pending = list.filter((i) => i.status === "Pending").reduce((s, i) => s + i.total, 0);
  const overdue = list.filter((i) => i.status === "Overdue").reduce((s, i) => s + i.total, 0);

  function openInv(inv: typeof list[number]) { setSelected(inv); setOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          <MetricCard icon={FileText} label="Total Invoiced" value={formatINR(total)} color="bg-[#2A7BBD]/10 text-[#2A7BBD] dark:bg-[#2A7BBD]/15 dark:text-[#00A79D]" index={0} />
          <MetricCard icon={CheckCircle2} label="Paid" value={formatINR(paid)} color="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" index={1} />
          <MetricCard icon={Clock} label="Pending" value={formatINR(pending)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
          <MetricCard icon={AlertCircle} label="Overdue" value={formatINR(overdue)} color="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" index={3} />
        </div>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <SectionHeader title="Invoices" description="All generated invoices with GST and payment status" />
          <GenerateInvoiceDialog />
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
                {list.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openInv(inv)}>
                    <TableCell className="font-mono text-xs font-medium">{inv.no}</TableCell>
                    <TableCell className="text-xs">{inv.customer}</TableCell>
                    <TableCell className="text-right text-xs">{formatFullINR(inv.amount)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatFullINR(inv.gst)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatFullINR(inv.total)}</TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); openInv(inv); }}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
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

function AddExpenseDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState("Vikram Iyer");
  function submit() {
    if (!category || !amount || !description) {
      toast({ title: "Missing fields", description: "Category, description and amount required", variant: "destructive" });
      return;
    }
    toast({ title: "Expense added", description: `${category}: ${formatFullINR(Number(amount))}` });
    setOpen(false);
    setCategory(""); setDescription(""); setAmount(""); setPaidBy("Vikram Iyer");
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
                  {["Office Rent", "Salaries", "API Costs", "Marketing", "Software", "Travel", "Utilities"].map((c) => (
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
          <div>
            <Label>Paid By</Label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Vikram Iyer", "Priya Sharma", "Rahul Khanna", "System"].map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} className="bg-primary hover:bg-primary/90">Add Expense</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesTab() {
  const total = EXPENSES.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <BrandHero
        eyebrow="This Month"
        title={formatFullINR(total)}
        subtitle={`${EXPENSES.length} expense entries recorded`}
        actions={<AddExpenseDialog />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 border-border/80 shadow-none">
          <CardHeader>
            <SectionHeader title="By Category" description="Expense distribution" />
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={EXPENSE_CATEGORIES} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={2}>
                    {EXPENSE_CATEGORIES.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    formatter={(v: number, n) => [formatFullINR(v), n]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <div key={c.name} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                  <span className="truncate">{c.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-border/80 shadow-none">
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
                  {EXPENSES.map((e) => {
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
                        <TableCell className="text-xs">{e.paidBy}</TableCell>
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

export function FinanceView() {
  const [data, setData] = useState<MappedFinance | null>(null);

  useEffect(() => {
    api.getFinance()
      .then((res) => {
        setData(mapApiFinance(res));
      })
      .catch(() => undefined);
  }, []);

  return (
    <PageShell>
      <PageHeader
        title="Finance"
        subtitle="Track revenue, GST, TDS, invoices and expenses — your complete financial cockpit."
      />
      <Tabs defaultValue="overview">
        <TabsList className="bg-muted/60 flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          <TabsTrigger value="tds">TDS</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4"><OverviewTab data={data} /></TabsContent>
        <TabsContent value="gst" className="mt-4"><GstTab data={data} /></TabsContent>
        <TabsContent value="tds" className="mt-4"><TdsTab /></TabsContent>
        <TabsContent value="invoices" className="mt-4"><InvoicesTab data={data} /></TabsContent>
        <TabsContent value="expenses" className="mt-4"><ExpensesTab /></TabsContent>
      </Tabs>
    </PageShell>
  );
}

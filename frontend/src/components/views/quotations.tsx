"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FileText, Send, FileDown, Plus, Trash2, CheckCircle2, Clock,
  XCircle, AlertCircle, Mail, MessageCircle, Eye, TrendingUp, Wallet,
  IndianRupee, Percent,
} from "lucide-react";
import { useDemoDataStore } from "@/store/demo-data-store";
import type { Quotation } from "@/types";
import {
  formatINR, formatFullINR, StatusBadge, PageHeader,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SERVICE_COLORS: Record<string, string> = {
  Flight: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  Hotel: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Holiday: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

interface QuoteItem { id: string; description: string; qty: number; price: number; }

function StatCard({ icon: Icon, label, value, color, change }: { icon: React.ElementType; label: string; value: string; color: string; change?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", color)}>
              <Icon className="w-4 h-4" />
            </div>
            {change && <span className="text-[11px] text-emerald-600 font-medium">{change}</span>}
          </div>
          <p className="text-xl font-bold mt-2 tracking-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CreateQuotationDialog() {
  const { toast } = useToast();
  const customers = useDemoDataStore((s) => s.customers);
  const addQuotation = useDemoDataStore((s) => s.addQuotation);
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [service, setService] = useState("Flight");
  const [items, setItems] = useState<QuoteItem[]>([
    { id: "1", description: "Flight - DEL → DXB (Return)", qty: 1, price: 28000 },
  ]);
  const [discount, setDiscount] = useState(0);

  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const discountAmount = (subtotal * discount) / 100;
  const taxableAmount = subtotal - discountAmount;
  const gst = Math.round(taxableAmount * 0.18);
  const total = taxableAmount + gst;

  function addRow() {
    setItems([...items, { id: Date.now().toString(), description: "", qty: 1, price: 0 }]);
  }
  function removeRow(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }
  function updateRow(id: string, field: keyof QuoteItem, value: string | number) {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }
  function save(asDraft: boolean) {
    if (!customer) {
      toast({ title: "Select customer", description: "Please choose a customer first", variant: "destructive" });
      return;
    }
    if (items.length === 0 || subtotal === 0) {
      toast({ title: "Add line items", description: "Add at least one item with a price", variant: "destructive" });
      return;
    }
    addQuotation({
      customerName: customer,
      service: service as Quotation["service"],
      items: items.length,
      amount: taxableAmount,
      gst,
      total,
      validTill: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdBy: "Sneha Reddy",
    });
    toast({
      title: asDraft ? "Quotation saved as draft" : "Quotation sent to customer",
      description: `${customer} · Total ${formatINR(total)} ${asDraft ? "(Draft)" : "(Sent)"}`,
    });
    setOpen(false);
    setCustomer("");
    setService("Flight");
    setItems([{ id: "1", description: "", qty: 1, price: 0 }]);
    setDiscount(0);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
          <Plus className="w-4 h-4 mr-1" /> Create Quotation
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Quotation</DialogTitle>
          <DialogDescription>Build a detailed quotation with line items, discount and GST.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Customer</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Service Type</Label>
            <Select value={service} onValueChange={setService}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Flight", "Hotel", "Holiday"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Line Items</Label>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
              <Plus className="w-3 h-3 mr-1" /> Add Row
            </Button>
          </div>
          <div className="rounded-lg border max-h-48 overflow-y-auto scroll-thin">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 p-2 border-b last:border-0 items-center">
                <Input
                  className="col-span-6 h-8 text-xs"
                  placeholder="Description"
                  value={item.description}
                  onChange={(e) => updateRow(item.id, "description", e.target.value)}
                />
                <Input
                  className="col-span-2 h-8 text-xs"
                  type="number"
                  placeholder="Qty"
                  value={item.qty}
                  onChange={(e) => updateRow(item.id, "qty", Number(e.target.value))}
                />
                <Input
                  className="col-span-3 h-8 text-xs"
                  type="number"
                  placeholder="Price ₹"
                  value={item.price}
                  onChange={(e) => updateRow(item.id, "price", Number(e.target.value))}
                />
                <Button variant="ghost" size="sm" className="col-span-1 h-8 text-rose-500" onClick={() => removeRow(item.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Discount (%)</Label>
            <div className="relative">
              <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="pl-8" />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatFullINR(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-emerald-600"><span>Discount ({discount}%)</span><span>-{formatFullINR(discountAmount)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">GST @ 18%</span><span>{formatFullINR(gst)}</span></div>
            <Separator className="my-1" />
            <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-teal-600">{formatFullINR(total)}</span></div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => save(true)}>Save as Draft</Button>
          <Button onClick={() => save(false)} className="bg-teal-600 hover:bg-teal-700">
            <Send className="w-4 h-4 mr-1" /> Send to Customer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const APPROVAL_STEPS = [
  { key: "Draft", icon: FileText, color: "text-slate-500 bg-slate-100 dark:bg-slate-500/15" },
  { key: "Pending Approval", icon: Clock, color: "text-amber-500 bg-amber-100 dark:bg-amber-500/15" },
  { key: "Approved", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/15" },
];

function QuoteDetailDialog({ quote, open, onOpenChange }: { quote: Quotation | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [approvalStep, setApprovalStep] = useState(0);
  if (!quote) return null;
  const items = Array.from({ length: quote.items }).map((_, i) => ({
    description: ["Flight / Hotel / Service", "Taxes & Fees", "Add-ons"][i % 3],
    qty: 1, price: Math.round(quote.amount / quote.items),
  }));

  function action(label: string, desc: string) {
    toast({ title: label, description: desc });
  }
  function requestApproval() {
    if (approvalStep < 2) {
      setApprovalStep(approvalStep + 1);
      toast({ title: "Approval workflow updated", description: `Status: ${APPROVAL_STEPS[approvalStep + 1].key}` });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {quote.quoteNo}
                <StatusBadge status={quote.status} />
              </DialogTitle>
              <DialogDescription>{quote.customerName} · {quote.service} · Created {new Date(quote.createdAt).toLocaleDateString("en-IN")}</DialogDescription>
            </div>
            <Badge variant="secondary" className={SERVICE_COLORS[quote.service]}>{quote.service}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Approval workflow */}
          <div className="rounded-lg border p-3 bg-muted/20">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Workflow</p>
            <div className="flex items-center justify-between">
              {APPROVAL_STEPS.map((step, i) => (
                <div key={step.key} className="flex-1 flex flex-col items-center relative">
                  {i < APPROVAL_STEPS.length - 1 && (
                    <div className={cn("absolute top-4 left-1/2 w-full h-0.5", i < approvalStep ? "bg-emerald-400" : "bg-border")} />
                  )}
                  <div className={cn("relative z-10 w-8 h-8 rounded-full flex items-center justify-center", i <= approvalStep ? step.color : "bg-muted text-muted-foreground")}>
                    <step.icon className="w-4 h-4" />
                  </div>
                  <p className={cn("text-[10px] mt-1 text-center", i <= approvalStep ? "font-medium" : "text-muted-foreground")}>{step.key}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Line items */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">#</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs text-center">Qty</TableHead>
                  <TableHead className="text-xs text-right">Price</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{i + 1}</TableCell>
                    <TableCell className="text-xs">{it.description}</TableCell>
                    <TableCell className="text-xs text-center">{it.qty}</TableCell>
                    <TableCell className="text-xs text-right">{formatFullINR(it.price)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatFullINR(it.qty * it.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Valid Till</span><span>{new Date(quote.validTill).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Created By</span><span>{quote.createdBy}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Items</span><span>{quote.items}</span></div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatFullINR(quote.amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">GST @ 18%</span><span>{formatFullINR(quote.gst)}</span></div>
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-teal-600">{formatFullINR(quote.total)}</span></div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => action("PDF Generated", `${quote.quoteNo}.pdf downloaded`)}><FileDown className="w-3.5 h-3.5 mr-1" /> Generate PDF</Button>
            <Button variant="outline" size="sm" onClick={() => action("Email sent", `Quotation emailed to ${quote.customerName}`)}><Mail className="w-3.5 h-3.5 mr-1" /> Send Email</Button>
            <Button variant="outline" size="sm" onClick={() => action("WhatsApp sent", `Quotation shared via WhatsApp to ${quote.customerName}`)}><MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp</Button>
            {approvalStep < 2 && (
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700 ml-auto" onClick={requestApproval}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {approvalStep === 0 ? "Request Approval" : "Mark Approved"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationsView() {
  const { toast } = useToast();
  const quotations = useDemoDataStore((s) => s.quotations);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return quotations;
    const q = search.toLowerCase();
    return quotations.filter((qt) => qt.quoteNo.toLowerCase().includes(q) || qt.customerName.toLowerCase().includes(q));
  }, [search, quotations]);

  const total = quotations.length;
  const sent = quotations.filter((q) => q.status === "Sent").length;
  const accepted = quotations.filter((q) => q.status === "Accepted").length;
  const totalValue = quotations.reduce((s, q) => s + q.total, 0);
  const conversionRate = sent + accepted > 0 ? Math.round((accepted / (sent + accepted)) * 100) : 0;

  const stats = [
    { icon: FileText, label: "Total Quotes", value: String(total), color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
    { icon: Send, label: "Sent", value: String(sent), color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" },
    { icon: CheckCircle2, label: "Accepted", value: String(accepted), color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
    { icon: TrendingUp, label: "Conversion Rate", value: `${conversionRate}%`, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
    { icon: Wallet, label: "Total Value", value: formatINR(totalValue), color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
  ];

  function openDetail(q: Quotation) {
    setSelected(q);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Quotations"
        subtitle="Create, send and track quotations with GST, approvals and customer responses."
        action={<CreateQuotationDialog />}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by quote no or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm mb-3 h-9"
          />
          <div className="rounded-lg border max-h-[60vh] overflow-y-auto scroll-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Quote No</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-center">Items</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">GST</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Till</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow key={q.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium text-xs">{q.quoteNo}</TableCell>
                    <TableCell className="text-xs">{q.customerName}</TableCell>
                    <TableCell><Badge variant="secondary" className={cn("text-[10px]", SERVICE_COLORS[q.service])}>{q.service}</Badge></TableCell>
                    <TableCell className="text-center text-xs">{q.items}</TableCell>
                    <TableCell className="text-right text-xs">{formatFullINR(q.amount)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatFullINR(q.gst)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatFullINR(q.total)}</TableCell>
                    <TableCell><StatusBadge status={q.status} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(q.validTill).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-xs">{q.createdBy}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View" onClick={() => openDetail(q)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-cyan-600" title="Send" onClick={() => toast({ title: "Quotation sent", description: `${q.quoteNo} sent to ${q.customerName}` })}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" title="PDF" onClick={() => toast({ title: "PDF generated", description: `${q.quoteNo}.pdf downloaded` })}>
                          <FileDown className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">No quotations found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <QuoteDetailDialog quote={selected} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}

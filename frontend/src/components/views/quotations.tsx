"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileText, Send, FileDown, Plus, Trash2, CheckCircle2, Clock,
  Mail, MessageCircle, Eye, TrendingUp, Wallet, Percent, Ticket, Loader2, Copy, Archive,
  ChevronDown, Sparkles, Globe, ListOrdered, XCircle,
} from "lucide-react";
import { useDemoDataStore } from "@/store/demo-data-store";
import { useAuthStore, useAppStore } from "@/store/app-store";
import { api, ApiError, apiFetchBlob } from "@/lib/api";
import type { Quotation } from "@/types";
import { mapApiQuotation } from "@/lib/api-mappers";
import { pickActiveTaxRule, taxFromConfiguredRule, type ClientTaxRule } from "@/lib/tax-config";
import {
  formatINR, formatFullINR, StatusBadge, PageHeader, PageShell, MetricCard,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent,
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { InternationalQuotationDialog } from "@/components/views/international-quotation";
import { ProductQuoteBuilderDialog } from "@/components/shared/product-quote-builder";
import { AgentQuotationDialog } from "@/components/views/agent-quotation-dialog";
import { AgentTripComposerDialog } from "@/components/views/agent-trip-composer";
import {
  downloadQuotationPdf,
  getQuotationLineItems,
  deliverQuotationEmail,
  deliverQuotationWhatsApp,
} from "@/lib/quotation-actions";
import { resolveQuotationCosting, toCalendarDate } from "@/lib/quote-costing";
import { canApproveDiscount, latestDiscountApproval } from "@/lib/quote-discount";
import { isQuoteReadyToSend, quoteDisplayStatus } from "@/lib/quote-status";
import { QuotePriceBreakdown } from "@/components/shared/quote-price-breakdown";
import type { Lead } from "@/types";

const SERVICE_COLORS: Record<string, string> = {
  Flight: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  Hotel: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Holiday: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
  International: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  Activity: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400",
  Transfer: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
};

interface QuoteItem { id: string; description: string; qty: number; price: number; }

function useProceedToBooking() {
  const { toast } = useToast();
  const upsertBooking = useDemoDataStore((s) => s.upsertBooking);
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const hydrateFromApi = useDemoDataStore((s) => s.hydrateFromApi);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function proceed(quote: Quotation, dates?: { travelStartDate?: string; travelEndDate?: string }) {
    if (quote.status !== "Accepted") {
      toast({
        title: "Quote must be Accepted",
        description: "Accept the quotation before converting it to a booking.",
        variant: "destructive",
      });
      return;
    }
    const travelStartDate = dates?.travelStartDate || quote.travelStartDate || quote.travelDates || "";
    const travelEndDate = dates?.travelEndDate || quote.travelEndDate || "";
    if (!travelStartDate) {
      toast({
        title: "Travel dates required",
        description: "Set check-in / travel start date before converting to a booking.",
        variant: "destructive",
      });
      return;
    }
    setBusyId(quote.id);
    try {
      const res = await api.proceedToBooking(quote.id, {
        travelStartDate,
        travelEndDate: travelEndDate || undefined,
      });
      const booking = (await import("@/lib/api-mappers")).mapApiBooking(res.booking);
      upsertBooking(booking);
      upsertQuotation({ ...quote, status: "Converted to Booking", convertedBookingId: booking.id });
      await hydrateFromApi().catch(() => undefined);
      toast({
        title: res.idempotent ? "Booking already exists" : "Booking created",
        description: `${booking.bookingRef} — open Bookings to continue passenger details`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409 && e.body?.booking) {
        const booking = (await import("@/lib/api-mappers")).mapApiBooking(e.body.booking as never);
        upsertBooking(booking);
        upsertQuotation({ ...quote, status: "Converted to Booking", convertedBookingId: booking.id });
        toast({
          title: "Booking already exists",
          description: `${booking.bookingRef} — open Bookings to continue`,
        });
        return;
      }
      toast({
        title: "Proceed to Booking failed",
        description: e instanceof ApiError ? e.message : "Could not create booking",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  return { proceed, busyId };
}

function useQuoteActions() {
  const { toast } = useToast();
  const updateQuotationStatus = useDemoDataStore((s) => s.updateQuotationStatus);
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);

  async function loadFull(quote: Quotation): Promise<Quotation> {
    try {
      const res = await api.getQuotationFull(quote.id);
      const mapped = mapApiQuotation(res.quotation);
      upsertQuotation(mapped);
      return mapped;
    } catch {
      return quote;
    }
  }

  async function pdf(quote: Quotation) {
    const full = await loadFull(quote);
    const ready = full.approvalStatus === "Approved"
      || ["Sent to Agent", "Sent", "Customer Reviewing", "Accepted", "Converted to Booking"].includes(full.status);
    try {
      // Customer PDF requires full approval; staff can always pull an internal preview.
      const ok = await downloadQuotationPdf(full, undefined, { mode: ready ? "customer" : "preview" });
      toast({
        title: ok ? (ready ? "Client PDF ready" : "Preview PDF ready") : "PDF failed",
        description: ok
          ? (ready
            ? "Customer-facing PDF downloaded."
            : "Internal preview downloaded. Complete approval to generate the final client PDF.")
          : "Could not generate the quotation PDF.",
        variant: ok ? "default" : "destructive",
      });
      return ok;
    } catch (e) {
      // If customer PDF is blocked (approval incomplete), fall back to staff preview once.
      if (e instanceof ApiError && e.status === 403 && ready === false) {
        try {
          const ok = await downloadQuotationPdf(full, undefined, { mode: "preview" });
          toast({
            title: ok ? "Preview PDF ready" : "PDF failed",
            description: ok
              ? "Approval is still pending — downloaded an internal preview instead."
              : "Could not generate the quotation PDF.",
            variant: ok ? "default" : "destructive",
          });
          return ok;
        } catch (previewErr) {
          toast({
            title: "PDF blocked",
            description: previewErr instanceof ApiError ? previewErr.message : "Could not generate the quotation PDF",
            variant: "destructive",
          });
          return false;
        }
      }
      toast({
        title: e instanceof ApiError && e.status === 401 ? "Session expired" : "PDF blocked",
        description: e instanceof ApiError
          ? (e.status === 401 ? "Please sign in again, then retry Download PDF." : e.message)
          : "Could not generate the quotation PDF",
        variant: "destructive",
      });
      return false;
    }
  }

  async function email(quote: Quotation) {
    try {
      const res = await deliverQuotationEmail(quote);
      toast({
        title: res.ok ? "Email sent" : "Email failed",
        description: res.ok
          ? "Customer quotation PDF was emailed by the server."
          : res.error || "Could not send email",
        variant: res.ok ? "default" : "destructive",
      });
    } catch (e) {
      toast({
        title: "Email failed",
        description: e instanceof ApiError ? e.message : "Could not send email",
        variant: "destructive",
      });
    }
  }

  async function whatsapp(quote: Quotation) {
    try {
      const res = await deliverQuotationWhatsApp(quote);
      toast({
        title: res.ok ? "WhatsApp sent" : "WhatsApp failed",
        description: res.ok
          ? "Customer quotation PDF was delivered by WhatsApp."
          : res.error || "Could not send WhatsApp",
        variant: res.ok ? "default" : "destructive",
      });
    } catch (e) {
      toast({
        title: "WhatsApp failed",
        description: e instanceof ApiError ? e.message : "Could not send WhatsApp",
        variant: "destructive",
      });
    }
  }

  function markSent(quote: Quotation) {
    updateQuotationStatus(quote.id, "Sent");
    toast({ title: "Marked as sent", description: `${quote.quoteNo} → ${quote.customerName}` });
  }

  return { pdf, email, whatsapp, markSent };
}

function CreateQuotationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { pdf, email, whatsapp } = useQuoteActions();
  const customers = useDemoDataStore((s) => s.customers);
  const leads = useDemoDataStore((s) => s.leads);
  const addQuotation = useDemoDataStore((s) => s.addQuotation);
  const setView = useAppStore((s) => s.setView);
  const user = useAuthStore((s) => s.user);
  const setOpen = onOpenChange;
  const [customer, setCustomer] = useState("");
  const [service, setService] = useState("Flight");
  const [items, setItems] = useState<QuoteItem[]>([
    { id: "1", description: "Flight - DEL → DXB (Return)", qty: 1, price: 28000 },
  ]);
  const [discount, setDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountAmount: number } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [shareQuote, setShareQuote] = useState<Quotation | null>(null);

  const selectedCustomer = customers.find((c) => c.name === customer);
  const subtotal = items.reduce((s, i) => s + i.qty * i.price, 0);
  const couponDiscountAmount = Math.min(subtotal, appliedCoupon?.discountAmount ?? 0);
  const afterCoupon = Math.max(0, subtotal - couponDiscountAmount);
  const manualDiscountAmount = Math.round((afterCoupon * discount) / 100);
  const taxableAmount = Math.max(0, afterCoupon - manualDiscountAmount);
  const [taxRule, setTaxRule] = useState<ClientTaxRule | null>(null);
  useEffect(() => {
    api.getTaxRules()
      .then((res) => {
        const mapped = (res.rules || []).map((r) => ({
          id: r.id,
          name: r.name,
          rate: r.rate,
          method: (r.method === "INCLUSIVE" ? "INCLUSIVE" : "EXCLUSIVE") as "EXCLUSIVE" | "INCLUSIVE",
          active: r.active,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
        }));
        setTaxRule(pickActiveTaxRule(mapped));
      })
      .catch(() => setTaxRule(null));
  }, []);
  const tax = taxFromConfiguredRule(taxableAmount, taxRule);
  const gst = tax.amount ?? 0;
  const total = tax.configured ? (tax.total ?? taxableAmount) : taxableAmount;

  async function applyCoupon() {
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      toast({ title: "Enter a coupon code", variant: "destructive" });
      return;
    }
    if (subtotal <= 0) {
      toast({ title: "Add line items first", description: "Coupon needs an order amount.", variant: "destructive" });
      return;
    }
    setCouponBusy(true);
    try {
      const res = await api.validateCoupon({
        code,
        orderAmount: subtotal,
        agencyId: user?.agencyId || undefined,
      });
      setAppliedCoupon({ code: res.coupon.code, discountAmount: res.discountAmount });
      setCouponCode(res.coupon.code);
      toast({ title: "Coupon applied", description: `${res.coupon.code} · −₹${res.discountAmount.toLocaleString("en-IN")}` });
    } catch (e) {
      setAppliedCoupon(null);
      toast({
        title: "Coupon not valid",
        description: e instanceof ApiError || e instanceof Error ? e.message : "Try another code",
        variant: "destructive",
      });
    } finally {
      setCouponBusy(false);
    }
  }

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
    const quote = addQuotation({
      customerName: customer,
      service: service as Quotation["service"],
      items: items.length,
      amount: taxableAmount,
      gst,
      total,
      validTill: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdBy: user?.name || "Team",
      contactEmail: selectedCustomer?.email,
      contactPhone: selectedCustomer?.phone,
      status: asDraft ? "Draft" : "Sent",
      couponCode: appliedCoupon?.code,
      couponDiscount: appliedCoupon?.discountAmount ?? 0,
      lineItems: items.map((i) => ({
        description: i.description || `${service} item`,
        qty: i.qty,
        price: i.price,
      })),
    });
    toast({
      title: asDraft ? "Quotation saved as draft" : "Quotation created",
      description: `${customer} · Total ${formatINR(total)}${appliedCoupon ? ` · ${appliedCoupon.code}` : ""}`,
    });
    setOpen(false);
    setCustomer("");
    setService("Flight");
    setItems([{ id: "1", description: "", qty: 1, price: 0 }]);
    setDiscount(0);
    setCouponCode("");
    setAppliedCoupon(null);
    if (!asDraft) setShareQuote(quote);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quick line-item quote</DialogTitle>
            <DialogDescription>
              Simple quote with customer, service type, and priced line items — then PDF, email, or WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Customer</Label>
              <Select value={customer} onValueChange={setCustomer}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.length === 0 && leads.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground max-w-[240px] space-y-2">
                      <p>No customers yet. Add one, then return here.</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setOpen(false);
                          setView("customers");
                        }}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add customer
                      </Button>
                    </div>
                  ) : (
                    <>
                      {customers.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      {leads.filter((l) => !customers.some((c) => c.name === l.customerName)).map((l) => (
                        <SelectItem key={l.id} value={l.customerName}>{l.customerName} (lead)</SelectItem>
                      ))}
                    </>
                  )}
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

          <div className="space-y-2">
            <Label>Coupon code</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Ticket className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 uppercase"
                  placeholder="e.g. FLY500"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value);
                    if (appliedCoupon) setAppliedCoupon(null);
                  }}
                />
              </div>
              <Button type="button" variant="outline" onClick={() => void applyCoupon()} disabled={couponBusy}>
                {couponBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
              </Button>
              {appliedCoupon && (
                <Button type="button" variant="ghost" onClick={() => { setAppliedCoupon(null); setCouponCode(""); }}>
                  Clear
                </Button>
              )}
            </div>
            {appliedCoupon && (
              <p className="text-xs text-emerald-600">
                {appliedCoupon.code} applied (−{formatFullINR(appliedCoupon.discountAmount)})
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Extra discount (%)</Label>
              <div className="relative">
                <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className="pl-8" />
              </div>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatFullINR(subtotal)}</span></div>
              {couponDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Coupon ({appliedCoupon?.code})</span>
                  <span>-{formatFullINR(couponDiscountAmount)}</span>
                </div>
              )}
              {manualDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Extra ({discount}%)</span>
                  <span>-{formatFullINR(manualDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between"><span className="text-muted-foreground">{tax.label}</span><span>{tax.configured ? formatFullINR(gst) : "—"}</span></div>
              {!tax.configured && (
                <p className="text-[10px] text-amber-700">Configure an active TaxRule before finalizing. No default rate is applied.</p>
              )}
              <Separator className="my-1" />
              <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-teal-600">{formatFullINR(total)}</span></div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => save(true)}>Save as Draft</Button>
            <Button onClick={() => save(false)} className="bg-primary hover:bg-primary/90">
              <Send className="w-4 h-4 mr-1" /> Save & Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareQuote} onOpenChange={(v) => { if (!v) setShareQuote(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share with client</DialogTitle>
            <DialogDescription>
              {shareQuote?.quoteNo} · {shareQuote?.customerName} · {shareQuote ? formatFullINR(shareQuote.total) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              variant="outline"
              onClick={() => shareQuote && pdf(shareQuote)}
            >
              <FileDown className="w-4 h-4 mr-2" /> Download PDF
            </Button>
            <Button
              variant="outline"
              disabled={shareQuote?.status === "Expired"}
              onClick={() => shareQuote && email(shareQuote)}
            >
              <Mail className="w-4 h-4 mr-2" /> Email PDF
            </Button>
            <Button
              variant="outline"
              disabled={shareQuote?.status === "Expired"}
              onClick={() => shareQuote && whatsapp(shareQuote)}
            >
              <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp PDF
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShareQuote(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const APPROVAL_STEPS = [
  { key: "Executive Prep", icon: FileText, color: "text-slate-500 bg-slate-100 dark:bg-slate-500/15" },
  { key: "Team Lead", icon: Clock, color: "text-amber-500 bg-amber-100 dark:bg-amber-500/15" },
  { key: "Finance", icon: Wallet, color: "text-violet-500 bg-violet-100 dark:bg-violet-500/15" },
  { key: "Ready to Send", icon: CheckCircle2, color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-500/15" },
];

function latestStage(q: Quotation, stage: string) {
  const rows = q.approvals || [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i]?.stage === stage) return rows[i];
  }
  return undefined;
}

function approvalIndex(q: Quotation) {
  if (
    ["Sent to Agent", "Sent", "Customer Reviewing", "Accepted", "Converted to Booking"].includes(q.status)
    || latestStage(q, "Ready to Send")?.status === "Approved"
    || q.approvalStatus === "Approved"
  ) return 3;
  const finance = latestStage(q, "Finance");
  if (finance?.status === "Pending" || (latestStage(q, "Team Lead")?.status === "Approved" && finance)) return 2;
  if (q.status === "Pending Approval" || q.approvalStatus === "Pending" || latestStage(q, "Team Lead")) return 1;
  if (latestStage(q, "Executive Prep")?.status === "Approved") return 0;
  return 0;
}

function pendingApprovalStage(q: Quotation): "Team Lead" | "Finance" | null {
  const team = latestStage(q, "Team Lead");
  if (team?.status === "Pending") return "Team Lead";
  const finance = latestStage(q, "Finance");
  if (finance?.status === "Pending") return "Finance";
  return null;
}

/** True once Executive Prep has been submitted (Team Lead row exists or status moved). */
function approvalAlreadySubmitted(q: Quotation): boolean {
  if (q.status === "Pending Approval") return true;
  if (latestStage(q, "Executive Prep")?.status === "Approved") return true;
  return Boolean(latestStage(q, "Team Lead"));
}

function QuoteDetailDialog({ quote, open, onOpenChange }: { quote: Quotation | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const isAgent = user?.role === "travel_agent";
  const { pdf, email, whatsapp } = useQuoteActions();
  const { proceed, busyId } = useProceedToBooking();
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const [full, setFull] = useState<Quotation | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [convertStart, setConvertStart] = useState("");
  const [convertEnd, setConvertEnd] = useState("");
  const [versions, setVersions] = useState<Array<{
    id: string;
    versionNumber: number;
    changeSummary?: string | null;
    createdByName?: string | null;
    createdAt: string;
    status?: string | null;
  }>>([]);
  const [customerResponses, setCustomerResponses] = useState<Array<{
    id: string;
    versionNumber: number;
    responseType: string;
    comment?: string | null;
    customerName?: string | null;
    createdAt: string;
  }>>([]);
  const [historyView, setHistoryView] = useState<{
    versionNumber: number;
    createdAt: string;
    createdByName?: string | null;
    changeSummary?: string | null;
    snapshot: Record<string, unknown>;
  } | null>(null);
  const [decisionOpen, setDecisionOpen] = useState<"reject" | "revision" | null>(null);
  const [decisionComments, setDecisionComments] = useState("");
  const [decisionBusy, setDecisionBusy] = useState(false);
  const [requireFinance, setRequireFinance] = useState(false);
  const [agents, setAgents] = useState<Array<{
    id: string;
    name: string;
    agentCode?: string | null;
    agency?: { name?: string | null; code?: string | null } | null;
  }>>([]);
  const [assignAgentId, setAssignAgentId] = useState<string>("none");
  const [assignBusy, setAssignBusy] = useState(false);
  const canAssignAgent = Boolean(user && !isAgent && ["super_admin", "agency_admin", "branch_manager", "sales_executive"].includes(user.role));

  useEffect(() => {
    if (!open || !quote) return;
    setFull(quote);
    setExtendDate(quote.validTill?.slice(0, 10) || "");
    setConvertStart(toCalendarDate(quote.travelStartDate) || toCalendarDate(quote.travelDates));
    setConvertEnd(toCalendarDate(quote.travelEndDate) || toCalendarDate(quote.returnDate));
    setAssignAgentId((quote as { agentId?: string }).agentId || "none");
    api.getQuotationFull(quote.id)
      .then((res) => {
        const mapped = mapApiQuotation(res.quotation);
        setFull(mapped);
        upsertQuotation(mapped);
        setVersions(mapped.versions || []);
        setExtendDate(mapped.validTill?.slice(0, 10) || "");
        setConvertStart(toCalendarDate(mapped.travelStartDate) || toCalendarDate(mapped.travelDates));
        setConvertEnd(toCalendarDate(mapped.travelEndDate) || toCalendarDate(mapped.returnDate));
        setAssignAgentId((mapped as { agentId?: string }).agentId || "none");
      })
      .catch(() => undefined);
    api.getQuotationVersions(quote.id)
      .then((res) => setVersions(res.versions || []))
      .catch(() => undefined);
    api.getQuotationCustomerResponses(quote.id)
      .then((res) => setCustomerResponses(res.responses || []))
      .catch(() => setCustomerResponses([]));
  }, [open, quote, isAgent, upsertQuotation]);

  useEffect(() => {
    if (!open || !canAssignAgent) return;
    api.getAgents()
      .then((res) => setAgents(res.agents || []))
      .catch(() => setAgents([]));
  }, [open, canAssignAgent]);

  if (!quote) return null;
  const display = full || quote;
  const items = getQuotationLineItems(display);
  const step = approvalIndex(display);
  const discountApproval = latestDiscountApproval(display.approvals);
  const showDiscountActions = !isAgent && canApproveDiscount(user?.role) && discountApproval?.status === "Pending";
  const pendingStage = pendingApprovalStage(display);
  const canApprovePending =
    !isAgent
    && pendingStage
    && (
      (pendingStage === "Team Lead" && ["team_lead", "branch_manager", "agency_admin", "super_admin"].includes(String(user?.role || "")))
      || (pendingStage === "Finance" && ["accountant", "management", "agency_admin", "super_admin"].includes(String(user?.role || "")))
    );
  const costing = resolveQuotationCosting({
    ...display,
    packages: display.packages as unknown as Array<Record<string, unknown>>,
  });

  async function refresh() {
    const res = await api.getQuotationFull(display.id);
    const mapped = mapApiQuotation(res.quotation);
    setFull(mapped);
    upsertQuotation(mapped);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pr-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {display.quoteNo}
                <StatusBadge status={quoteDisplayStatus(display)} />
                {discountApproval?.status === "Pending" && (
                  <Badge variant="outline" className="border-amber-300 text-amber-800 bg-amber-50">Discount pending</Badge>
                )}
                {discountApproval?.status === "Rejected" && (
                  <Badge variant="outline" className="border-rose-300 text-rose-800 bg-rose-50">Discount rejected</Badge>
                )}
                {discountApproval?.status === "Approved" && Number(display.discountValue || 0) > 0 && (
                  <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50">Discount approved</Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                {display.customerName} · {display.service}
                {display.destination ? ` · ${display.destination}` : ""}
                {" · "}Created {new Date(display.createdAt).toLocaleDateString("en-IN")}
                {display.currentVersion ? ` · v${display.currentVersion}` : ""}
              </DialogDescription>
            </div>
            <Badge variant="secondary" className={cn("shrink-0", SERVICE_COLORS[display.service])}>{display.service}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {(discountApproval?.status === "Pending" || discountApproval?.status === "Rejected") && (
            <div className={cn(
              "rounded-lg border px-3 py-2 text-xs",
              discountApproval.status === "Pending"
                ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10"
                : "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-500/30 dark:bg-rose-500/10",
            )}>
              <p className="font-medium">
                {discountApproval.status === "Pending"
                  ? "Discount approval required"
                  : "Discount was rejected"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {display.discountType || "Discount"} {display.discountValue ?? 0}
                {discountApproval.comments ? ` — ${discountApproval.comments}` : ""}
                {". "}Submit for approval and send stay blocked until this is resolved.
              </p>
              {showDiscountActions && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button size="sm" className="h-7" onClick={async () => {
                    try {
                      await api.approveQuotation(display.id, { stage: "Discount" });
                      await refresh();
                      toast({ title: "Discount approved" });
                    } catch (e) {
                      toast({ title: "Approve failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                    }
                  }}>
                    Approve discount
                  </Button>
                  <Button size="sm" variant="outline" className="h-7" onClick={async () => {
                    try {
                      await api.rejectQuotationApproval(display.id, { stage: "Discount", comments: "Reduce discount" });
                      await refresh();
                      toast({ title: "Discount rejected" });
                    } catch (e) {
                      toast({ title: "Reject failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                    }
                  }}>
                    Reject discount
                  </Button>
                </div>
              )}
            </div>
          )}

          {["Sent to Agent", "Sent", "Customer Reviewing"].includes(display.status) && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100">
              <p className="font-medium">Customer decision</p>
              <p className="mt-0.5 text-muted-foreground dark:text-sky-200/80">
                {isAgent
                  ? <>Use <strong>Accept</strong>, <strong>Reject</strong>, or <strong>Request revision</strong> after the customer decides. You can also share a customer review link.</>
                  : <>When the client confirms, use <strong>Record acceptance</strong>. That unlocks Convert to Booking for staff. Use Request Revision if they want changes.</>}
              </p>
            </div>
          )}

          {(display.documents || []).length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">Documents & vouchers</p>
              <div className="space-y-1 text-xs">
                {display.documents!.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{doc.docType}</span>
                      {" · "}
                      {doc.fileName}
                    </span>
                    {doc.downloadPath ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 shrink-0"
                        onClick={async () => {
                          try {
                            const blob = await apiFetchBlob(doc.downloadPath!);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = doc.fileName || "document";
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch (e) {
                            toast({ title: "Download failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                          }
                        }}
                      >
                        <FileDown className="w-3.5 h-3.5 mr-1" /> Download
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border p-3 bg-muted/20">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Approval Workflow</p>
            <div className="flex items-center justify-between">
              {APPROVAL_STEPS.map((s, i) => (
                <div key={s.key} className="flex-1 flex flex-col items-center relative">
                  {i < APPROVAL_STEPS.length - 1 && (
                    <div className={cn("absolute top-4 left-1/2 w-full h-0.5", i < step ? "bg-emerald-400" : "bg-border")} />
                  )}
                  <div className={cn("relative z-10 w-8 h-8 rounded-full flex items-center justify-center", i <= step ? s.color : "bg-muted text-muted-foreground")}>
                    <s.icon className="w-4 h-4" />
                  </div>
                  <p className={cn("text-[10px] mt-1 text-center", i <= step ? "font-medium" : "text-muted-foreground")}>{s.key}</p>
                </div>
              ))}
            </div>
          </div>

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
                    <TableCell className="text-xs">
                      <div className="flex items-center gap-2">
                        {it.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={it.imageUrl} alt="" className="w-10 h-8 rounded object-cover border" />
                        ) : null}
                        <span>{it.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-center">{it.qty}</TableCell>
                    <TableCell className="text-xs text-right">{formatFullINR(it.price)}</TableCell>
                    <TableCell className="text-xs text-right font-medium">{formatFullINR(it.qty * it.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="rounded-xl border bg-muted/20 p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-xs">
            <div>
              <p className="text-muted-foreground">Valid Till</p>
              <p className={display.status === "Expired" ? "font-medium text-destructive" : "font-medium"}>
                {new Date(display.validTill).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                {display.status === "Expired" ? " · Expired" : ""}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Created By</p>
              <p className="font-medium break-all">{display.createdBy}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Travel agent</p>
              <p className="font-medium break-all">{display.agentName || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Items</p>
              <p className="font-medium">{display.items}</p>
            </div>
            {display.contactEmail && (
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium break-all">{display.contactEmail}</p>
              </div>
            )}
            {display.contactPhone && (
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{display.contactPhone}</p>
              </div>
            )}
            {!isAgent && display.internalNotes && (
              <div className="sm:col-span-2 lg:col-span-3 rounded border border-amber-200 bg-amber-50 dark:bg-amber-500/10 p-2">
                <p className="text-[10px] uppercase text-amber-800">Internal notes</p>
                <p>{display.internalNotes}</p>
              </div>
            )}
          </div>

          {canAssignAgent && !["Converted to Booking", "Archived"].includes(display.status) && (
            <div className="flex flex-wrap items-end gap-2 border rounded-lg p-3">
              <div className="min-w-[240px] flex-1">
                <Label className="text-xs">Assign travel agent</Label>
                <Select value={assignAgentId || "none"} onValueChange={setAssignAgentId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select registered agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No travel agent</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                        {a.agentCode ? ` · ${a.agentCode}` : ""}
                        {a.agency?.name ? ` · ${a.agency.name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={assignBusy}
                onClick={async () => {
                  setAssignBusy(true);
                  try {
                    const res = await api.assignQuotationAgent(
                      display.id,
                      { agentId: assignAgentId === "none" ? null : assignAgentId },
                    );
                    const mapped = mapApiQuotation(res.quotation);
                    setFull(mapped);
                    upsertQuotation(mapped);
                    setAssignAgentId((mapped as { agentId?: string }).agentId || "none");
                    toast({
                      title: "Travel agent updated",
                      description: mapped.agentName || "Agent cleared from quotation",
                    });
                  } catch (e) {
                    toast({
                      title: "Could not assign agent",
                      description: e instanceof ApiError ? e.message : "Try again",
                      variant: "destructive",
                    });
                  } finally {
                    setAssignBusy(false);
                  }
                }}
              >
                {assignBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Save agent
              </Button>
            </div>
          )}
          <QuotePriceBreakdown
            costing={{
              ...costing,
              checkIn: toCalendarDate(convertStart) || costing.checkIn,
              checkOut: toCalendarDate(convertEnd) || costing.checkOut,
            }}
            audience={String(user?.role) === "customer" ? "customer" : isAgent ? "agent" : "internal"}
            showInternal={!isAgent && String(user?.role) !== "customer"}
            editable={!isAgent && display.status === "Accepted"}
            onChangeDates={(start, end) => {
              setConvertStart(start);
              setConvertEnd(end);
            }}
            onChangeTravellers={undefined}
            onChangeRooms={undefined}
          />

          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase">
              {isAgent ? "Share with customer" : "Validity & versions"}
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              {!isAgent && (
                <>
                  <div>
                    <Label className="text-[10px]">Extend valid until</Label>
                    <Input className="h-8 w-40 text-xs" type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} />
                  </div>
                  <Button size="sm" variant="outline" onClick={async () => {
                    try {
                      const res = await api.extendQuotation(display.id, extendDate);
                      upsertQuotation(mapApiQuotation(res.quotation));
                      setFull(mapApiQuotation(res.quotation));
                      toast({ title: "Validity updated" });
                    } catch (e) {
                      toast({ title: "Extend failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                    }
                  }}>Extend / renew</Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={async () => {
                try {
                  const res = await api.createQuotationCustomerLink(display.id);
                  const url = res.url || `${window.location.origin}/q/${res.token}`;
                  await navigator.clipboard.writeText(url);
                  toast({ title: "Customer link copied", description: `Bound to version ${res.versionNumber}` });
                } catch (e) {
                  toast({ title: "Link failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                }
              }}>Copy customer link</Button>
              {!isAgent && (
                <Button size="sm" variant="outline" onClick={async () => {
                  try {
                    await api.createQuotationVersion(display.id, { changeSummary: "Manual snapshot" });
                    const res = await api.getQuotationVersions(display.id);
                    setVersions(res.versions || []);
                    toast({ title: "Version saved" });
                  } catch (e) {
                    toast({ title: "Version failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                  }
                }}>Save version</Button>
              )}
            </div>
            {!isAgent && versions.length > 0 && (
                <div className="max-h-36 overflow-y-auto text-xs space-y-1">
                  {versions.map((v) => (
                    <div key={v.id} className="flex justify-between items-center gap-2 rounded border px-2 py-1">
                      <span className="min-w-0 truncate">
                        v{v.versionNumber}
                        {v.status ? ` · ${v.status}` : ""}
                        {" · "}
                        {v.changeSummary || "Revision"}
                        {" · "}
                        {v.createdByName || "System"}
                        {" · "}
                        {new Date(v.createdAt).toLocaleString("en-IN")}
                      </span>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7" onClick={async () => {
                          try {
                            const res = await api.getQuotationVersion(display.id, v.versionNumber);
                            setHistoryView({
                              versionNumber: res.version.versionNumber,
                              createdAt: res.version.createdAt,
                              createdByName: res.version.createdByName,
                              changeSummary: res.version.changeSummary,
                              snapshot: res.version.snapshot,
                            });
                          } catch (e) {
                            toast({ title: "View failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                          }
                        }}>View</Button>
                        {!isAgent && (
                          <Button size="sm" variant="ghost" className="h-7" onClick={async () => {
                            try {
                              const res = await api.restoreQuotationVersion(display.id, v.id);
                              const mapped = mapApiQuotation(res.quotation);
                              setFull(mapped);
                              upsertQuotation(mapped);
                              const vers = await api.getQuotationVersions(display.id);
                              setVersions(vers.versions || []);
                              toast({ title: `Restored as new revision from v${v.versionNumber}` });
                            } catch (e) {
                              toast({ title: "Restore failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                            }
                          }}>Restore</Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </div>

          {customerResponses.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase">Customer responses</p>
              <div className="max-h-28 overflow-y-auto text-xs space-y-1">
                {customerResponses.map((r) => (
                  <div key={r.id} className="rounded border px-2 py-1">
                    <span className="font-medium">{r.responseType}</span>
                    {" · v"}{r.versionNumber}
                    {" · "}{r.customerName || "Customer"}
                    {" · "}{new Date(r.createdAt).toLocaleString("en-IN")}
                    {r.comment ? ` — ${r.comment}` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyView && (
            <div className="rounded-lg border p-3 bg-amber-50/40 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase text-amber-900">
                  Historical v{historyView.versionNumber} (read-only)
                </p>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => setHistoryView(null)}>Close</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {historyView.changeSummary || "Revision"} · {historyView.createdByName || "System"} · {new Date(historyView.createdAt).toLocaleString("en-IN")}
              </p>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div>Customer: <span className="font-medium">{String(historyView.snapshot.customerName || "—")}</span></div>
                <div>Destination: <span className="font-medium">{String(historyView.snapshot.destination || "—")}</span></div>
                <div>Dates: <span className="font-medium">{String(historyView.snapshot.travelStartDate || historyView.snapshot.travelDates || "—")}</span></div>
                <div>Total: <span className="font-medium">{formatFullINR(Number(historyView.snapshot.total || 0))}</span></div>
                <div>Packages: <span className="font-medium">{Array.isArray(historyView.snapshot.packages) ? historyView.snapshot.packages.length : 0}</span></div>
                <div>Status then: <span className="font-medium">{String(historyView.snapshot.status || "—")}</span></div>
              </div>
              <p className="text-[10px] text-muted-foreground">This snapshot is immutable. Restore creates a new current revision and requires re-approval before send.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => pdf(display)}><FileDown className="w-3.5 h-3.5 mr-1" /> Download PDF</Button>
            <Button variant="outline" size="sm" disabled={display.status === "Expired"} onClick={() => email(display)}><Mail className="w-3.5 h-3.5 mr-1" /> Email</Button>
            <Button variant="outline" size="sm" disabled={display.status === "Expired"} onClick={() => whatsapp(display)}><MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp</Button>
            {["Sent to Agent", "Sent"].includes(display.status) && (
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  await api.setQuotationStatus(display.id, "Customer Reviewing");
                  await refresh();
                  toast({ title: "Marked as Customer Reviewing" });
                } catch (e) {
                  toast({ title: "Update failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                }
              }}>
                <Eye className="w-3.5 h-3.5 mr-1" /> Mark Customer Reviewing
              </Button>
            )}
            {["Sent", "Sent to Agent", "Customer Reviewing"].includes(display.status) && display.status !== "Expired" && (
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  await api.acceptQuotation(display.id, { personName: display.customerName });
                  await refresh();
                  toast({
                    title: isAgent ? "Quotation accepted" : "Customer acceptance recorded",
                    description: isAgent ? "Trevio ops can convert this to a booking" : "Convert to Booking is now available for employees",
                  });
                } catch (e) {
                  toast({ title: "Accept failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                }
              }}>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {isAgent ? "Accept" : "Record acceptance"}
              </Button>
            )}
            {["Sent to Agent", "Customer Reviewing", "Sent"].includes(display.status) && (
              <>
                <Button variant="outline" size="sm" onClick={() => { setDecisionComments(""); setDecisionOpen("revision"); }}>
                  Request Revision
                </Button>
                <Button variant="outline" size="sm" className="text-rose-700 border-rose-200 hover:bg-rose-50" onClick={() => { setDecisionComments(""); setDecisionOpen("reject"); }}>
                  <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                </Button>
              </>
            )}
            {!isAgent && (display.status === "Accepted" || display.status === "Converted to Booking") && (
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white"
                disabled={busyId === display.id || display.status === "Converted to Booking"}
                onClick={() => proceed(display, { travelStartDate: convertStart, travelEndDate: convertEnd })}
              >
                {busyId === display.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Ticket className="w-3.5 h-3.5 mr-1" />}
                {display.status === "Converted to Booking" ? "Booking Created" : "Convert to Booking"}
              </Button>
            )}
            {display.status === "Expired" && (
              <p className="text-xs text-destructive w-full">This quotation has expired. Extend validity and re-approve before sending or converting.</p>
            )}
            {!isAgent && ["Draft", "In Progress"].includes(display.status) && !approvalAlreadySubmitted(display) && (
              <div className="flex flex-wrap items-center gap-2 w-full">
                <label className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
                  <input
                    type="checkbox"
                    checked={requireFinance}
                    onChange={(e) => setRequireFinance(e.target.checked)}
                  />
                  Require Finance approval
                </label>
                <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={async () => {
                  try {
                    await api.submitQuotationApproval(display.id, { financeApprovalRequired: requireFinance });
                    await refresh();
                    toast({ title: "Submitted for approval", description: "Executive Prep complete · awaiting Team Lead" });
                  } catch (e) {
                    toast({ title: "Submit failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                  }
                }}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Submit Approval
                </Button>
              </div>
            )}
            {!isAgent && canApprovePending && pendingStage && (
              <Button size="sm" className="ml-auto" onClick={async () => {
                try {
                  const res = await api.approveQuotation(display.id, { stage: pendingStage });
                  const mapped = mapApiQuotation(res.quotation);
                  setFull(mapped);
                  upsertQuotation(mapped);
                  const ready = Boolean((res as { readyToSend?: boolean }).readyToSend) || mapped.approvalStatus === "Approved";
                  toast({
                    title: ready ? "Approved & ready to send" : `${pendingStage} approved`,
                    description: ready
                      ? "Badge will show Ready to Send. You can Download PDF or Email/WhatsApp now."
                      : "Waiting for the next approval stage.",
                  });
                } catch (e) {
                  toast({ title: "Approve failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                }
              }}>
                Approve {pendingStage}
              </Button>
            )}
            {!isAgent && isQuoteReadyToSend(display) && (
              <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50">Ready to Send</Badge>
            )}
          </div>
        </div>

        <Dialog open={decisionOpen != null} onOpenChange={(v) => { if (!v) setDecisionOpen(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{decisionOpen === "reject" ? "Reject quotation" : "Request revision"}</DialogTitle>
              <DialogDescription>
                {decisionOpen === "reject"
                  ? "Share why the customer is declining so the sales team can follow up."
                  : "Tell the team what needs to change (hotels, price, dates, etc.)."}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              rows={4}
              placeholder={decisionOpen === "reject" ? "Reason for rejection…" : "Revision notes…"}
              value={decisionComments}
              onChange={(e) => setDecisionComments(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setDecisionOpen(null)}>Cancel</Button>
              <Button
                disabled={decisionBusy || !decisionComments.trim()}
                className={decisionOpen === "reject" ? "bg-rose-600 hover:bg-rose-700" : undefined}
                onClick={async () => {
                  if (!decisionOpen) return;
                  setDecisionBusy(true);
                  try {
                    if (decisionOpen === "reject") {
                      await api.rejectQuotation(display.id, { comments: decisionComments.trim() });
                      toast({ title: "Quotation rejected" });
                    } else {
                      await api.requestQuotationRevision(display.id, { comments: decisionComments.trim() });
                      toast({ title: "Revision requested" });
                    }
                    setDecisionOpen(null);
                    await refresh();
                  } catch (e) {
                    toast({
                      title: decisionOpen === "reject" ? "Reject failed" : "Revision failed",
                      description: e instanceof ApiError ? e.message : "Error",
                      variant: "destructive",
                    });
                  } finally {
                    setDecisionBusy(false);
                  }
                }}
              >
                {decisionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : decisionOpen === "reject" ? "Confirm reject" : "Submit revision"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationsView() {
  const { toast } = useToast();
  const { pdf, markSent } = useQuoteActions();
  const user = useAuthStore((s) => s.user);
  const quotePrefill = useAppStore((s) => s.quotePrefill);
  const setQuotePrefill = useAppStore((s) => s.setQuotePrefill);
  const openQuotationWizard = useAppStore((s) => s.openQuotationWizard);
  const setView = useAppStore((s) => s.setView);
  const quotations = useDemoDataStore((s) => s.quotations);
  const leads = useDemoDataStore((s) => s.leads);
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const hydrateFromApi = useDemoDataStore((s) => s.hydrateFromApi);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [productQuoteOpen, setProductQuoteOpen] = useState(false);
  const [intlQuoteOpen, setIntlQuoteOpen] = useState(false);
  const [quickQuoteOpen, setQuickQuoteOpen] = useState(false);
  const [agentQuoteOpen, setAgentQuoteOpen] = useState(false);
  const [tripComposerOpen, setTripComposerOpen] = useState(false);
  const [fromEnquiryOpen, setFromEnquiryOpen] = useState(false);
  const [enquiryLeadId, setEnquiryLeadId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sort, setSort] = useState("latest");
  const [travelFrom, setTravelFrom] = useState("");
  const [travelTo, setTravelTo] = useState("");
  const [analytics, setAnalytics] = useState<Record<string, number | undefined>>({});
  const isAgent = user?.role === "travel_agent";

  const enquiryLeads = useMemo(
    () => leads.filter((l) => !["Won", "Lost"].includes(l.stage)).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [leads],
  );

  function openFromEnquiry(lead: Lead) {
    setQuotePrefill({
      leadId: lead.id,
      customerName: lead.customerName,
      contactEmail: lead.email,
      contactPhone: lead.phone,
      service: lead.service,
      budget: lead.value,
      enquiryRef: `LEAD-${lead.id.slice(-6)}`,
    });
    setFromEnquiryOpen(false);
    setEnquiryLeadId("");
    openQuotationWizard(null);
    toast({ title: "Opening quotation wizard", description: `Prefilling from ${lead.customerName}` });
  }

  useEffect(() => {
    if (!quotePrefill || isAgent) return;
    openQuotationWizard(null);
  }, [quotePrefill, isAgent, openQuotationWizard]);

  useEffect(() => {
    api.getQuotationAnalytics()
      .then((a) => setAnalytics(a as Record<string, number | undefined>))
      .catch(() => undefined);
    const params: Record<string, string> = { pageSize: "100", sort };
    if (statusFilter !== "All") params.status = statusFilter;
    if (search.trim()) params.q = search.trim();
    if (travelFrom) params.travelFrom = travelFrom;
    if (travelTo) params.travelTo = travelTo;
    api.getQuotationsManage(params)
      .then((res) => {
        res.quotations.forEach((q) => upsertQuotation(mapApiQuotation(q)));
      })
      .catch(() => undefined);
  }, [sort, statusFilter, search, travelFrom, travelTo, upsertQuotation]);

  const filtered = useMemo(() => {
    let list = quotations;
    if (statusFilter !== "All") list = list.filter((q) => q.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((qt) =>
        qt.quoteNo.toLowerCase().includes(q) ||
        qt.customerName.toLowerCase().includes(q) ||
        (qt.destination || "").toLowerCase().includes(q) ||
        (qt.agentName || "").toLowerCase().includes(q) ||
        (qt.salesExecutiveName || "").toLowerCase().includes(q) ||
        (qt.enquiryRef || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, quotations, statusFilter]);

  const stats = [
    { icon: FileText, label: "Total Quotes", value: String(analytics.total ?? quotations.length), color: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-400" },
    { icon: Clock, label: "In Progress", value: String(analytics.inProgress ?? 0), color: "bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400" },
    { icon: Send, label: "Sent", value: String(analytics.sent ?? 0), color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400" },
    { icon: CheckCircle2, label: "Accepted", value: String(analytics.accepted ?? 0), color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400" },
    { icon: Ticket, label: "Converted", value: String(analytics.converted ?? 0), color: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400" },
    { icon: TrendingUp, label: "Conversion", value: `${analytics.conversionRate ?? 0}%`, color: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" },
    { icon: Wallet, label: "Quoted Value", value: formatINR(Number(analytics.totalQuotedValue ?? 0)), color: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400" },
    ...(!isAgent && analytics.expectedProfit != null
      ? [{ icon: Percent, label: "Expected Profit", value: formatINR(Number(analytics.expectedProfit)), color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" }]
      : []),
  ];

  function openDetail(q: Quotation) {
    setSelected(q);
    setDetailOpen(true);
  }

  async function runAction(label: string, fn: () => Promise<void>) {
    try {
      await fn();
      toast({ title: label });
      await hydrateFromApi();
      const a = await api.getQuotationAnalytics();
      setAnalytics(a as Record<string, number | undefined>);
    } catch (e) {
      toast({ title: `${label} failed`, description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Quotation Management"
        subtitle={isAgent ? "Browse packages, add markup, and send branded PDFs to customers instantly" : "Enquiry → draft → approval → send → revise → accept → convert to booking"}
        action={
          isAgent ? (
            <div className="flex flex-wrap gap-2">
              <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => setAgentQuoteOpen(true)}>
                <Plus className="w-4 h-4 mr-1" /> Create quotation
              </Button>
              <Button variant="outline" onClick={() => setTripComposerOpen(true)}>
                <Sparkles className="w-4 h-4 mr-1" /> Compose trip
              </Button>
              <Button variant="outline" onClick={() => setView("crm")}>
                <FileText className="w-4 h-4 mr-1" /> Submit enquiry
              </Button>
            </div>
          ) : !isAgent ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                onClick={() => openQuotationWizard(null)}
              >
                <Plus className="w-4 h-4 mr-1" /> Create quotation
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Other quote types
                    <ChevronDown className="w-4 h-4 ml-1 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  <DropdownMenuLabel>Choose how to build the quote</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                    onClick={() => openQuotationWizard(null)}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Full itinerary (recommended)
                    </span>
                    <span className="text-xs text-muted-foreground pl-5">
                      Packages, costing, and approval workflow
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                    onClick={() => setFromEnquiryOpen(true)}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" /> From CRM enquiry
                    </span>
                    <span className="text-xs text-muted-foreground pl-5">
                      Prefill customer, contact, budget from a lead
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                    onClick={() => setProductQuoteOpen(true)}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> From product catalog
                    </span>
                    <span className="text-xs text-muted-foreground pl-5">
                      Hotels & activities already approved in catalog
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                    onClick={() => setIntlQuoteOpen(true)}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" /> International trip
                    </span>
                    <span className="text-xs text-muted-foreground pl-5">
                      Overseas package with destination & budget
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex flex-col items-start gap-0.5 py-2.5 cursor-pointer"
                    onClick={() => setQuickQuoteOpen(true)}
                  >
                    <span className="font-medium flex items-center gap-1.5">
                      <ListOrdered className="w-3.5 h-3.5" /> Quick line items
                    </span>
                    <span className="text-xs text-muted-foreground pl-5">
                      Simple priced rows (flight / hotel / other)
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ProductQuoteBuilderDialog open={productQuoteOpen} onOpenChange={setProductQuoteOpen} />
              <InternationalQuotationDialog open={intlQuoteOpen} onOpenChange={setIntlQuoteOpen} />
              <CreateQuotationDialog open={quickQuoteOpen} onOpenChange={setQuickQuoteOpen} />
              <Dialog open={fromEnquiryOpen} onOpenChange={setFromEnquiryOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create quote from enquiry</DialogTitle>
                    <DialogDescription>
                      Pick a CRM lead to prefill the quotation wizard.
                    </DialogDescription>
                  </DialogHeader>
                  {enquiryLeads.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No open leads found. Add an enquiry in CRM first.</p>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Enquiry / lead</Label>
                        <Select value={enquiryLeadId || "none"} onValueChange={(v) => setEnquiryLeadId(v === "none" ? "" : v)}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select lead" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select lead…</SelectItem>
                            {enquiryLeads.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                {l.customerName} · {l.service} · {l.stage} · {formatINR(l.value)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {enquiryLeadId && (() => {
                        const lead = enquiryLeads.find((l) => l.id === enquiryLeadId);
                        if (!lead) return null;
                        return (
                          <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
                            <p><span className="text-muted-foreground">Customer:</span> {lead.customerName}</p>
                            <p><span className="text-muted-foreground">Contact:</span> {lead.email || "—"} · {lead.phone || "—"}</p>
                            <p><span className="text-muted-foreground">Budget:</span> {formatINR(lead.value)}</p>
                            <p><span className="text-muted-foreground">Enquiry ref:</span> LEAD-{lead.id.slice(-6)}</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setFromEnquiryOpen(false)}>Cancel</Button>
                    <Button
                      disabled={!enquiryLeadId}
                      className="bg-teal-600 hover:bg-teal-700"
                      onClick={() => {
                        const lead = enquiryLeads.find((l) => l.id === enquiryLeadId);
                        if (lead) openFromEnquiry(lead);
                      }}
                    >
                      Open wizard
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
        {stats.map((s, i) => <MetricCard key={s.label} {...s} index={i} />)}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <Input
              placeholder="Search quote no, customer, agent, destination, enquiry…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm h-9"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {["All", "Draft", "In Progress", "Pending Approval", "Sent to Agent", "Customer Reviewing", "Revision Requested", "Accepted", "Rejected", "Expired", "Converted to Booking", "Archived"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest">Latest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="value">Quote Value</SelectItem>
                {!isAgent && <SelectItem value="profit">Profit</SelectItem>}
                <SelectItem value="status">Status</SelectItem>
                <SelectItem value="travel">Travel date</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">Travel from</Label>
              <Input type="date" className="h-9 w-36" value={travelFrom} onChange={(e) => setTravelFrom(e.target.value)} />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">to</Label>
              <Input type="date" className="h-9 w-36" value={travelTo} onChange={(e) => setTravelTo(e.target.value)} />
            </div>
          </div>
          <div className="rounded-lg border border-border max-h-[60vh] overflow-y-auto scroll-thin">
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
                  <TableHead className="text-right sticky right-0 bg-card z-20 shadow-[-8px_0_8px_rgba(0,0,0,0.06)]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q) => (
                  <TableRow
                    key={q.id}
                    className="hover:bg-muted/40 cursor-pointer"
                    onClick={() => openDetail(q)}
                  >
                    <TableCell className="font-medium text-xs">{q.quoteNo}</TableCell>
                    <TableCell className="text-xs">
                      <div>{q.customerName}</div>
                      {q.destination && <div className="text-[10px] text-muted-foreground">{q.destination}</div>}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className={cn("text-[10px]", SERVICE_COLORS[q.service])}>{q.service}</Badge></TableCell>
                    <TableCell className="text-center text-xs">{q.items}</TableCell>
                    <TableCell className="text-right text-xs">{formatFullINR(q.amount)}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{formatFullINR(q.gst)}</TableCell>
                    <TableCell className="text-right text-xs font-semibold">{formatFullINR(q.total)}</TableCell>
                    <TableCell><StatusBadge status={quoteDisplayStatus(q)} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(q.validTill).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                    <TableCell className="text-xs">{q.createdBy}</TableCell>
                    <TableCell className="text-right sticky right-0 bg-card" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View" onClick={() => openDetail(q)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {!isAgent && ["Draft", "In Progress", "Revision Requested"].includes(q.status) && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit wizard" onClick={() => openQuotationWizard(q.id)}>
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {!isAgent && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Duplicate" onClick={() => runAction("Duplicated", async () => {
                            const res = await api.duplicateQuotation(q.id);
                            upsertQuotation(mapApiQuotation(res.quotation));
                          })}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-cyan-600" title="Email quotation PDF" onClick={() => runAction("Emailed", async () => {
                          const res = await deliverQuotationEmail(q);
                          if (!res.ok) throw new Error(res.error || "Email failed");
                        })}>
                          <Mail className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" title="WhatsApp quotation PDF" onClick={() => runAction("WhatsApp sent", async () => {
                          const res = await deliverQuotationWhatsApp(q);
                          if (!res.ok) throw new Error(res.error || "WhatsApp failed");
                        })}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-sky-600" title="Record link share" onClick={() => runAction("Shared", async () => {
                          await api.shareQuotation(q.id, {
                            channel: "Link",
                            recipient: q.contactEmail,
                            appOrigin: window.location.origin,
                          });
                        })}>
                          <Send className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" title="Download PDF" onClick={() => pdf(q)}>
                          <FileDown className="w-3.5 h-3.5" />
                        </Button>
                        {!isAgent && q.status === "Draft" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" title="Delete draft" onClick={() => runAction("Draft deleted", () => api.deleteQuotationDraft(q.id).then(() => undefined))}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {!isAgent && q.status !== "Archived" && (
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Archive" onClick={() => runAction("Archived", () => api.archiveQuotation(q.id).then(() => undefined))}>
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">{isAgent ? "No quotations yet. Create one from a published package." : "No quotations found. Create a quote with the wizard to start."}</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <QuoteDetailDialog quote={selected} open={detailOpen} onOpenChange={setDetailOpen} />
      <AgentQuotationDialog
        open={agentQuoteOpen}
        onOpenChange={setAgentQuoteOpen}
        onCreated={(q) => upsertQuotation(q)}
      />
      <AgentTripComposerDialog
        open={tripComposerOpen}
        onOpenChange={setTripComposerOpen}
        onCreated={(q) => upsertQuotation(q)}
      />
    </PageShell>
  );
}

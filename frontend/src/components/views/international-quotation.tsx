"use client";

import { useMemo, useState } from "react";
import { Globe, Send, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { formatFullINR } from "@/components/shared/ui-helpers";
import { downloadInternationalQuotationPdf } from "@/lib/quotation-pdf";
import type { NewQuotationInput } from "@/types";
import { api } from "@/lib/api";

const EMPTY_FORM = {
  customerName: "",
  contactPerson: "",
  contactEmail: "",
  contactPhone: "",
  destination: "",
  country: "",
  departureCity: "",
  travelDates: "",
  returnDate: "",
  nights: "0",
  days: "0",
  adults: "2",
  children: "0",
  infants: "0",
  hotelStarPreference: "4",
  roomTypePreference: "Deluxe",
  mealPlanPreference: "CP",
  location: "",
  budget: "",
  currency: "INR",
  paymentTerms: "50% advance, balance before travel",
  cancellationPolicy: "As per supplier policy",
  termsAndConditions: "Quotation valid for 14 days. Rates subject to availability.",
  includes: "Flight, Hotel, Transfers, Activities",
  excludes: "Personal Expenses, Tips, GST, TCS, Optional Activities",
  salesExecutiveName: "",
  salesExecutivePhone: "",
  salesExecutiveEmail: "",
};

export function InternationalQuotationDialog() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const addQuotation = useDemoDataStore((s) => s.addQuotation);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const budgetNum = parseInt(form.budget || "0", 10);
  const gst = Math.round(budgetNum * 0.18);
  const total = budgetNum + gst;
  const totalPax = useMemo(
    () => (parseInt(form.adults, 10) || 0) + (parseInt(form.children, 10) || 0) + (parseInt(form.infants, 10) || 0),
    [form.adults, form.children, form.infants]
  );

  function set(key: keyof typeof EMPTY_FORM, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(send: boolean) {
    if (!form.customerName || !form.destination || !form.travelDates) {
      toast({ title: "Missing required fields", description: "Customer, destination and travel date are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: NewQuotationInput = {
      customerName: form.customerName,
      service: "International" as const,
      items: 4,
      amount: budgetNum,
      gst,
      total,
      validTill: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdBy: form.salesExecutiveName || user?.name || "Sales Executive",
      isInternational: true,
      contactPerson: form.contactPerson,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      destination: form.destination,
      country: form.country,
      departureCity: form.departureCity,
      travelDates: form.travelDates,
      returnDate: form.returnDate,
      nights: parseInt(form.nights, 10) || 0,
      days: parseInt(form.days, 10) || 0,
      adults: parseInt(form.adults, 10),
      children: parseInt(form.children, 10),
      infants: parseInt(form.infants, 10),
      hotelStarPreference: form.hotelStarPreference,
      roomTypePreference: form.roomTypePreference,
      mealPlanPreference: form.mealPlanPreference,
      location: form.location,
      budget: budgetNum,
      currency: form.currency,
      packageIncludes: form.includes.split(",").map((s) => s.trim()).filter(Boolean),
      packageExcludes: form.excludes.split(",").map((s) => s.trim()).filter(Boolean),
      termsAndConditions: form.termsAndConditions,
      paymentTerms: form.paymentTerms,
      cancellationPolicy: form.cancellationPolicy,
      salesExecutiveName: form.salesExecutiveName || user?.name || "",
      salesExecutivePhone: form.salesExecutivePhone || user?.phone || "",
      salesExecutiveEmail: form.salesExecutiveEmail || user?.email || "",
      approvalStatus: (send ? "Pending" : "Draft") as "Pending" | "Draft",
      status: (send ? "Sent" : "Draft") as "Sent" | "Draft",
    };

    try {
      await api.createQuotation(payload);
      addQuotation(payload);
      toast({ title: send ? "International quotation sent" : "International quotation saved" });
      setOpen(false);
      setForm({
        ...EMPTY_FORM,
        salesExecutiveName: user?.name || "",
        salesExecutivePhone: user?.phone || "",
        salesExecutiveEmail: user?.email || "",
      });
    } catch (e) {
      addQuotation(payload);
      toast({
        title: send ? "Quotation saved locally" : "Draft saved locally",
        description: e instanceof Error ? e.message : "API unavailable — stored in session.",
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function exportPdf() {
    if (!form.customerName || !form.destination || !form.travelDates) {
      toast({ title: "Fill required fields before generating PDF", variant: "destructive" });
      return;
    }
    const ok = downloadInternationalQuotationPdf({
      customerName: form.customerName,
      contactPerson: form.contactPerson,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      destination: `${form.destination}${form.country ? `, ${form.country}` : ""}`,
      travelDates: `${form.travelDates}${form.returnDate ? ` → ${form.returnDate}` : ""} (${form.nights || 0}N / ${form.days || 0}D)`,
      adults: parseInt(form.adults, 10),
      children: parseInt(form.children, 10),
      infants: parseInt(form.infants, 10),
      hotelStarPreference: `${form.hotelStarPreference}★ · ${form.roomTypePreference} · ${form.mealPlanPreference}`,
      location: form.location || form.departureCity,
      currency: form.currency,
      includes: form.includes.split(",").map((s) => s.trim()).filter(Boolean),
      excludes: form.excludes.split(",").map((s) => s.trim()).filter(Boolean),
      paymentTerms: form.paymentTerms,
      cancellationPolicy: form.cancellationPolicy,
      amount: budgetNum,
      gst,
      total,
      createdBy: form.salesExecutiveName || user?.name || "Sales Executive",
    });
    toast({
      title: ok ? "PDF ready" : "Popup blocked",
      description: ok ? "Use the print dialog and choose Save as PDF." : "Allow popups to download the quotation PDF.",
      variant: ok ? "default" : "destructive",
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v && !form.salesExecutiveName) {
        setForm((f) => ({
          ...f,
          salesExecutiveName: user?.name || "",
          salesExecutivePhone: user?.phone || "",
          salesExecutiveEmail: user?.email || "",
        }));
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1"><Globe className="w-4 h-4" />International Quote</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>International Trip Quotation</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-semibold mb-2">Customer Details</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Customer Name *</Label><Input value={form.customerName} onChange={(e) => set("customerName", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Mobile Number</Label><Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email ID</Label><Input type="email" value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Travel Details</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Destination *</Label><Input value={form.destination} onChange={(e) => set("destination", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Country</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Departure City</Label><Input value={form.departureCity} onChange={(e) => set("departureCity", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Travel Date *</Label><Input type="date" value={form.travelDates} onChange={(e) => set("travelDates", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Return Date</Label><Input type="date" value={form.returnDate} onChange={(e) => set("returnDate", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Nights</Label><Input type="number" value={form.nights} onChange={(e) => set("nights", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Days</Label><Input type="number" value={form.days} onChange={(e) => set("days", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Customer Budget</Label><Input type="number" value={form.budget} onChange={(e) => set("budget", e.target.value)} /></div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Passenger Details</h4>
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="space-y-1.5"><Label>Adults</Label><Input type="number" value={form.adults} onChange={(e) => set("adults", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Children</Label><Input type="number" value={form.children} onChange={(e) => set("children", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Infants</Label><Input type="number" value={form.infants} onChange={(e) => set("infants", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Total Passengers</Label><Input value={String(totalPax)} readOnly /></div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Hotel Preferences</h4>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Star Category</Label>
                <Select value={form.hotelStarPreference} onValueChange={(v) => set("hotelStarPreference", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4, 5].map((s) => <SelectItem key={s} value={String(s)}>{s}★</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Room Type</Label><Input value={form.roomTypePreference} onChange={(e) => set("roomTypePreference", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Meal Plan</Label><Input value={form.mealPlanPreference} onChange={(e) => set("mealPlanPreference", e.target.value)} /></div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Package & Terms</h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2 space-y-1.5"><Label>Package Includes</Label><Input value={form.includes} onChange={(e) => set("includes", e.target.value)} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Package Excludes</Label><Input value={form.excludes} onChange={(e) => set("excludes", e.target.value)} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Terms & Conditions</Label><Textarea value={form.termsAndConditions} onChange={(e) => set("termsAndConditions", e.target.value)} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Payment Terms</Label><Textarea value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></div>
              <div className="sm:col-span-2 space-y-1.5"><Label>Cancellation Policy</Label><Textarea value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["INR", "USD", "EUR", "AED", "SGD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Sales Executive</h4>
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Employee Name</Label><Input value={form.salesExecutiveName} onChange={(e) => set("salesExecutiveName", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Mobile Number</Label><Input value={form.salesExecutivePhone} onChange={(e) => set("salesExecutivePhone", e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Email ID</Label><Input value={form.salesExecutiveEmail} onChange={(e) => set("salesExecutiveEmail", e.target.value)} /></div>
            </div>
          </div>
        </div>

        {budgetNum > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span>Total Cost</span><span>{formatFullINR(budgetNum)}</span></div>
            <div className="flex justify-between"><span>GST @ 18%</span><span>{formatFullINR(gst)}</span></div>
            <div className="flex justify-between font-semibold"><span>Grand Total</span><span>{formatFullINR(total)}</span></div>
          </div>
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={exportPdf}><FileDown className="w-4 h-4 mr-1" />PDF</Button>
          <Button variant="outline" disabled={saving} onClick={() => save(true)}><Send className="w-4 h-4 mr-1" />Send</Button>
          <Button disabled={saving} onClick={() => save(false)}>{saving ? "Saving..." : "Save Draft"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

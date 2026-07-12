"use client";

import { useState } from "react";
import { Globe, Send, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useDemoDataStore } from "@/store/demo-data-store";
import { formatFullINR } from "@/components/shared/ui-helpers";
import { downloadInternationalQuotationPdf } from "@/lib/quotation-pdf";

export function InternationalQuotationDialog() {
  const { toast } = useToast();
  const addQuotation = useDemoDataStore((s) => s.addQuotation);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    destination: "",
    travelDates: "",
    adults: "2",
    children: "0",
    infants: "0",
    hotelStarPreference: "4",
    location: "",
    budget: "",
    currency: "INR",
    paymentTerms: "50% advance, balance before travel",
    cancellationPolicy: "As per supplier policy",
    includes: "Flights, Hotels, Activities, Transfers",
    excludes: "Visa fees, personal expenses, travel insurance",
  });

  const budgetNum = parseInt(form.budget || "0", 10);
  const gst = Math.round(budgetNum * 0.18);
  const total = budgetNum + gst;

  function save(send: boolean) {
    if (!form.customerName || !form.destination || !form.travelDates) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    addQuotation({
      customerName: form.customerName,
      service: "International",
      items: 4,
      amount: budgetNum,
      gst,
      total,
      validTill: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdBy: "Sales Executive",
      isInternational: true,
      contactPerson: form.contactPerson,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      destination: form.destination,
      travelDates: form.travelDates,
      adults: parseInt(form.adults, 10),
      children: parseInt(form.children, 10),
      infants: parseInt(form.infants, 10),
      hotelStarPreference: form.hotelStarPreference,
      location: form.location,
      budget: budgetNum,
      currency: form.currency,
      packageIncludes: form.includes.split(",").map((s) => s.trim()),
      packageExcludes: form.excludes.split(",").map((s) => s.trim()),
      paymentTerms: form.paymentTerms,
      cancellationPolicy: form.cancellationPolicy,
      approvalStatus: send ? "Pending" : "Draft",
      status: send ? "Sent" : "Draft",
    });
    toast({ title: send ? "International quotation sent" : "International quotation saved" });
    setOpen(false);
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
      destination: form.destination,
      travelDates: form.travelDates,
      adults: parseInt(form.adults, 10),
      children: parseInt(form.children, 10),
      infants: parseInt(form.infants, 10),
      hotelStarPreference: form.hotelStarPreference,
      location: form.location,
      currency: form.currency,
      includes: form.includes.split(",").map((s) => s.trim()).filter(Boolean),
      excludes: form.excludes.split(",").map((s) => s.trim()).filter(Boolean),
      paymentTerms: form.paymentTerms,
      cancellationPolicy: form.cancellationPolicy,
      amount: budgetNum,
      gst,
      total,
      createdBy: "Sales Executive",
    });
    toast({
      title: ok ? "PDF ready" : "Popup blocked",
      description: ok ? "Use the print dialog and choose Save as PDF." : "Allow popups to download the quotation PDF.",
      variant: ok ? "default" : "destructive",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-1"><Globe className="w-4 h-4" />International Quote</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>International Quotation</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Customer Name *</Label><Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} /></div>
          <div className="space-y-2"><Label>Contact Person</Label><Input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Destination *</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
          <div className="space-y-2"><Label>Travel Dates *</Label><Input value={form.travelDates} onChange={(e) => setForm({ ...form, travelDates: e.target.value })} placeholder="01 Mar - 10 Mar 2026" /></div>
          <div className="space-y-2"><Label>Adults</Label><Input type="number" value={form.adults} onChange={(e) => setForm({ ...form, adults: e.target.value })} /></div>
          <div className="space-y-2"><Label>Children</Label><Input type="number" value={form.children} onChange={(e) => setForm({ ...form, children: e.target.value })} /></div>
          <div className="space-y-2"><Label>Infants</Label><Input type="number" value={form.infants} onChange={(e) => setForm({ ...form, infants: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Hotel Star Preference</Label>
            <Select value={form.hotelStarPreference} onValueChange={(v) => setForm({ ...form, hotelStarPreference: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 4, 5].map((s) => <SelectItem key={s} value={String(s)}>{s} Star</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Location</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="space-y-2"><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["INR", "USD", "EUR", "AED", "SGD"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2"><Label>Package Includes</Label><Input value={form.includes} onChange={(e) => setForm({ ...form, includes: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-2"><Label>Package Excludes</Label><Input value={form.excludes} onChange={(e) => setForm({ ...form, excludes: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-2"><Label>Payment Terms</Label><Textarea value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} /></div>
          <div className="sm:col-span-2 space-y-2"><Label>Cancellation Policy</Label><Textarea value={form.cancellationPolicy} onChange={(e) => setForm({ ...form, cancellationPolicy: e.target.value })} /></div>
        </div>
        {budgetNum > 0 && (
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatFullINR(budgetNum)}</span></div>
            <div className="flex justify-between"><span>GST @ 18%</span><span>{formatFullINR(gst)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total</span><span>{formatFullINR(total)}</span></div>
          </div>
        )}
        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" onClick={exportPdf}><FileDown className="w-4 h-4 mr-1" />PDF</Button>
          <Button variant="outline" onClick={() => save(true)}><Send className="w-4 h-4 mr-1" />Send</Button>
          <Button onClick={() => save(false)}>Save Draft</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

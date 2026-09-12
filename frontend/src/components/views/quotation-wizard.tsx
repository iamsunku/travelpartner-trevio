"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, ImageIcon, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { api, apiFetch, ApiError } from "@/lib/api";
import { mapApiQuotation } from "@/lib/api-mappers";
import { useDemoDataStore } from "@/store/demo-data-store";
import { useAuthStore } from "@/store/app-store";
import type { ProductRecord, Quotation, QuotationPackage } from "@/types";
import { formatFullINR } from "@/components/shared/ui-helpers";
import { previewPackageLayers, resolveQuotationCosting } from "@/lib/quote-costing";
import { QuotePriceBreakdown } from "@/components/shared/quote-price-breakdown";
import { DESTINATION_QUOTE_PLANS, getDestinationQuotePlan } from "@/lib/destination-quote-plans";
import { downloadQuotationPdf } from "@/lib/quotation-actions";
import { DestinationSelect } from "@/components/shared/destination-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { QuotePrefill } from "@/store/app-store";

const STEPS = [
  { label: "Basic Details", hint: "Customer & trip" },
  { label: "Hotels", hint: "Stay" },
  { label: "Flights", hint: "Air" },
  { label: "Itinerary", hint: "Day plan" },
  { label: "Transfers & Activities", hint: "Ground" },
  { label: "Meals", hint: "Food" },
  { label: "Insurance & Visa", hint: "Docs" },
  { label: "Add-ons", hint: "Extras" },
  { label: "Packages & Costing", hint: "Price" },
  { label: "Terms", hint: "Policies" },
  { label: "Review", hint: "Finish" },
] as const;

const STEP_GROUPS: { title: string; from: number; to: number }[] = [
  { title: "Start", from: 0, to: 0 },
  { title: "Trip build", from: 1, to: 5 },
  { title: "Extras", from: 6, to: 7 },
  { title: "Finish", from: 8, to: 10 },
];

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">{children}</div>
    </section>
  );
}

function emptyPackage(name: string, selected = false): QuotationPackage {
  return {
    name,
    isSelected: selected,
    sortOrder: 0,
    hotels: [],
    flights: [],
    transfers: [],
    activities: [],
    meals: [],
    itinerary: [{ day: 1, title: "Day 1", city: "", mealPlan: "", coverImage: "", gallery: [], items: [{ activityName: "Airport Arrival", description: "Meet & greet" }] }],
    visa: { enabled: false, visaType: "Tourist", entryType: "Single Entry", sellingPrice: 0, costPrice: 0 },
    insurance: { enabled: false, provider: "", planName: "", sellingPrice: 0, costPrice: 0 },
    addOns: [],
    inclusions: ["Accommodation", "Breakfast", "Airport transfers"],
    exclusions: ["Flights", "Personal expenses", "Tips"],
  };
}

export function QuotationWizardDialog({
  open,
  onOpenChange,
  quotationId,
  onSaved,
  prefill,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quotationId?: string | null;
  onSaved?: (q: Quotation) => void;
  prefill?: QuotePrefill | null;
}) {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [id, setId] = useState<string | null>(quotationId || null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [quoteNo, setQuoteNo] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    agentName: "",
    salesExecutiveName: user?.name || user?.email || "",
    destination: "",
    country: "",
    travelStartDate: "",
    travelEndDate: "",
    adults: 2,
    children: 0,
    infants: 0,
    currency: "INR",
    validTill: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    specialRequests: "",
    internalNotes: "",
    enquiryRef: "",
    isInternational: false,
    discountType: "" as "" | "Fixed" | "Percentage",
    discountValue: 0,
    taxRate: 0,
    trevioMarkupType: "Percentage" as "Percentage" | "Fixed",
    trevioMarkupValue: 0,
    termsAndConditions: "Rates subject to availability. Passport must be valid 6 months.",
    paymentTerms: "50% advance to confirm. Balance 15 days before travel.",
    cancellationPolicy: "Cancellation charges as per supplier policy.",
    refundPolicy: "Refunds processed within 15 working days after supplier confirmation.",
    hotelTerms: "",
    flightTerms: "",
    visaTerms: "",
    insuranceTerms: "",
    forceMajeure: "",
    travelDisclaimer: "This quotation is subject to availability and supplier confirmation. Catalogue visa notes are not immigration advice.",
    coverImage: "",
    budget: 0,
    service: "Holiday",
    agentCode: "",
    agencyCode: "",
  });
  const [packages, setPackages] = useState<QuotationPackage[]>([emptyPackage("Standard", true)]);
  const [destinationId, setDestinationId] = useState("");
  const [visaHint, setVisaHint] = useState("");
  const [visaRecommendation, setVisaRecommendation] = useState<{
    catalogueDetails: string;
    visaTypicallyRequired: boolean;
    suggestedVisaType: string;
    suggestedEntryType: string;
    disclaimer: string;
  } | null>(null);
  const [planId, setPlanId] = useState("");
  const [suggestedNights, setSuggestedNights] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    if (quotationId) {
      setBusy(true);
      api.getQuotationFull(quotationId)
        .then((res) => {
          const q = res.quotation as unknown as Quotation & Record<string, unknown>;
          setId(q.id);
          setLeadId((q.leadId as string) || null);
          setQuoteNo(q.quoteNo);
          setStep(Math.max(0, Number(q.wizardStep || 1) - 1));
          setForm((f) => ({
            ...f,
            customerName: q.customerName || "",
            contactPerson: q.contactPerson || "",
            contactEmail: q.contactEmail || "",
            contactPhone: q.contactPhone || "",
            agentName: q.agentName || "",
            salesExecutiveName: q.salesExecutiveName || f.salesExecutiveName,
            destination: q.destination || "",
            country: q.country || "",
            travelStartDate: q.travelStartDate || "",
            travelEndDate: q.travelEndDate || q.returnDate || "",
            adults: q.adults ?? 2,
            children: q.children ?? 0,
            infants: q.infants ?? 0,
            currency: q.currency || "INR",
            validTill: q.validTill,
            specialRequests: q.specialRequests || "",
            internalNotes: q.internalNotes || "",
            enquiryRef: q.enquiryRef || "",
            isInternational: Boolean(q.isInternational),
            discountType: (q.discountType as "" | "Fixed" | "Percentage") || "",
            discountValue: Number(q.discountValue || 0),
            taxRate: Number(q.taxRate ?? 0),
            trevioMarkupType: (q.trevioMarkupType === "Fixed" ? "Fixed" : "Percentage"),
            trevioMarkupValue: Number(q.trevioMarkupValue ?? 0),
            termsAndConditions: q.termsAndConditions || f.termsAndConditions,
            paymentTerms: q.paymentTerms || f.paymentTerms,
            cancellationPolicy: q.cancellationPolicy || f.cancellationPolicy,
            refundPolicy: (q.refundPolicy as string) || f.refundPolicy,
            hotelTerms: String(q.hotelTerms || ""),
            flightTerms: String(q.flightTerms || ""),
            visaTerms: String(q.visaTerms || ""),
            insuranceTerms: String(q.insuranceTerms || ""),
            forceMajeure: String(q.forceMajeure || ""),
            travelDisclaimer: String(q.travelDisclaimer || f.travelDisclaimer),
            coverImage: q.coverImage || "",
            budget: Number(q.budget || 0),
            service: (q.service as string) || "Holiday",
          }));
          if (q.packages?.length) setPackages(q.packages as QuotationPackage[]);
        })
        .catch(() => toast({ title: "Failed to load quote", variant: "destructive" }))
        .finally(() => setBusy(false));
    } else {
      setId(null);
      setQuoteNo("");
      setStep(0);
      setPackages([emptyPackage("Standard", true)]);
      setDestinationId("");
      setVisaHint("");
      setVisaRecommendation(null);
      setLeadId(prefill?.leadId || null);
      setForm((f) => ({
        ...f,
        coverImage: "",
        customerName: prefill?.customerName || "",
        contactPerson: prefill?.customerName || "",
        contactEmail: prefill?.contactEmail || "",
        contactPhone: prefill?.contactPhone || "",
        enquiryRef: prefill?.enquiryRef || "",
        budget: prefill?.budget || 0,
        service: prefill?.service || "Holiday",
        destination: prefill?.destination || "",
      }));
    }
  }, [open, quotationId, prefill, toast]);

  useEffect(() => {
    if (!open || !user || quotationId) return;
    setForm((f) => ({
      ...f,
      agentName: f.agentName || user.name || user.email || "",
      agentCode: user.agentCode || f.agentCode || "",
      agencyCode: user.agencyCode || f.agencyCode || "",
      salesExecutiveName: f.salesExecutiveName || user.name || user.email || "",
    }));
  }, [open, user, quotationId]);

  const nights = useMemo(() => {
    if (!form.travelStartDate || !form.travelEndDate) return null;
    const a = new Date(form.travelStartDate);
    const b = new Date(form.travelEndDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }, [form.travelStartDate, form.travelEndDate]);
  const tripDays = nights != null ? nights + 1 : null;

  const selected = packages.find((p) => p.isSelected) || packages[0];

  const liveCosting = useMemo(
    () =>
      previewPackageLayers({
        hotels: selected?.hotels,
        flights: selected?.flights,
        transfers: selected?.transfers,
        activities: selected?.activities,
        meals: selected?.meals,
        nights,
        trevioMarkupValue: form.trevioMarkupValue,
        discountType: form.discountType || null,
        discountValue: form.discountValue,
        adults: form.adults,
        children: form.children,
        infants: form.infants,
      }),
    [selected, nights, form.trevioMarkupValue, form.discountType, form.discountValue, form.adults, form.children, form.infants],
  );

  useEffect(() => {
    if (!form.destination.trim()) {
      setVisaHint("");
      setVisaRecommendation(null);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<{
        recommendation: {
          catalogueDetails: string;
          visaTypicallyRequired: boolean;
          suggestedVisaType: string;
          suggestedEntryType: string;
          disclaimer: string;
        };
        matched: boolean;
      }>(
        `/api/destinations/visa-recommendation?q=${encodeURIComponent(form.destination)}&country=${encodeURIComponent(form.country || "")}`,
      )
        .then((r) => {
          setVisaRecommendation(r.recommendation);
          setVisaHint(r.recommendation.catalogueDetails);
        })
        .catch(() => {
          setVisaHint("");
          setVisaRecommendation(null);
        });
    }, 250);
    return () => clearTimeout(t);
  }, [form.destination, form.country]);

  function patchPkg(idx: number, patch: Partial<QuotationPackage>) {
    setPackages((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function patchSelected(patch: Partial<QuotationPackage>) {
    const idx = packages.findIndex((p) => p.isSelected);
    patchPkg(idx >= 0 ? idx : 0, patch);
  }

  function applyDestinationBasics(selectedPlanId: string) {
    const plan = getDestinationQuotePlan(selectedPlanId);
    if (!plan) return;
    setPlanId(selectedPlanId);
    setSuggestedNights(plan.suggestedNights ?? null);
    setForm((f) => {
      const next = {
        ...f,
        destination: plan.form.destination,
        country: plan.form.country,
        isInternational: plan.form.isInternational,
        coverImage: f.coverImage || plan.form.coverImage || "",
        currency: plan.form.currency || f.currency,
      };
      if (f.travelStartDate && plan.suggestedNights && !f.travelEndDate) {
        const d = new Date(f.travelStartDate);
        d.setDate(d.getDate() + plan.suggestedNights);
        next.travelEndDate = d.toISOString().slice(0, 10);
      }
      return next;
    });
    toast({
      title: `${plan.label} selected`,
      description: `Only destination is set${plan.suggestedNights ? ` · suggested ${plan.suggestedNights} nights / ${plan.suggestedNights + 1} days` : ""}. Use “Load full sample” if you want hotels & itinerary.`,
    });
  }

  function loadFullSamplePackage() {
    const plan = getDestinationQuotePlan(planId);
    if (!plan) {
      toast({ title: "Pick a destination plan first", variant: "destructive" });
      return;
    }
    setForm((f) => ({
      ...f,
      destination: plan.form.destination,
      country: plan.form.country,
      isInternational: plan.form.isInternational,
      coverImage: plan.form.coverImage || f.coverImage,
      specialRequests: plan.form.specialRequests || f.specialRequests,
      termsAndConditions: plan.form.termsAndConditions || f.termsAndConditions,
      paymentTerms: plan.form.paymentTerms || f.paymentTerms,
      cancellationPolicy: plan.form.cancellationPolicy || f.cancellationPolicy,
      refundPolicy: plan.form.refundPolicy || f.refundPolicy,
      adults: plan.form.adults ?? f.adults,
      children: plan.form.children ?? f.children,
      infants: plan.form.infants ?? f.infants,
      currency: plan.form.currency || f.currency,
    }));
    setPackages(plan.packages.map((p) => ({ ...p })));
    setSuggestedNights(plan.suggestedNights ?? null);
    toast({
      title: "Full sample loaded",
      description: "Hotels, flights, itinerary and terms filled. Edit dates and prices before sending.",
    });
  }

  function onStartDateChange(v: string) {
    setForm((f) => {
      let end = f.travelEndDate;
      if (!v) end = "";
      else if (end && end < v) end = "";
      else if (v && !end && suggestedNights) {
        const d = new Date(v);
        d.setDate(d.getDate() + suggestedNights);
        end = d.toISOString().slice(0, 10);
      }
      return { ...f, travelStartDate: v, travelEndDate: end };
    });
  }

  async function persist(nextStep = step, submitApproval = false) {
    if (!form.customerName.trim() || !form.destination.trim()) {
      toast({ title: "Customer and destination are required", variant: "destructive" });
      return null;
    }
    if (form.travelEndDate && form.travelStartDate && nights == null) {
      toast({ title: "End date cannot be before start date", variant: "destructive" });
      return null;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
        nights: nights ?? undefined,
        days: tripDays ?? undefined,
        travelDates: form.travelStartDate,
        wizardStep: nextStep + 1,
        packages: packages.map((p, i) => ({ ...p, sortOrder: i })),
        service: form.service || (form.isInternational ? "International" : "Holiday"),
        leadId: leadId || undefined,
        budget: form.budget || undefined,
        agentCode: form.agentCode || user?.agentCode || undefined,
        agencyCode: form.agencyCode || user?.agencyCode || undefined,
        agentId: user?.role === "travel_agent" ? user.id : undefined,
      };
      let quotation: Quotation;
      if (!id) {
        const created = await api.createQuotationWizard(payload);
        quotation = mapApiQuotation(created.quotation);
        setId(quotation.id);
        setQuoteNo(quotation.quoteNo);
      } else {
        const saved = await api.saveQuotationWizard(id, payload);
        quotation = mapApiQuotation(saved.quotation);
      }
      if (submitApproval && quotation.id) {
        const approved = await api.submitQuotationApproval(quotation.id);
        quotation = mapApiQuotation(approved.quotation);
      }
      upsertQuotation(quotation);
      if (quotation.packages?.length) setPackages(quotation.packages);
      onSaved?.(quotation);
      toast({ title: submitApproval ? "Submitted for approval" : "Draft saved", description: quotation.quoteNo });
      return quotation;
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "destructive",
      });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    const q = await persist(Math.min(step + 1, STEPS.length - 1));
    if (q) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function back() {
    await persist(Math.max(step - 1, 0));
    setStep((s) => Math.max(s - 1, 0));
  }

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-5xl lg:max-w-6xl w-[calc(100%-1.5rem)] p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col"
      >
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0 space-y-3 text-left">
          <div className="flex flex-wrap items-start justify-between gap-2 pr-8">
            <div>
              <DialogTitle className="text-lg">
                {quoteNo || "New quotation"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {STEPS[step].label}
                {nights != null ? ` · ${nights}N / ${tripDays}D` : ""}
                {" · "}
                Step {step + 1} of {STEPS.length}
              </DialogDescription>
            </div>
            <div className="text-right text-xs text-muted-foreground hidden sm:block">
              <p className="font-medium text-foreground tabular-nums">{formatFullINR(liveCosting.total)}</p>
              <p>Live total · {liveCosting.profitMargin}% margin</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <nav className="hidden md:flex w-52 shrink-0 flex-col gap-4 border-r bg-muted/20 p-3 overflow-y-auto">
            {STEP_GROUPS.map((group) => (
              <div key={group.title} className="space-y-1">
                <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
                {STEPS.slice(group.from, group.to + 1).map((s, idx) => {
                  const i = group.from + idx;
                  const done = i < step;
                  const active = i === step;
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setStep(i)}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                        active && "bg-teal-600 text-white shadow-sm",
                        done && !active && "text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40",
                        !done && !active && "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                          active && "bg-white/20",
                          done && !active && "bg-teal-100 text-teal-800 dark:bg-teal-900/50",
                          !done && !active && "bg-muted",
                        )}
                      >
                        {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                      </span>
                      <span className="min-w-0 leading-tight">
                        <span className="block font-medium truncate">{s.label}</span>
                        <span className={cn("block text-[10px] truncate", active ? "text-white/80" : "text-muted-foreground")}>
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="flex-1 min-w-0 flex flex-col min-h-0 relative">
            <div className="md:hidden shrink-0 px-3 py-2 border-b bg-background">
              <div className="flex gap-1.5 overflow-x-auto">
                {STEPS.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setStep(i)}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs whitespace-nowrap",
                      i === step ? "bg-teal-600 text-white" : i < step ? "bg-teal-100 text-teal-800" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
        {step === 0 && (
          <div className="space-y-4">
            <FormSection
              title="Start from a plan (optional)"
              description="Sets destination + suggested duration only. Does not fill hotels, flights, or full itinerary unless you load the sample."
            >
              <div className="sm:col-span-2 flex flex-col sm:flex-row gap-2">
                <Select value={planId || undefined} onValueChange={applyDestinationBasics}>
                  <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Choose a destination plan…" /></SelectTrigger>
                  <SelectContent>
                    {DESTINATION_QUOTE_PLANS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" className="h-10 shrink-0" disabled={!planId} onClick={loadFullSamplePackage}>
                  Load full sample
                </Button>
              </div>
            </FormSection>

            <FormSection
              title="Apply quote template (optional)"
              description="Uses Active Quote Templates. Default mode fills empty fields only — existing hotels, itinerary, and terms are preserved. Save the draft first."
            >
              <div className="sm:col-span-2">
                <QuoteTemplateApplyButton
                  quotationId={id}
                  disabled={busy}
                  onApplied={(q) => {
                    setPackages(q.packages?.length ? q.packages : packages);
                    setForm((f) => ({
                      ...f,
                      termsAndConditions: q.termsAndConditions || f.termsAndConditions,
                      paymentTerms: q.paymentTerms || f.paymentTerms,
                      cancellationPolicy: q.cancellationPolicy || f.cancellationPolicy,
                      refundPolicy: q.refundPolicy || f.refundPolicy,
                      specialRequests: q.specialRequests || f.specialRequests,
                    }));
                    upsertQuotation(q);
                  }}
                />
              </div>
            </FormSection>

            <FormSection title="Customer & agent codes" description="Agency and agent codes are system-generated.">
              <Field label="Customer *" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v })} />
              <Field label="Contact person" value={form.contactPerson} onChange={(v) => setForm({ ...form, contactPerson: v })} />
              <Field label="Email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />
              <Field label="Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} />
              <Field label="Travel agent" value={form.agentName} onChange={(v) => setForm({ ...form, agentName: v })} />
              <Field label="Sales executive" value={form.salesExecutiveName} onChange={(v) => setForm({ ...form, salesExecutiveName: v })} />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Agency code</Label>
                <Input className="h-10 bg-muted/40 font-mono" value={form.agencyCode || "—"} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Agent code</Label>
                <Input className="h-10 bg-muted/40 font-mono" value={form.agentCode || "—"} readOnly />
              </div>
            </FormSection>

            <FormSection title="Destination" description="City for the trip and cover image for the customer PDF.">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">Search destination master</Label>
                <DestinationSelect
                  value={destinationId}
                  onChange={(id) => {
                    setDestinationId(id);
                    apiFetch<{ item: { name: string; country?: string; heroImage?: string | null; bannerImage?: string | null; thumbnail?: string | null; galleryImages?: string[] } }>(`/api/destinations/${id}`)
                      .then((data) => {
                        const hero = data.item.heroImage || data.item.bannerImage || data.item.thumbnail || data.item.galleryImages?.[0] || "";
                        setForm((f) => ({
                          ...f,
                          destination: data.item.name || f.destination,
                          country: data.item.country || f.country,
                          coverImage: f.coverImage || hero,
                        }));
                      })
                      .catch(() => undefined);
                  }}
                  placeholder="Search destinations…"
                />
              </div>
              <Field label="Destination city *" value={form.destination} onChange={(v) => setForm({ ...form, destination: v })} />
              <Field label="Country" value={form.country} onChange={(v) => setForm({ ...form, country: v })} />
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">Cover image URL</Label>
                <p className="text-xs text-muted-foreground">Paste a photo link for the brochure cover. Destination search can auto-fill this.</p>
                <ImageUrlField
                  value={form.coverImage}
                  onChange={(v) => setForm({ ...form, coverImage: v })}
                  placeholder="https://… destination photo"
                />
              </div>
            </FormSection>

            <FormSection title="Travel dates & guests" description="Set start date first. End date unlocks after that. Nights / days are calculated automatically.">
              <Field label="Start date" type="date" value={form.travelStartDate} onChange={onStartDateChange} />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">End date</Label>
                <Input
                  type="date"
                  className="h-10"
                  value={form.travelEndDate}
                  min={form.travelStartDate || undefined}
                  disabled={!form.travelStartDate}
                  onChange={(e) => setForm({ ...form, travelEndDate: e.target.value })}
                />
                {!form.travelStartDate && (
                  <p className="text-[11px] text-muted-foreground">Choose a start date before selecting the end date.</p>
                )}
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nights</p>
                <p className="text-lg font-semibold">{nights != null ? nights : "—"}</p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Days</p>
                <p className="text-lg font-semibold">{tripDays != null ? tripDays : "—"}</p>
              </div>
              {suggestedNights != null && nights == null && (
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Suggested duration from plan: {suggestedNights} nights / {suggestedNights + 1} days
                  {form.travelStartDate ? " (end date can auto-fill from start)." : "."}
                </p>
              )}
              <Field label="Adults" type="number" value={String(form.adults)} onChange={(v) => setForm({ ...form, adults: Math.max(0, Number(v) || 0) })} />
              <Field label="Children" type="number" value={String(form.children)} onChange={(v) => setForm({ ...form, children: Math.max(0, Number(v) || 0) })} />
              <Field label="Infants" type="number" value={String(form.infants)} onChange={(v) => setForm({ ...form, infants: Math.max(0, Number(v) || 0) })} />
              <Field label="Valid until" type="date" value={form.validTill} onChange={(v) => setForm({ ...form, validTill: v })} />
              <Field label="Enquiry ref" value={form.enquiryRef} onChange={(v) => setForm({ ...form, enquiryRef: v })} />
              <div className="flex items-center gap-2.5 pt-7">
                <Checkbox checked={form.isInternational} onCheckedChange={(v) => setForm({ ...form, isInternational: Boolean(v) })} id="intl" />
                <Label htmlFor="intl" className="text-sm font-medium cursor-pointer">International booking</Label>
              </div>
            </FormSection>

            <FormSection title="Notes">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium">Special requests</Label>
                <p className="text-xs text-muted-foreground">Shown to the customer on the quote.</p>
                <Textarea className="min-h-[72px]" value={form.specialRequests} onChange={(e) => setForm({ ...form, specialRequests: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-sm font-medium text-amber-800 dark:text-amber-400">Internal notes</Label>
                <p className="text-xs text-muted-foreground">Team only — never on PDF or agent portal.</p>
                <Textarea className="min-h-[72px]" value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} />
              </div>
            </FormSection>
          </div>
        )}

        {step === 1 && (
          <ServiceEditor
            title="Hotels"
            rows={(selected?.hotels || []) as Record<string, unknown>[]}
            fields={["hotelName", "starCategory", "roomType", "mealPlan", "checkIn", "checkOut", "rooms", "city", "imageUrl", "costPrice", "sellingPrice", "supplier", "remarks"]}
            onChange={(rows) => patchSelected({ hotels: rows })}
            template={{ hotelName: "", starCategory: "4", roomType: "Deluxe", mealPlan: "Breakfast", rooms: 1, city: "", imageUrl: "", costPrice: 8000, sellingPrice: 10000, source: "MANUAL" }}
            catalogKind="hotels"
            travelDate={form.travelStartDate}
            travelEndDate={form.travelEndDate}
            catalogToRow={(item) => hotelFromCatalog(item)}
          />
        )}

        {step === 2 && (
          <ServiceEditor
            title="Flights"
            rows={(selected?.flights || []) as Record<string, unknown>[]}
            fields={["airline", "flightNumber", "from", "to", "date", "depTime", "arrTime", "duration", "baggage", "cabinClass", "currency", "pnr", "remarks", "costPrice", "sellingPrice", "fare"]}
            onChange={(rows) => patchSelected({ flights: rows })}
            template={{ airline: "", flightNumber: "", from: "", to: "", cabinClass: "Economy", currency: form.currency || "INR", duration: "", baggage: "", remarks: "", pnr: "", costPrice: 12000, sellingPrice: 15000, fare: 15000, source: "MANUAL" }}
            catalogKind="flights"
            travelDate={form.travelStartDate}
            quotationId={id}
            catalogToRow={(item) => ({
              productId: item.id,
              productType: "FLIGHT",
              source: "CONTRACTED_PRODUCT",
              airline: String(item.airline || item.name || ""),
              flightNumber: String(item.flightNumber || ""),
              from: String(item.origin || ""),
              to: String(item.destinationAirport || ""),
              cabinClass: String(item.cabinClass || "Economy"),
              depTime: String(item.departureTime || ""),
              arrTime: String(item.arrivalTime || ""),
              duration: String(item.duration || ""),
              baggage: String(item.baggage || ""),
              currency: String(item.currency || form.currency || "INR"),
              date: form.travelStartDate,
            })}
          />
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-semibold">Day-wise Itinerary</p>
                <p className="text-[11px] text-muted-foreground">Add a cover photo and extra place images per day so the customer PDF showcases the trip.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={!selected?.itinerary?.length} onClick={() => {
                  const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                  if (!days.length) return;
                  const prev = JSON.parse(JSON.stringify(days[days.length - 1])) as Record<string, unknown>;
                  days.push({ ...prev, day: days.length + 1, title: `Day ${days.length + 1}` });
                  patchSelected({ itinerary: days });
                }}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy previous day
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                  days.push({ day: days.length + 1, title: `Day ${days.length + 1}`, city: "", mealPlan: "", coverImage: "", gallery: [], items: [{ activityName: "Leisure", description: "" }] });
                  patchSelected({ itinerary: days });
                }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Day
                </Button>
              </div>
            </div>
            {((selected?.itinerary || []) as Array<Record<string, unknown>>).map((day, di) => (
              <div key={di} className="border rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-center">
                  <Input
                    className="h-8"
                    value={String(day.title || `Day ${di + 1}`)}
                    onChange={(e) => {
                      const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                      days[di] = { ...days[di], title: e.target.value, day: di + 1 };
                      patchSelected({ itinerary: days });
                    }}
                  />
                  <Button size="sm" variant="ghost" onClick={() => {
                    const days = ((selected?.itinerary || []) as Array<Record<string, unknown>>).filter((_, i) => i !== di);
                    patchSelected({ itinerary: days });
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="City / place"
                    value={String(day.city || "")}
                    onChange={(v) => {
                      const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                      days[di] = { ...days[di], city: v };
                      patchSelected({ itinerary: days });
                    }}
                  />
                  <Field
                    label="Meal plan"
                    value={String(day.mealPlan || "")}
                    onChange={(v) => {
                      const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                      days[di] = { ...days[di], mealPlan: v };
                      patchSelected({ itinerary: days });
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Day cover image URL
                  </Label>
                  <ImageUrlField
                    value={String(day.coverImage || "")}
                    onChange={(v) => {
                      const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                      days[di] = { ...days[di], coverImage: v };
                      patchSelected({ itinerary: days });
                    }}
                    placeholder="https://… place photo for this day"
                  />
                </div>
                <GalleryUrlsField
                  urls={Array.isArray(day.gallery) ? (day.gallery as unknown[]).map(String).filter(Boolean) : []}
                  onChange={(gallery) => {
                    const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                    days[di] = { ...days[di], gallery };
                    patchSelected({ itinerary: days });
                  }}
                />
                <Textarea
                  className="text-xs"
                  placeholder="Activities (one per line — advanced fields below preserve pickup/duration/vehicle/guide/voucher)"
                  value={Array.isArray(day.items) ? (day.items as Array<{ activityName?: string }>).map((i) => i.activityName || "").join("\n") : ""}
                  onChange={(e) => {
                    const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                    const prevItems = Array.isArray(days[di].items) ? (days[di].items as Array<Record<string, unknown>>) : [];
                    const lines = e.target.value.split("\n").filter(Boolean);
                    days[di] = {
                      ...days[di],
                      items: lines.map((line, li) => ({
                        ...(prevItems[li] || {}),
                        activityName: line,
                        description: String((prevItems[li] as { description?: string } | undefined)?.description || line),
                      })),
                    };
                    patchSelected({ itinerary: days });
                  }}
                />
                {Array.isArray(day.items) && (day.items as Array<Record<string, unknown>>).slice(0, 4).map((item, ii) => (
                  <div key={ii} className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2">
                    <p className="col-span-2 md:col-span-3 text-[10px] font-medium text-muted-foreground">{String(item.activityName || `Item ${ii + 1}`)}</p>
                    {(["pickupTime", "duration", "vehicle", "guide", "voucher", "remarks"] as const).map((f) => (
                      <Field
                        key={f}
                        label={f.replace(/([A-Z])/g, " $1")}
                        value={String(item[f] || "")}
                        onChange={(v) => {
                          const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                          const items = [...((days[di].items as Array<Record<string, unknown>>) || [])];
                          items[ii] = { ...items[ii], [f]: v };
                          days[di] = { ...days[di], items };
                          patchSelected({ itinerary: days });
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <ServiceEditor
              title="Transfers"
              rows={(selected?.transfers || []) as Record<string, unknown>[]}
              fields={["transferType", "date", "pickup", "drop", "vehicleType", "costPrice", "sellingPrice", "supplier"]}
              onChange={(rows) => patchSelected({ transfers: rows })}
              template={{ transferType: "Airport Pickup", vehicleType: "Sedan", costPrice: 1500, sellingPrice: 2200, source: "MANUAL" }}
              catalogKind="transfers"
              travelDate={form.travelStartDate}
              catalogToRow={(item) => ({
                productId: item.id,
                productType: "TRANSFER",
                source: "CONTRACTED_PRODUCT",
                transferType: String(item.transferType || item.name || "Transfer"),
                vehicleType: String(item.vehicleType || "Sedan"),
                pickup: String(item.pickupLocation || ""),
                drop: String(item.dropLocation || ""),
                sellingPrice: Number(item.privatePrice ?? item.sharedPrice ?? 0),
                supplier: item.supplier?.name,
              })}
            />
            <ServiceEditor
              title="Activities"
              rows={(selected?.activities || []) as Record<string, unknown>[]}
              fields={["activityName", "description", "date", "ticketType", "adultRate", "childRate", "adults", "children", "imageUrl", "costPrice", "sellingPrice"]}
              onChange={(rows) => patchSelected({ activities: rows })}
              template={{ activityName: "", description: "", ticketType: "Standard", adultRate: 2500, childRate: 1500, adults: form.adults, children: form.children, imageUrl: "", costPrice: 2000, sellingPrice: 2500, source: "MANUAL" }}
              catalogKind="activities"
              travelDate={form.travelStartDate}
              catalogToRow={(item) => ({
                productId: item.id,
                productType: "ACTIVITY",
                source: "CONTRACTED_PRODUCT",
                activityName: item.name,
                description: String(item.shortDescription || item.description || ""),
                ticketType: String(item.ticketType || "Standard"),
                startTime: String(item.startTime || ""),
                closingTime: String(item.closingTime || ""),
                duration: String(item.duration || ""),
                adults: form.adults,
                children: form.children,
                imageUrl: firstProductImage(item),
                sellingPrice: Number(item.adultPrice || 0),
                supplier: item.supplier?.name,
              })}
            />
          </div>
        )}

        {step === 5 && (
          <ServiceEditor
            title="Meals"
            rows={(selected?.meals || []) as Record<string, unknown>[]}
            fields={["restaurant", "cuisine", "mealType", "dietary", "date", "adults", "children", "adultRate", "childRate", "costPrice", "sellingPrice"]}
            onChange={(rows) => patchSelected({ meals: rows })}
            template={{ mealType: "Dinner", cuisine: "Local", dietary: "", adults: form.adults, children: form.children, adultRate: 1200, childRate: 800, costPrice: 900, sellingPrice: 1200, source: "MANUAL" }}
            catalogKind="meals"
            travelDate={form.travelStartDate}
            catalogToRow={(item) => ({
              productId: item.id,
              productType: "MEAL",
              source: "CONTRACTED_PRODUCT",
              restaurant: String(item.restaurant || item.name || ""),
              mealType: String(item.mealType || "Other"),
              cuisine: String(item.city || ""),
              dietary: "",
              description: String(item.description || ""),
              transferBadge: item.transferInclusion === "PRIVATE" ? "Private Transfer" : "No Transfer",
              adults: form.adults,
              children: form.children,
              sellingPrice: Number(item.adultPrice || 0),
            })}
          />
        )}

        {step === 6 && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(selected?.insurance && (selected.insurance as { enabled?: boolean }).enabled)}
                  onCheckedChange={(v) => patchSelected({
                    insurance: { ...(selected?.insurance || {}), enabled: Boolean(v), provider: "TATA AIG", planName: "Travel Guard", costPrice: 800, sellingPrice: 1200 },
                  })}
                />
                <Label>Enable Travel Insurance</Label>
              </div>
              {Boolean((selected?.insurance as { enabled?: boolean })?.enabled) && (
                <>
                  <Field label="Provider" value={String((selected?.insurance as { provider?: string })?.provider || "")} onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, provider: v } })} />
                  <Field label="Plan" value={String((selected?.insurance as { planName?: string })?.planName || "")} onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, planName: v } })} />
                  <Field label="Selling" type="number" value={String((selected?.insurance as { sellingPrice?: number })?.sellingPrice || 0)} onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, sellingPrice: Number(v) || 0 } })} />
                  <Field label="Cost" type="number" value={String((selected?.insurance as { costPrice?: number })?.costPrice || 0)} onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, costPrice: Number(v) || 0 } })} />
                </>
              )}
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(selected?.visa && (selected.visa as { enabled?: boolean }).enabled)}
                  onCheckedChange={(v) => patchSelected({
                    visa: { ...(selected?.visa || {}), enabled: Boolean(v), visaType: "Tourist", entryType: "Single Entry", costPrice: 3000, sellingPrice: 4500, required: form.isInternational },
                  })}
                />
                <Label>Visa Required / Include Visa Service</Label>
              </div>
              {Boolean((selected?.visa as { enabled?: boolean })?.enabled) && (
                <>
                  <Field label="Visa Type" value={String((selected?.visa as { visaType?: string })?.visaType || "")} onChange={(v) => patchSelected({ visa: { ...selected?.visa, visaType: v } })} />
                  <Field label="Entry" value={String((selected?.visa as { entryType?: string })?.entryType || "")} onChange={(v) => patchSelected({ visa: { ...selected?.visa, entryType: v } })} />
                  <Field label="Processing time" value={String((selected?.visa as { processingTime?: string })?.processingTime || "")} onChange={(v) => patchSelected({ visa: { ...selected?.visa, processingTime: v } })} />
                  <Field label="Fee notes" value={String((selected?.visa as { feeNotes?: string })?.feeNotes || "")} onChange={(v) => patchSelected({ visa: { ...selected?.visa, feeNotes: v } })} />
                  <Field label="Documents required" value={String((selected?.visa as { documentsRequired?: string })?.documentsRequired || "")} onChange={(v) => patchSelected({ visa: { ...selected?.visa, documentsRequired: v } })} />
                  <Field label="Appointment note" value={String((selected?.visa as { appointmentNote?: string })?.appointmentNote || "")} onChange={(v) => patchSelected({ visa: { ...selected?.visa, appointmentNote: v } })} />
                  <Field label="Selling" type="number" value={String((selected?.visa as { sellingPrice?: number })?.sellingPrice || 0)} onChange={(v) => patchSelected({ visa: { ...selected?.visa, sellingPrice: Number(v) || 0 } })} />
                </>
              )}
              <p className="text-[11px] text-muted-foreground">
                {form.isInternational ? "International trip — visa often required." : "Domestic — visa typically not required."}
              </p>
              {visaHint && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-2 text-[11px] text-amber-900 dark:text-amber-200 space-y-2">
                  <p>{visaHint}</p>
                  {visaRecommendation && (
                    <>
                      <p className="opacity-80">{visaRecommendation.disclaimer}</p>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 text-[11px]"
                        onClick={() => patchSelected({
                          visa: {
                            ...(selected?.visa || {}),
                            enabled: true,
                            visaType: visaRecommendation.suggestedVisaType,
                            entryType: visaRecommendation.suggestedEntryType,
                            required: visaRecommendation.visaTypicallyRequired,
                            catalogueRecommendation: visaRecommendation.catalogueDetails,
                            disclaimer: visaRecommendation.disclaimer,
                            remarks: visaRecommendation.disclaimer,
                          },
                        })}
                      >
                        Apply catalogue recommendation
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 7 && (
          <ServiceEditor
            title="Optional Add-ons"
            rows={(selected?.addOns || []) as Record<string, unknown>[]}
            fields={["name", "description", "quantity", "costPrice", "sellingPrice", "remarks"]}
            onChange={(rows) => patchSelected({ addOns: rows.map((r) => ({ ...r, enabled: true })) })}
            template={{ name: "eSIM", description: "", quantity: 1, costPrice: 500, sellingPrice: 899 }}
          />
        )}

        {step === 8 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {packages.map((p, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant={p.isSelected ? "default" : "outline"}
                  onClick={() => setPackages((prev) => prev.map((x, j) => ({ ...x, isSelected: j === i })))}
                >
                  {p.name}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={() => setPackages((prev) => [...prev, emptyPackage(["Economy", "Deluxe", "Premium", "Luxury"][prev.length] || `Option ${prev.length + 1}`)])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Package Option
              </Button>
            </div>
            <Field
              label="Selected package name"
              value={selected?.name || ""}
              onChange={(v) => patchSelected({ name: v })}
            />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Discount Type</Label>
                <Select value={form.discountType || "none"} onValueChange={(v) => setForm({ ...form, discountType: v === "none" ? "" : v as "Fixed" | "Percentage" })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Fixed">Fixed</SelectItem>
                    <SelectItem value="Percentage">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label="Discount Value" type="number" value={String(form.discountValue)} onChange={(v) => setForm({ ...form, discountValue: Number(v) || 0 })} />
              <Field label="Trevio markup %" type="number" value={String(form.trevioMarkupValue ?? 0)} onChange={(v) => setForm({ ...form, trevioMarkupValue: Number(v) || 0, trevioMarkupType: "Percentage" })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Contracted cost comes from the saved rate snapshot. Trevio markup is internal. Tax is applied only from an active tax rule — if none exists, saving is allowed but the quote cannot be finalized until tax configuration exists.
            </p>
            <QuotePriceBreakdown
              costing={resolveQuotationCosting({
                amount: liveCosting.taxableAmount,
                gst: liveCosting.gst,
                total: liveCosting.total,
                taxRate: form.taxRate,
                totalNetCost: liveCosting.totalNetCost,
                grossProfit: liveCosting.grossProfit,
                profitMargin: liveCosting.profitMargin,
                perPersonCost: liveCosting.perPersonCost,
                discountAmount: liveCosting.discountAmount,
                discountType: form.discountType || null,
                discountValue: form.discountValue,
                adults: form.adults,
                children: form.children,
                infants: form.infants,
                travelStartDate: form.travelStartDate,
                travelEndDate: form.travelEndDate,
                packages: packages as unknown as Array<Record<string, unknown>>,
              })}
              editable
              showInternal
              onChangeDates={(checkIn, checkOut) => {
                setForm((f) => ({ ...f, travelStartDate: checkIn, travelEndDate: checkOut }));
                const hotels = [...((selected?.hotels || []) as Array<Record<string, unknown>>)];
                if (hotels[0]) {
                  hotels[0] = { ...hotels[0], checkIn, checkOut };
                  patchSelected({ hotels });
                }
              }}
              onChangeRooms={(rooms) => {
                const hotels = [...((selected?.hotels || []) as Array<Record<string, unknown>>)];
                if (hotels[0]) {
                  hotels[0] = { ...hotels[0], rooms };
                  patchSelected({ hotels });
                } else {
                  patchSelected({
                    hotels: [{ hotelName: "Stay", rooms, checkIn: form.travelStartDate, checkOut: form.travelEndDate, costPrice: 0, sellingPrice: 0 }],
                  });
                }
              }}
              onChangeTravellers={(adults, children, infants) => {
                setForm((f) => ({ ...f, adults, children, infants }));
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Inclusions (one per line)</Label>
                <Textarea
                  value={(selected?.inclusions || []).join("\n")}
                  onChange={(e) => patchSelected({ inclusions: e.target.value.split("\n").filter(Boolean) })}
                />
              </div>
              <div>
                <Label className="text-xs">Exclusions (one per line)</Label>
                <Textarea
                  value={(selected?.exclusions || []).join("\n")}
                  onChange={(e) => patchSelected({ exclusions: e.target.value.split("\n").filter(Boolean) })}
                />
              </div>
            </div>
          </div>
        )}

        {step === 9 && (
          <FormSection title="Terms & policies" description="These appear on the customer quotation PDF. Extra terms are snapshotted on the quotation — later catalogue edits do not rewrite saved quotes.">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Terms & conditions</Label>
              <Textarea className="min-h-[88px]" value={form.termsAndConditions} onChange={(e) => setForm({ ...form, termsAndConditions: e.target.value })} rows={3} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Payment policy</Label>
              <Textarea value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Cancellation policy</Label>
              <Textarea value={form.cancellationPolicy} onChange={(e) => setForm({ ...form, cancellationPolicy: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Refund policy</Label>
              <Textarea value={form.refundPolicy} onChange={(e) => setForm({ ...form, refundPolicy: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Hotel terms</Label>
              <Textarea value={form.hotelTerms} onChange={(e) => setForm({ ...form, hotelTerms: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Flight terms</Label>
              <Textarea value={form.flightTerms} onChange={(e) => setForm({ ...form, flightTerms: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Visa terms</Label>
              <Textarea value={form.visaTerms} onChange={(e) => setForm({ ...form, visaTerms: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Insurance terms</Label>
              <Textarea value={form.insuranceTerms} onChange={(e) => setForm({ ...form, insuranceTerms: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Force majeure</Label>
              <Textarea value={form.forceMajeure} onChange={(e) => setForm({ ...form, forceMajeure: e.target.value })} rows={2} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-sm font-medium">Disclaimer</Label>
              <Textarea value={form.travelDisclaimer} onChange={(e) => setForm({ ...form, travelDisclaimer: e.target.value })} rows={2} />
            </div>
            {planId && (
              <div className="sm:col-span-2">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const plan = getDestinationQuotePlan(planId);
                    if (!plan) return;
                    setForm((f) => ({
                      ...f,
                      termsAndConditions: plan.form.termsAndConditions || f.termsAndConditions,
                      paymentTerms: plan.form.paymentTerms || f.paymentTerms,
                      cancellationPolicy: plan.form.cancellationPolicy || f.cancellationPolicy,
                      refundPolicy: plan.form.refundPolicy || f.refundPolicy,
                    }));
                    toast({ title: "Destination plan terms copied into this draft" });
                  }}
                >
                  Apply terms from selected destination plan
                </Button>
              </div>
            )}
          </FormSection>
        )}

        {step === 10 && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Info label="Customer" value={form.customerName} />
              <Info label="Destination" value={`${form.destination}${form.country ? `, ${form.country}` : ""}`} />
              <Info label="Travel" value={`${form.travelStartDate || "—"} → ${form.travelEndDate || "—"}`} />
              <Info label="Pax" value={`${form.adults}A ${form.children}C ${form.infants}I`} />
              <Info label="Packages" value={packages.map((p) => p.name).join(", ")} />
              <Info label="Selected" value={selected?.name || "—"} />
            </div>
            <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-2">
              <p className="font-semibold">Customer preview hides cost, profit, suppliers, and internal notes.</p>
              <p>Hotels: {(selected?.hotels || []).length} · Flights: {(selected?.flights || []).length} · Activities: {(selected?.activities || []).length}</p>
              <p>
                Photos: {form.coverImage ? "cover · " : ""}
                {(selected?.hotels || []).filter((h) => Boolean((h as Record<string, unknown>).imageUrl)).length} hotels ·
                {" "}{(selected?.itinerary || []).filter((d) => Boolean((d as Record<string, unknown>).coverImage)).length} itinerary days ·
                {" "}{(selected?.activities || []).filter((a) => Boolean((a as Record<string, unknown>).imageUrl)).length} experiences
              </p>
              <p>Insurance: {(selected?.insurance as { enabled?: boolean })?.enabled ? "Yes" : "No"} · Visa: {(selected?.visa as { enabled?: boolean })?.enabled ? "Yes" : "No"}</p>
              <p>Final (preview): {formatFullINR(liveCosting.total)} · Per person: {formatFullINR(liveCosting.perPersonCost)}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!form.customerName.trim() || !form.destination.trim()) {
                    toast({ title: "Customer and destination are required for the client PDF", variant: "destructive" });
                    return;
                  }
                  const preview: Quotation = {
                    id: id || "",
                    quoteNo: quoteNo || "DRAFT",
                    customerName: form.customerName,
                    service: form.isInternational ? "International" : "Holiday",
                    items: packages.length,
                    amount: liveCosting.totalSelling,
                    gst: liveCosting.gst,
                    total: liveCosting.total,
                    status: "Draft",
                    validTill: form.validTill,
                    createdBy: form.salesExecutiveName,
                    createdAt: new Date().toISOString(),
                    contactPerson: form.contactPerson,
                    contactEmail: form.contactEmail,
                    contactPhone: form.contactPhone,
                    destination: form.destination,
                    country: form.country,
                    coverImage: form.coverImage || undefined,
                    travelDates: form.travelStartDate,
                    travelStartDate: form.travelStartDate,
                    travelEndDate: form.travelEndDate,
                    nights: nights ?? undefined,
                    days: nights != null ? nights + 1 : undefined,
                    adults: form.adults,
                    children: form.children,
                    infants: form.infants,
                    currency: form.currency,
                    packageIncludes: selected?.inclusions,
                    packageExcludes: selected?.exclusions,
                    termsAndConditions: form.termsAndConditions,
                    paymentTerms: form.paymentTerms,
                    cancellationPolicy: form.cancellationPolicy,
                    refundPolicy: form.refundPolicy,
                    salesExecutiveName: form.salesExecutiveName,
                    specialRequests: form.specialRequests,
                    taxRate: form.taxRate,
                    perPersonCost: liveCosting.perPersonCost,
                    packages,
                  };
                  try {
                    const ok = await downloadQuotationPdf(preview, undefined, { mode: id ? "preview" : "customer" });
                    toast({
                      title: ok ? "Client PDF ready" : "PDF failed",
                      description: ok
                        ? id
                          ? "Internal preview PDF generated and downloaded (customer-facing content)."
                          : "Brochure opened. Save the quote to generate a stored server PDF."
                        : "Could not open the PDF.",
                      variant: ok ? "default" : "destructive",
                    });
                  } catch (e) {
                    toast({
                      title: "PDF blocked",
                      description: e instanceof Error ? e.message : "Could not generate PDF",
                      variant: "destructive",
                    });
                  }
                }}
              >
                Preview client PDF (what customer receives)
              </Button>
            </div>
            {packages.length > 1 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="p-2 text-left">Feature</th>
                      {packages.map((p) => <th key={p.name} className="p-2 text-left">{p.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border-t">Hotels</td>
                      {packages.map((p) => <td key={p.name} className="p-2 border-t">{(p.hotels || []).length}</td>)}
                    </tr>
                    <tr>
                      <td className="p-2 border-t">Flights</td>
                      {packages.map((p) => <td key={p.name} className="p-2 border-t">{(p.flights || []).length}</td>)}
                    </tr>
                    <tr>
                      <td className="p-2 border-t">Insurance</td>
                      {packages.map((p) => <td key={p.name} className="p-2 border-t">{(p.insurance as { enabled?: boolean })?.enabled ? "Yes" : "No"}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

            </div>

            <div className="shrink-0 border-t bg-background px-4 sm:px-5 py-3 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Info label="Customer" value={form.customerName || "—"} />
                <Info label="Destination" value={form.destination || "—"} />
                <Info label="Travel" value={`${form.travelStartDate || "—"} → ${form.travelEndDate || "—"}`} />
                <Info label="Total" value={formatFullINR(liveCosting.total)} />
              </div>

              <div className="flex flex-wrap gap-2 justify-between">
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy || step === 0} onClick={back}>
                    <ChevronLeft className="w-4 h-4 mr-0.5" /> Back
                  </Button>
                  <Button variant="outline" disabled={busy} onClick={() => persist(step)}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save draft"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  {step < STEPS.length - 1 ? (
                    <Button disabled={busy} onClick={next} className="bg-teal-600 hover:bg-teal-700">
                      Save & continue <ChevronRight className="w-4 h-4 ml-0.5" />
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" disabled={busy} onClick={async () => { await persist(step); onOpenChange(false); }}>
                        Finish later
                      </Button>
                      <Button
                        disabled={busy}
                        className="bg-teal-600 hover:bg-teal-700"
                        onClick={async () => {
                          const q = await persist(step, true);
                          if (q) onOpenChange(false);
                        }}
                      >
                        Submit for approval
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <Input className="h-10" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-2.5 py-2 min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-medium text-sm truncate">{value || "—"}</p>
    </div>
  );
}

function firstProductImage(item: ProductRecord): string {
  if (Array.isArray(item.images) && item.images.length) return String(item.images[0] || "");
  if (typeof item.heroImage === "string" && item.heroImage) return item.heroImage;
  if (typeof item.thumbnail === "string" && item.thumbnail) return item.thumbnail;
  if (item.destination?.heroImage) return String(item.destination.heroImage);
  if (item.destination?.thumbnail) return String(item.destination.thumbnail);
  return "";
}

function isImageField(name: string) {
  return name === "imageUrl" || name === "coverImage";
}

function ImageUrlField({
  value,
  onChange,
  placeholder = "https://…",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex gap-2 items-start">
      {/^https?:\/\/|^data:image\/|^\//i.test(value.trim()) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value.trim()} alt="" className="h-12 w-16 rounded object-cover border shrink-0 bg-muted" />
      )}
      <Input
        className="h-10"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function GalleryUrlsField({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (urls: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const url = draft.trim();
    if (!url) return;
    onChange([...urls, url]);
    setDraft("");
  }
  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground">Place gallery URLs (Enter to add)</Label>
      <div className="flex gap-1">
        <Input
          className="h-8 text-xs"
          placeholder="https://… extra place photo"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>Add</Button>
      </div>
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {urls.map((url, i) => (
            <div key={`${url}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-12 w-16 rounded object-cover border bg-muted" />
              <button
                type="button"
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-background border text-[9px] leading-none"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuoteTemplateApplyButton({
  quotationId,
  disabled,
  onApplied,
}: {
  quotationId: string | null;
  disabled?: boolean;
  onApplied: (q: Quotation) => void;
}) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Array<{ id: string; templateName: string }>>([]);
  const [templateId, setTemplateId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiFetch<{ items: Array<{ id: string; templateName: string }> }>("/api/quote-templates?status=Active&pageSize=50")
      .then((r) => setTemplates(r.items || []))
      .catch(() => setTemplates([]));
  }, []);

  if (!quotationId) {
    return <p className="text-xs text-muted-foreground">Save the draft once to enable Quote Template merge.</p>;
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Select value={templateId || undefined} onValueChange={setTemplateId}>
        <SelectTrigger className="h-10 flex-1"><SelectValue placeholder="Choose an Active quote template…" /></SelectTrigger>
        <SelectContent>
          {templates.map((t) => (
            <SelectItem key={t.id} value={t.id}>{t.templateName}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        className="h-10 shrink-0"
        disabled={disabled || busy || !templateId}
        onClick={() => {
          setBusy(true);
          api.applyQuotationTemplate(quotationId, { templateId, mode: "fill-empty", packageIndex: 0 })
            .then((res) => {
              onApplied(mapApiQuotation(res.quotation));
              toast({
                title: res.appliedFields?.length ? "Template applied" : "Nothing to fill",
                description: res.message || (res.appliedFields?.length ? `Updated: ${res.appliedFields.slice(0, 6).join(", ")}` : undefined),
              });
            })
            .catch((e) => toast({ title: e instanceof Error ? e.message : "Template apply failed", variant: "destructive" }))
            .finally(() => setBusy(false));
        }}
      >
        Apply (fill empty only)
      </Button>
    </div>
  );
}

function hotelFromCatalog(item: ProductRecord): Record<string, unknown> {
  const rooms = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
  const first = rooms[0];
  const pricing = (first?.pricing as Record<string, number>) || {};
  const selling = Number(pricing.double ?? pricing.single ?? 0);
  return {
    productId: item.id,
    hotelName: item.name,
    starCategory: String(item.starCategory || ""),
    roomType: String(first?.name || "Deluxe"),
    mealPlan: String(first?.mealPlan || "Breakfast"),
    city: String(item.city || item.destination?.name || ""),
    imageUrl: firstProductImage(item),
    sellingPrice: selling,
    supplier: item.supplier?.name,
    source: "CONTRACTED_PRODUCT",
    productType: "HOTEL",
  };
}

const NO_VALID_RATE = "No valid contracted rate available for selected travel date.";
const CATALOG_TYPE = {
  hotels: "HOTEL",
  transfers: "TRANSFER",
  activities: "ACTIVITY",
  meals: "MEAL",
  flights: "FLIGHT",
} as const;

function ServiceEditor({
  title, rows, fields, onChange, template, catalogKind, catalogToRow, travelDate, travelEndDate, quotationId,
}: {
  title: string;
  rows: Record<string, unknown>[];
  fields: string[];
  onChange: (rows: Record<string, unknown>[]) => void;
  template: Record<string, unknown>;
  catalogKind?: keyof typeof CATALOG_TYPE;
  catalogToRow?: (item: ProductRecord) => Record<string, unknown>;
  travelDate?: string;
  travelEndDate?: string;
  quotationId?: string | null;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Add from catalog or enter self-booked details.</p>
        </div>
        <div className="flex gap-2">
          {catalogKind && catalogToRow && (
            <CatalogPicker
              kind={catalogKind}
              travelDate={travelDate}
              travelEndDate={travelEndDate}
              onPick={(item, rate) => {
                const base = catalogToRow(item);
                const selling = Number(base.sellingPrice || rate.displayPrice || 0);
                onChange([...rows, {
                  ...base,
                  ...(catalogKind === "hotels" ? {
                    checkIn: travelDate || base.checkIn || "",
                    checkOut: travelEndDate || base.checkOut || "",
                    rooms: Number(base.rooms || 1),
                  } : {}),
                  source: "CONTRACTED_PRODUCT",
                  productType: CATALOG_TYPE[catalogKind],
                  rateId: rate.rateId,
                  rateValidFrom: rate.validFrom,
                  rateValidTo: rate.validTo,
                  rateSelectedAt: new Date().toISOString(),
                  rateTravelDate: travelDate,
                  rateUnresolved: false,
                  costPrice: rate.contractedCost,
                  sellingPrice: selling || rate.contractedCost,
                }]);
              }}
            />
          )}
          {catalogKind === "flights" && (
            <FlightApiSearch
              travelDate={travelDate}
              onPick={(row) => onChange([...rows, row])}
            />
          )}
          <Button size="sm" variant="outline" onClick={() => onChange([...rows, { ...template }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add self-booked
          </Button>
        </div>
      </div>
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} yet — pick from catalog or add self-booked.
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 relative">
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-2 top-2 h-8 w-8 p-0"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {row.rateUnresolved === true && (
            <p className="sm:col-span-2 md:col-span-3 text-xs text-destructive">{NO_VALID_RATE}</p>
          )}
          {Boolean(row.transferBadge) && (
            <p className="sm:col-span-2 md:col-span-3 text-[11px] uppercase tracking-wide text-muted-foreground">{String(row.transferBadge)}</p>
          )}
          {Boolean(row.source) && (
            <p className="sm:col-span-2 md:col-span-3 text-[10px] text-muted-foreground">Source: {String(row.source)}</p>
          )}
          {fields.map((f) => (
            <div key={f} className={cn("space-y-1.5", isImageField(f) ? "sm:col-span-2 md:col-span-3 pr-8" : "")}>
              <Label className="text-xs font-medium capitalize text-muted-foreground">
                {f === "imageUrl" ? "Image URL" : f.replace(/([A-Z])/g, " $1")}
              </Label>
              {isImageField(f) ? (
                <ImageUrlField
                  value={String(row[f] ?? "")}
                  onChange={(v) => {
                    const next = [...rows];
                    next[i] = { ...next[i], [f]: v };
                    onChange(next);
                  }}
                  placeholder="https://… photo for customer PDF"
                />
              ) : (
                <Input
                  className="h-9"
                  value={String(row[f] ?? "")}
                  onChange={(e) => {
                    const next = [...rows];
                    const num = ["costPrice", "sellingPrice", "fare", "rooms", "quantity", "adultRate", "childRate", "adults", "children"].includes(f);
                    next[i] = { ...next[i], [f]: num ? Number(e.target.value) || 0 : e.target.value };
                    onChange(next);
                  }}
                />
              )}
            </div>
          ))}
          {catalogKind === "flights" && (
            <FlightDocAttach
              quotationId={quotationId}
              documentId={String(row.ticketDocumentId || "")}
              fileName={String(row.ticketFileName || "")}
              onLinked={(doc) => {
                const next = [...rows];
                next[i] = {
                  ...next[i],
                  ticketDocumentId: doc.id,
                  ticketFileName: doc.fileName,
                  // Private download path only — never a public static URL
                  ticketDownloadPath: doc.downloadPath,
                };
                onChange(next);
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function FlightDocAttach({
  quotationId,
  documentId,
  fileName,
  onLinked,
}: {
  quotationId?: string | null;
  documentId?: string;
  fileName?: string;
  onLinked: (doc: { id: string; fileName: string; downloadPath: string }) => void;
}) {
  const { toast } = useToast();
  if (!quotationId) {
    return (
      <p className="sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground">
        Save the draft to attach ticket / invoice via private document storage.
      </p>
    );
  }
  return (
    <div className="sm:col-span-2 md:col-span-3 space-y-1">
      <Label className="text-xs text-muted-foreground">Ticket / invoice (private)</Label>
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept=".pdf,image/jpeg,image/png"
          className="h-9 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void api.uploadQuotationDocument(quotationId, file, {
              docType: "FLIGHT_TICKET",
              visibility: "AGENT",
              relatedEntity: "flight",
              description: "Flight ticket / invoice",
            })
              .then((res) => {
                onLinked(res.document);
                toast({ title: "Flight document stored privately" });
              })
              .catch((err) => {
                toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
              });
          }}
        />
        {(documentId || fileName) && (
          <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
            {fileName || documentId}
          </span>
        )}
      </div>
    </div>
  );
}

function FlightApiSearch({
  travelDate,
  onPick,
}: {
  travelDate?: string;
  onPick: (row: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("BOM");
  const [to, setTo] = useState("DEL");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);

  async function search() {
    try {
      const data = await apiFetch<{ flights: Array<Record<string, unknown>> }>(
        `/api/flights/search?origin=${encodeURIComponent(from)}&destination=${encodeURIComponent(to)}&departureDate=${encodeURIComponent(travelDate || "")}&count=6`,
      );
      setItems(data.flights || []);
      if (!data.flights?.length) toast({ title: "No API flights returned" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Flight search failed", variant: "destructive" });
    }
  }

  return (
    <div className="relative">
      <Button size="sm" variant="outline" type="button" onClick={() => setOpen((v) => !v)}>API search</Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border bg-popover p-2 shadow-md space-y-2">
          <div className="flex gap-1">
            <Input className="h-8 text-xs" value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} placeholder="From" />
            <Input className="h-8 text-xs" value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} placeholder="To" />
            <Button size="sm" type="button" onClick={() => void search()}>Search</Button>
          </div>
          {items.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted"
              onClick={() => {
                onPick({
                  source: "AMADEUS_API",
                  airline: item.airline,
                  flightNumber: item.flightNumber,
                  from: item.origin,
                  to: item.destination,
                  depTime: item.departTime,
                  arrTime: item.arriveTime,
                  duration: item.duration || "",
                  baggage: item.baggage || "",
                  cabinClass: item.cabin,
                  currency: item.currency || "INR",
                  date: travelDate || "",
                  seatsLeft: item.seatsLeft,
                  sellingPrice: Number(item.price || 0),
                  fare: Number(item.price || 0),
                  costPrice: 0,
                  remarks: "",
                  pnr: "",
                });
                setOpen(false);
              }}
            >
              {String(item.airline)} {String(item.flightNumber)} · {String(item.origin)} → {String(item.destination)}
              {item.duration ? ` · ${String(item.duration)}` : ""}
              {item.baggage ? ` · ${String(item.baggage)}` : ""}
              {item.price != null ? ` · ${formatFullINR(Number(item.price))}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogPicker({
  kind,
  travelDate,
  travelEndDate,
  onPick,
}: {
  kind: keyof typeof CATALOG_TYPE;
  travelDate?: string;
  travelEndDate?: string;
  onPick: (item: ProductRecord, rate: { rateId: string; validFrom: string; validTo: string; contractedCost?: number; displayPrice?: number | null }) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ items: ProductRecord[] }>(
        `/api/products/${kind}?liveOnly=true&pageSize=20${q ? `&q=${encodeURIComponent(q)}` : ""}`,
      )
        .then((r) => setItems(r.items || []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [open, q, kind]);

  return (
    <div className="relative">
      <Button size="sm" variant="outline" type="button" onClick={() => setOpen((v) => !v)}>
        <Search className="w-3.5 h-3.5 mr-1" /> Catalog
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-72 rounded-md border bg-popover p-2 shadow-md">
          <Input
            className="h-8 text-xs mb-2"
            placeholder={`Search ${kind}…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="max-h-48 overflow-y-auto space-y-1">
            {loading && <p className="text-[11px] text-muted-foreground px-1">Loading…</p>}
            {!loading && items.length === 0 && <p className="text-[11px] text-muted-foreground px-1">No live products.</p>}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted"
                onClick={() => {
                  void (async () => {
                    if (!travelDate) {
                      toast({ title: "Select a travel start date before choosing a contracted product.", variant: "destructive" });
                      return;
                    }
                    try {
                      const rooms = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
                      const firstRoom = rooms[0];
                      if (kind === "hotels") {
                        if (!travelEndDate) {
                          toast({ title: "Select a travel end date before choosing a hotel.", variant: "destructive" });
                          return;
                        }
                        const availParams = new URLSearchParams({
                          checkIn: travelDate,
                          checkOut: travelEndDate,
                          rooms: "1",
                        });
                        if (firstRoom?.name) availParams.set("roomType", String(firstRoom.name));
                        const avail = await apiFetch<{ ok: boolean; message?: string | null; liveSupplier?: boolean }>(
                          `/api/products/hotels/${item.id}/catalogue-availability?${availParams.toString()}`,
                        );
                        if (!avail.ok) {
                          toast({
                            title: avail.message || "Hotel catalogue inventory unavailable for these dates",
                            description: "Catalogue availability only — not a live supplier confirmation.",
                            variant: "destructive",
                          });
                          return;
                        }
                      }
                      const params = new URLSearchParams({
                        productType: CATALOG_TYPE[kind],
                        productId: item.id,
                        travelDate,
                      });
                      if (firstRoom?.name) params.set("roomType", String(firstRoom.name));
                      if (firstRoom?.mealPlan) params.set("mealPlan", String(firstRoom.mealPlan));
                      if (item.vehicleType) params.set("vehicleType", String(item.vehicleType));
                      if (item.transferType) params.set("transferType", String(item.transferType));
                      if (item.ticketType) params.set("ticketType", String(item.ticketType));
                      if (item.cabinClass) params.set("cabinClass", String(item.cabinClass));
                      const rate = await apiFetch<{
                        applicable: boolean;
                        message?: string;
                        rateId?: string;
                        validFrom?: string;
                        validTo?: string;
                        contractedCost?: number;
                        displayPrice?: number | null;
                      }>(`/api/contracted-rates/applicable?${params.toString()}`);
                      if (!rate.applicable || !rate.rateId || rate.contractedCost == null) {
                        toast({ title: rate.message || NO_VALID_RATE, variant: "destructive" });
                        return;
                      }
                      onPick(item, { rateId: rate.rateId, validFrom: rate.validFrom || "", validTo: rate.validTo || "", contractedCost: rate.contractedCost, displayPrice: rate.displayPrice });
                      setOpen(false);
                    } catch {
                      toast({ title: NO_VALID_RATE, variant: "destructive" });
                    }
                  })();
                }}
              >
                <span className="font-medium">{item.name}</span>
                {kind === "activities" && (
                  <span className="block text-[10px] text-muted-foreground">
                    {String(item.startTime || item.operatingHours || "Timing on request")}
                    {item.closingTime ? `–${String(item.closingTime)}` : ""}
                    {item.duration ? ` · ${String(item.duration)}` : ""}
                    {item.adultPrice != null ? ` · ${formatFullINR(Number(item.adultPrice))}` : ""}
                    {item.description ? ` · ${String(item.description).slice(0, 80)}` : ""}
                    {" · View details · Select"}
                  </span>
                )}
                {kind === "meals" && (
                  <span className="block text-[10px] text-muted-foreground">
                    {item.transferInclusion === "PRIVATE" ? "Private Transfer" : "No Transfer"}
                  </span>
                )}
                {item.destination?.name && (
                  <span className="text-muted-foreground"> · {item.destination.name}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

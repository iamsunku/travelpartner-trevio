"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, FileDown, ImageIcon, Loader2, Mail, MessageCircle, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { api, apiFetch, ApiError } from "@/lib/api";
import { mapApiQuotation, mapApiUser } from "@/lib/api-mappers";
import { useDemoDataStore } from "@/store/demo-data-store";
import { useAuthStore } from "@/store/app-store";
import type { ProductRecord, Quotation, QuotationPackage } from "@/types";
import { formatFullINR } from "@/components/shared/ui-helpers";
import { calcPackageCosting, resolveQuotationCosting, toCalendarDate } from "@/lib/quote-costing";
import {
  canApproveDiscount,
  discountRequiresApproval,
  latestDiscountApproval,
  maxDiscountFixed,
  maxDiscountPercent,
} from "@/lib/quote-discount";
import { QuotePriceBreakdown } from "@/components/shared/quote-price-breakdown";
import { DESTINATION_QUOTE_PLANS, getDestinationQuotePlan } from "@/lib/destination-quote-plans";
import { downloadQuotationPdf, deliverQuotationEmail, deliverQuotationWhatsApp } from "@/lib/quotation-actions";
import { downloadClientQuotationBrochure } from "@/lib/client-quotation-brochure";
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
    visa: {
      enabled: false,
      visaType: "Tourist Visa",
      entryType: "Single Entry",
      processingTime: "",
      documentsRequired: "",
      appointmentRequired: false,
      appointmentNote: "",
      remarks: "",
      feeNotes: "",
      sellingPrice: 0,
      costPrice: 0,
    },
    insurance: {
      enabled: false,
      provider: "",
      planName: "",
      coverage: "",
      validity: "",
      policyNumber: "",
      remarks: "",
      sellingPrice: 0,
      costPrice: 0,
      premium: 0,
      policyDocuments: [],
    },
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
  const [requireFinanceApproval, setRequireFinanceApproval] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(quotationId || null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [quoteNo, setQuoteNo] = useState("");
  const [form, setForm] = useState({
    customerName: "",
    contactPerson: "",
    contactEmail: "",
    contactPhone: "",
    agentName: "",
    agentId: "",
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
  const [agents, setAgents] = useState<Array<{ id: string; name: string; agentCode?: string | null }>>([]);

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
            agentId: (q as { agentId?: string }).agentId || "",
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
      agentId: f.agentId || user.id || "",
      agentCode: user.agentCode || f.agentCode || "",
      agencyCode: user.agencyCode || f.agencyCode || "",
      salesExecutiveName: f.salesExecutiveName || user.name || user.email || "",
    }));
    api.getMe()
      .then(({ user: raw }) => {
        const mapped = mapApiUser(raw);
        setForm((f) => ({
          ...f,
          agentName: f.agentName || mapped.name || "",
          agentId: f.agentId || mapped.id,
          agentCode: mapped.agentCode || f.agentCode || "",
          agencyCode: mapped.agencyCode || f.agencyCode || "",
        }));
      })
      .catch(() => undefined);
  }, [open, user, quotationId]);

  useEffect(() => {
    if (!open) return;
    api.getAgents()
      .then((res) => setAgents(res.agents || []))
      .catch(() => setAgents([]));
  }, [open]);

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
      calcPackageCosting({
        hotels: selected?.hotels,
        flights: selected?.flights,
        transfers: selected?.transfers,
        activities: selected?.activities,
        meals: selected?.meals,
        addOns: selected?.addOns,
        visa: selected?.visa as { enabled?: boolean; costPrice?: number; sellingPrice?: number } | null,
        insurance: selected?.insurance as {
          enabled?: boolean;
          costPrice?: number;
          sellingPrice?: number;
          premium?: number;
        } | null,
        taxRate: form.taxRate,
        discountType: form.discountType || null,
        discountValue: form.discountValue,
        trevioMarkupValue: form.trevioMarkupValue,
        adults: form.adults,
        children: form.children,
        infants: form.infants,
      }),
    [
      selected,
      form.taxRate,
      form.discountType,
      form.discountValue,
      form.trevioMarkupValue,
      form.adults,
      form.children,
      form.infants,
    ],
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

  useEffect(() => {
    if (!open) return;
    const name = form.destination.trim();
    if (!name) {
      if (destinationId) setDestinationId("");
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      apiFetch<{ items: Array<{ id: string; name: string }> }>(
        `/api/destinations?q=${encodeURIComponent(name)}&pageSize=10`,
      )
        .then((res) => {
          if (cancelled) return;
          const items = res.items || [];
          const exact = items.find((d) => d.name.trim().toLowerCase() === name.toLowerCase());
          if (exact?.id) {
            if (exact.id !== destinationId) setDestinationId(exact.id);
          }
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, form.destination, destinationId]);

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

  async function persist(nextStep = step, opts?: { submitApproval?: boolean; approveNow?: boolean; financeApprovalRequired?: boolean }) {
    if (!form.customerName.trim() || !form.destination.trim()) {
      toast({ title: "Customer and destination are required", variant: "destructive" });
      return null;
    }
    if (form.travelEndDate && form.travelStartDate && nights == null) {
      toast({ title: "End date cannot be before start date", variant: "destructive" });
      return null;
    }
    const submitApproval = Boolean(opts?.submitApproval || opts?.approveNow);
    const approveNow = Boolean(opts?.approveNow);
    setBusy(true);
    setSaveError(null);
    try {
      const payload = {
        ...form,
        adults: Number(form.adults) || 2,
        children: Number(form.children) || 0,
        infants: Number(form.infants) || 0,
        nights: nights ?? undefined,
        days: tripDays ?? undefined,
        travelDates: form.travelStartDate,
        wizardStep: nextStep + 1,
        packages: !id && !packages.some((p) =>
          [p.hotels, p.flights, p.transfers, p.activities, p.meals].some((rows) => Array.isArray(rows) && rows.length > 0)
        )
          ? undefined
          : packages.map((p, i) => ({ ...p, sortOrder: i })),
        service: form.service || (form.isInternational ? "International" : "Holiday"),
        leadId: leadId || undefined,
        budget: form.budget || undefined,
        agentCode: form.agentCode || user?.agentCode || undefined,
        agencyCode: form.agencyCode || user?.agencyCode || undefined,
        agentId: form.agentId || user?.id || undefined,
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
      setForm((f) => ({
        ...f,
        agentCode: quotation.agentCode || f.agentCode,
        agencyCode: quotation.agencyCode || f.agencyCode,
        agentId: quotation.agentId || f.agentId,
        agentName: quotation.agentName || f.agentName,
      }));
      if (submitApproval && quotation.id) {
        const submitted = await api.submitQuotationApproval(quotation.id, {
          financeApprovalRequired: Boolean(opts?.financeApprovalRequired ?? requireFinanceApproval),
        });
        quotation = mapApiQuotation(submitted.quotation);
      }
      if (approveNow && quotation.id) {
        const approved = await api.approveQuotation(quotation.id, { readyToSend: true, stage: "Team Lead" });
        quotation = mapApiQuotation(approved.quotation);
      }
      upsertQuotation(quotation);
      if (quotation.packages?.length) setPackages(quotation.packages);
      onSaved?.(quotation);
      const disc = latestDiscountApproval(quotation.approvals);
      const discountNote = disc?.status === "Pending"
        ? " · Discount approval requested"
        : disc?.status === "Approved" && discountRequiresApproval("sales_executive", form.discountType || null, form.discountValue)
          ? " · Discount approved"
          : "";
      toast({
        title: approveNow ? "Approved & ready to send" : submitApproval ? "Submitted for approval" : "Draft saved",
        description: `${quotation.quoteNo}${discountNote}`,
      });
      return quotation;
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Could not save quotation";
      setSaveError(message);
      toast({
        title: "Save failed",
        description: message,
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

  function buildReviewQuote(quoteId?: string | null): Quotation {
    return {
      id: quoteId || id || "",
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
      hotelTerms: form.hotelTerms,
      flightTerms: form.flightTerms,
      visaTerms: form.visaTerms,
      insuranceTerms: form.insuranceTerms,
      forceMajeure: form.forceMajeure,
      travelDisclaimer: form.travelDisclaimer,
      salesExecutiveName: form.salesExecutiveName,
      specialRequests: form.specialRequests,
      taxRate: form.taxRate,
      perPersonCost: liveCosting.perPersonCost,
      packages,
    };
  }

  async function ensureSavedForDelivery(): Promise<Quotation | null> {
    if (!form.customerName.trim() || !form.destination.trim()) {
      toast({ title: "Customer and destination are required", variant: "destructive" });
      return null;
    }
    const saved = await persist(step);
    if (!saved?.id) {
      toast({ title: "Save the draft first", description: "Email and WhatsApp need a saved quotation.", variant: "destructive" });
      return null;
    }
    return { ...buildReviewQuote(saved.id), ...saved, id: saved.id, quoteNo: saved.quoteNo || quoteNo || "DRAFT" };
  }

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="sm:max-w-5xl lg:max-w-6xl w-[calc(100%-1.5rem)] p-0 gap-0 max-h-[92vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
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
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Travel agent</Label>
                {agents.length ? (
                  <Select
                    value={!form.agentId || form.agentId === user?.id ? "self" : form.agentId}
                    onValueChange={(v) => {
                      if (v === "self") {
                        setForm({
                          ...form,
                          agentId: user?.id || "",
                          agentName: user?.name || user?.email || form.agentName,
                          agentCode: user?.agentCode || form.agentCode,
                        });
                        return;
                      }
                      const picked = agents.find((a) => a.id === v);
                      setForm({
                        ...form,
                        agentId: v,
                        agentName: picked?.name || "",
                        agentCode: picked?.agentCode || "",
                      });
                    }}
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select travel agent" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="self">{user?.name || "Current user"}{user?.agentCode ? ` · ${user.agentCode}` : ""}</SelectItem>
                      {agents.filter((a) => a.id !== user?.id).map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}{a.agentCode ? ` · ${a.agentCode}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input className="h-10" value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} />
                )}
              </div>
              <Field label="Sales executive" value={form.salesExecutiveName} onChange={(v) => setForm({ ...form, salesExecutiveName: v })} />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Agency code</Label>
                <Input className="h-10 bg-muted/40 font-mono" value={form.agencyCode || "—"} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Agent code</Label>
                <Input className="h-10 bg-muted/40 font-mono" value={form.agentCode || "—"} readOnly />
                {!form.agentCode && (
                  <p className="text-[11px] text-muted-foreground">Issued on save as a code like ADCI-AGT-0001 for this agent.</p>
                )}
              </div>
            </FormSection>

            <FormSection title="Destination" description="City for the trip and cover image for the customer PDF.">
              {!form.destination.trim() ? (
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-sm font-medium">Search destination master</Label>
                  <DestinationSelect
                    value={destinationId}
                    onChange={(id) => {
                      setDestinationId(id);
                      apiFetch<{ item: { name: string; country?: string; heroImage?: string | null; bannerImage?: string | null; thumbnail?: string | null; galleryImages?: string[] } }>(`/api/destinations/${id}`)
                        .then((data) => {
                          const hero = data.item.heroImage || data.item.bannerImage || data.item.thumbnail || data.item.galleryImages?.[0] || "";
                          const country = data.item.country || "";
                          const intl = Boolean(country && !["india", "in", "bharat"].includes(country.trim().toLowerCase()));
                          setForm((f) => ({
                            ...f,
                            destination: data.item.name || f.destination,
                            country: country || f.country,
                            coverImage: f.coverImage || hero,
                            isInternational: intl,
                          }));
                        })
                        .catch(() => undefined);
                    }}
                    placeholder="Search destinations…"
                  />
                </div>
              ) : null}
              <Field label="Destination city *" value={form.destination} onChange={(v) => setForm({ ...form, destination: v })} />
              <Field
                label="Country"
                value={form.country}
                onChange={(v) => {
                  const intl = Boolean(v && !["india", "in", "bharat"].includes(v.trim().toLowerCase()));
                  setForm({ ...form, country: v, isInternational: intl });
                }}
              />
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
            fields={["hotelName", "starCategory", "roomType", "mealPlan", "checkIn", "checkOut", "nights", "rooms", "address", "city", "supplier", "confirmationNo", "contactPerson", "contactPhone", "contactEmail", "costPrice", "sellingPrice", "markup", "remarks", "imageUrl"]}
            onChange={(rows) => patchSelected({ hotels: rows })}
            template={{
              hotelName: "",
              starCategory: "4",
              roomType: "Deluxe",
              mealPlan: "Breakfast",
              checkIn: form.travelStartDate || "",
              checkOut: form.travelEndDate || "",
              checkInTime: "14:00",
              checkOutTime: "11:00",
              nights: nights ?? "",
              rooms: 1,
              address: "",
              city: form.destination || "",
              supplier: "",
              confirmationNo: "",
              contactPerson: "",
              contactPhone: "",
              contactEmail: "",
              imageUrl: "",
              costPrice: 8000,
              sellingPrice: 10000,
              markup: 2000,
              remarks: "",
              source: "MANUAL",
              hotelDocuments: [],
            }}
            catalogKind="hotels"
            travelDate={form.travelStartDate}
            travelEndDate={form.travelEndDate}
            destinationId={destinationId}
            destination={form.destination}
            catalogToRow={(item) => hotelFromCatalog(item)}
          />
        )}

        {step === 2 && (
          <ServiceEditor
            title="Flights"
            rows={(selected?.flights || []) as Record<string, unknown>[]}
            fields={["airline", "flightNumber", "from", "to", "date", "depTime", "arrTime", "duration", "baggage", "cabinClass", "currency", "pnr", "remarks", "costPrice", "sellingPrice", "fare"]}
            onChange={(rows) => patchSelected({ flights: rows })}
            template={{ airline: "", flightNumber: "", from: "", to: "", cabinClass: "Economy", currency: form.currency || "INR", duration: "", baggage: "", remarks: "", pnr: "", costPrice: 12000, sellingPrice: 15000, fare: 15000, source: "MANUAL", flightDocuments: [] }}
            catalogKind="flights"
            travelDate={form.travelStartDate}
            destinationId={destinationId}
            destination={form.destination}
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
              flightDocuments: [],
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
              template={{ transferType: "Airport Pickup", vehicleType: "Sedan", pickup: "", drop: "", date: form.travelStartDate || "", costPrice: 1500, sellingPrice: 2200, supplier: "", source: "MANUAL" }}
              catalogKind="transfers"
              travelDate={form.travelStartDate}
              destinationId={destinationId}
              destination={form.destination}
              quotationId={id}
              catalogToRow={(item) => ({
                productId: item.id,
                productType: "TRANSFER",
                source: "CONTRACTED_PRODUCT",
                transferType: String(item.transferType || item.name || "Airport Pickup"),
                vehicleType: String(item.vehicleType || "Sedan"),
                pickup: String(item.pickupLocation || ""),
                drop: String(item.dropLocation || ""),
                date: form.travelStartDate || "",
                sellingPrice: Number(item.privatePrice ?? item.sharedPrice ?? 0),
                costPrice: 0,
                supplier: item.supplier?.name || "",
              })}
            />
            <ServiceEditor
              title="Activities"
              rows={(selected?.activities || []) as Record<string, unknown>[]}
              fields={["activityCategory", "activityName", "description", "date", "timeSlot", "ticketType", "adultRate", "childRate", "adults", "children", "supplier", "imageUrl", "costPrice", "sellingPrice"]}
              onChange={(rows) => patchSelected({ activities: rows })}
              template={{
                activityCategory: "Attraction",
                activityName: "",
                description: "",
                date: form.travelStartDate || "",
                timeSlot: "",
                ticketType: "Standard",
                adultRate: 2500,
                childRate: 1500,
                adults: form.adults,
                children: form.children,
                supplier: "",
                imageUrl: "",
                costPrice: 2000,
                sellingPrice: 2500,
                source: "MANUAL",
                activityDocuments: [],
              }}
              catalogKind="activities"
              travelDate={form.travelStartDate}
              destinationId={destinationId}
              destination={form.destination}
              quotationId={id}
              catalogToRow={(item) => {
                const extra = item as ProductRecord & Record<string, unknown>;
                return {
                productId: item.id,
                productType: "ACTIVITY",
                source: "CONTRACTED_PRODUCT",
                activityCategory: String(extra.category || extra.activityType || "Attraction"),
                activityName: item.name,
                description: String(item.shortDescription || item.description || ""),
                date: form.travelStartDate || "",
                timeSlot: String(extra.startTime || ""),
                ticketType: String(extra.ticketType || "Standard"),
                startTime: String(extra.startTime || ""),
                closingTime: String(extra.closingTime || ""),
                duration: String(extra.duration || ""),
                adults: form.adults,
                children: form.children,
                adultRate: Number(extra.adultPrice || 0),
                childRate: Number(extra.childPrice || 0),
                imageUrl: firstProductImage(item),
                sellingPrice: Number(extra.adultPrice || 0),
                costPrice: 0,
                supplier: item.supplier?.name || "",
                activityDocuments: [],
              };
              }}
            />
          </div>
        )}

        {step === 5 && (
          <ServiceEditor
            title="Meals"
            rows={(selected?.meals || []) as Record<string, unknown>[]}
            fields={["restaurant", "cuisine", "mealType", "dietary", "date", "adults", "children", "adultRate", "childRate", "costPrice", "sellingPrice"]}
            onChange={(rows) => patchSelected({ meals: rows })}
            template={{ mealType: "Dinner", restaurant: "", cuisine: "Local", dietary: "", date: form.travelStartDate || "", adults: form.adults, children: form.children, adultRate: 1200, childRate: 800, costPrice: 900, sellingPrice: 1200, source: "MANUAL" }}
            catalogKind="meals"
            travelDate={form.travelStartDate}
            destinationId={destinationId}
            destination={form.destination}
            quotationId={id}
            catalogToRow={(item) => {
              const extra = item as ProductRecord & Record<string, unknown>;
              return {
              productId: item.id,
              productType: "MEAL",
              source: "CONTRACTED_PRODUCT",
              restaurant: String(extra.restaurant || item.name || ""),
              mealType: String(extra.mealType || "Dinner"),
              cuisine: String(extra.cuisine || item.city || ""),
              dietary: "",
              date: form.travelStartDate || "",
              description: String(item.description || ""),
              transferBadge: item.transferInclusion === "PRIVATE" ? "Private Transfer" : "No Transfer",
              adults: form.adults,
              children: form.children,
              sellingPrice: Number(extra.adultPrice || 0),
            };
            }}
          />
        )}

        {step === 6 && (
          <div className="grid md:grid-cols-2 gap-4">
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(selected?.insurance && (selected.insurance as { enabled?: boolean }).enabled)}
                  onCheckedChange={(v) => patchSelected({
                    insurance: {
                      ...(selected?.insurance || {}),
                      enabled: Boolean(v),
                      provider: String((selected?.insurance as { provider?: string })?.provider || "TATA AIG"),
                      planName: String((selected?.insurance as { planName?: string })?.planName || "Travel Guard"),
                      coverage: String((selected?.insurance as { coverage?: string })?.coverage || ""),
                      validity: String((selected?.insurance as { validity?: string })?.validity || ""),
                      policyNumber: String((selected?.insurance as { policyNumber?: string })?.policyNumber || ""),
                      remarks: String((selected?.insurance as { remarks?: string })?.remarks || ""),
                      costPrice: Number((selected?.insurance as { costPrice?: number })?.costPrice || 800),
                      sellingPrice: Number((selected?.insurance as { sellingPrice?: number })?.sellingPrice || 1200),
                      premium: Number((selected?.insurance as { premium?: number })?.premium
                        || (selected?.insurance as { sellingPrice?: number })?.sellingPrice
                        || 1200),
                      policyDocuments: Array.isArray((selected?.insurance as { policyDocuments?: unknown })?.policyDocuments)
                        ? (selected?.insurance as { policyDocuments: Array<Record<string, string>> }).policyDocuments
                        : [],
                    },
                  })}
                />
                <Label>Enable Travel Insurance</Label>
              </div>
              {Boolean((selected?.insurance as { enabled?: boolean })?.enabled) && (
                <>
                  <Field
                    label="Insurance provider"
                    value={String((selected?.insurance as { provider?: string })?.provider || "")}
                    onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, provider: v } })}
                  />
                  <Field
                    label="Plan name"
                    value={String((selected?.insurance as { planName?: string })?.planName || "")}
                    onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, planName: v } })}
                  />
                  <Field
                    label="Coverage"
                    value={String((selected?.insurance as { coverage?: string })?.coverage || "")}
                    onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, coverage: v } })}
                  />
                  <Field
                    label="Validity"
                    value={String((selected?.insurance as { validity?: string })?.validity || "")}
                    onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, validity: v } })}
                  />
                  <Field
                    label="Premium"
                    type="number"
                    value={String(
                      (selected?.insurance as { premium?: number })?.premium
                      ?? (selected?.insurance as { sellingPrice?: number })?.sellingPrice
                      ?? 0,
                    )}
                    onChange={(v) => {
                      const premium = Number(v) || 0;
                      patchSelected({ insurance: { ...selected?.insurance, premium, sellingPrice: premium } });
                    }}
                  />
                  <Field
                    label="Cost"
                    type="number"
                    value={String((selected?.insurance as { costPrice?: number })?.costPrice || 0)}
                    onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, costPrice: Number(v) || 0 } })}
                  />
                  <Field
                    label="Policy number"
                    value={String((selected?.insurance as { policyNumber?: string })?.policyNumber || "")}
                    onChange={(v) => patchSelected({ insurance: { ...selected?.insurance, policyNumber: v } })}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Remarks</Label>
                    <Textarea
                      className="min-h-[72px]"
                      value={String((selected?.insurance as { remarks?: string })?.remarks || "")}
                      onChange={(e) => patchSelected({ insurance: { ...selected?.insurance, remarks: e.target.value } })}
                    />
                  </div>
                  <InsurancePolicyAttach
                    quotationId={id}
                    documents={Array.isArray((selected?.insurance as { policyDocuments?: unknown })?.policyDocuments)
                      ? ((selected?.insurance as { policyDocuments: Array<Record<string, string>> }).policyDocuments)
                      : []}
                    onChange={(docs) => patchSelected({ insurance: { ...selected?.insurance, policyDocuments: docs } })}
                  />
                </>
              )}
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={Boolean(selected?.visa && (selected.visa as { enabled?: boolean }).enabled)}
                  onCheckedChange={(v) => patchSelected({
                    visa: {
                      ...(selected?.visa || {}),
                      enabled: Boolean(v),
                      visaType: String((selected?.visa as { visaType?: string })?.visaType || "Tourist Visa"),
                      entryType: String((selected?.visa as { entryType?: string })?.entryType || "Single Entry"),
                      processingTime: String((selected?.visa as { processingTime?: string })?.processingTime || ""),
                      documentsRequired: String((selected?.visa as { documentsRequired?: string })?.documentsRequired || ""),
                      appointmentRequired: Boolean((selected?.visa as { appointmentRequired?: boolean })?.appointmentRequired),
                      appointmentNote: String((selected?.visa as { appointmentNote?: string })?.appointmentNote || ""),
                      remarks: String((selected?.visa as { remarks?: string })?.remarks || ""),
                      feeNotes: String((selected?.visa as { feeNotes?: string })?.feeNotes || ""),
                      costPrice: Number((selected?.visa as { costPrice?: number })?.costPrice || 3000),
                      sellingPrice: Number((selected?.visa as { sellingPrice?: number })?.sellingPrice || 4500),
                      required: form.isInternational,
                    },
                  })}
                />
                <Label>Visa Required / Include Visa Service</Label>
              </div>
              {Boolean((selected?.visa as { enabled?: boolean })?.enabled) && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Visa type</Label>
                    <Select
                      value={normalizeVisaType(String((selected?.visa as { visaType?: string })?.visaType || "Tourist Visa"))}
                      onValueChange={(v) => patchSelected({ visa: { ...selected?.visa, visaType: v } })}
                    >
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select visa type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Tourist Visa">Tourist Visa</SelectItem>
                        <SelectItem value="Business Visa">Business Visa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Entry type</Label>
                    <Select
                      value={normalizeEntryType(String((selected?.visa as { entryType?: string })?.entryType || "Single Entry"))}
                      onValueChange={(v) => patchSelected({ visa: { ...selected?.visa, entryType: v } })}
                    >
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select entry type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Single Entry">Single Entry</SelectItem>
                        <SelectItem value="Multiple Entry">Multiple Entry</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Field
                    label="Processing time"
                    value={String((selected?.visa as { processingTime?: string })?.processingTime || "")}
                    onChange={(v) => patchSelected({ visa: { ...selected?.visa, processingTime: v } })}
                  />
                  <Field
                    label="Visa fee (selling)"
                    type="number"
                    value={String((selected?.visa as { sellingPrice?: number })?.sellingPrice || 0)}
                    onChange={(v) => patchSelected({ visa: { ...selected?.visa, sellingPrice: Number(v) || 0 } })}
                  />
                  <Field
                    label="Visa fee (cost)"
                    type="number"
                    value={String((selected?.visa as { costPrice?: number })?.costPrice || 0)}
                    onChange={(v) => patchSelected({ visa: { ...selected?.visa, costPrice: Number(v) || 0 } })}
                  />
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Required documents</Label>
                    <Textarea
                      className="min-h-[72px]"
                      value={String((selected?.visa as { documentsRequired?: string })?.documentsRequired || "")}
                      onChange={(e) => patchSelected({ visa: { ...selected?.visa, documentsRequired: e.target.value } })}
                      placeholder="Passport, photos, bank statement…"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox
                      checked={Boolean((selected?.visa as { appointmentRequired?: boolean })?.appointmentRequired)}
                      onCheckedChange={(v) => patchSelected({
                        visa: { ...selected?.visa, appointmentRequired: Boolean(v) },
                      })}
                    />
                    <Label>Appointment required</Label>
                  </div>
                  {Boolean((selected?.visa as { appointmentRequired?: boolean })?.appointmentRequired) && (
                    <Field
                      label="Appointment note"
                      value={String((selected?.visa as { appointmentNote?: string })?.appointmentNote || "")}
                      onChange={(v) => patchSelected({ visa: { ...selected?.visa, appointmentNote: v } })}
                    />
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Remarks</Label>
                    <Textarea
                      className="min-h-[72px]"
                      value={String((selected?.visa as { remarks?: string })?.remarks || "")}
                      onChange={(e) => patchSelected({ visa: { ...selected?.visa, remarks: e.target.value } })}
                    />
                  </div>
                  <VisaDocumentAttach
                    quotationId={id}
                    documents={Array.isArray((selected?.visa as { visaDocuments?: unknown })?.visaDocuments)
                      ? ((selected?.visa as { visaDocuments: Array<Record<string, string>> }).visaDocuments)
                      : []}
                    onChange={(docs) => patchSelected({ visa: { ...selected?.visa, visaDocuments: docs } })}
                  />
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
                            visaType: normalizeVisaType(visaRecommendation.suggestedVisaType),
                            entryType: normalizeEntryType(visaRecommendation.suggestedEntryType),
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
          <AddOnsEditor
            rows={(selected?.addOns || []) as Record<string, unknown>[]}
            onChange={(rows) => patchSelected({ addOns: rows })}
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
            {discountRequiresApproval(user?.role, form.discountType || null, form.discountValue) && (
              <div className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                canApproveDiscount(user?.role)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                  : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100",
              )}>
                {canApproveDiscount(user?.role) ? (
                  <p>
                    This discount exceeds the standard sales limit
                    {form.discountType === "Percentage"
                      ? ` (${maxDiscountPercent("sales_executive")}%)`
                      : ` (₹${maxDiscountFixed("sales_executive").toLocaleString("en-IN")})`}
                    . Saving will auto-approve it under your manager authority.
                  </p>
                ) : (
                  <p>
                    This discount exceeds your limit
                    {form.discountType === "Percentage"
                      ? ` of ${maxDiscountPercent(user?.role)}%`
                      : ` of ₹${maxDiscountFixed(user?.role).toLocaleString("en-IN")}`}
                    . Saving requests <strong>Discount approval</strong> — Team Lead / manager must approve before submit-for-approval or send.
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Contracted cost comes from each service net cost. Trevio markup is internal. Tax is applied only from an active tax rule — if none exists, saving is allowed but the quote cannot be finalized until tax configuration exists.
            </p>

            <div className="rounded-xl border overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/30">
                <p className="text-sm font-semibold">Costing engine</p>
                <p className="text-[11px] text-muted-foreground">Automatic net cost and selling price by service</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Service</th>
                      <th className="px-3 py-2 font-medium text-right">Net cost</th>
                      <th className="px-3 py-2 font-medium text-right">Selling price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveCosting.services.map((row) => (
                      <tr key={row.key} className="border-b last:border-0">
                        <td className="px-3 py-2">{row.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatFullINR(row.netCost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatFullINR(row.sellingPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 border-t bg-muted/10 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total net cost</p>
                  <p className="font-semibold tabular-nums">{formatFullINR(liveCosting.totalNetCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total selling</p>
                  <p className="font-semibold tabular-nums">{formatFullINR(liveCosting.totalSellingBeforeDiscount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Discount</p>
                  <p className="font-semibold tabular-nums">{formatFullINR(liveCosting.discountAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Gross profit</p>
                  <p className="font-semibold tabular-nums">{formatFullINR(liveCosting.grossProfit)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Profit margin</p>
                  <p className="font-semibold tabular-nums">{liveCosting.profitMargin}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {form.taxRate > 0 ? `GST / Tax (${form.taxRate}%)` : "GST / Tax"}
                  </p>
                  <p className="font-semibold tabular-nums">
                    {form.taxRate > 0 ? formatFullINR(liveCosting.gst) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Final package cost</p>
                  <p className="font-semibold tabular-nums text-teal-700 dark:text-teal-300">{formatFullINR(liveCosting.finalPackageCost)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Per person cost</p>
                  <p className="font-semibold tabular-nums">{formatFullINR(liveCosting.perPersonCost)}</p>
                </div>
                {liveCosting.trevioMarkupAmount > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Trevio markup</p>
                    <p className="font-semibold tabular-nums">{formatFullINR(liveCosting.trevioMarkupAmount)}</p>
                  </div>
                )}
              </div>
            </div>

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
                trevioMarkupValue: form.trevioMarkupValue,
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
            <div className="rounded-lg border p-3 bg-muted/30 text-xs space-y-3">
              <p className="font-semibold">Generate professional quote</p>
              <p className="text-muted-foreground">Customer preview hides cost, profit, suppliers, and internal notes.</p>
              <p>Hotels: {(selected?.hotels || []).length} · Flights: {(selected?.flights || []).length} · Activities: {(selected?.activities || []).length}</p>
              <p>
                Photos: {form.coverImage ? "cover · " : ""}
                {(selected?.hotels || []).filter((h) => Boolean((h as Record<string, unknown>).imageUrl)).length} hotels ·
                {" "}{(selected?.itinerary || []).filter((d) => Boolean((d as Record<string, unknown>).coverImage)).length} itinerary days ·
                {" "}{(selected?.activities || []).filter((a) => Boolean((a as Record<string, unknown>).imageUrl)).length} experiences
              </p>
              <p>Insurance: {(selected?.insurance as { enabled?: boolean })?.enabled ? "Yes" : "No"} · Visa: {(selected?.visa as { enabled?: boolean })?.enabled ? "Yes" : "No"}</p>
              <p>Final (preview): {formatFullINR(liveCosting.total)} · Per person: {formatFullINR(liveCosting.perPersonCost)}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    if (!form.customerName.trim() || !form.destination.trim()) {
                      toast({ title: "Customer and destination are required for the client PDF", variant: "destructive" });
                      return;
                    }
                    try {
                      const preview = buildReviewQuote();
                      const ok = await downloadQuotationPdf(preview, undefined, { mode: id ? "preview" : "customer" });
                      toast({
                        title: ok ? "Client PDF ready" : "PDF failed",
                        description: ok
                          ? id
                            ? "Branded quotation PDF downloaded."
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
                  <FileDown className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    if (!form.customerName.trim() || !form.destination.trim()) {
                      toast({ title: "Customer and destination are required", variant: "destructive" });
                      return;
                    }
                    const ok = await downloadClientQuotationBrochure(buildReviewQuote());
                    toast({
                      title: ok ? "Print dialog opened" : "Print failed",
                      description: ok ? "Use your browser print dialog to print or save as PDF." : "Pop-up may be blocked.",
                      variant: ok ? "default" : "destructive",
                    });
                  }}
                >
                  <Printer className="w-3.5 h-3.5 mr-1" /> Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const quote = await ensureSavedForDelivery();
                    if (!quote) return;
                    if (!quote.contactEmail?.trim()) {
                      toast({ title: "Add contact email in Basic Details", variant: "destructive" });
                      return;
                    }
                    const res = await deliverQuotationEmail(quote);
                    toast({
                      title: res.ok ? "Email sent" : "Email failed",
                      description: res.ok
                        ? `Quotation PDF emailed to ${quote.contactEmail}.`
                        : res.error || "Could not send email",
                      variant: res.ok ? "default" : "destructive",
                    });
                  }}
                >
                  <Mail className="w-3.5 h-3.5 mr-1" /> Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={async () => {
                    const quote = await ensureSavedForDelivery();
                    if (!quote) return;
                    if (!quote.contactPhone?.trim()) {
                      toast({ title: "Add contact phone in Basic Details", variant: "destructive" });
                      return;
                    }
                    const res = await deliverQuotationWhatsApp(quote);
                    toast({
                      title: res.ok ? "WhatsApp sent" : "WhatsApp failed",
                      description: res.ok
                        ? `Quotation PDF sent to ${quote.contactPhone}.`
                        : res.error || "Could not send WhatsApp",
                      variant: res.ok ? "default" : "destructive",
                    });
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                </Button>
              </div>
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
                    <tr>
                      <td className="p-2 border-t">Visa</td>
                      {packages.map((p) => <td key={p.name} className="p-2 border-t">{(p.visa as { enabled?: boolean })?.enabled ? "Yes" : "No"}</td>)}
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

              {saveError && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Save failed: {saveError}
                </div>
              )}
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
                      <label className="flex items-center gap-2 text-xs text-muted-foreground mr-auto">
                        <input
                          type="checkbox"
                          checked={requireFinanceApproval}
                          onChange={(e) => setRequireFinanceApproval(e.target.checked)}
                        />
                        Require Finance approval
                      </label>
                      <Button variant="outline" disabled={busy} onClick={async () => { await persist(step); onOpenChange(false); }}>
                        Finish later
                      </Button>
                      <Button
                        variant={["super_admin", "agency_admin"].includes(String(user?.role || "")) ? "outline" : "default"}
                        disabled={busy}
                        className={["super_admin", "agency_admin"].includes(String(user?.role || "")) ? undefined : "bg-teal-600 hover:bg-teal-700"}
                        onClick={async () => {
                          const q = await persist(step, { submitApproval: true, financeApprovalRequired: requireFinanceApproval });
                          if (q) onOpenChange(false);
                        }}
                      >
                        Submit for approval
                      </Button>
                      {["super_admin", "agency_admin"].includes(String(user?.role || "")) && (
                        <Button
                          disabled={busy}
                          className="bg-teal-600 hover:bg-teal-700"
                          onClick={async () => {
                            const q = await persist(step, { approveNow: true, financeApprovalRequired: false });
                            if (q) onOpenChange(false);
                          }}
                        >
                          Approve & finish
                        </Button>
                      )}
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
    address: String(item.address || ""),
    city: String(item.city || item.destination?.name || ""),
    checkInTime: String(item.checkInTime || "14:00"),
    checkOutTime: String(item.checkOutTime || "11:00"),
    contactPerson: String(item.contactPerson || ""),
    contactPhone: String(item.contactPhone || ""),
    contactEmail: String(item.contactEmail || ""),
    imageUrl: firstProductImage(item),
    sellingPrice: selling,
    supplier: item.supplier?.name,
    confirmationNo: "",
    remarks: "",
    hotelDocuments: [],
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

const TRANSFER_TYPES = [
  "Airport Pickup",
  "Airport Drop",
  "Hotel Transfer",
  "Intercity Transfer",
  "SIC",
  "Private Vehicle",
  "Coach",
] as const;

const VEHICLE_TYPES = [
  "Sedan",
  "SUV",
  "Van",
  "Luxury Car",
  "Mini Coach",
  "Full Coach",
] as const;

const ACTIVITY_CATEGORIES = [
  "Attraction",
  "Theme Park",
  "Cruise",
  "Museum",
  "Adventure Activity",
  "Show",
  "Local Tour",
] as const;

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner"] as const;

function normalizeVisaType(value: string): "Tourist Visa" | "Business Visa" {
  const v = value.trim().toLowerCase();
  if (v.includes("business")) return "Business Visa";
  return "Tourist Visa";
}

function normalizeEntryType(value: string): "Single Entry" | "Multiple Entry" {
  const v = value.trim().toLowerCase();
  if (v.includes("multi")) return "Multiple Entry";
  return "Single Entry";
}

const FIELD_SELECT_OPTIONS: Record<string, readonly string[]> = {
  transferType: TRANSFER_TYPES,
  vehicleType: VEHICLE_TYPES,
  activityCategory: ACTIVITY_CATEGORIES,
  mealType: MEAL_TYPES,
};

function fieldInputType(field: string): string {
  if (field === "checkIn" || field === "checkOut" || field === "date") return "date";
  if (field === "checkInTime" || field === "checkOutTime" || field === "depTime" || field === "arrTime" || field === "timeSlot") return "time";
  if (["costPrice", "sellingPrice", "fare", "rooms", "quantity", "adultRate", "childRate", "adults", "children", "nights", "markup", "starCategory"].includes(field)) {
    return "number";
  }
  return "text";
}

function fieldLabel(field: string): string {
  if (field === "imageUrl") return "Image URL";
  if (field === "checkIn") return "Check-in";
  if (field === "checkOut") return "Check-out";
  if (field === "confirmationNo") return "Confirmation number";
  if (field === "contactPerson") return "Contact person";
  if (field === "contactPhone") return "Contact phone";
  if (field === "contactEmail") return "Contact email";
  if (field === "nights") return "Number of nights";
  if (field === "rooms") return "Number of rooms";
  if (field === "markup") return "Markup";
  if (field === "starCategory") return "Star category";
  if (field === "costPrice") return "Cost price";
  if (field === "sellingPrice") return "Selling price";
  if (field === "transferType") return "Transfer type";
  if (field === "vehicleType") return "Vehicle type";
  if (field === "activityCategory") return "Activity category";
  if (field === "timeSlot") return "Time slot";
  if (field === "ticketType") return "Ticket type";
  if (field === "adultRate") return "Adult rate";
  if (field === "childRate") return "Child rate";
  if (field === "mealType") return "Meal type";
  if (field === "dietary") return "Special dietary requirements";
  return field.replace(/([A-Z])/g, " $1");
}

function stayNights(checkIn?: string, checkOut?: string): number | null {
  const a = toCalendarDate(checkIn);
  const b = toCalendarDate(checkOut);
  if (!a || !b || b <= a) return null;
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

function hotelDisplayPrice(item: ProductRecord): number {
  const rooms = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
  const first = rooms[0] as { pricing?: Record<string, number> } | undefined;
  const pricing = first?.pricing || {};
  return Number(pricing.double ?? pricing.single ?? item.adultPrice ?? 0) || 0;
}

function toTimeValue(value?: string | null, fallback = ""): string {
  if (!value) return fallback;
  const v = String(value).trim();
  const iso = v.match(/^(\d{1,2}):(\d{2})/);
  if (iso) return `${iso[1].padStart(2, "0")}:${iso[2]}`;
  const ampm = v.match(/^(\d{1,2})\s*(am|pm)$/i);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (/pm/i.test(ampm[2])) h += 12;
    return `${String(h).padStart(2, "0")}:00`;
  }
  return fallback;
}

const OPTIONAL_ADDON_PRESETS: Array<{
  name: string;
  description: string;
  costPrice: number;
  sellingPrice: number;
}> = [
  { name: "International SIM Card", description: "Local SIM with data for the trip", costPrice: 400, sellingPrice: 799 },
  { name: "eSIM", description: "Instant digital SIM — activate on arrival", costPrice: 500, sellingPrice: 899 },
  { name: "Airport Lounge Access", description: "Departure lounge pass", costPrice: 1500, sellingPrice: 2499 },
  { name: "Early Check-in", description: "Subject to hotel availability", costPrice: 800, sellingPrice: 1500 },
  { name: "Late Check-out", description: "Subject to hotel availability", costPrice: 800, sellingPrice: 1500 },
  { name: "Extra Excursions", description: "Optional day trip / sightseeing add-on", costPrice: 2000, sellingPrice: 3500 },
  { name: "Private Guide", description: "Dedicated local guide for selected days", costPrice: 3000, sellingPrice: 4999 },
  { name: "Birthday Decorations", description: "Room / venue birthday setup", costPrice: 1200, sellingPrice: 2499 },
  { name: "Honeymoon Setup", description: "Romantic room décor & amenities", costPrice: 1500, sellingPrice: 2999 },
  { name: "Travel Accessories", description: "Travel kit / adapters / essentials", costPrice: 300, sellingPrice: 699 },
];

function AddOnsEditor({
  rows,
  onChange,
}: {
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
}) {
  function isEnabled(name: string) {
    return rows.some((r) => String(r.name || "") === name && r.enabled !== false);
  }

  function findRow(name: string) {
    return rows.find((r) => String(r.name || "") === name);
  }

  function togglePreset(preset: (typeof OPTIONAL_ADDON_PRESETS)[number], enabled: boolean) {
    if (enabled) {
      if (isEnabled(preset.name)) return;
      const existing = findRow(preset.name);
      if (existing) {
        onChange(rows.map((r) => (String(r.name) === preset.name ? { ...r, enabled: true } : r)));
        return;
      }
      onChange([
        ...rows,
        {
          name: preset.name,
          description: preset.description,
          quantity: 1,
          costPrice: preset.costPrice,
          sellingPrice: preset.sellingPrice,
          remarks: "",
          enabled: true,
          source: "PRESET",
        },
      ]);
      return;
    }
    // Remove from package extras — does not touch hotels/flights/main services.
    onChange(rows.filter((r) => String(r.name || "") !== preset.name));
  }

  function updateRow(name: string, patch: Record<string, unknown>) {
    onChange(rows.map((r) => (String(r.name || "") === name ? { ...r, ...patch, enabled: true } : r)));
  }

  function addCustom() {
    onChange([
      ...rows,
      {
        name: "Custom add-on",
        description: "",
        quantity: 1,
        costPrice: 0,
        sellingPrice: 0,
        remarks: "",
        enabled: true,
        source: "MANUAL",
      },
    ]);
  }

  const customRows = rows.filter(
    (r) => r.enabled !== false && !OPTIONAL_ADDON_PRESETS.some((p) => p.name === String(r.name || "")),
  );

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Optional Add-ons</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Enable extras to grow revenue. Turning these on or off does not change hotels, flights, or the main package.
        </p>
      </div>

      <div className="space-y-2">
        {OPTIONAL_ADDON_PRESETS.map((preset) => {
          const enabled = isEnabled(preset.name);
          const row = findRow(preset.name);
          return (
            <div key={preset.name} className="rounded-xl border bg-card p-3 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={enabled}
                  onCheckedChange={(v) => togglePreset(preset, Boolean(v))}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                </div>
                {!enabled && (
                  <p className="text-xs text-muted-foreground tabular-nums shrink-0">
                    from {formatFullINR(preset.sellingPrice)}
                  </p>
                )}
              </div>
              {enabled && row && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pl-7">
                  <Field
                    label="Quantity"
                    type="number"
                    value={String(row.quantity ?? 1)}
                    onChange={(v) => updateRow(preset.name, { quantity: Number(v) || 1 })}
                  />
                  <Field
                    label="Cost"
                    type="number"
                    value={String(row.costPrice ?? 0)}
                    onChange={(v) => updateRow(preset.name, { costPrice: Number(v) || 0 })}
                  />
                  <Field
                    label="Selling price"
                    type="number"
                    value={String(row.sellingPrice ?? 0)}
                    onChange={(v) => updateRow(preset.name, { sellingPrice: Number(v) || 0 })}
                  />
                  <Field
                    label="Remarks"
                    value={String(row.remarks || "")}
                    onChange={(v) => updateRow(preset.name, { remarks: v })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {customRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Custom add-ons</p>
          {customRows.map((row, idx) => {
            const name = String(row.name || `Custom ${idx + 1}`);
            return (
              <div key={`${name}-${idx}`} className="rounded-xl border bg-card p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 relative">
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute right-2 top-2 h-8 w-8 p-0"
                  onClick={() => onChange(rows.filter((r) => r !== row))}
                  aria-label="Remove custom add-on"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Field
                  label="Name"
                  value={name}
                  onChange={(v) => {
                    onChange(rows.map((r) => (r === row ? { ...r, name: v, enabled: true } : r)));
                  }}
                />
                <Field
                  label="Description"
                  value={String(row.description || "")}
                  onChange={(v) => {
                    onChange(rows.map((r) => (r === row ? { ...r, description: v, enabled: true } : r)));
                  }}
                />
                <Field
                  label="Quantity"
                  type="number"
                  value={String(row.quantity ?? 1)}
                  onChange={(v) => {
                    onChange(rows.map((r) => (r === row ? { ...r, quantity: Number(v) || 1, enabled: true } : r)));
                  }}
                />
                <Field
                  label="Cost"
                  type="number"
                  value={String(row.costPrice ?? 0)}
                  onChange={(v) => {
                    onChange(rows.map((r) => (r === row ? { ...r, costPrice: Number(v) || 0, enabled: true } : r)));
                  }}
                />
                <Field
                  label="Selling price"
                  type="number"
                  value={String(row.sellingPrice ?? 0)}
                  onChange={(v) => {
                    onChange(rows.map((r) => (r === row ? { ...r, sellingPrice: Number(v) || 0, enabled: true } : r)));
                  }}
                />
                <Field
                  label="Remarks"
                  value={String(row.remarks || "")}
                  onChange={(v) => {
                    onChange(rows.map((r) => (r === row ? { ...r, remarks: v, enabled: true } : r)));
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <Button type="button" size="sm" variant="outline" onClick={addCustom}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Add custom add-on
      </Button>
    </div>
  );
}

function ServiceEditor({
  title, rows, fields, onChange, template, catalogKind, catalogToRow, travelDate, travelEndDate, quotationId, destinationId, destination,
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
  destinationId?: string;
  destination?: string;
}) {
  const [catalogOpen, setCatalogOpen] = useState(false);

  function addSelfBooked() {
    setCatalogOpen(false);
    const row = { ...template };
    if (catalogKind === "hotels") {
      row.checkIn = toCalendarDate(String(row.checkIn || "")) || travelDate || "";
      row.checkOut = toCalendarDate(String(row.checkOut || "")) || travelEndDate || "";
      if (!row.checkInTime) row.checkInTime = "14:00";
      if (!row.checkOutTime) row.checkOutTime = "11:00";
      if (!row.city && destination) row.city = destination;
      const n = stayNights(String(row.checkIn || ""), String(row.checkOut || ""));
      row.nights = n ?? "";
      const cost = Number(row.costPrice || 0);
      const sell = Number(row.sellingPrice || 0);
      row.markup = Math.round(sell - cost);
      if (!Array.isArray(row.hotelDocuments)) row.hotelDocuments = [];
    }
    if (catalogKind === "flights" && !Array.isArray(row.flightDocuments)) {
      row.flightDocuments = [];
    }
    if (catalogKind === "activities" && !Array.isArray(row.activityDocuments)) {
      row.activityDocuments = [];
    }
    onChange([...rows, row]);
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {destination
              ? `Add from ${destination} catalog or enter self-booked details.`
              : "Add from catalog or enter self-booked details."}
          </p>
        </div>
        <div className="flex gap-2">
          {catalogKind && catalogToRow && (
            <CatalogPicker
              kind={catalogKind}
              travelDate={travelDate}
              travelEndDate={travelEndDate}
              destinationId={destinationId}
              destination={destination}
              open={catalogOpen}
              onOpenChange={setCatalogOpen}
              onAddSelfBooked={addSelfBooked}
              onPick={(item, rate) => {
                const base = catalogToRow(item);
                const selling = Number(base.sellingPrice || rate.displayPrice || 0);
                const cost = Number(rate.contractedCost || 0);
                const cin = travelDate || String(base.checkIn || "");
                const cout = travelEndDate || String(base.checkOut || "");
                onChange([...rows, {
                  ...base,
                  ...(catalogKind === "hotels" ? {
                    checkIn: cin,
                    checkOut: cout,
                    checkInTime: String(base.checkInTime || "14:00"),
                    checkOutTime: String(base.checkOutTime || "11:00"),
                    nights: stayNights(cin, cout) ?? "",
                    rooms: Number(base.rooms || 1),
                    city: String(base.city || destination || ""),
                    markup: Math.round((selling || cost) - cost),
                    hotelDocuments: Array.isArray(base.hotelDocuments) ? base.hotelDocuments : [],
                  } : {}),
                  ...(catalogKind === "flights" ? {
                    flightDocuments: Array.isArray(base.flightDocuments) ? base.flightDocuments : [],
                  } : {}),
                  ...(catalogKind === "activities" ? {
                    activityDocuments: Array.isArray(base.activityDocuments) ? base.activityDocuments : [],
                  } : {}),
                  source: "CONTRACTED_PRODUCT",
                  productType: CATALOG_TYPE[catalogKind],
                  rateId: rate.rateId,
                  rateValidFrom: rate.validFrom,
                  rateValidTo: rate.validTo,
                  rateSelectedAt: new Date().toISOString(),
                  rateTravelDate: travelDate,
                  rateUnresolved: false,
                  costPrice: cost,
                  sellingPrice: selling || cost,
                }]);
                setCatalogOpen(false);
              }}
            />
          )}
          {catalogKind === "flights" && (
            <FlightApiSearch
              travelDate={travelDate}
              onPick={(row) => onChange([...rows, row])}
            />
          )}
          <Button size="sm" variant="outline" type="button" onClick={addSelfBooked}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add self-booked
          </Button>
        </div>
      </div>
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} yet — pick from catalog or add self-booked.
        </div>
      )}
      {rows.map((row, i) => {
        const checkIn = toCalendarDate(String(row.checkIn || ""));
        const checkOut = toCalendarDate(String(row.checkOut || ""));
        const dateError = catalogKind === "hotels" && checkIn && checkOut && checkOut <= checkIn
          ? "Check-out date must be after check-in date."
          : null;
        return (
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
            {dateError && (
              <p className="sm:col-span-2 md:col-span-3 text-xs text-destructive">{dateError}</p>
            )}
            {Boolean(row.transferBadge) && (
              <p className="sm:col-span-2 md:col-span-3 text-[11px] uppercase tracking-wide text-muted-foreground">{String(row.transferBadge)}</p>
            )}
            {Boolean(row.source) && (
              <p className="sm:col-span-2 md:col-span-3 text-[10px] text-muted-foreground">Source: {String(row.source)}</p>
            )}
            {fields.map((f) => {
              const inputType = fieldInputType(f);
              const raw = String(row[f] ?? "");
              const value = inputType === "date" ? (toCalendarDate(raw) || "") : raw;
              const isStayDate = catalogKind === "hotels" && (f === "checkIn" || f === "checkOut");
              const timeKey = f === "checkIn" ? "checkInTime" : "checkOutTime";
              const timeFallback = f === "checkIn" ? "14:00" : "11:00";
              const timeValue = isStayDate
                ? toTimeValue(String(row[timeKey] ?? ""), timeFallback)
                : "";
              const selectOptions = FIELD_SELECT_OPTIONS[f];
              const selectValue = value || undefined;
              const selectItems = selectOptions
                ? (selectValue && !(selectOptions as readonly string[]).includes(selectValue)
                  ? [selectValue, ...selectOptions]
                  : [...selectOptions])
                : [];
              return (
                <div key={f} className={cn("space-y-1.5", isImageField(f) || isStayDate ? "sm:col-span-2 md:col-span-3 pr-8" : "")}>
                  <Label className="text-xs font-medium capitalize text-muted-foreground">
                    {fieldLabel(f)}
                  </Label>
                  {isImageField(f) ? (
                    <ImageUrlField
                      value={raw}
                      onChange={(v) => {
                        const next = [...rows];
                        next[i] = { ...next[i], [f]: v };
                        onChange(next);
                      }}
                      placeholder="https://… photo for customer PDF"
                    />
                  ) : isStayDate ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        className="h-9"
                        type="date"
                        min={f === "checkOut" && checkIn ? checkIn : undefined}
                        value={value}
                        onChange={(e) => {
                          const next = [...rows];
                          const dateVal = toCalendarDate(e.target.value) || e.target.value;
                          const existingTime = toTimeValue(String(next[i][timeKey] ?? ""), "");
                          const patch: Record<string, unknown> = {
                            ...next[i],
                            [f]: dateVal,
                            [timeKey]: existingTime || timeFallback,
                          };
                          const cin = toCalendarDate(String(f === "checkIn" ? dateVal : patch.checkIn || ""));
                          const cout = toCalendarDate(String(f === "checkOut" ? dateVal : patch.checkOut || ""));
                          const n = stayNights(cin, cout);
                          if (n != null) patch.nights = n;
                          next[i] = patch;
                          onChange(next);
                        }}
                      />
                      <Input
                        className="h-9"
                        type="time"
                        value={timeValue}
                        onChange={(e) => {
                          const next = [...rows];
                          next[i] = {
                            ...next[i],
                            [timeKey]: toTimeValue(e.target.value, timeFallback),
                          };
                          onChange(next);
                        }}
                      />
                    </div>
                  ) : selectOptions ? (
                    <Select
                      value={selectValue}
                      onValueChange={(v) => {
                        const next = [...rows];
                        next[i] = { ...next[i], [f]: v };
                        onChange(next);
                      }}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={`Select ${fieldLabel(f).toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectItems.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-9"
                      type={inputType}
                      readOnly={f === "nights" || f === "markup"}
                      min={f === "checkOut" && checkIn ? checkIn : undefined}
                      value={
                        f === "nights"
                          ? String(stayNights(checkIn, checkOut) ?? row.nights ?? "")
                          : f === "markup"
                            ? String(Math.round(Number(row.sellingPrice || 0) - Number(row.costPrice || 0)))
                            : value
                      }
                      onChange={(e) => {
                        if (f === "nights" || f === "markup") return;
                        const next = [...rows];
                        const num = inputType === "number";
                        let nextVal: string | number = num ? Number(e.target.value) || 0 : e.target.value;
                        if (inputType === "date") nextVal = toCalendarDate(String(nextVal)) || String(nextVal);
                        const patch: Record<string, unknown> = { ...next[i], [f]: nextVal };
                        if (f === "costPrice" || f === "sellingPrice") {
                          const cost = Number(f === "costPrice" ? nextVal : patch.costPrice || 0);
                          const sell = Number(f === "sellingPrice" ? nextVal : patch.sellingPrice || 0);
                          patch.markup = Math.round(sell - cost);
                        }
                        next[i] = patch;
                        onChange(next);
                      }}
                    />
                  )}
                </div>
              );
            })}
            {catalogKind === "hotels" && (
              <HotelDocumentsAttach
                quotationId={quotationId}
                documents={Array.isArray(row.hotelDocuments) ? (row.hotelDocuments as Array<Record<string, string>>) : []}
                onChange={(docs) => {
                  const next = [...rows];
                  next[i] = { ...next[i], hotelDocuments: docs };
                  onChange(next);
                }}
              />
            )}
            {catalogKind === "flights" && (
              <FlightDocumentsAttach
                quotationId={quotationId}
                documents={(() => {
                  const docs = Array.isArray(row.flightDocuments)
                    ? [...(row.flightDocuments as Array<Record<string, string>>)]
                    : [];
                  if (row.ticketDocumentId && !docs.some((d) => d.id === String(row.ticketDocumentId))) {
                    docs.unshift({
                      id: String(row.ticketDocumentId),
                      fileName: String(row.ticketFileName || "Ticket"),
                      docType: "FLIGHT_TICKET",
                      downloadPath: String(row.ticketDownloadPath || ""),
                    });
                  }
                  return docs;
                })()}
                onChange={(docs) => {
                  const next = [...rows];
                  next[i] = {
                    ...next[i],
                    flightDocuments: docs,
                    ticketDocumentId: "",
                    ticketFileName: "",
                    ticketDownloadPath: "",
                  };
                  onChange(next);
                }}
              />
            )}
            {catalogKind === "activities" && (
              <ActivityDocumentsAttach
                quotationId={quotationId}
                documents={Array.isArray(row.activityDocuments) ? (row.activityDocuments as Array<Record<string, string>>) : []}
                onChange={(docs) => {
                  const next = [...rows];
                  next[i] = { ...next[i], activityDocuments: docs };
                  onChange(next);
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}


function HotelDocumentsAttach({
  quotationId,
  documents,
  onChange,
}: {
  quotationId?: string | null;
  documents: Array<Record<string, string>>;
  onChange: (docs: Array<Record<string, string>>) => void;
}) {
  const { toast } = useToast();
  const kinds: Array<{ docType: string; label: string; accept: string }> = [
    { docType: "HOTEL_VOUCHER", label: "Hotel voucher", accept: ".pdf,image/jpeg,image/png" },
    { docType: "HOTEL_CONFIRMATION", label: "Booking confirmation", accept: ".pdf,image/jpeg,image/png" },
    { docType: "OTHER", label: "PDF / image", accept: ".pdf,image/jpeg,image/png" },
  ];

  if (!quotationId) {
    return (
      <p className="sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground">
        Save the draft to upload hotel voucher, confirmation, PDF, or images.
      </p>
    );
  }

  return (
    <div className="sm:col-span-2 md:col-span-3 space-y-2 rounded-lg border bg-muted/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Uploads</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {kinds.map((kind) => (
          <div key={kind.docType} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{kind.label}</Label>
            <Input
              type="file"
              accept={kind.accept}
              className="h-9 text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void api.uploadQuotationDocument(quotationId, file, {
                  docType: kind.docType,
                  visibility: "AGENT",
                  relatedEntity: "hotel",
                  description: kind.label,
                })
                  .then((res) => {
                    onChange([
                      ...documents,
                      {
                        id: res.document.id,
                        fileName: res.document.fileName,
                        docType: res.document.docType || kind.docType,
                        downloadPath: res.document.downloadPath,
                      },
                    ]);
                    toast({ title: `${kind.label} uploaded` });
                  })
                  .catch((err) => {
                    toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
                  })
                  .finally(() => {
                    e.target.value = "";
                  });
              }}
            />
          </div>
        ))}
      </div>
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, idx) => (
            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">
                {doc.docType || "DOC"} · {doc.fileName || doc.id}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => onChange(documents.filter((_, j) => j !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FlightDocumentsAttach({
  quotationId,
  documents,
  onChange,
}: {
  quotationId?: string | null;
  documents: Array<Record<string, string>>;
  onChange: (docs: Array<Record<string, string>>) => void;
}) {
  const { toast } = useToast();
  const kinds: Array<{ docType: string; label: string; accept: string }> = [
    { docType: "FLIGHT_TICKET", label: "Ticket", accept: ".pdf,image/jpeg,image/png" },
    { docType: "FLIGHT_CONFIRMATION", label: "Flight confirmation", accept: ".pdf,image/jpeg,image/png" },
    { docType: "FLIGHT_INVOICE", label: "Invoice", accept: ".pdf,image/jpeg,image/png" },
  ];

  if (!quotationId) {
    return (
      <p className="sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground">
        Save the draft to upload ticket, flight confirmation, or invoice.
      </p>
    );
  }

  return (
    <div className="sm:col-span-2 md:col-span-3 space-y-2 rounded-lg border bg-muted/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Uploads</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {kinds.map((kind) => (
          <div key={kind.docType} className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">{kind.label}</Label>
            <Input
              type="file"
              accept={kind.accept}
              className="h-9 text-xs"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void api.uploadQuotationDocument(quotationId, file, {
                  docType: kind.docType,
                  visibility: "AGENT",
                  relatedEntity: "flight",
                  description: kind.label,
                })
                  .then((res) => {
                    onChange([
                      ...documents,
                      {
                        id: res.document.id,
                        fileName: res.document.fileName,
                        docType: res.document.docType || kind.docType,
                        downloadPath: res.document.downloadPath,
                      },
                    ]);
                    toast({ title: `${kind.label} uploaded` });
                  })
                  .catch((err) => {
                    toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
                  })
                  .finally(() => {
                    e.target.value = "";
                  });
              }}
            />
          </div>
        ))}
      </div>
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, idx) => (
            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">
                {doc.docType || "DOC"} · {doc.fileName || doc.id}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => onChange(documents.filter((_, j) => j !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityDocumentsAttach({
  quotationId,
  documents,
  onChange,
}: {
  quotationId?: string | null;
  documents: Array<Record<string, string>>;
  onChange: (docs: Array<Record<string, string>>) => void;
}) {
  const { toast } = useToast();

  if (!quotationId) {
    return (
      <p className="sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground">
        Save the draft to upload an activity voucher.
      </p>
    );
  }

  return (
    <div className="sm:col-span-2 md:col-span-3 space-y-2 rounded-lg border bg-muted/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Uploads</p>
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Voucher</Label>
        <Input
          type="file"
          accept=".pdf,image/jpeg,image/png"
          className="h-9 text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            void api.uploadQuotationDocument(quotationId, file, {
              docType: "ACTIVITY_VOUCHER",
              visibility: "AGENT",
              relatedEntity: "activity",
              description: "Activity voucher",
            })
              .then((res) => {
                onChange([
                  ...documents,
                  {
                    id: res.document.id,
                    fileName: res.document.fileName,
                    docType: res.document.docType || "ACTIVITY_VOUCHER",
                    downloadPath: res.document.downloadPath,
                  },
                ]);
                toast({ title: "Activity voucher uploaded" });
              })
              .catch((err) => {
                toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
              })
              .finally(() => {
                e.target.value = "";
              });
          }}
        />
      </div>
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, idx) => (
            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">
                {doc.docType || "VOUCHER"} · {doc.fileName || doc.id}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => onChange(documents.filter((_, j) => j !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InsurancePolicyAttach({
  quotationId,
  documents,
  onChange,
}: {
  quotationId?: string | null;
  documents: Array<Record<string, string>>;
  onChange: (docs: Array<Record<string, string>>) => void;
}) {
  const { toast } = useToast();

  if (!quotationId) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Save the draft to upload the insurance policy document.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Upload policy document</p>
      <Input
        type="file"
        accept=".pdf,image/jpeg,image/png"
        className="h-9 text-xs"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void api.uploadQuotationDocument(quotationId, file, {
            docType: "INSURANCE_POLICY",
            visibility: "AGENT",
            relatedEntity: "insurance",
            description: "Insurance policy",
          })
            .then((res) => {
              onChange([
                ...documents,
                {
                  id: res.document.id,
                  fileName: res.document.fileName,
                  docType: res.document.docType || "INSURANCE_POLICY",
                  downloadPath: res.document.downloadPath,
                },
              ]);
              toast({ title: "Insurance policy uploaded" });
            })
            .catch((err) => {
              toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
            })
            .finally(() => {
              e.target.value = "";
            });
        }}
      />
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, idx) => (
            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">
                {doc.docType || "POLICY"} · {doc.fileName || doc.id}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => onChange(documents.filter((_, j) => j !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VisaDocumentAttach({
  quotationId,
  documents,
  onChange,
}: {
  quotationId?: string | null;
  documents: Array<Record<string, string>>;
  onChange: (docs: Array<Record<string, string>>) => void;
}) {
  const { toast } = useToast();

  if (!quotationId) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Save the draft to upload visa documents.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/10 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Upload visa documents</p>
      <Input
        type="file"
        accept=".pdf,image/jpeg,image/png"
        className="h-9 text-xs"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          void api.uploadQuotationDocument(quotationId, file, {
            docType: "VISA_DOCUMENT",
            visibility: "AGENT",
            relatedEntity: "visa",
            description: "Visa document",
          })
            .then((res) => {
              onChange([
                ...documents,
                {
                  id: res.document.id,
                  fileName: res.document.fileName,
                  docType: res.document.docType || "VISA_DOCUMENT",
                  downloadPath: res.document.downloadPath,
                },
              ]);
              toast({ title: "Visa document uploaded" });
            })
            .catch((err) => {
              toast({ title: err instanceof Error ? err.message : "Upload failed", variant: "destructive" });
            })
            .finally(() => {
              e.target.value = "";
            });
        }}
      />
      {documents.length > 0 && (
        <div className="space-y-1">
          {documents.map((doc, idx) => (
            <div key={`${doc.id}-${idx}`} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-muted-foreground">
                {doc.docType || "VISA"} · {doc.fileName || doc.id}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2"
                onClick={() => onChange(documents.filter((_, j) => j !== idx))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}
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
                  flightDocuments: [],
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
  destinationId,
  destination,
  open,
  onOpenChange,
  onAddSelfBooked,
  onPick,
}: {
  kind: keyof typeof CATALOG_TYPE;
  travelDate?: string;
  travelEndDate?: string;
  destinationId?: string;
  destination?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSelfBooked?: () => void;
  onPick: (item: ProductRecord, rate: { rateId: string; validFrom: string; validTo: string; contractedCost?: number; displayPrice?: number | null }) => void;
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [star, setStar] = useState("all");
  const [supplierId, setSupplierId] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const destLabel = (destination || "").trim();
  const isHotels = kind === "hotels";

  useEffect(() => {
    if (!open || !isHotels) return;
    apiFetch<{ items: Array<{ id: string; name: string }> }>("/api/suppliers?pageSize=100")
      .then((r) => setSuppliers((r.items || []).map((s) => ({ id: s.id, name: s.name }))))
      .catch(() => setSuppliers([]));
  }, [open, isHotels]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ liveOnly: "true", pageSize: isHotels ? "50" : "20" });
          if (q.trim()) params.set("q", q.trim());
          if (destinationId) params.set("destinationId", destinationId);
          else if (destLabel) params.set("city", destLabel);
          if (isHotels && star !== "all") params.set("starCategory", star);
          if (isHotels && supplierId !== "all") params.set("supplierId", supplierId);
          const res = await apiFetch<{ items: ProductRecord[] }>(`/api/products/${kind}?${params.toString()}`);
          let next = res.items || [];
          if (isHotels) {
            const min = Number(minPrice);
            const max = Number(maxPrice);
            if (Number.isFinite(min) && min > 0) next = next.filter((item) => hotelDisplayPrice(item) >= min);
            if (Number.isFinite(max) && max > 0) next = next.filter((item) => hotelDisplayPrice(item) <= max);
            if (availableOnly && travelDate && travelEndDate) {
              const checked = await Promise.all(
                next.map(async (item) => {
                  try {
                    const rooms = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
                    const firstRoom = rooms[0];
                    const availParams = new URLSearchParams({
                      checkIn: travelDate,
                      checkOut: travelEndDate,
                      rooms: "1",
                    });
                    if (firstRoom?.name) availParams.set("roomType", String(firstRoom.name));
                    const avail = await apiFetch<{ ok: boolean }>(
                      `/api/products/hotels/${item.id}/catalogue-availability?${availParams.toString()}`,
                    );
                    return avail.ok ? item : null;
                  } catch {
                    return item;
                  }
                }),
              );
              next = checked.filter(Boolean) as ProductRecord[];
            }
          }
          setItems(next);
        } catch {
          setItems([]);
        } finally {
          setLoading(false);
        }
      })();
    }, 250);
    return () => clearTimeout(t);
  }, [open, q, kind, destinationId, destLabel, star, supplierId, minPrice, maxPrice, availableOnly, travelDate, travelEndDate, isHotels]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
    }
    function onPointer(e: MouseEvent) {
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onOpenChange(false);
    }
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={panelRef}>
      <Button size="sm" variant="outline" type="button" onClick={() => onOpenChange(!open)}>
        <Search className="w-3.5 h-3.5 mr-1" /> Catalog
      </Button>
      {open && (
        <div className={cn("absolute right-0 z-20 mt-1 rounded-md border bg-popover p-2 shadow-md", isHotels ? "w-[22rem] sm:w-[28rem]" : "w-80")}>
          <div className="flex items-center gap-1 mb-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder={
                isHotels
                  ? (destLabel ? `Hotel name in ${destLabel}…` : "Search hotel name…")
                  : (destLabel ? `Search ${kind} in ${destLabel}…` : `Search ${kind}…`)
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label="Close catalog"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>

          {isHotels && (
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Destination</Label>
                <Input className="h-8 text-xs" value={destLabel || "—"} readOnly />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Star rating</Label>
                <Select value={star} onValueChange={setStar}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any</SelectItem>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}★</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-[10px] text-muted-foreground">Supplier</Label>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any supplier" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any supplier</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Min price</Label>
                <Input className="h-8 text-xs" type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Max price</Label>
                <Input className="h-8 text-xs" type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} placeholder="Any" />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-[11px] text-muted-foreground px-0.5">
                <Checkbox checked={availableOnly} onCheckedChange={(v) => setAvailableOnly(v === true)} />
                Only show available for travel dates
              </label>
            </div>
          )}

          {destLabel && !isHotels && (
            <p className="text-[10px] text-muted-foreground px-1 mb-1.5">
              Showing live {kind} for {destLabel}
            </p>
          )}
          {isHotels && destLabel && (
            <p className="text-[10px] text-muted-foreground px-1 mb-1.5">
              Hotel database · {destLabel}
              {travelDate && travelEndDate ? ` · ${travelDate} → ${travelEndDate}` : ""}
            </p>
          )}

          <div className="max-h-56 overflow-y-auto space-y-1">
            {loading && <p className="text-[11px] text-muted-foreground px-1">Loading…</p>}
            {!loading && items.length === 0 && (
              <div className="space-y-2 px-1 py-1">
                <p className="text-[11px] text-muted-foreground">
                  {destLabel ? `No live ${kind} for ${destLabel}.` : "No live products."}
                </p>
                {onAddSelfBooked && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                    onClick={() => {
                      onOpenChange(false);
                      onAddSelfBooked();
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Add self-booked instead
                  </Button>
                )}
              </div>
            )}
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
                        toast({
                          title: rate.message || NO_VALID_RATE,
                          description: `${item.name} needs an active contracted rate covering ${travelDate}. Add one under Contracted Rates, or use Add self-booked.`,
                          variant: "destructive",
                        });
                        return;
                      }
                      onPick(item, { rateId: rate.rateId, validFrom: rate.validFrom || "", validTo: rate.validTo || "", contractedCost: rate.contractedCost, displayPrice: rate.displayPrice });
                      onOpenChange(false);
                    } catch {
                      toast({ title: NO_VALID_RATE, variant: "destructive" });
                    }
                  })();
                }}
              >
                <span className="font-medium">{item.name}</span>
                {isHotels && (
                  <span className="block text-[10px] text-muted-foreground">
                    {item.starCategory ? `${item.starCategory}★` : "Unrated"}
                    {item.supplier?.name ? ` · ${item.supplier.name}` : ""}
                    {hotelDisplayPrice(item) > 0 ? ` · ${formatFullINR(hotelDisplayPrice(item))}` : ""}
                    {item.city || item.destination?.name ? ` · ${String(item.city || item.destination?.name)}` : ""}
                  </span>
                )}
                {kind === "activities" && (
                  <span className="block text-[10px] text-muted-foreground">
                    {String(item.startTime || item.operatingHours || "Timing on request")}
                    {item.closingTime ? `–${String(item.closingTime)}` : ""}
                    {item.duration ? ` · ${String(item.duration)}` : ""}
                    {item.adultPrice != null ? ` · ${formatFullINR(Number(item.adultPrice))}` : ""}
                    {item.description ? ` · ${String(item.description).slice(0, 80)}` : ""}
                  </span>
                )}
                {kind === "meals" && (
                  <span className="block text-[10px] text-muted-foreground">
                    {item.transferInclusion === "PRIVATE" ? "Private Transfer" : "No Transfer"}
                  </span>
                )}
                {!isHotels && (item.city || item.destination?.name) && (
                  <span className="text-muted-foreground"> · {String(item.city || item.destination?.name)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

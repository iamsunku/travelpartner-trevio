"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BadgeCheck, Check, ChevronDown, ChevronLeft, ChevronRight, Coffee, Copy, Crosshair, FileDown, Headphones, Home, Hotel,
  ImageIcon, Loader2, Mail, MapPin, MessageCircle, Plus, Printer, Search, ShieldCheck, Star, Trash2, X,
} from "lucide-react";
import { api, apiFetch, ApiError } from "@/lib/api";
import { mapApiQuotation, mapApiUser } from "@/lib/api-mappers";
import { useDemoDataStore } from "@/store/demo-data-store";
import { useAuthStore, useAppStore } from "@/store/app-store";
import type { ProductRecord, Quotation, QuotationPackage } from "@/types";
import { formatFullINR } from "@/components/shared/ui-helpers";
import { calcPackageCosting, resolveQuotationCosting, toCalendarDate } from "@/lib/quote-costing";
import {
  buildTripCityStayWindows,
  encodeCityStayDates,
  findStayWindowForCity,
  hotelTransferLocations as buildHotelTransferLocations,
  syncHotelRowsToTripStays,
  type HotelTransferLocation,
  type TripCityStayWindow,
} from "@/lib/quote-trip-stays";
import {
  defaultActivityDateForCity,
  isDateInCityStay,
  mergeAutoTransfers,
  suggestAutoTransfers,
} from "@/lib/quote-transfers";
import {
  applyMealCityChange,
  defaultMealDateForCity,
  hotelBreakfastDuplicationWarning,
  syncMealRowsToTripStays,
} from "@/lib/quote-meals";
import {
  syncPackageItinerary,
  formatItineraryDate,
  itemTypeLabel,
} from "@/lib/quote-itinerary-sync";
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
import { AirportSelect } from "@/components/shared/airport-select";
import { CitySelect } from "@/components/shared/city-select";
import { departureIata } from "@/lib/world-airports";
import { preloadWorldCities } from "@/lib/world-cities";
import { COUNTRIES_MASTER } from "@/lib/location-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Client Create Quote uses demonyms (e.g. Indian), not country names. */
const NATIONALITY_OPTIONS = [
  { value: "Indian", label: "Indian" },
  { value: "Singaporean", label: "Singaporean" },
  { value: "Emirati", label: "Emirati" },
  { value: "American", label: "American" },
  { value: "British", label: "British" },
  { value: "Australian", label: "Australian" },
  { value: "Malaysian", label: "Malaysian" },
  { value: "Thai", label: "Thai" },
  { value: "Sri Lankan", label: "Sri Lankan" },
  { value: "Nepali", label: "Nepali" },
  { value: "Bangladeshi", label: "Bangladeshi" },
] as const;

function nationalityDisplay(raw: string | undefined | null): string {
  const v = String(raw || "").trim();
  if (!v) return "Indian";
  if (NATIONALITY_OPTIONS.some((o) => o.value === v)) return v;
  const byCountry = COUNTRIES_MASTER.find((c) => c.name.toLowerCase() === v.toLowerCase());
  if (byCountry?.code === "IN") return "Indian";
  if (byCountry?.code === "SG") return "Singaporean";
  if (byCountry?.code === "AE") return "Emirati";
  if (byCountry?.code === "US") return "American";
  if (byCountry?.code === "GB") return "British";
  if (byCountry?.code === "AU") return "Australian";
  if (byCountry?.code === "MY") return "Malaysian";
  if (byCountry?.code === "TH") return "Thai";
  if (byCountry?.code === "LK") return "Sri Lankan";
  if (byCountry?.code === "NP") return "Nepali";
  if (byCountry?.code === "BD") return "Bangladeshi";
  return v;
}

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

/** True when itinerary is still the default stub (safe to auto-replace after hotel confirm). */
function isPlaceholderItinerary(days: unknown): boolean {
  if (!Array.isArray(days) || days.length === 0) return true;
  if (days.length !== 1) return false;
  const d = days[0] as Record<string, unknown>;
  if (d.autoFromHotel === true || d.autoSkeleton === true) return true;
  const items = Array.isArray(d.items) ? (d.items as Array<Record<string, unknown>>) : [];
  const first = items[0];
  return !String(d.city || "").trim()
    && String(first?.activityName || "").toLowerCase().includes("airport arrival");
}

/** Safe multi-service itinerary sync (Module 04A) — never wipes manual items. */
function syncItineraryFromPackage(
  existing: unknown,
  pkg: {
    hotels?: unknown;
    flights?: unknown;
    transfers?: unknown;
    activities?: unknown;
    meals?: unknown;
  },
  opts: {
    stayWindows?: TripCityStayWindow[];
    travelStartDate?: string;
  },
): Record<string, unknown>[] {
  return syncPackageItinerary(isPlaceholderItinerary(existing) ? [] : existing, {
    hotels: Array.isArray(pkg.hotels) ? (pkg.hotels as Record<string, unknown>[]) : [],
    flights: Array.isArray(pkg.flights) ? (pkg.flights as Record<string, unknown>[]) : [],
    transfers: Array.isArray(pkg.transfers) ? (pkg.transfers as Record<string, unknown>[]) : [],
    activities: Array.isArray(pkg.activities) ? (pkg.activities as Record<string, unknown>[]) : [],
    meals: Array.isArray(pkg.meals) ? (pkg.meals as Record<string, unknown>[]) : [],
    stayWindows: opts.stayWindows,
    travelStartDate: opts.travelStartDate,
  });
}

export function QuotationWizardView() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const quotationId = useAppStore((s) => s.wizardQuotationId);
  const prefill = useAppStore((s) => s.quotePrefill);
  const setWizardQuotationId = useAppStore((s) => s.setWizardQuotationId);
  const closeQuotationWizard = useAppStore((s) => s.closeQuotationWizard);
  const setQuotePrefill = useAppStore((s) => s.setQuotePrefill);
  const onClose = () => {
    setQuotePrefill(null);
    closeQuotationWizard();
  };
  const onSaved = (q: Quotation) => {
    upsertQuotation(q);
    if (q.id && q.id !== quotationId) setWizardQuotationId(q.id);
  };
  // Mounted as a full page — always active while this view is shown.
  const open = true;
  const onOpenChange = (v: boolean) => {
    if (!v) onClose();
  };
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
    salesExecutiveEmail: user?.email || "",
    salesExecutivePhone: user?.phone || "",
    destination: "",
    country: "",
    departureCity: "",
    travelStartDate: "",
    travelEndDate: "",
    adults: 2,
    children: 0,
    infants: 0,
    rooms: 1,
    hotelStarPreference: "",
    nationality: "Indian",
    landOnly: false,
    estimatedBookingDate: "",
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
  const [tripCities, setTripCities] = useState<Array<{ city: string; nights: number; order: number; destinationId?: string | null }>>([]);
  const [packages, setPackages] = useState<QuotationPackage[]>([emptyPackage("Standard", true)]);
  const [destinationId, setDestinationId] = useState("");
  const [departureDestinationId, setDepartureDestinationId] = useState("");
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
  const [agents, setAgents] = useState<Array<{
    id: string;
    name: string;
    agentCode?: string | null;
    agency?: { code?: string | null } | null;
  }>>([]);
  const [salesExecutives, setSalesExecutives] = useState<Array<{
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
  }>>([]);
  const [salesExecutiveId, setSalesExecutiveId] = useState("");

  useEffect(() => {
    if (!open) return;
    preloadWorldCities();
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
            salesExecutiveEmail: (q as { salesExecutiveEmail?: string }).salesExecutiveEmail || f.salesExecutiveEmail,
            salesExecutivePhone: (q as { salesExecutivePhone?: string }).salesExecutivePhone || f.salesExecutivePhone,
            destination: q.destination || "",
            country: q.country || "",
            departureCity: q.departureCity || "",
            travelStartDate: q.travelStartDate || "",
            travelEndDate: q.travelEndDate || q.returnDate || "",
            adults: q.adults ?? 2,
            children: q.children ?? 0,
            infants: q.infants ?? 0,
            rooms: Math.max(1, Number(q.rooms ?? 1) || 1),
            hotelStarPreference: q.hotelStarPreference || "",
            nationality: nationalityDisplay(q.nationality || f.nationality),
            landOnly: Boolean(q.landOnly),
            estimatedBookingDate: q.estimatedBookingDate || "",
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
          const cities = Array.isArray(q.tripCities) ? q.tripCities : [];
          setTripCities(
            cities.length
              ? cities
                  .map((c, i) => ({
                    city: String(c.city || ""),
                    nights: Math.max(1, Number(c.nights) || 1),
                    order: Number(c.order) > 0 ? Number(c.order) : i + 1,
                    destinationId: c.destinationId ?? null,
                  }))
                  .filter((c) => c.city)
              : [{ city: "", nights: 1, order: 1, destinationId: null }],
          );
          if (q.packages?.length) setPackages(q.packages as QuotationPackage[]);
        })
        .catch(() => toast({ title: "Failed to load quote", variant: "destructive" }))
        .finally(() => setBusy(false));
    } else {
      setId(null);
      setQuoteNo("");
      setStep(0);
      setPackages([emptyPackage("Standard", true)]);
      setTripCities([{ city: "", nights: 1, order: 1, destinationId: null }]);
      setDestinationId("");
      setDepartureDestinationId("");
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
      if (prefill) {
        // Clear after apply so returning to Quotations does not reopen the wizard.
        queueMicrotask(() => setQuotePrefill(null));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- apply prefill only when opening / switching quote id
  }, [open, quotationId, toast, setQuotePrefill]);

  useEffect(() => {
    if (!open || !user || quotationId) return;
    setForm((f) => ({
      ...f,
      agentName: f.agentName || user.name || user.email || "",
      agentId: f.agentId || user.id || "",
      agentCode: user.agentCode || f.agentCode || "",
      agencyCode: user.agencyCode || f.agencyCode || "",
      salesExecutiveName: f.salesExecutiveName || user.name || user.email || "",
      salesExecutiveEmail: f.salesExecutiveEmail || user.email || "",
      salesExecutivePhone: f.salesExecutivePhone || user.phone || "",
    }));
    if (user.id) setSalesExecutiveId((id) => id || user.id);
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
      .then((res) => {
        const list = res.agents || [];
        setAgents(list);
        setForm((f) => {
          if (f.agencyCode) return f;
          const fromUser = user?.agencyCode || "";
          if (fromUser) return { ...f, agencyCode: fromUser };
          const picked = list.find((a) => a.id === f.agentId);
          const code = picked?.agency?.code || "";
          return code ? { ...f, agencyCode: code } : f;
        });
      })
      .catch(() => setAgents([]));
    api.getSalesExecutives()
      .then((res) => {
        const list = res.salesExecutives || [];
        setSalesExecutives(list);
        setSalesExecutiveId((current) => {
          if (current) return current;
          const byEmail = list.find((s) => s.email && s.email === form.salesExecutiveEmail);
          if (byEmail) return byEmail.id;
          const byName = list.find((s) => s.name && s.name === form.salesExecutiveName);
          if (byName) return byName.id;
          return user?.id || "";
        });
      })
      .catch(() => setSalesExecutives([]));
  }, [open]);

  const nights = useMemo(() => {
    const cityNights = tripCities.reduce((s, c) => s + Math.max(0, Number(c.nights) || 0), 0);
    if (tripCities.length > 0 && cityNights > 0) return cityNights;
    if (!form.travelStartDate || !form.travelEndDate) return null;
    const a = new Date(form.travelStartDate);
    const b = new Date(form.travelEndDate);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }, [form.travelStartDate, form.travelEndDate, tripCities]);
  const tripDays = nights != null ? nights + 1 : null;

  // Keep travel end date in sync with Basic Details travel start + trip-city nights.
  useEffect(() => {
    const start = form.travelStartDate;
    if (!start) return;
    const cityNights = tripCities.reduce((s, c) => s + Math.max(0, Number(c.nights) || 0), 0);
    if (cityNights <= 0) return;
    const nextEnd = addDaysYmd(start, cityNights);
    if (!nextEnd || form.travelEndDate === nextEnd) return;
    setForm((f) => (f.travelEndDate === nextEnd ? f : { ...f, travelEndDate: nextEnd }));
  }, [form.travelStartDate, form.travelEndDate, tripCities]);

  const stayWindows = useMemo(
    () => buildTripCityStayWindows(tripCities, form.travelStartDate || ""),
    [tripCities, form.travelStartDate],
  );
  const stayWindowsKey = stayWindows.map((w) => `${w.city}:${w.checkIn}:${w.checkOut}:${w.nights}`).join("|");

  // Recalculate hotel stay dates + meal stay sync + itinerary when Trip Plan nights/order change.
  useEffect(() => {
    if (!stayWindows.length) return;
    setPackages((prev) =>
      prev.map((pkg) => {
        const hotels = Array.isArray(pkg.hotels) ? (pkg.hotels as Record<string, unknown>[]) : [];
        const nextHotels = hotels.length ? syncHotelRowsToTripStays(hotels, stayWindows) : hotels;
        const hotelsChanged = nextHotels.some((h, i) => {
          const prevRow = hotels[i] || {};
          return (
            String(h.checkIn || "") !== String(prevRow.checkIn || "")
            || String(h.checkOut || "") !== String(prevRow.checkOut || "")
            || String(h.nights ?? "") !== String(prevRow.nights ?? "")
            || String(h.tripCity || "") !== String(prevRow.tripCity || "")
          );
        });
        const meals = Array.isArray(pkg.meals) ? (pkg.meals as Record<string, unknown>[]) : [];
        const nextMeals = meals.length ? syncMealRowsToTripStays(meals, stayWindows) : meals;
        const mealsChanged = nextMeals.some((m, i) => {
          const prevRow = meals[i] || {};
          return (
            String(m.date || "") !== String(prevRow.date || "")
            || Boolean(m.dateInvalid) !== Boolean(prevRow.dateInvalid)
            || Boolean(m.cityOrphan) !== Boolean(prevRow.cityOrphan)
            || String(m.dateInvalidReason || "") !== String(prevRow.dateInvalidReason || "")
            || String(m.cityOrphanReason || "") !== String(prevRow.cityOrphanReason || "")
          );
        });
        const nextPkg = {
          ...pkg,
          ...(hotelsChanged ? { hotels: nextHotels } : {}),
          ...(mealsChanged ? { meals: nextMeals } : {}),
        };
        const itinerary = syncItineraryFromPackage(nextPkg.itinerary, nextPkg, {
          stayWindows,
          travelStartDate: form.travelStartDate,
        });
        return { ...nextPkg, itinerary };
      }),
    );
  // form.travelStartDate included via stayWindowsKey when start changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stayWindowsKey]);

  const selected = packages.find((p) => p.isSelected) || packages[0];
  const hotelTransferLocations = useMemo(
    () => buildHotelTransferLocations(selected?.hotels),
    [selected?.hotels],
  );

  const tripPaxTotal = Math.max(1, Number(form.adults || 0) + Number(form.children || 0) || 1);

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
      else {
        const cityNights = tripCities.reduce((s, c) => s + Math.max(0, Number(c.nights) || 0), 0);
        const nightsToUse = cityNights > 0 ? cityNights : (suggestedNights || 0);
        if (v && !end && nightsToUse > 0) {
          end = addDaysYmd(v, nightsToUse);
        }
      }
      return { ...f, travelStartDate: v, travelEndDate: end };
    });
  }

  async function persist(nextStep = step, opts?: { submitApproval?: boolean; approveNow?: boolean; financeApprovalRequired?: boolean }) {
    const hasTripPlan = tripCities.some((c) => c.city.trim() && Number(c.nights) > 0);
    if (!form.customerName.trim() || (!form.destination.trim() && !hasTripPlan)) {
      toast({ title: "Customer and destination (or trip cities) are required", variant: "destructive" });
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
      const normalizedTripCities = tripCities
        .filter((c) => c.city.trim() && Number(c.nights) > 0)
        .map((c, i) => ({
          city: c.city.trim(),
          nights: Math.max(1, Number(c.nights) || 1),
          order: i + 1,
          destinationId: c.destinationId || null,
        }));
      const payload = {
        ...form,
        adults: Number(form.adults) || 2,
        children: Number(form.children) || 0,
        infants: Number(form.infants) || 0,
        rooms: Math.max(1, Number(form.rooms) || 1),
        hotelStarPreference: form.hotelStarPreference || undefined,
        nationality: form.nationality || undefined,
        landOnly: Boolean(form.landOnly),
        estimatedBookingDate: form.estimatedBookingDate || null,
        departureCity: form.departureCity || undefined,
        tripCities: normalizedTripCities,
        nights: nights ?? undefined,
        days: tripDays ?? undefined,
        travelDates: form.travelStartDate,
        destination: normalizedTripCities.length
          ? normalizedTripCities.map((c) => c.city).join(" · ")
          : form.destination,
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
        setWizardQuotationId(quotation.id);
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
      let approveReady = false;
      if (approveNow && quotation.id) {
        const approved = await api.approveQuotation(quotation.id, { stage: "Team Lead" });
        quotation = mapApiQuotation(approved.quotation);
        approveReady = Boolean(approved.readyToSend) || quotation.approvalStatus === "Approved";
      }
      upsertQuotation(quotation);
      if (quotation.packages?.length) setPackages(quotation.packages);
      if (Array.isArray(quotation.tripCities)) {
        setTripCities(
          quotation.tripCities
            .map((c, i) => ({
              city: String(c.city || ""),
              nights: Math.max(1, Number(c.nights) || 1),
              order: Number(c.order) > 0 ? Number(c.order) : i + 1,
              destinationId: c.destinationId ?? null,
            }))
            .filter((c) => c.city),
        );
      }
      onSaved(quotation);
      const disc = latestDiscountApproval(quotation.approvals);
      const discountNote = disc?.status === "Pending"
        ? " · Discount approval requested"
        : disc?.status === "Approved" && discountRequiresApproval("sales_executive", form.discountType || null, form.discountValue)
          ? " · Discount approved"
          : "";
      toast({
        title: approveNow
          ? (approveReady ? "Approved & ready to send" : "Approval incomplete")
          : submitApproval
            ? "Submitted for approval"
            : "Draft saved",
        description: approveNow && !approveReady
          ? `${quotation.quoteNo} — complete Team Lead / Finance approval or fix discount before sending.`
          : `${quotation.quoteNo}${discountNote}`,
        variant: approveNow && !approveReady ? "destructive" : "default",
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
    let target = Math.min(step + 1, STEPS.length - 1);
    if (form.landOnly && target === 2) target = 3;
    const q = await persist(target);
    if (q) setStep(target);
  }

  async function back() {
    let target = Math.max(step - 1, 0);
    if (form.landOnly && target === 2) target = 1;
    await persist(target);
    setStep(target);
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
    const hasTripPlan = tripCities.some((c) => c.city.trim() && Number(c.nights) > 0);
    if (!form.customerName.trim() || (!form.destination.trim() && !hasTripPlan)) {
      toast({ title: "Customer and destination (or trip cities) are required", variant: "destructive" });
      return null;
    }
    const saved = await persist(step);
    if (!saved?.id) {
      toast({ title: "Save the draft first", description: "Email and WhatsApp need a saved quotation.", variant: "destructive" });
      return null;
    }
    return { ...buildReviewQuote(saved.id), ...saved, id: saved.id, quoteNo: saved.quoteNo || quoteNo || "DRAFT" };
  }

  const hotelTripCities = useMemo(
    () => tripCities.map((c) => c.city.trim()).filter(Boolean),
    [tripCities],
  );

  const progressPct = Math.round(((step + 1) / STEPS.length) * 100);

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 mb-[-1.5rem] sm:mb-[-2rem] lg:mb-[-2rem] min-h-[calc(100vh-3.5rem)] flex flex-col bg-background border-y border-border/60">
        <header className="px-4 sm:px-6 lg:px-8 pt-4 pb-3 border-b shrink-0 space-y-3 bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 mt-0.5"
                onClick={onClose}
              >
                <ChevronLeft className="w-4 h-4 mr-0.5" /> Quotations
              </Button>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
                  {quoteNo || "New quotation"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {STEPS[step].label}
                  {nights != null ? ` · ${nights}N / ${tripDays}D` : ""}
                  {" · "}
                  Step {step + 1} of {STEPS.length}
                </p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground tabular-nums text-sm">{formatFullINR(liveCosting.total)}</p>
              <p>Live total · {liveCosting.profitMargin}% margin</p>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </header>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          <nav className="hidden md:flex w-56 shrink-0 flex-col gap-4 border-r bg-muted/20 p-3 overflow-y-auto">
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
                      onClick={() => {
                        if (form.landOnly && i === 2) {
                          toast({
                            title: "Land-only package",
                            description: "Flights step is skipped. Change Basic Details to Air + Land to edit flights.",
                          });
                          return;
                        }
                        setStep(i);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                        active && "bg-teal-600 text-white shadow-sm",
                        done && !active && "text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/40",
                        !done && !active && "text-muted-foreground hover:bg-muted hover:text-foreground",
                        form.landOnly && i === 2 && "opacity-50",
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
                    onClick={() => {
                      if (form.landOnly && i === 2) {
                        toast({
                          title: "Land-only package",
                          description: "Flights step is skipped. Change Basic Details to Air + Land to edit flights.",
                        });
                        return;
                      }
                      setStep(i);
                    }}
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs whitespace-nowrap",
                      i === step ? "bg-teal-600 text-white" : i < step ? "bg-teal-100 text-teal-800" : "bg-muted text-muted-foreground",
                      form.landOnly && i === 2 && "opacity-50",
                    )}
                  >
                    {i + 1}. {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div
              className={cn(
                "flex-1 min-h-0 px-4 sm:px-6 lg:px-8",
                step === 1
                  ? "overflow-y-auto py-3"
                  : "overflow-y-auto py-5 space-y-4",
              )}
            >
        {step === 0 && (
          <div className="space-y-4 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Name" value={form.customerName} onChange={(v) => setForm({ ...form, customerName: v, contactPerson: form.contactPerson || v })} />
                <Field label="Email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} />

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Leaving Airport</Label>
                  <AirportSelect
                    value={form.departureCity}
                    onChange={(v) => {
                      setDepartureDestinationId("");
                      setForm((f) => ({ ...f, departureCity: v }));
                    }}
                    placeholder="Select leaving airport…"
                    className="h-10 w-full"
                  />
                </div>
                <Field label="Travel Date" type="date" value={form.travelStartDate} onChange={onStartDateChange} />

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Rooms / travellers</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="h-10 w-full justify-between font-normal">
                        <span className="truncate uppercase tracking-wide text-xs sm:text-sm">
                          {form.rooms} ROOM{form.rooms === 1 ? "" : "S"}, {form.adults} ADULT{form.adults === 1 ? "" : "S"}, {form.children} CHILD{form.children === 1 ? "" : "REN"}
                        </span>
                        <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 space-y-3" align="start" side="bottom" avoidCollisions={false}>
                      {[
                        { key: "rooms" as const, label: "Rooms", min: 1 },
                        { key: "adults" as const, label: "Adults", min: 1 },
                        { key: "children" as const, label: "Children", min: 0 },
                      ].map((row) => (
                        <div key={row.key} className="flex items-center justify-between gap-3">
                          <span className="text-sm">{row.label}</span>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setForm((f) => ({
                                ...f,
                                [row.key]: Math.max(row.min, Number(f[row.key]) - 1),
                              }))}
                            >
                              −
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{form[row.key]}</span>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => setForm((f) => ({
                                ...f,
                                [row.key]: Math.max(row.min, Number(f[row.key]) + 1),
                              }))}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                      ))}
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Hotel Star Rating</Label>
                  <Select
                    value={form.hotelStarPreference || "all"}
                    onValueChange={(v) => setForm({ ...form, hotelStarPreference: v === "all" ? "" : v })}
                  >
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="---Select All---" /></SelectTrigger>
                    <SelectContent side="bottom" avoidCollisions={false}>
                      <SelectItem value="all">---Select All---</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="7">7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <p className="text-sm font-semibold">Trip Plan City Wise</p>
                <div className="grid grid-cols-[1fr_100px_36px] gap-2 text-xs text-muted-foreground px-0.5">
                  <span>City</span>
                  <span>Night</span>
                  <span />
                </div>
                {tripCities.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_36px] gap-2 items-start">
                    <CitySelect
                      value={row.city}
                      onChange={(cityName, city) => {
                        setTripCities((prev) => {
                          const next = prev.map((c, i) => (
                            i === idx
                              ? { ...c, city: cityName, destinationId: null }
                              : c
                          ));
                          const label = next.map((c) => c.city.trim()).filter(Boolean).join(" · ");
                          setForm((f) => ({
                            ...f,
                            destination: label || f.destination,
                            country: city?.country || f.country,
                            isInternational: city?.country
                              ? !["india"].includes(city.country.trim().toLowerCase())
                              : f.isInternational,
                          }));
                          return next;
                        });
                      }}
                      placeholder="Select City"
                    />
                    <Input
                      className="h-10"
                      type="number"
                      min={1}
                      value={row.nights}
                      onChange={(e) => setTripCities((prev) => prev.map((c, i) => (
                        i === idx ? { ...c, nights: Math.max(1, Number(e.target.value) || 1) } : c
                      )))}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-10 w-9"
                      disabled={tripCities.length <= 1}
                      onClick={() => setTripCities((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <button
                  type="button"
                  className="text-sm text-sky-600 hover:text-sky-700 font-medium"
                  onClick={() => setTripCities((prev) => [...prev, { city: "", nights: 1, order: prev.length + 1, destinationId: null }])}
                >
                  + Add new city
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Nationality</Label>
                  <Select
                    value={nationalityDisplay(form.nationality)}
                    onValueChange={(v) => setForm({ ...form, nationality: v })}
                  >
                    <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Nationality" /></SelectTrigger>
                    <SelectContent side="bottom" avoidCollisions={false}>
                      {NATIONALITY_OPTIONS.map((n) => (
                        <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Land Only</Label>
                  <div className="flex items-center gap-5 h-10">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="landOnly"
                        checked={form.landOnly === true}
                        onChange={() => setForm({ ...form, landOnly: true })}
                      />
                      Yes
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="landOnly"
                        checked={form.landOnly === false}
                        onChange={() => setForm({ ...form, landOnly: false })}
                      />
                      No
                    </label>
                  </div>
                </div>
                <Field
                  label="Estimated Booking Date"
                  type="date"
                  value={form.estimatedBookingDate}
                  onChange={(v) => setForm({ ...form, estimatedBookingDate: v })}
                />

                <div className="space-y-1.5 min-w-0">
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
                            agencyCode: user?.agencyCode || form.agencyCode,
                          });
                          return;
                        }
                        const picked = agents.find((a) => a.id === v);
                        setForm({
                          ...form,
                          agentId: v,
                          agentName: picked?.name || "",
                          agentCode: picked?.agentCode || "",
                          agencyCode: picked?.agency?.code || user?.agencyCode || form.agencyCode,
                        });
                      }}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue placeholder="Select travel agent" className="truncate" />
                      </SelectTrigger>
                      <SelectContent side="bottom" avoidCollisions={false}>
                        <SelectItem value="self">{user?.name || "Current user"}{user?.agentCode ? ` · ${user.agentCode}` : ""}</SelectItem>
                        {agents.filter((a) => a.id !== user?.id).map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}{a.agentCode ? ` · ${a.agentCode}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input className="h-10 w-full" value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} />
                  )}
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Sales executive</Label>
                  <Select
                    value={!salesExecutiveId || salesExecutiveId === user?.id ? "self" : salesExecutiveId}
                    onValueChange={(v) => {
                      if (v === "self") {
                        setSalesExecutiveId(user?.id || "");
                        setForm({
                          ...form,
                          salesExecutiveName: user?.name || user?.email || form.salesExecutiveName,
                          salesExecutiveEmail: user?.email || form.salesExecutiveEmail,
                          salesExecutivePhone: user?.phone || form.salesExecutivePhone,
                        });
                        return;
                      }
                      const picked = salesExecutives.find((s) => s.id === v);
                      setSalesExecutiveId(v);
                      setForm({
                        ...form,
                        salesExecutiveName: picked?.name || "",
                        salesExecutiveEmail: picked?.email || "",
                        salesExecutivePhone: picked?.phone || "",
                      });
                    }}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="Select sales executive" className="truncate" />
                    </SelectTrigger>
                    <SelectContent side="bottom" avoidCollisions={false}>
                      <SelectItem value="self">{user?.name || "Current user"}</SelectItem>
                      {salesExecutives.filter((s) => s.id !== user?.id).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}{s.email ? ` · ${s.email}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Agency code</Label>
                  <Input className="h-10 w-full bg-muted/40 font-mono" value={form.agencyCode || "—"} readOnly />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <Label className="text-sm font-medium">Agent code</Label>
                  <Input className="h-10 w-full bg-muted/40 font-mono" value={form.agentCode || "—"} readOnly />
                </div>
              </div>
          </div>
        )}

        {step === 1 && (
          <ServiceEditor
            title="Hotels"
            rows={(selected?.hotels || []) as Record<string, unknown>[]}
            fields={["hotelName", "starCategory", "roomType", "mealPlan", "checkIn", "checkOut", "nights", "rooms", "address", "city", "supplier", "confirmationNo", "contactPerson", "contactPhone", "contactEmail", "costPrice", "sellingPrice", "markup", "remarks", "imageUrl"]}
            selfBookedFields={["hotelName", "address", "city"]}
            onChange={(rows) => patchSelected({
              hotels: rows,
              itinerary: syncItineraryFromPackage(selected?.itinerary, { ...selected, hotels: rows }, {
                stayWindows,
                travelStartDate: form.travelStartDate,
              }),
            })}
            onHotelAdded={(hotels) => {
              const patch: Partial<QuotationPackage> = { hotels };
              patch.itinerary = syncItineraryFromPackage(selected?.itinerary, {
                ...selected,
                hotels,
              }, {
                stayWindows,
                travelStartDate: form.travelStartDate,
              });
              patchSelected(patch);
              setStep(3); // Day-wise Itinerary
              toast({
                title: "Hotel added",
                description: "Itinerary days were synchronized from your hotel stay. Manual notes were preserved.",
              });
            }}
            template={{
              lineId: "",
              hotelName: "",
              address: "",
              city: stayWindows[0]?.city || tripCities[0]?.city || form.destination || "",
              tripCity: stayWindows[0]?.city || tripCities[0]?.city || "",
              checkIn: stayWindows[0]?.checkIn || form.travelStartDate || "",
              checkOut: stayWindows[0]?.checkOut || form.travelEndDate || "",
              checkInTime: "14:00",
              checkOutTime: "11:00",
              nights: stayWindows[0]?.nights ?? nights ?? "",
              rooms: Math.max(1, form.rooms || 1),
              remarks: "",
              source: "MANUAL",
              selfBooked: true,
              productType: "HOTEL",
              hotelDocuments: [],
            }}
            catalogKind="hotels"
            travelDate={form.travelStartDate}
            travelEndDate={
              form.travelEndDate
              || (form.travelStartDate && nights != null && nights > 0
                ? addDaysYmd(form.travelStartDate, nights)
                : "")
            }
            destinationId={destinationId || tripCities[0]?.destinationId || ""}
            destination={tripCities[0]?.city || form.destination}
            tripCities={hotelTripCities}
            stayWindows={stayWindows}
            initialStar={form.hotelStarPreference || undefined}
            defaultRooms={Math.max(1, form.rooms || 1)}
            catalogToRow={(item, room) => hotelFromCatalog(item, Math.max(1, form.rooms || 1), room)}
          />
        )}

        {step === 2 && !form.landOnly && (
          <ServiceEditor
            title="Flights"
            rows={(selected?.flights || []) as Record<string, unknown>[]}
            fields={[
              "airline", "airlineCode", "flightNumber", "from", "to", "date", "arrivalDate",
              "depTime", "arrTime", "duration", "stops", "baggage", "cabinClass", "currency",
              "pnr", "remarks", "costPrice", "sellingPrice", "fare",
            ]}
            onChange={(rows) => {
              const withMeta = rows.map((row, i) => ({
                ...row,
                segmentIndex: row.segmentIndex != null ? row.segmentIndex : i,
                adults: row.adults != null ? row.adults : form.adults,
                children: row.children != null ? row.children : form.children,
                infants: row.infants != null ? row.infants : form.infants,
              }));
              patchSelected({
                flights: withMeta,
                itinerary: syncItineraryFromPackage(selected?.itinerary, {
                  ...selected,
                  flights: withMeta,
                }, {
                  stayWindows,
                  travelStartDate: form.travelStartDate,
                }),
              });
            }}
            template={{
              airline: "",
              airlineCode: "",
              flightNumber: "",
              from: departureIata(form.departureCity) || "",
              to: "",
              date: "",
              arrivalDate: "",
              cabinClass: "Economy",
              currency: form.currency || "INR",
              duration: "",
              stops: 0,
              baggage: "",
              remarks: "",
              pnr: "",
              source: "MANUAL",
              selfBooked: true,
              flightDocuments: [],
              adults: form.adults,
              children: form.children,
              infants: form.infants,
            }}
            catalogKind="flights"
            travelDate={form.travelStartDate}
            travelEndDate={form.travelEndDate}
            destinationId={destinationId}
            destination={form.destination}
            defaultFlightFrom={departureIata(form.departureCity) || undefined}
            defaultFlightTo={departureIata(form.destination) || undefined}
            flightAdults={form.adults}
            flightChildren={form.children}
            flightInfants={form.infants}
            tripCities={hotelTripCities}
            quotationId={id}
            catalogToRow={(item) => ({
              productId: item.id,
              productType: "FLIGHT",
              source: "CONTRACTED_PRODUCT",
              airline: String(item.airline || item.name || ""),
              airlineCode: String(item.airlineCode || ""),
              flightNumber: String(item.flightNumber || ""),
              from: String(item.origin || departureIata(form.departureCity) || ""),
              to: String(item.destinationAirport || ""),
              cabinClass: String(item.cabinClass || "Economy"),
              depTime: String(item.departureTime || ""),
              arrTime: String(item.arrivalTime || ""),
              duration: String(item.duration || ""),
              baggage: String(item.baggage || ""),
              currency: String(item.currency || form.currency || "INR"),
              // Segment date left blank — user sets intended flight date (not forced to trip start).
              date: "",
              arrivalDate: "",
              stops: Number(item.stops || 0),
              flightDocuments: [],
              adults: form.adults,
              children: form.children,
              infants: form.infants,
            })}
          />
        )}
        {step === 2 && form.landOnly && (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-10 text-center space-y-2">
            <p className="text-sm font-semibold">Land-only package</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Flights are skipped because this quotation is marked land-only in Basic Details.
              Switch to Air + Land to add catalogue, API, or self-booked flights.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex justify-between items-start gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold">Day-wise Itinerary</p>
                <p className="text-[11px] text-muted-foreground">
                  Days sync from hotels, flights, transfers, activities, and meals. Manual notes and days are preserved when services change.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const itinerary = syncItineraryFromPackage(selected?.itinerary, selected || {}, {
                      stayWindows,
                      travelStartDate: form.travelStartDate,
                    });
                    patchSelected({ itinerary });
                    toast({ title: "Itinerary regenerated", description: "Auto services refreshed. Manual items kept." });
                  }}
                >
                  Regenerate itinerary
                </Button>
                <Button size="sm" variant="outline" disabled={!selected?.itinerary?.length} onClick={() => {
                  const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                  if (!days.length) return;
                  const prev = JSON.parse(JSON.stringify(days[days.length - 1])) as Record<string, unknown>;
                  const copiedItems = (Array.isArray(prev.items) ? prev.items as Record<string, unknown>[] : []).map((it) => {
                    const next = { ...it };
                    delete next.autoFromHotel;
                    delete next.autoFromFlight;
                    delete next.autoFromTransfer;
                    delete next.autoFromActivity;
                    delete next.autoFromMeal;
                    delete next.sourceKey;
                    delete next.hotelLineId;
                    delete next.flightLineId;
                    delete next.transferLineId;
                    delete next.activityLineId;
                    delete next.mealLineId;
                    next.itemType = "MANUAL";
                    return next;
                  });
                  days.push({
                    ...prev,
                    day: days.length + 1,
                    title: `Day ${days.length + 1}`,
                    manualDay: true,
                    autoSkeleton: false,
                    autoFromHotel: false,
                    autoFromFlightDay: false,
                    titleLocked: true,
                    items: copiedItems,
                  });
                  patchSelected({ itinerary: days });
                }}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy previous day
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                  days.push({
                    day: days.length + 1,
                    title: `Day ${days.length + 1}`,
                    city: "",
                    date: "",
                    mealPlan: "",
                    coverImage: "",
                    gallery: [],
                    manualDay: true,
                    titleLocked: true,
                    items: [{ activityName: "Leisure", description: "", itemType: "MANUAL" }],
                  });
                  patchSelected({ itinerary: days });
                }}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Day
                </Button>
              </div>
            </div>
            {((selected?.itinerary || []) as Array<Record<string, unknown>>).map((day, di) => (
              <div key={di} className="border rounded-lg p-3 space-y-2">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Day {di + 1}
                      {day.date ? ` · ${formatItineraryDate(String(day.date))}` : ""}
                      {day.city ? ` · ${String(day.city)}` : ""}
                    </p>
                    <Input
                      className="h-8"
                      value={String(day.title || `Day ${di + 1}`)}
                      onChange={(e) => {
                        const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                        days[di] = { ...days[di], title: e.target.value, day: di + 1, titleLocked: true };
                        patchSelected({ itinerary: days });
                      }}
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const days = ((selected?.itinerary || []) as Array<Record<string, unknown>>).filter((_, i) => i !== di);
                    patchSelected({ itinerary: days });
                  }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  <Field
                    label="Date"
                    type="date"
                    value={toCalendarDate(String(day.date || "")) || ""}
                    onChange={(v) => {
                      const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                      days[di] = { ...days[di], date: toCalendarDate(v) || v, titleLocked: true };
                      patchSelected({ itinerary: days });
                    }}
                  />
                  <Field
                    label="City / place"
                    value={String(day.city || "")}
                    onChange={(v) => {
                      const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                      days[di] = { ...days[di], city: v, titleLocked: true };
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
                  placeholder="Item names (one per line — operational fields below)"
                  value={Array.isArray(day.items) ? (day.items as Array<{ activityName?: string }>).map((i) => i.activityName || "").join("\n") : ""}
                  onChange={(e) => {
                    const days = [...(selected?.itinerary || [])] as Array<Record<string, unknown>>;
                    const prevItems = Array.isArray(days[di].items) ? (days[di].items as Array<Record<string, unknown>>) : [];
                    const lines = e.target.value.split("\n").filter(Boolean);
                    days[di] = {
                      ...days[di],
                      items: lines.map((line, li) => {
                        const prev = prevItems[li] || {};
                        const isAuto = Boolean(
                          prev.autoFromHotel || prev.autoFromFlight || prev.autoFromTransfer
                          || prev.autoFromActivity || prev.autoFromMeal,
                        );
                        return {
                          ...prev,
                          activityName: line,
                          description: String(prev.description || line),
                          ...(isAuto ? {} : { itemType: prev.itemType || "MANUAL" }),
                        };
                      }),
                    };
                    patchSelected({ itinerary: days });
                  }}
                />
                {Array.isArray(day.items) && (day.items as Array<Record<string, unknown>>).map((item, ii) => (
                  <div key={ii} className="grid grid-cols-2 md:grid-cols-3 gap-2 rounded-md border bg-muted/20 p-2">
                    <div className="col-span-2 md:col-span-3 flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                        {itemTypeLabel(item.itemType)}
                      </span>
                      <p className="text-[10px] font-medium text-muted-foreground truncate">
                        {String(item.activityName || `Item ${ii + 1}`)}
                      </p>
                    </div>
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
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                type="button"
                onClick={() => {
                  const suggestions = suggestAutoTransfers({
                    stayWindows,
                    hotels: selected?.hotels,
                    pax: tripPaxTotal,
                    currency: form.currency || undefined,
                  });
                  if (!suggestions.length) {
                    toast({
                      title: "No transfer routes suggested",
                      description: "Add hotels for each trip city first. Airport ends stay blank until you fill them.",
                    });
                    return;
                  }
                  const merged = mergeAutoTransfers(
                    (selected?.transfers || []) as Record<string, unknown>[],
                    suggestions,
                  );
                  const added = merged.length - ((selected?.transfers || []) as unknown[]).length;
                  patchSelected({
                    transfers: merged,
                    itinerary: syncItineraryFromPackage(selected?.itinerary, { ...selected, transfers: merged }, {
                      stayWindows,
                      travelStartDate: form.travelStartDate,
                    }),
                  });
                  toast({
                    title: added > 0 ? `Added ${added} transfer route(s)` : "Routes already present",
                    description: "Arrival, intercity, and departure suggestions use hotel endpoints only. No prices invented.",
                  });
                }}
              >
                Suggest transfer routes
              </Button>
            </div>
            <ServiceEditor
              title="Transfers"
              rows={(selected?.transfers || []) as Record<string, unknown>[]}
              fields={[
                "transferType", "date", "pickupTime", "pickup", "drop", "vehicleType", "pax", "duration",
                "currency", "voucher", "remarks", "supplier", "costPrice", "sellingPrice",
              ]}
              onChange={(rows) => patchSelected({
                transfers: rows,
                itinerary: syncItineraryFromPackage(selected?.itinerary, { ...selected, transfers: rows }, {
                  stayWindows,
                  travelStartDate: form.travelStartDate,
                }),
              })}
              template={{
                transferType: "Airport Pickup",
                vehicleType: "Sedan",
                pickup: "",
                drop: "",
                date: stayWindows[0]?.checkIn || "",
                pickupTime: "",
                pax: tripPaxTotal,
                duration: "",
                currency: form.currency || "",
                voucher: "",
                remarks: "",
                supplier: "",
                source: "MANUAL",
                selfBooked: true,
              }}
              catalogKind="transfers"
              travelDate={form.travelStartDate}
              destinationId={destinationId}
              destination={form.destination}
              quotationId={id}
              tripCities={hotelTripCities}
              stayWindows={stayWindows}
              flightAdults={form.adults}
              flightChildren={form.children}
              hotelTransferLocations={hotelTransferLocations}
              catalogToRow={(item) => {
                const city = stayWindows.length === 1 ? stayWindows[0].city : "";
                const date = stayWindows.length === 1 ? stayWindows[0].checkIn : "";
                return {
                  productId: item.id,
                  productType: "TRANSFER",
                  source: "CONTRACTED_PRODUCT",
                  selfBooked: false,
                  transferType: String(item.transferType || item.name || "Airport Pickup"),
                  vehicleType: String(item.vehicleType || "Sedan"),
                  pickup: String(item.pickupLocation || ""),
                  drop: String(item.dropLocation || ""),
                  date,
                  city,
                  pickupTime: String((item as ProductRecord & { pickupTime?: string }).pickupTime || ""),
                  pax: tripPaxTotal,
                  duration: String((item as ProductRecord & { duration?: string }).duration || ""),
                  currency: form.currency || "",
                  voucher: "",
                  remarks: "",
                  sellingPrice: Number(item.privatePrice ?? item.sharedPrice ?? 0),
                  costPrice: 0,
                  supplier: item.supplier?.name || "",
                };
              }}
            />
            <ServiceEditor
              title="Activities"
              rows={(selected?.activities || []) as Record<string, unknown>[]}
              fields={[
                "activityCategory", "activityName", "city", "description", "date", "duration", "timeSlot",
                "ticketType", "adultRate", "childRate", "adults", "children", "voucher", "remarks",
                "supplier", "imageUrl", "costPrice", "sellingPrice",
              ]}
              onChange={(rows) => patchSelected({
                activities: rows,
                itinerary: syncItineraryFromPackage(selected?.itinerary, { ...selected, activities: rows }, {
                  stayWindows,
                  travelStartDate: form.travelStartDate,
                }),
              })}
              template={{
                activityCategory: "Attraction",
                activityName: "",
                description: "",
                city: stayWindows.length === 1 ? stayWindows[0].city : "",
                date: stayWindows.length === 1
                  ? defaultActivityDateForCity(stayWindows, stayWindows[0].city)
                  : "",
                timeSlot: "",
                duration: "",
                ticketType: "Standard",
                adults: form.adults,
                children: form.children,
                supplier: "",
                imageUrl: "",
                voucher: "",
                remarks: "",
                source: "MANUAL",
                selfBooked: true,
                activityDocuments: [],
              }}
              catalogKind="activities"
              travelDate={form.travelStartDate}
              destinationId={destinationId}
              destination={form.destination}
              quotationId={id}
              tripCities={hotelTripCities}
              stayWindows={stayWindows}
              flightAdults={form.adults}
              flightChildren={form.children}
              catalogToRow={(item) => {
                const extra = item as ProductRecord & Record<string, unknown>;
                const productCity = String(extra.city || item.destination?.name || "").trim();
                const stay = productCity
                  ? findStayWindowForCity(stayWindows, productCity)
                  : (stayWindows.length === 1 ? stayWindows[0] : null);
                const city = stay?.city || (stayWindows.length === 1 ? stayWindows[0].city : productCity);
                const date = city
                  ? defaultActivityDateForCity(stayWindows, city)
                  : "";
                return {
                  productId: item.id,
                  productType: "ACTIVITY",
                  source: "CONTRACTED_PRODUCT",
                  selfBooked: false,
                  activityCategory: String(extra.category || extra.activityType || "Attraction"),
                  activityName: item.name,
                  description: String(item.shortDescription || item.description || ""),
                  city,
                  date,
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
                  currency: form.currency || "",
                  voucher: "",
                  remarks: "",
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
            fields={[
              "mealType", "city", "restaurant", "location", "cuisine", "description", "dietary",
              "date", "time", "duration", "adults", "children", "infants",
              "currency", "voucher", "remarks", "adultRate", "childRate", "costPrice", "sellingPrice",
            ]}
            onChange={(rows) => patchSelected({
              meals: rows,
              itinerary: syncItineraryFromPackage(selected?.itinerary, { ...selected, meals: rows }, {
                stayWindows,
                travelStartDate: form.travelStartDate,
              }),
            })}
            template={{
              mealType: "Dinner",
              restaurant: "",
              location: "",
              cuisine: "",
              description: "",
              dietary: "",
              city: stayWindows.length === 1 ? stayWindows[0].city : "",
              date: stayWindows.length === 1
                ? defaultMealDateForCity(stayWindows, stayWindows[0].city)
                : "",
              dateSource: "AUTO",
              time: "",
              duration: "",
              adults: form.adults,
              children: form.children,
              infants: form.infants,
              currency: form.currency || "",
              voucher: "",
              remarks: "",
              source: "MANUAL",
              selfBooked: true,
            }}
            catalogKind="meals"
            travelDate={form.travelStartDate}
            destinationId={destinationId}
            destination={form.destination}
            quotationId={id}
            tripCities={hotelTripCities}
            stayWindows={stayWindows}
            flightAdults={form.adults}
            flightChildren={form.children}
            flightInfants={form.infants}
            packageHotels={(selected?.hotels || []) as Record<string, unknown>[]}
            catalogToRow={(item) => {
              const extra = item as ProductRecord & Record<string, unknown>;
              const productCity = String(extra.city || item.destination?.name || "").trim();
              const stay = productCity
                ? findStayWindowForCity(stayWindows, productCity)
                : (stayWindows.length === 1 ? stayWindows[0] : null);
              const city = stay?.city || (stayWindows.length === 1 ? stayWindows[0].city : productCity);
              const date = city ? defaultMealDateForCity(stayWindows, city) : "";
              return {
                productId: item.id,
                productType: "MEAL",
                source: "CONTRACTED_PRODUCT",
                selfBooked: false,
                restaurant: String(extra.restaurant || item.name || ""),
                mealType: String(extra.mealType || "Dinner"),
                cuisine: String(extra.cuisine || ""),
                city,
                location: "",
                dietary: "",
                date,
                dateSource: "AUTO",
                time: "",
                duration: String(extra.duration || ""),
                description: String(item.description || ""),
                transferBadge: item.transferInclusion === "PRIVATE" ? "Private Transfer" : "No Transfer",
                adults: form.adults,
                children: form.children,
                infants: form.infants,
                currency: String(extra.currency || form.currency || ""),
                voucher: "",
                remarks: "",
                sellingPrice: Number(extra.adultPrice || 0),
                costPrice: 0,
                supplier: item.supplier?.name || "",
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
                      {step === 0 && !id ? "Create" : "Save & continue"} <ChevronRight className="w-4 h-4 ml-0.5" />
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
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="space-y-1.5 min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      <Input className="h-10 w-full" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
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

function hotelFromCatalog(
  item: ProductRecord,
  defaultRooms = 1,
  room?: Record<string, unknown> | null,
): Record<string, unknown> {
  const rooms = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
  const selected = room || rooms[0];
  const pricing = (selected?.pricing as Record<string, number>) || {};
  const selling = Number(pricing.double ?? pricing.single ?? 0);
  const cancellation = String(
    selected?.cancellationPolicy
    || item.cancellationPolicy
    || item.cancellation
    || "",
  ).trim();
  const roomImage = Array.isArray(selected?.images) && selected.images[0]
    ? String(selected.images[0])
    : firstProductImage(item);
  return {
    productId: item.id,
    hotelName: item.name,
    starCategory: String(item.starCategory || ""),
    roomType: String(selected?.name || "Deluxe"),
    mealPlan: String(selected?.mealPlan || "Breakfast"),
    address: String(item.address || ""),
    city: String(item.city || item.destination?.name || ""),
    tripCity: String(item.city || item.destination?.name || ""),
    checkInTime: String(item.checkInTime || "14:00"),
    checkOutTime: String(item.checkOutTime || "11:00"),
    contactPerson: String(item.contactPerson || ""),
    contactPhone: String(item.contactPhone || ""),
    contactEmail: String(item.contactEmail || ""),
    imageUrl: roomImage,
    sellingPrice: selling,
    rooms: Math.max(1, defaultRooms || 1),
    supplier: item.supplier?.name,
    confirmationNo: "",
    remarks: "",
    cancellationPolicy: cancellation || undefined,
    refundable: selected?.refundable === true || undefined,
    hotelDocuments: [],
    source: "CONTRACTED_PRODUCT",
    selfBooked: false,
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

const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snacks", "Other"] as const;

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
  if (field === "checkIn" || field === "checkOut" || field === "date" || field === "arrivalDate") return "date";
  if (field === "checkInTime" || field === "checkOutTime" || field === "depTime" || field === "arrTime" || field === "timeSlot" || field === "pickupTime" || field === "time") return "time";
  if (["costPrice", "sellingPrice", "fare", "rooms", "quantity", "adultRate", "childRate", "adults", "children", "infants", "nights", "markup", "starCategory", "stops", "pax"].includes(field)) {
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
  if (field === "arrivalDate") return "Arrival date";
  if (field === "airlineCode") return "Airline code";
  if (field === "stops") return "Stops";
  if (field === "depTime") return "Departure time";
  if (field === "arrTime") return "Arrival time";
  if (field === "cabinClass") return "Cabin class";
  if (field === "flightNumber") return "Flight number";
  if (field === "transferType") return "Transfer type";
  if (field === "vehicleType") return "Vehicle type";
  if (field === "pickupTime") return "Pickup time";
  if (field === "pax") return "Passengers (pax)";
  if (field === "voucher") return "Voucher / reference";
  if (field === "activityCategory") return "Activity category";
  if (field === "timeSlot") return "Time slot";
  if (field === "ticketType") return "Ticket type";
  if (field === "adultRate") return "Adult rate";
  if (field === "childRate") return "Child rate";
  if (field === "mealType") return "Meal type";
  if (field === "dietary") return "Special dietary requirements";
  if (field === "location") return "Location";
  if (field === "time") return "Time";
  if (field === "infants") return "Infants";
  return field.replace(/([A-Z])/g, " $1");
}

function stayNights(checkIn?: string, checkOut?: string): number | null {
  const a = toCalendarDate(checkIn);
  const b = toCalendarDate(checkOut);
  if (!a || !b || b <= a) return null;
  const ms = new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

/** Add calendar days to a YYYY-MM-DD string (noon local) without UTC day-shift. */
function addDaysYmd(ymd: string, days: number): string {
  const base = toCalendarDate(ymd);
  if (!base) return "";
  const dt = new Date(`${base}T12:00:00`);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function newHotelLineId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ServiceEditor({
  title, rows, fields, selfBookedFields, onChange, onHotelAdded, template, catalogKind, catalogToRow, travelDate, travelEndDate, quotationId, destinationId, destination,
  tripCities, stayWindows, initialStar, defaultRooms, defaultFlightFrom, defaultFlightTo, flightAdults, flightChildren, flightInfants, hotelTransferLocations, packageHotels,
}: {
  title: string;
  rows: Record<string, unknown>[];
  fields: string[];
  /** When set, self-booked hotel rows only show these fields (name + address focused). */
  selfBookedFields?: string[];
  onChange: (rows: Record<string, unknown>[]) => void;
  /** Fired after a hotel is confirmed/added (catalogue or self-booked). */
  onHotelAdded?: (hotels: Record<string, unknown>[]) => void;
  template: Record<string, unknown>;
  catalogKind?: keyof typeof CATALOG_TYPE;
  catalogToRow?: (item: ProductRecord, room?: Record<string, unknown> | null) => Record<string, unknown>;
  travelDate?: string;
  travelEndDate?: string;
  quotationId?: string | null;
  destinationId?: string;
  destination?: string;
  /** Cities from Basic Details trip plan — hotels are recommended/filtered by these. */
  tripCities?: string[];
  stayWindows?: TripCityStayWindow[];
  initialStar?: string;
  defaultRooms?: number;
  defaultFlightFrom?: string;
  defaultFlightTo?: string;
  flightAdults?: number;
  flightChildren?: number;
  flightInfants?: number;
  hotelTransferLocations?: HotelTransferLocation[];
  /** Hotels from the selected package — used for meal breakfast awareness. */
  packageHotels?: Record<string, unknown>[];
}) {
  const user = useAuthStore((s) => s.user);
  // Quotation wizard is staff/agent-facing; agents must not see internal cost fields.
  const hideInternalCost = user?.role === "travel_agent";
  const visibleFields = hideInternalCost
    ? fields.filter((f) => !["costPrice", "markup", "supplier", "quotedCostPrice", "contractedCost"].includes(f))
    : fields;
  const [catalogOpen, setCatalogOpen] = useState(false);
  const windows = stayWindows || [];
  const hotelPickLock = useRef(false);

  useEffect(() => {
    if (catalogOpen) hotelPickLock.current = false;
  }, [catalogOpen]);

  function resolveHotelStay(preferredCity?: string): TripCityStayWindow | null {
    if (preferredCity) {
      const hit = findStayWindowForCity(windows, preferredCity);
      if (hit) return hit;
    }
    if (windows.length === 1) return windows[0];
    return null;
  }

  function isDuplicateHotelRow(candidate: Record<string, unknown>): boolean {
    return rows.some((r) => {
      if (String(r.productId || "") && String(candidate.productId || "")
        && String(r.productId) === String(candidate.productId)
        && String(r.roomType || "") === String(candidate.roomType || "")
        && String(r.tripCity || r.city || "") === String(candidate.tripCity || candidate.city || "")
        && String(r.checkIn || "") === String(candidate.checkIn || "")) {
        return true;
      }
      return false;
    });
  }

  function appendHotelPick(
    item: ProductRecord,
    rate: { rateId: string; validFrom: string; validTo: string; contractedCost?: number; displayPrice?: number | null },
    stayCity?: string,
    room?: Record<string, unknown> | null,
  ) {
    if (hotelPickLock.current) return;
    hotelPickLock.current = true;
    const next = buildHotelPickRow(item, rate, stayCity, room);
    if (isDuplicateHotelRow(next)) {
      setCatalogOpen(false);
      return;
    }
    const hotels = [...rows, next];
    onChange(hotels);
    setCatalogOpen(false);
    onHotelAdded?.(hotels);
  }

  function buildHotelPickRow(
    item: ProductRecord,
    rate: { rateId: string; validFrom: string; validTo: string; contractedCost?: number; displayPrice?: number | null },
    stayCity?: string,
    room?: Record<string, unknown> | null,
  ): Record<string, unknown> {
    const base = catalogToRow!(item, room);
    const selling = Number(base.sellingPrice || rate.displayPrice || 0);
    const hasInternalCost = rate.contractedCost != null && Number.isFinite(Number(rate.contractedCost));
    const cost = hasInternalCost ? Number(rate.contractedCost) : undefined;
    const productCity = String(base.city || item.city || item.destination?.name || stayCity || "").trim();
    const stay = resolveHotelStay(stayCity || productCity);
    const cin = stay?.checkIn || travelDate || String(base.checkIn || "");
    const cout = stay?.checkOut || travelEndDate || String(base.checkOut || "");
    const tripCity = stay?.city || productCity;
    const row: Record<string, unknown> = {
      ...base,
      lineId: newHotelLineId(),
      checkIn: cin,
      checkOut: cout,
      checkInTime: String(base.checkInTime || "14:00"),
      checkOutTime: String(base.checkOutTime || "11:00"),
      nights: stay?.nights ?? stayNights(cin, cout) ?? "",
      rooms: Math.max(1, Number(base.rooms || defaultRooms || 1)),
      city: tripCity,
      tripCity,
      stayDatesLocked: false,
      selfBooked: false,
      hotelDocuments: Array.isArray(base.hotelDocuments) ? base.hotelDocuments : [],
      source: "CONTRACTED_PRODUCT",
      productType: CATALOG_TYPE.hotels,
      rateId: rate.rateId,
      rateValidFrom: rate.validFrom,
      rateValidTo: rate.validTo,
      rateSelectedAt: new Date().toISOString(),
      rateTravelDate: cin || travelDate,
      rateUnresolved: false,
      sellingPrice: selling || (cost ?? 0),
      markup: hasInternalCost ? Math.round((selling || cost || 0) - (cost || 0)) : undefined,
      cancellationPolicy: base.cancellationPolicy || undefined,
    };
    if (hasInternalCost) row.costPrice = cost;
    return row;
  }

  function addSelfBooked(preferredCity?: string) {
    setCatalogOpen(false);
    const row = { ...template };
    if (catalogKind === "hotels") {
      const stay = resolveHotelStay(preferredCity || String(row.tripCity || row.city || ""));
      row.lineId = newHotelLineId();
      row.selfBooked = true;
      row.source = "MANUAL";
      row.productType = "HOTEL";
      if (stay) {
        row.checkIn = stay.checkIn;
        row.checkOut = stay.checkOut;
        row.nights = stay.nights;
        row.city = stay.city;
        row.tripCity = stay.city;
      } else {
        row.checkIn = toCalendarDate(String(row.checkIn || "")) || travelDate || "";
        row.checkOut = toCalendarDate(String(row.checkOut || "")) || travelEndDate || "";
        const n = stayNights(String(row.checkIn || ""), String(row.checkOut || ""));
        row.nights = n ?? "";
        if (!row.city && destination) row.city = destination;
        if (!row.tripCity) row.tripCity = row.city;
      }
      if (!row.checkInTime) row.checkInTime = "14:00";
      if (!row.checkOutTime) row.checkOutTime = "11:00";
      if (row.rooms == null) row.rooms = Math.max(1, defaultRooms || 1);
      delete row.costPrice;
      delete row.sellingPrice;
      delete row.markup;
      row.stayDatesLocked = false;
      if (!Array.isArray(row.hotelDocuments)) row.hotelDocuments = [];
    }
    if (catalogKind === "flights") {
      if (!row.from && defaultFlightFrom) row.from = defaultFlightFrom;
      if (!row.to && defaultFlightTo) row.to = defaultFlightTo;
      if (!Array.isArray(row.flightDocuments)) row.flightDocuments = [];
      row.source = "MANUAL";
      row.selfBooked = true;
      delete row.costPrice;
      delete row.sellingPrice;
      delete row.fare;
      delete row.markup;
      if (row.adults == null && flightAdults != null) row.adults = flightAdults;
      if (row.children == null && flightChildren != null) row.children = flightChildren;
      if (row.infants == null && flightInfants != null) row.infants = flightInfants;
      row.segmentIndex = rows.length;
    }
    if (catalogKind === "transfers") {
      row.source = "MANUAL";
      row.selfBooked = true;
      delete row.costPrice;
      delete row.sellingPrice;
      delete row.markup;
      if (!row.date) {
        row.date = windows.length === 1 ? windows[0].checkIn : "";
      }
      if (row.city == null && windows.length === 1) row.city = windows[0].city;
      if (row.pax == null && flightAdults != null) {
        row.pax = Math.max(1, Number(flightAdults || 0) + Number(flightChildren || 0) || 1);
      }
    }
    if (catalogKind === "activities") {
      row.source = "MANUAL";
      row.selfBooked = true;
      delete row.costPrice;
      delete row.sellingPrice;
      delete row.adultRate;
      delete row.childRate;
      delete row.markup;
      if (!Array.isArray(row.activityDocuments)) row.activityDocuments = [];
      if (row.adults == null && flightAdults != null) row.adults = flightAdults;
      if (row.children == null && flightChildren != null) row.children = flightChildren;
      if (!row.city) {
        row.city = windows.length === 1 ? windows[0].city : "";
      }
      if (!row.date && row.city) {
        row.date = defaultActivityDateForCity(windows, String(row.city));
      } else if (!row.date) {
        row.date = "";
      }
    }
    if (catalogKind === "meals") {
      row.source = "MANUAL";
      row.selfBooked = true;
      delete row.costPrice;
      delete row.sellingPrice;
      delete row.adultRate;
      delete row.childRate;
      delete row.markup;
      if (row.adults == null && flightAdults != null) row.adults = flightAdults;
      if (row.children == null && flightChildren != null) row.children = flightChildren;
      if (row.infants == null && flightInfants != null) row.infants = flightInfants;
      if (!row.city) {
        row.city = windows.length === 1 ? windows[0].city : "";
      }
      if (!row.date && row.city) {
        row.date = defaultMealDateForCity(windows, String(row.city));
        row.dateSource = "AUTO";
      } else if (!row.date) {
        row.date = "";
        row.dateSource = "AUTO";
      }
    }
    const nextRows = [...rows, row];
    onChange(nextRows);
    if (catalogKind === "hotels") onHotelAdded?.(nextRows);
  }

  return (
    <div className={cn("space-y-3", catalogKind === "hotels" && catalogOpen && "h-full min-h-0")}>
      {catalogKind === "hotels" && catalogOpen && catalogToRow ? (
        <CatalogPicker
          kind="hotels"
          travelDate={travelDate}
          travelEndDate={travelEndDate}
          destinationId={destinationId}
          destination={destination}
          tripCities={tripCities}
          stayWindows={windows}
          initialStar={initialStar}
          defaultRooms={defaultRooms}
          open={catalogOpen}
          onOpenChange={setCatalogOpen}
          variant="inline"
          onAddSelfBooked={(city) => addSelfBooked(city)}
          onPick={(item, rate, stayCity, room) => {
            appendHotelPick(item, rate, stayCity, room);
          }}
        />
      ) : (
        <>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {catalogKind === "hotels"
              ? "Pick a catalogue hotel (room options) or add a self-booked stay with name and address."
              : destination
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
              tripCities={catalogKind === "hotels" ? tripCities : undefined}
              stayWindows={catalogKind === "hotels" ? windows : undefined}
              initialStar={catalogKind === "hotels" ? initialStar : undefined}
              defaultRooms={catalogKind === "hotels" ? defaultRooms : undefined}
              open={catalogOpen}
              onOpenChange={setCatalogOpen}
              onAddSelfBooked={(city) => addSelfBooked(city)}
              onPick={(item, rate, stayCity, room) => {
                if (catalogKind === "hotels") {
                  appendHotelPick(item, rate, stayCity, room);
                  return;
                }
                const base = catalogToRow(item);
                const selling = Number(base.sellingPrice || rate.displayPrice || 0);
                const hasInternalCost = rate.contractedCost != null && Number.isFinite(Number(rate.contractedCost));
                const cost = hasInternalCost ? Number(rate.contractedCost) : 0;
                onChange([...rows, {
                  ...base,
                  ...(catalogKind === "flights" ? {
                    flightDocuments: Array.isArray(base.flightDocuments) ? base.flightDocuments : [],
                    segmentIndex: rows.length,
                    adults: base.adults != null ? base.adults : flightAdults,
                    children: base.children != null ? base.children : flightChildren,
                    infants: base.infants != null ? base.infants : flightInfants,
                    // Keep blank date unless catalogue row already had one — never force trip start.
                    date: String(base.date || ""),
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
                  ...(hasInternalCost ? { costPrice: cost } : {}),
                  sellingPrice: selling || cost,
                }]);
                setCatalogOpen(false);
              }}
            />
          )}
          {catalogKind === "flights" && (
            <FlightApiSearch
              travelDate={travelDate}
              travelEndDate={travelEndDate}
              defaultFrom={defaultFlightFrom}
              defaultTo={defaultFlightTo}
              adults={flightAdults ?? 1}
              children={flightChildren ?? 0}
              infants={flightInfants ?? 0}
              destinationLabel={destination}
              tripCities={tripCities}
              onPick={(row) => {
                const next = {
                  ...row,
                  segmentIndex: row.segmentIndex != null ? row.segmentIndex : rows.length,
                  adults: row.adults != null ? row.adults : flightAdults,
                  children: row.children != null ? row.children : flightChildren,
                  infants: row.infants != null ? row.infants : flightInfants,
                };
                onChange([...rows, next]);
              }}
            />
          )}
          <Button size="sm" variant="outline" type="button" onClick={() => addSelfBooked()}>
            <Plus className="w-3.5 h-3.5 mr-1" /> {catalogKind === "hotels" ? "Add self-booked (name & address)" : "Add self-booked"}
          </Button>
        </div>
      </div>
      {rows.length === 0 && (
        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No {title.toLowerCase()} yet — pick from catalog or enter self-booked details.
        </div>
      )}
      {rows.map((row, i) => {
        const checkIn = toCalendarDate(String(row.checkIn || ""));
        const checkOut = toCalendarDate(String(row.checkOut || ""));
        const dateError = catalogKind === "hotels" && checkIn && checkOut && checkOut <= checkIn
          ? "Check-out date must be after check-in date."
          : null;
        const rowFields = row.selfBooked === true && selfBookedFields?.length
          ? selfBookedFields
          : visibleFields;
        return (
          <div key={String(row.lineId || i)} className="rounded-xl border bg-card p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 relative">
            <Button
              size="sm"
              variant="ghost"
              className="absolute right-2 top-2 h-8 w-8 p-0"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            {row.selfBooked === true && (
              <div className="sm:col-span-2 md:col-span-3 space-y-1 pr-8">
                <p className="text-[11px] uppercase tracking-wide text-teal-700 dark:text-teal-400">
                  {catalogKind === "hotels"
                    ? "Self-booked — name and address for land pickup/drop"
                    : catalogKind === "transfers" || catalogKind === "activities" || catalogKind === "meals"
                      ? "Self-booked — enter operational details; prices only if you set them"
                      : "Self-booked"}
                </p>
                {(row.tripCity || row.city || checkIn) && (
                  <p className="text-xs text-muted-foreground">
                    {[
                      row.tripCity || row.city,
                      checkIn && checkOut ? `${checkIn} → ${checkOut}` : null,
                      row.nights != null && row.nights !== "" ? `${row.nights} nights` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            )}
            {catalogKind === "meals" && (() => {
              const breakfastWarn = hotelBreakfastDuplicationWarning({
                mealType: row.mealType,
                mealCity: row.city,
                mealDate: row.date,
                hotels: packageHotels || [],
              });
              const msgs = [
                row.cityOrphanReason ? String(row.cityOrphanReason) : "",
                row.dateInvalidReason ? String(row.dateInvalidReason) : "",
                breakfastWarn || "",
              ].filter(Boolean);
              if (!msgs.length) return null;
              return (
                <div className="sm:col-span-2 md:col-span-3 space-y-1 pr-8">
                  {msgs.map((msg) => (
                    <p key={msg} className="text-[11px] text-amber-700 dark:text-amber-400">
                      {msg}
                    </p>
                  ))}
                </div>
              );
            })()}
            {row.selfBooked !== true && Boolean(row.rateValidFrom) && Boolean(row.rateValidTo) ? (
              <p className="sm:col-span-2 md:col-span-3 text-[11px] text-muted-foreground">
                Rate validity {String(row.rateValidFrom)} → {String(row.rateValidTo)}
                {row.roomType || row.mealPlan
                  ? ` · ${[row.roomType, row.mealPlan].filter(Boolean).join(" · ")}`
                  : ""}
                {row.cancellationPolicy ? ` · Cancellation: ${String(row.cancellationPolicy)}` : ""}
              </p>
            ) : null}
            {row.rateUnresolved === true && (
              <p className="sm:col-span-2 md:col-span-3 text-xs text-destructive">{NO_VALID_RATE}</p>
            )}
            {dateError && (
              <p className="sm:col-span-2 md:col-span-3 text-xs text-destructive">{dateError}</p>
            )}
            {Boolean(row.transferBadge) && (
              <p className="sm:col-span-2 md:col-span-3 text-[11px] uppercase tracking-wide text-muted-foreground">{String(row.transferBadge)}</p>
            )}
            {rowFields.map((f) => {
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
                <div
                  key={f}
                  className={cn(
                    "space-y-1.5",
                    isImageField(f) || isStayDate || (row.selfBooked === true && (f === "hotelName" || f === "address"))
                      ? "sm:col-span-2 md:col-span-3 pr-8"
                      : "",
                  )}
                >
                  <Label className="text-xs font-medium capitalize text-muted-foreground">
                    {f === "hotelName" && row.selfBooked === true
                      ? "Hotel name"
                      : f === "address" && row.selfBooked === true
                        ? "Address / location (for pickup & drop)"
                        : fieldLabel(f)}
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
                            stayDatesLocked: true,
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
                  ) : (f === "pickup" || f === "drop") && hotelTransferLocations && hotelTransferLocations.length > 0 ? (
                    <div className="space-y-1.5">
                      <Select
                        value={
                          hotelTransferLocations.some((loc) => loc.location === value)
                            ? value
                            : "__custom__"
                        }
                        onValueChange={(v) => {
                          const next = [...rows];
                          if (v === "__custom__") {
                            next[i] = {
                              ...next[i],
                              [f]: value && !hotelTransferLocations.some((loc) => loc.location === value) ? value : "",
                              [`${f}HotelLineId`]: "",
                            };
                          } else {
                            const loc = hotelTransferLocations.find((l) => l.location === v);
                            next[i] = {
                              ...next[i],
                              [f]: v,
                              [`${f}HotelLineId`]: loc?.lineId || "",
                            };
                          }
                          onChange(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Hotel or custom location" />
                        </SelectTrigger>
                        <SelectContent>
                          {hotelTransferLocations.map((loc) => (
                            <SelectItem key={`${f}-${loc.lineId}`} value={loc.location}>
                              {loc.label}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">Custom location…</SelectItem>
                        </SelectContent>
                      </Select>
                      {(!value || !hotelTransferLocations.some((loc) => loc.location === value)) && (
                        <Input
                          className="h-9"
                          value={value}
                          placeholder="Type pickup/drop location"
                          onChange={(e) => {
                            const next = [...rows];
                            next[i] = { ...next[i], [f]: e.target.value, [`${f}HotelLineId`]: "" };
                            onChange(next);
                          }}
                        />
                      )}
                    </div>
                  ) : f === "city" && tripCities && tripCities.length > 0 ? (
                    <div className="space-y-1">
                      <Select
                        value={value || undefined}
                        onValueChange={(v) => {
                          const next = [...rows];
                          if (catalogKind === "meals") {
                            next[i] = applyMealCityChange(next[i], v, windows);
                          } else {
                            const patch: Record<string, unknown> = { ...next[i], city: v, tripCity: v };
                            const currentDate = String(patch.date || "");
                            if (!currentDate || !isDateInCityStay(windows, v, currentDate)) {
                              patch.date = defaultActivityDateForCity(windows, v);
                            }
                            next[i] = patch;
                          }
                          onChange(next);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select trip city" />
                        </SelectTrigger>
                        <SelectContent>
                          {tripCities.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {value && String(row.date || "") && !isDateInCityStay(windows, value, String(row.date)) && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">
                          Date is outside this city&apos;s stay window — override allowed.
                        </p>
                      )}
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
                        if (catalogKind === "meals" && f === "date") {
                          patch.dateSource = "MANUAL";
                          const city = String(patch.city || "");
                          const dateStr = String(nextVal || "");
                          if (city && dateStr && !isDateInCityStay(windows, city, dateStr)) {
                            patch.dateInvalid = true;
                            patch.dateInvalidReason = `Date ${dateStr} is outside the ${city} stay window.`;
                          } else {
                            delete patch.dateInvalid;
                            delete patch.dateInvalidReason;
                          }
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
        </>
      )}
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

function mapSearchResultToFlightLine(
  item: Record<string, unknown>,
  opts: {
    rateSource: "AMADEUS_API" | "MOCK";
    adults: number;
    children: number;
    infants: number;
    fallbackDate?: string;
  },
): Record<string, unknown> {
  const departDate = String(item.departDate || item.departureDate || item.date || opts.fallbackDate || "");
  const arriveDate = String(item.arriveDate || item.arrivalDate || "");
  return {
    source: opts.rateSource,
    provider: opts.rateSource,
    airline: String(item.airline || ""),
    airlineCode: String(item.airlineCode || ""),
    flightNumber: String(item.flightNumber || ""),
    from: String(item.origin || item.from || ""),
    to: String(item.destination || item.to || ""),
    date: departDate,
    arrivalDate: arriveDate,
    depTime: String(item.departTime || item.depTime || ""),
    arrTime: String(item.arriveTime || item.arrTime || ""),
    duration: String(item.duration || ""),
    stops: Number(item.stops || 0),
    baggage: String(item.baggage || ""),
    cabinClass: String(item.cabin || item.cabinClass || "Economy"),
    currency: String(item.currency || "INR"),
    seatsLeft: Number(item.seatsLeft ?? 0),
    refundable: Boolean(item.refundable),
    aircraft: String(item.aircraft || ""),
    sellingPrice: Math.round(Number(item.price || 0)),
    fare: Math.round(Number(item.price || 0)),
    remarks: "",
    pnr: "",
    flightDocuments: [],
    direction: item.direction ? String(item.direction) : undefined,
    segmentIndex: item.segmentIndex != null ? Number(item.segmentIndex) : 0,
    journeyId: item.journeyId ? String(item.journeyId) : String(item.id || ""),
    adults: opts.adults,
    children: opts.children,
    infants: opts.infants,
  };
}

type FlightSearchSegment = { origin: string; destination: string; date: string };

function FlightApiSearch({
  travelDate,
  travelEndDate,
  defaultFrom,
  defaultTo,
  adults,
  children,
  infants,
  destinationLabel,
  tripCities,
  onPick,
}: {
  travelDate?: string;
  travelEndDate?: string;
  defaultFrom?: string;
  defaultTo?: string;
  adults: number;
  children: number;
  infants: number;
  destinationLabel?: string;
  tripCities?: string[];
  onPick: (row: Record<string, unknown>) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [tripType, setTripType] = useState<"one_way" | "round_trip" | "multi_city">("one_way");
  const [from, setFrom] = useState(defaultFrom?.trim() || "");
  const [to, setTo] = useState(defaultTo?.trim() || "");
  const [depDate, setDepDate] = useState(travelDate || "");
  const [retDate, setRetDate] = useState(travelEndDate || "");
  const [paxAdults, setPaxAdults] = useState(Math.max(1, adults || 1));
  const [paxChildren, setPaxChildren] = useState(Math.max(0, children || 0));
  const [paxInfants, setPaxInfants] = useState(Math.max(0, infants || 0));
  const [cabinClass, setCabinClass] = useState("Economy");
  const [segments, setSegments] = useState<FlightSearchSegment[]>([
    { origin: defaultFrom?.trim() || "", destination: defaultTo?.trim() || "", date: travelDate || "" },
    { origin: defaultTo?.trim() || "", destination: "", date: travelEndDate || travelDate || "" },
  ]);
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [meta, setMeta] = useState<{ provider?: string; source?: string; demo?: boolean; message?: string; rateSource?: string }>({});
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (defaultFrom?.trim()) setFrom(defaultFrom.trim());
    if (defaultTo?.trim()) setTo(defaultTo.trim());
    if (travelDate) setDepDate(travelDate);
    if (travelEndDate) setRetDate(travelEndDate);
    setPaxAdults(Math.max(1, adults || 1));
    setPaxChildren(Math.max(0, children || 0));
    setPaxInfants(Math.max(0, infants || 0));
    setSegments((prev) => {
      const next = [...prev];
      if (next[0]) {
        next[0] = {
          ...next[0],
          origin: defaultFrom?.trim() || next[0].origin,
          destination: defaultTo?.trim() || next[0].destination,
          date: travelDate || next[0].date,
        };
      }
      return next;
    });
  }, [open, defaultFrom, defaultTo, travelDate, travelEndDate, adults, children, infants]);

  async function search() {
    try {
      setSearching(true);
      const params = new URLSearchParams({
        tripType,
        adults: String(paxAdults),
        children: String(paxChildren),
        infants: String(paxInfants),
        cabinClass,
        count: "8",
      });

      if (tripType === "multi_city") {
        const cleaned = segments
          .map((s) => ({
            origin: s.origin.trim().toUpperCase(),
            destination: s.destination.trim().toUpperCase(),
            date: s.date.trim(),
          }))
          .filter((s) => s.origin && s.destination);
        if (cleaned.length < 2) {
          toast({ title: "Add at least two multi-city segments with From / To", variant: "destructive" });
          return;
        }
        if (cleaned.some((s) => !s.date)) {
          toast({ title: "Each multi-city segment needs a departure date", variant: "destructive" });
          return;
        }
        params.set("segments", JSON.stringify(cleaned));
      } else {
        const origin = from.trim().toUpperCase();
        const destination = to.trim().toUpperCase();
        if (!origin) {
          toast({ title: "Origin airport is required", variant: "destructive" });
          return;
        }
        if (!destination) {
          toast({
            title: "Destination airport is required",
            description: destinationLabel || (tripCities && tripCities.length > 1)
              ? "Multi-city quotes need an explicit destination airport — nothing is hardcoded."
              : "Enter a destination IATA code (e.g. HKT).",
            variant: "destructive",
          });
          return;
        }
        if (!depDate) {
          toast({ title: "Departure date is required", variant: "destructive" });
          return;
        }
        params.set("origin", origin);
        params.set("destination", destination);
        params.set("departureDate", depDate);
        if (tripType === "round_trip") {
          if (!retDate) {
            toast({ title: "Return date is required for round trip", variant: "destructive" });
            return;
          }
          params.set("returnDate", retDate);
        }
      }

      const data = await apiFetch<{
        flights: Array<Record<string, unknown>>;
        provider?: string;
        source?: string;
        demo?: boolean;
        message?: string;
        rateSource?: string;
      }>(`/api/flights/search?${params.toString()}`);
      setItems(data.flights || []);
      setMeta({
        provider: data.provider,
        source: data.source,
        demo: data.demo,
        message: data.message,
        rateSource: data.rateSource,
      });
      if (!data.flights?.length) toast({ title: "No flights returned" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Flight search failed", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }

  const rateSource: "AMADEUS_API" | "MOCK" =
    meta.rateSource === "AMADEUS_API" || (meta.provider === "amadeus" && meta.source === "live")
      ? "AMADEUS_API"
      : "MOCK";

  return (
    <div className="relative">
      <Button size="sm" variant="outline" type="button" onClick={() => setOpen((v) => !v)}>API search</Button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[22rem] max-h-[28rem] overflow-y-auto rounded-md border bg-popover p-2 shadow-md space-y-2">
          <div className="flex gap-1">
            {([
              ["one_way", "One way"],
              ["round_trip", "Round trip"],
              ["multi_city", "Multi-city"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                type="button"
                variant={tripType === value ? "default" : "outline"}
                className="h-7 text-[10px] px-2"
                onClick={() => setTripType(value)}
              >
                {label}
              </Button>
            ))}
          </div>

          {tripType !== "multi_city" ? (
            <>
              <div className="flex gap-1">
                <Input className="h-8 text-xs" value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} placeholder="From (IATA)" />
                <Input className="h-8 text-xs" value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} placeholder="To (IATA)" />
              </div>
              <div className="flex gap-1">
                <Input className="h-8 text-xs" type="date" value={depDate} onChange={(e) => setDepDate(e.target.value)} />
                {tripType === "round_trip" && (
                  <Input className="h-8 text-xs" type="date" value={retDate} onChange={(e) => setRetDate(e.target.value)} />
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              {segments.map((seg, i) => (
                <div key={i} className="space-y-1 rounded border p-1.5">
                  <p className="text-[10px] font-semibold text-muted-foreground">Segment {i + 1}</p>
                  <div className="flex gap-1">
                    <Input
                      className="h-7 text-xs"
                      value={seg.origin}
                      onChange={(e) => {
                        const next = [...segments];
                        next[i] = { ...next[i], origin: e.target.value.toUpperCase() };
                        setSegments(next);
                      }}
                      placeholder="From"
                    />
                    <Input
                      className="h-7 text-xs"
                      value={seg.destination}
                      onChange={(e) => {
                        const next = [...segments];
                        next[i] = { ...next[i], destination: e.target.value.toUpperCase() };
                        setSegments(next);
                      }}
                      placeholder="To"
                    />
                  </div>
                  <Input
                    className="h-7 text-xs"
                    type="date"
                    value={seg.date}
                    onChange={(e) => {
                      const next = [...segments];
                      next[i] = { ...next[i], date: e.target.value };
                      setSegments(next);
                    }}
                  />
                </div>
              ))}
              <div className="flex gap-1">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  className="h-7 text-[10px]"
                  onClick={() => setSegments((s) => [...s, { origin: "", destination: "", date: "" }])}
                >
                  Add segment
                </Button>
                {segments.length > 2 && (
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    className="h-7 text-[10px]"
                    onClick={() => setSegments((s) => s.slice(0, -1))}
                  >
                    Remove last
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1">
            <div>
              <Label className="text-[9px] text-muted-foreground">Adults</Label>
              <Input className="h-7 text-xs" type="number" min={1} value={paxAdults} onChange={(e) => setPaxAdults(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground">Children</Label>
              <Input className="h-7 text-xs" type="number" min={0} value={paxChildren} onChange={(e) => setPaxChildren(Math.max(0, Number(e.target.value) || 0))} />
            </div>
            <div>
              <Label className="text-[9px] text-muted-foreground">Infants</Label>
              <Input className="h-7 text-xs" type="number" min={0} value={paxInfants} onChange={(e) => setPaxInfants(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>
          <Select value={cabinClass} onValueChange={setCabinClass}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Cabin" />
            </SelectTrigger>
            <SelectContent>
              {["Economy", "Premium Economy", "Business", "First"].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" type="button" className="w-full" disabled={searching} onClick={() => void search()}>
            {searching ? "Searching…" : "Search"}
          </Button>

          {(meta.demo || meta.provider === "mock") && (
            <p className="text-[10px] rounded bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 px-2 py-1">
              Demo / mock results — not live Amadeus inventory.
              {meta.message ? ` ${meta.message}` : ""}
            </p>
          )}
          {meta.provider === "amadeus" && meta.source === "live" && (
            <p className="text-[10px] rounded bg-teal-50 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200 px-2 py-1">
              Live Amadeus results
            </p>
          )}

          {items.map((item) => (
            <button
              key={String(item.id)}
              type="button"
              className="w-full text-left text-xs rounded px-2 py-1.5 hover:bg-muted"
              onClick={() => {
                onPick(mapSearchResultToFlightLine(item, {
                  rateSource,
                  adults: paxAdults,
                  children: paxChildren,
                  infants: paxInfants,
                  fallbackDate: depDate || travelDate,
                }));
                setOpen(false);
              }}
            >
              {item.direction ? `[${String(item.direction)}] ` : ""}
              {String(item.airline)} {String(item.flightNumber)} · {String(item.origin)} → {String(item.destination)}
              {item.departDate ? ` · ${String(item.departDate)}` : ""}
              {item.duration ? ` · ${String(item.duration)}` : ""}
              {item.stops != null ? ` · ${Number(item.stops)} stop(s)` : ""}
              {item.baggage ? ` · ${String(item.baggage)}` : ""}
              {item.price != null ? ` · ${formatFullINR(Number(item.price))}` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function hotelStarNumber(item: ProductRecord): number {
  const n = Number(item.starCategory);
  return Number.isFinite(n) && n > 0 ? Math.min(7, Math.round(n)) : 0;
}

function hotelMatchesTripCity(item: ProductRecord, city: string): boolean {
  const needle = city.trim().toLowerCase();
  if (!needle) return false;
  const hay = [
    item.city,
    item.address,
    item.location,
    item.destination?.name,
    item.country,
  ]
    .map((v) => String(v || "").toLowerCase())
    .join(" ");
  return hay.includes(needle);
}

function mealPlanKey(raw: unknown): string {
  return String(raw || "").trim().toLowerCase();
}

function isRoomOnlyMeal(meal: string): boolean {
  if (!meal) return true;
  return /room\s*only|^ro$|none|european|^ep\b/.test(meal);
}

function isBreakfastMeal(meal: string): boolean {
  return /breakfast|bb\b|bed\s*&?\s*breakfast|continental|^cp\b/.test(meal);
}

function roomIsRefundable(room: Record<string, unknown>, hotel: ProductRecord): boolean {
  if (room.refundable === true) return true;
  const text = [
    room.cancellationPolicy,
    room.bookingPolicy,
    hotel.cancellationPolicy,
    hotel.cancellation,
  ].map((v) => String(v || "").toLowerCase()).join(" ");
  return /free\s*cancel|fully\s*refundable|\brefundable\b/.test(text) && !/non[-\s]?refundable/.test(text);
}

function roomNightUnitPrice(room: Record<string, unknown>): number {
  const pricing = (room.pricing as Record<string, number>) || {};
  return Number(pricing.double ?? pricing.single ?? 0) || 0;
}

function roomThumb(room: Record<string, unknown>, hotel: ProductRecord): string {
  if (Array.isArray(room.images) && room.images[0]) return String(room.images[0]);
  return firstProductImage(hotel);
}

function formatStayLabel(checkIn?: string, checkOut?: string, nights?: number | null): string {
  const a = checkIn || "";
  const b = checkOut || "";
  const n = nights != null && nights > 0 ? nights : stayNights(a, b);
  if (!a || !b) return n ? `${n} night${n === 1 ? "" : "s"}` : "";
  return `${a} → ${b}${n ? ` · ${n} night${n === 1 ? "" : "s"}` : ""}`;
}

type RoomSelectConfirm = {
  room: Record<string, unknown>;
  rate: { rateId: string; validFrom: string; validTo: string; contractedCost?: number; displayPrice?: number | null };
  stayCity?: string;
};

function HotelRoomSelectionPanel({
  hotel,
  stay,
  quoteRooms,
  onBack,
  onConfirm,
  confirming,
}: {
  hotel: ProductRecord;
  stay: { checkIn: string; checkOut: string; nights: number | null; city?: string };
  quoteRooms: number;
  onBack: () => void;
  onConfirm: (payload: RoomSelectConfirm) => void | Promise<void>;
  confirming: boolean;
}) {
  const { toast } = useToast();
  const roomsRaw = Array.isArray(hotel.roomCategories)
    ? (hotel.roomCategories as Array<Record<string, unknown>>)
    : [];
  const rooms = roomsRaw.length
    ? roomsRaw
    : [{ name: "Standard Room", mealPlan: "Breakfast", pricing: {} }];
  const [filter, setFilter] = useState<"all" | "room_only" | "breakfast" | "free_cancel">("all");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const hero = firstProductImage(hotel);
  const stars = hotelStarNumber(hotel);
  const address = String(hotel.address || hotel.location || "");
  const nights = stay.nights && stay.nights > 0
    ? stay.nights
    : stayNights(stay.checkIn, stay.checkOut);
  const busy = confirming || submitting;

  const filtered = useMemo(() => {
    return rooms.filter((room) => {
      const meal = mealPlanKey(room.mealPlan);
      if (filter === "room_only") return isRoomOnlyMeal(meal);
      if (filter === "breakfast") return isBreakfastMeal(meal);
      if (filter === "free_cancel") return roomIsRefundable(room, hotel);
      return true;
    });
  }, [rooms, filter, hotel]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [filter, hotel.id]);

  const selected = filtered[selectedIdx] || filtered[0] || rooms[0] || null;

  async function confirm() {
    if (submitLock.current || busy) return;
    if (!selected) {
      toast({ title: "No room options available for this hotel", variant: "destructive" });
      return;
    }
    if (!stay.checkIn || !stay.checkOut) {
      toast({
        title: "Travel dates missing",
        description: "Set Travel Date and trip-city nights in Basic Details, then try again.",
        variant: "destructive",
      });
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    try {
      const availParams = new URLSearchParams({
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        rooms: String(quoteRooms),
      });
      if (selected.name) availParams.set("roomType", String(selected.name));
      const avail = await apiFetch<{ ok: boolean; message?: string | null }>(
        `/api/products/hotels/${hotel.id}/catalogue-availability?${availParams.toString()}`,
      );
      if (!avail.ok) {
        toast({
          title: avail.message || "Hotel catalogue inventory unavailable for these dates",
          description: "Catalogue availability only — not a live supplier confirmation.",
          variant: "destructive",
        });
        submitLock.current = false;
        setSubmitting(false);
        return;
      }
      const params = new URLSearchParams({
        productType: "HOTEL",
        productId: hotel.id,
        travelDate: stay.checkIn,
      });
      if (selected.name) params.set("roomType", String(selected.name));
      if (selected.mealPlan) params.set("mealPlan", String(selected.mealPlan));
      const rate = await apiFetch<{
        applicable: boolean;
        message?: string;
        rateId?: string;
        validFrom?: string;
        validTo?: string;
        contractedCost?: number;
        displayPrice?: number | null;
      }>(`/api/contracted-rates/applicable?${params.toString()}`);
      if (!rate.applicable || !rate.rateId) {
        toast({
          title: rate.message || NO_VALID_RATE,
          description: `${hotel.name} needs an active contracted rate covering ${stay.checkIn}.`,
          variant: "destructive",
        });
        submitLock.current = false;
        setSubmitting(false);
        return;
      }
      await onConfirm({
        room: selected,
        rate: {
          rateId: rate.rateId,
          validFrom: rate.validFrom || "",
          validTo: rate.validTo || "",
          contractedCost: rate.contractedCost,
          displayPrice: rate.displayPrice,
        },
        stayCity: stay.city,
      });
      // Keep lock held after success — panel unmounts; prevents a late second confirm.
    } catch {
      toast({ title: NO_VALID_RATE, variant: "destructive" });
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  const filters: Array<{ key: typeof filter; label: string }> = [
    { key: "all", label: "All" },
    { key: "room_only", label: "Room Only" },
    { key: "breakfast", label: "Breakfast Included" },
    { key: "free_cancel", label: "Free Cancellation" },
  ];

  return (
    <div className="rounded-xl border border-border/70 bg-card overflow-hidden flex flex-col min-h-[min(70vh,720px)] max-h-[min(75vh,780px)]">
      <div className="px-4 py-3 border-b bg-muted/20 shrink-0 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Room selection</p>
          <p className="text-base sm:text-lg font-semibold text-foreground mt-0.5 truncate">
            {hotel.name}{hotel.city ? `, ${hotel.city}` : hotel.destination?.name ? `, ${hotel.destination.name}` : ""}
          </p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={onBack}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="relative h-36 sm:h-44 bg-muted">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero} alt="" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-100 to-primary/20">
              <Hotel className="w-12 h-12 text-teal-600/70" />
            </div>
          )}
        </div>
        <div className="px-4 py-3 space-y-2 border-b">
          <div className="flex items-center gap-2 flex-wrap">
            {stars > 0 && (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </span>
            )}
            <p className="font-semibold text-sm">{hotel.name}</p>
          </div>
          {address && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-teal-600" />
              <span>{address}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {[stars ? `${stars}* hotel` : null, hotel.city || hotel.destination?.name || null]
              .filter(Boolean)
              .join(" · ") || "Catalogue hotel"}
          </p>
        </div>

        <div className="px-4 py-3 flex flex-wrap gap-2 border-b">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                filter === f.key
                  ? "bg-teal-600 text-white border-teal-600"
                  : "bg-background text-foreground border-border hover:bg-muted/50",
              )}
            >
              {filter === f.key && f.key === "breakfast" ? (
                <span className="inline-flex items-center gap-1"><Coffee className="w-3 h-3" />{f.label}</span>
              ) : f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="rounded-full px-3 py-1.5 text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50"
          >
            Reset
          </button>
        </div>

        <div className="px-4 py-3 space-y-3 pb-24">
          {filtered.length === 0 && (
            <div className="rounded-xl border bg-background p-6 text-center text-sm text-muted-foreground">
              No rooms match this filter. Try All or Reset.
            </div>
          )}
          {filtered.map((room, idx) => {
            const unit = roomNightUnitPrice(room);
            const stayTotal = unit > 0 && nights ? unit * quoteRooms * nights : unit;
            const meal = String(room.mealPlan || "").trim();
            const refundable = roomIsRefundable(room, hotel);
            const thumb = roomThumb(room, hotel);
            const isSelected = selected === room;
            return (
              <button
                key={`${String(room.name || "room")}-${idx}`}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={cn(
                  "w-full text-left rounded-xl border bg-background p-3 grid grid-cols-[96px_1fr] gap-3 transition-all",
                  isSelected ? "border-teal-600 shadow-sm" : "border-border hover:border-teal-600/40",
                )}
              >
                <div className="relative h-24 rounded-lg overflow-hidden bg-muted">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Hotel className="w-8 h-8 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-snug">{String(room.name || "Room")}</p>
                    {isSelected && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-600 text-white text-[10px] font-semibold px-2 py-1 shrink-0">
                        <Check className="w-3 h-3" /> Selected
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Room Info · Booking Policy
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {meal && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Coffee className="w-3 h-3" /> {meal}
                      </span>
                    )}
                    {refundable ? (
                      <span className="text-emerald-600 font-medium">Refundable</span>
                    ) : (
                      <span className="text-muted-foreground">Cancellation as per policy</span>
                    )}
                    <span className="text-amber-600 font-medium">On Request</span>
                  </div>
                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-400 mt-auto pt-1">
                    {stayTotal > 0
                      ? `${formatFullINR(stayTotal)}${nights ? ` for ${nights} night${nights === 1 ? "" : "s"}` : ""}`
                      : "Rate on confirm"}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {quoteRooms} Room(s){selected ? ` · ${String(selected.name || "Room")}` : ""}
          </p>
          <p className="text-[11px] text-white/70">
            {formatStayLabel(stay.checkIn, stay.checkOut, nights)}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy || !selected}
          className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
          onClick={() => void confirm()}
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
          Confirm & Add Hotel
        </Button>
      </div>
    </div>
  );
}

function isRecommendedHotel(item: ProductRecord): boolean {
  // Server annotates contracted-rate eligibility. Stars / isFeatured are NOT substitutes.
  return item.hasApplicableContractedRate === true;
}

function CatalogPicker({
  kind,
  travelDate,
  travelEndDate,
  destinationId,
  destination,
  tripCities: tripCitiesProp,
  stayWindows = [],
  initialStar,
  defaultRooms,
  open,
  onOpenChange,
  onAddSelfBooked,
  onPick,
  variant = "dropdown",
}: {
  kind: keyof typeof CATALOG_TYPE;
  travelDate?: string;
  travelEndDate?: string;
  destinationId?: string;
  destination?: string;
  /** Cities selected in Basic Details trip plan. */
  tripCities?: string[];
  stayWindows?: TripCityStayWindow[];
  /** Quote hotel star preference — initializes filter when catalogue opens; user may change. */
  initialStar?: string;
  defaultRooms?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddSelfBooked?: (preferredCity?: string) => void;
  onPick: (
    item: ProductRecord,
    rate: { rateId: string; validFrom: string; validTo: string; contractedCost?: number; displayPrice?: number | null },
    stayCity?: string,
    room?: Record<string, unknown> | null,
  ) => void;
  /** Hotels: "inline" fills the Hotels step; other catalogs keep dropdown. */
  variant?: "dropdown" | "inline";
}) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [star, setStar] = useState("all");
  const [supplierId, setSupplierId] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [priceSort, setPriceSort] = useState<"low" | "high">("low");
  const [hotelTab, setHotelTab] = useState<"recommended" | "all">("recommended");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [roomSelectHotel, setRoomSelectHotel] = useState<ProductRecord | null>(null);
  const [confirmingRoom, setConfirmingRoom] = useState(false);
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const tripCityKey = (tripCitiesProp || []).map((c) => c.trim()).filter(Boolean).join("|");
  const tripCities = useMemo(
    () => [...new Set(tripCityKey ? tripCityKey.split("|") : [])],
    [tripCityKey],
  );
  const destLabel = (destination || "").trim();
  const isHotels = kind === "hotels";
  const quoteRooms = Math.max(1, Number(defaultRooms) || 1);
  const activeCities = useMemo(() => {
    if (!isHotels) return [] as string[];
    if (cityFilter !== "all") return [cityFilter];
    if (tripCities.length) return tripCities;
    return destLabel ? [destLabel] : [];
  }, [isHotels, cityFilter, tripCities, destLabel]);

  const activeStay = useMemo(() => {
    if (cityFilter !== "all") return findStayWindowForCity(stayWindows, cityFilter) || null;
    if (stayWindows.length === 1) return stayWindows[0];
    return null;
  }, [cityFilter, stayWindows]);

  const stayCheckIn = activeStay?.checkIn || travelDate || "";
  const stayCheckOut = activeStay?.checkOut || travelEndDate || "";

  useEffect(() => {
    if (!open) return;
    const pref = (initialStar || "").trim();
    setStar(pref || "all");
    setHotelTab("recommended");
    setPriceSort("low");
    setQ("");
    setCityFilter(tripCities[0] || "all");
    setRoomSelectHotel(null);
  }, [open, initialStar, tripCities]);

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
          const params = new URLSearchParams({ liveOnly: "true", pageSize: isHotels ? "80" : "20" });
          if (q.trim()) params.set("q", q.trim());
          if (isHotels) {
            // Prefer trip-plan cities over a single destinationId so multi-city quotes match correctly.
            if (activeCities.length > 1) params.set("cities", activeCities.join(","));
            else if (activeCities.length === 1) params.set("city", activeCities[0]);
            else if (destinationId) params.set("destinationId", destinationId);
            else if (destLabel) params.set("city", destLabel);
            if (supplierId !== "all") params.set("supplierId", supplierId);
            if (travelDate) params.set("travelDate", travelDate);
            const cityStayPayload = encodeCityStayDates(stayWindows);
            if (cityStayPayload) params.set("cityStayDates", cityStayPayload);
            if (hotelTab === "recommended") params.set("recommendedOnly", "true");
          } else {
            if (destinationId) params.set("destinationId", destinationId);
            else if (destLabel) params.set("city", destLabel);
          }
          const res = await apiFetch<{ items: ProductRecord[] }>(`/api/products/${kind}?${params.toString()}`);
          let next = res.items || [];
          if (isHotels) {
            // Keep only hotels that match selected trip cities when API returns broader results.
            if (activeCities.length) {
              next = next.filter((item) => activeCities.some((c) => hotelMatchesTripCity(item, c)));
            }
            const min = Number(minPrice);
            const max = Number(maxPrice);
            if (Number.isFinite(min) && min > 0) next = next.filter((item) => hotelDisplayPrice(item) >= min);
            if (Number.isFinite(max) && max > 0) next = next.filter((item) => hotelDisplayPrice(item) <= max);
            const availIn = stayCheckIn || travelDate;
            const availOut = stayCheckOut || travelEndDate;
            if (availableOnly && availIn && availOut) {
              const checked = await Promise.all(
                next.map(async (item) => {
                  try {
                    const rooms = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
                    const firstRoom = rooms[0];
                    const itemStay = findStayWindowForCity(stayWindows, String(item.city || item.destination?.name || ""))
                      || activeStay;
                    const availParams = new URLSearchParams({
                      checkIn: itemStay?.checkIn || availIn,
                      checkOut: itemStay?.checkOut || availOut,
                      rooms: String(quoteRooms),
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
  }, [open, q, kind, destinationId, destLabel, supplierId, minPrice, maxPrice, availableOnly, travelDate, travelEndDate, isHotels, activeCities, stayWindows, stayCheckIn, stayCheckOut, activeStay, quoteRooms, hotelTab]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onOpenChange(false);
    }
    function onPointer(e: MouseEvent) {
      if (isHotels) return;
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
  }, [open, onOpenChange, isHotels]);

  const starCounts = useMemo(() => {
    const counts: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const item of items) {
      const n = hotelStarNumber(item);
      if (n >= 1 && n <= 5) counts[n] += 1;
      else if (n > 5) counts[5] += 1;
    }
    return counts;
  }, [items]);

  const hotelList = useMemo(() => {
    let list = [...items];
    if (star !== "all") {
      const want = Number(star);
      list = list.filter((item) => hotelStarNumber(item) === want || (want === 5 && hotelStarNumber(item) >= 5));
    }
    if (hotelTab === "recommended") {
      list = list.filter((item) => isRecommendedHotel(item));
    }
    list.sort((a, b) => {
      const pa = hotelDisplayPrice(a);
      const pb = hotelDisplayPrice(b);
      return priceSort === "low" ? pa - pb : pb - pa;
    });
    return list;
  }, [items, star, hotelTab, priceSort]);

  async function pickCatalogItem(item: ProductRecord) {
    if (!travelDate) {
      toast({ title: "Select a travel start date before choosing a contracted product.", variant: "destructive" });
      return;
    }
    if (kind === "hotels") {
      const productCity = String(
        item.city || item.destination?.name || (cityFilter !== "all" ? cityFilter : ""),
      ).trim();
      const stayCity = cityFilter !== "all"
        ? cityFilter
        : (findStayWindowForCity(stayWindows, productCity)?.city || productCity || undefined);
      const stay = (stayCity && findStayWindowForCity(stayWindows, stayCity)) || activeStay;
      const cin = stay?.checkIn || travelDate;
      const cout = stay?.checkOut || travelEndDate;
      if (!cin || !cout) {
        toast({
          title: "Travel end date is missing",
          description: "Set Travel Date and trip-city nights in Basic Details, then try again.",
          variant: "destructive",
        });
        return;
      }
      setRoomSelectHotel(item);
      return;
    }
    setPickingId(item.id);
    try {
      const params = new URLSearchParams({
        productType: CATALOG_TYPE[kind],
        productId: item.id,
        travelDate,
      });
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
      if (!rate.applicable || !rate.rateId) {
        toast({
          title: rate.message || NO_VALID_RATE,
          description: `${item.name} needs an active contracted rate covering ${travelDate}.`,
          variant: "destructive",
        });
        return;
      }
      onPick(
        item,
        {
          rateId: rate.rateId,
          validFrom: rate.validFrom || "",
          validTo: rate.validTo || "",
          contractedCost: rate.contractedCost,
          displayPrice: rate.displayPrice,
        },
      );
      onOpenChange(false);
    } catch {
      toast({ title: NO_VALID_RATE, variant: "destructive" });
    } finally {
      setPickingId(null);
    }
  }

  function hotelStayForItem(item: ProductRecord) {
    const productCity = String(
      item.city || item.destination?.name || (cityFilter !== "all" ? cityFilter : ""),
    ).trim();
    const stayCity = cityFilter !== "all"
      ? cityFilter
      : (findStayWindowForCity(stayWindows, productCity)?.city || productCity || undefined);
    const stay = (stayCity && findStayWindowForCity(stayWindows, stayCity)) || activeStay;
    return {
      checkIn: stay?.checkIn || travelDate || "",
      checkOut: stay?.checkOut || travelEndDate || "",
      nights: stay?.nights ?? stayNights(stay?.checkIn || travelDate, stay?.checkOut || travelEndDate),
      city: stay?.city || stayCity,
    };
  }

  function resetHotelFilters() {
    setQ("");
    setStar("all");
    setSupplierId("all");
    setMinPrice("");
    setMaxPrice("");
    setAvailableOnly(true);
    setPriceSort("low");
    setHotelTab("recommended");
    setCityFilter(tripCities[0] || "all");
  }

  const isInlineHotels = isHotels && variant === "inline";

  if (isInlineHotels && open && roomSelectHotel) {
    const stay = hotelStayForItem(roomSelectHotel);
    return (
      <HotelRoomSelectionPanel
        hotel={roomSelectHotel}
        stay={stay}
        quoteRooms={quoteRooms}
        confirming={confirmingRoom}
        onBack={() => setRoomSelectHotel(null)}
        onConfirm={async ({ room, rate, stayCity }) => {
          setConfirmingRoom(true);
          try {
            onPick(roomSelectHotel, rate, stayCity || stay.city, room);
            setRoomSelectHotel(null);
            onOpenChange(false);
          } finally {
            setConfirmingRoom(false);
          }
        }}
      />
    );
  }

  if (isInlineHotels && open) {
    return (
      <div className="rounded-xl border border-border/70 bg-card overflow-hidden flex flex-col min-h-[min(70vh,720px)] max-h-[min(75vh,780px)]">
            <div className="px-4 py-3 border-b bg-muted/20 shrink-0">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Hotel selection</p>
                  <p className="text-base sm:text-lg font-semibold text-foreground mt-0.5">
                    Find your ideal hotel at the best price
                  </p>
                  {activeCities.length > 0 ? (
                    <p className="text-xs text-muted-foreground mt-1">
                      Based on your trip plan
                      {cityFilter === "all" && tripCities.length > 1
                        ? `: ${tripCities.join(" · ")}`
                        : `: ${activeCities.join(" · ")}`}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Add cities in Basic Details to recommend hotels for your trip.
                    </p>
                  )}
                  {tripCities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {tripCities.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setCityFilter("all")}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                            cityFilter === "all"
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-background border-border text-muted-foreground hover:bg-muted/50",
                          )}
                        >
                          All trip cities
                        </button>
                      )}
                      {tripCities.map((city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => setCityFilter(city)}
                          className={cn(
                            "rounded-full px-2.5 py-1 text-[11px] font-medium border transition-colors",
                            cityFilter === city
                              ? "bg-teal-600 text-white border-teal-600"
                              : "bg-background border-border text-muted-foreground hover:bg-muted/50",
                          )}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {[
                      { icon: ShieldCheck, label: "Free Cancellation" },
                      { icon: BadgeCheck, label: "Best Price Promise" },
                      { icon: Headphones, label: "24×7 Travel Support" },
                    ].map((chip) => (
                      <span
                        key={chip.label}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                      >
                        <chip.icon className="w-3.5 h-3.5 text-primary" />
                        {chip.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    {loading ? "…" : `${hotelList.length} results`}
                  </p>
                  <Button type="button" size="sm" variant="outline" onClick={() => onOpenChange(false)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Back
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] flex-1 min-h-0">
              <aside className="border-b md:border-b-0 md:border-r p-4 space-y-5 bg-background overflow-y-auto">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8 text-sm rounded-full"
                    placeholder="Search by hotel name…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Filters</p>
                  <button type="button" className="text-xs text-rose-600 hover:underline" onClick={resetHotelFilters}>
                    Reset
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Sort by Price</p>
                  <div className="space-y-1.5">
                    {(
                      [
                        { key: "low" as const, label: "Low → High" },
                        { key: "high" as const, label: "High → Low" },
                      ]
                    ).map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPriceSort(opt.key)}
                        className={cn(
                          "w-full h-9 rounded-lg border text-sm font-medium transition-colors",
                          priceSort === opt.key
                            ? "bg-teal-600 text-white border-teal-600"
                            : "bg-background border-border text-foreground hover:bg-muted/50",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">Star Rating</p>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => setStar("all")}
                      className={cn(
                        "w-full flex items-center justify-between rounded-lg px-2 py-1.5 text-sm",
                        star === "all" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted/50",
                      )}
                    >
                      <span>Any</span>
                      <span className="text-xs text-muted-foreground">{items.length}</span>
                    </button>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStar(String(n))}
                        className={cn(
                          "w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                          star === String(n) ? "bg-primary/10 font-medium" : "hover:bg-muted/50",
                        )}
                      >
                        <span className="flex items-center gap-0.5">
                          {Array.from({ length: n }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          ))}
                        </span>
                        <span className="flex-1 h-px bg-border" />
                        <span className="text-xs text-muted-foreground w-5 text-right">{starCounts[n] || 0}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-1 border-t">
                  <Label className="text-xs text-muted-foreground">Supplier</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger className="h-9 w-full text-sm"><SelectValue placeholder="Any supplier" /></SelectTrigger>
                    <SelectContent side="bottom" avoidCollisions={false}>
                      <SelectItem value="all">Any supplier</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Checkbox checked={availableOnly} onCheckedChange={(v) => setAvailableOnly(v === true)} />
                    Available for travel dates
                  </label>
                </div>
              </aside>

              <div className="flex flex-col min-h-0 bg-muted/10 overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex flex-wrap items-center gap-2 shrink-0">
                  {(
                    [
                      { key: "recommended" as const, label: "Recommended", icon: Star },
                      { key: "all" as const, label: "All hotels", icon: Hotel },
                    ]
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setHotelTab(tab.key)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border transition-colors",
                        hotelTab === tab.key
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-background text-foreground border-border hover:bg-muted/50",
                      )}
                    >
                      <tab.icon className={cn("w-3.5 h-3.5", hotelTab === tab.key && tab.key === "recommended" ? "fill-amber-300 text-amber-300" : "")} />
                      {tab.label}
                    </button>
                  ))}
                  {onAddSelfBooked && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onAddSelfBooked(cityFilter !== "all" ? cityFilter : undefined);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium border bg-background text-foreground border-border hover:bg-muted/50"
                    >
                      <Home className="w-3.5 h-3.5" />
                      Self booked
                    </button>
                  )}
                </div>

                <p className="px-4 pb-2 text-xs text-muted-foreground shrink-0">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5 align-middle" />
                  {loading ? "Loading hotels…" : `${hotelList.length} hotels found`}
                  {cityFilter !== "all" ? ` · ${cityFilter}` : destLabel ? ` · ${destLabel}` : ""}
                  {stayCheckIn && stayCheckOut
                    ? ` · ${stayCheckIn} → ${stayCheckOut}${activeStay ? ` (${activeStay.nights}n)` : ""}`
                    : travelDate && travelEndDate
                      ? ` · ${travelDate} → ${travelEndDate}`
                      : ""}
                  {` · ${quoteRooms} room${quoteRooms === 1 ? "" : "s"}`}
                </p>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 space-y-3">
                  {loading && (
                    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading hotels…
                    </div>
                  )}
                  {!loading && hotelList.length === 0 && (
                    <div className="rounded-xl border bg-background p-8 text-center space-y-3">
                      <Hotel className="w-10 h-10 mx-auto text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {destLabel ? `No hotels found for ${destLabel}.` : "No live hotels found."}
                      </p>
                      {onAddSelfBooked && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onOpenChange(false);
                            onAddSelfBooked(cityFilter !== "all" ? cityFilter : undefined);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add self-booked instead
                        </Button>
                      )}
                    </div>
                  )}
                  {!loading && hotelList.map((item) => {
                    const img = firstProductImage(item);
                    const stars = hotelStarNumber(item);
                    const recommended = isRecommendedHotel(item);
                    const city = String(item.city || item.destination?.name || destLabel || "");
                    const country = String(item.country || item.destination?.country || "");
                    const address = String(item.address || item.location || "");
                    const price = hotelDisplayPrice(item);
                    const roomCats = Array.isArray(item.roomCategories) ? (item.roomCategories as Array<Record<string, unknown>>) : [];
                    const firstRoom = roomCats[0];
                    const roomLabel = firstRoom?.name ? String(firstRoom.name) : "";
                    const mealLabel = firstRoom?.mealPlan ? String(firstRoom.mealPlan) : "";
                    const cancelLabel = String(item.cancellationPolicy || item.cancellation || "").trim();
                    const busy = pickingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border bg-background shadow-sm hover:border-teal-600/40 hover:shadow-md transition-all"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-[168px_1fr] gap-0">
                          <div className="relative h-36 sm:h-auto sm:min-h-[148px] bg-muted overflow-hidden rounded-t-xl sm:rounded-tr-none sm:rounded-l-xl">
                            {img ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-teal-100 via-cyan-50 to-primary/20 dark:from-teal-950/40 dark:via-background dark:to-primary/10 flex items-center justify-center">
                                <Hotel className="w-12 h-12 text-teal-600/70" />
                              </div>
                            )}
                            {recommended && (
                              <span className="absolute top-0 left-0 z-10 bg-orange-500 text-white text-[10px] font-bold tracking-wide px-2.5 py-1 rounded-br-md shadow-sm">
                                RECOMMENDED
                              </span>
                            )}
                          </div>
                          <div className="p-4 flex flex-col min-w-0 gap-1">
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0 text-teal-600" />
                              <span className="truncate">{[city, country].filter(Boolean).join(", ") || "—"}</span>
                            </p>
                            <p className="font-semibold text-base text-foreground leading-snug truncate">{item.name}</p>
                            {stars > 0 && (
                              <span className="flex items-center gap-0.5 mt-0.5">
                                {Array.from({ length: Math.min(stars, 5) }).map((_, i) => (
                                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                                ))}
                                {stars > 5 ? <span className="text-[10px] text-muted-foreground ml-1">{stars}★</span> : null}
                              </span>
                            )}
                            {(roomLabel || mealLabel) && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {[roomLabel, mealLabel].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            <p className="text-[11px] text-muted-foreground">
                              Cancellation: {cancelLabel || "Unavailable in catalogue"}
                            </p>
                            {recommended ? (
                              <p className="text-[11px] text-teal-700 dark:text-teal-400">Contracted rate available for stay dates</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">No applicable contracted rate for stay dates</p>
                            )}
                            {address ? (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{address}</p>
                            ) : item.supplier?.name ? (
                              <p className="text-xs text-muted-foreground mt-1">Supplier · {item.supplier.name}</p>
                            ) : null}
                            <div className="mt-3 pt-1 flex items-end justify-between gap-3">
                              <div>
                                {price > 0 ? (
                                  <>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">From</p>
                                    <p className="text-sm font-semibold text-teal-700 dark:text-teal-400">{formatFullINR(price)}</p>
                                  </>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Rate on select</p>
                                )}
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy}
                                className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                                onClick={() => void pickCatalogItem(item)}
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5 mr-1.5" />}
                                Select Hotel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button size="sm" variant="outline" type="button" onClick={() => onOpenChange(!open)}>
        <Search className="w-3.5 h-3.5 mr-1" /> Catalog
      </Button>

      {!isHotels && open ? (
        <div className="absolute right-0 z-20 mt-1 rounded-md border bg-popover p-2 shadow-md w-80">
          <div className="flex items-center gap-1 mb-2">
            <Input
              className="h-8 text-xs flex-1"
              placeholder={destLabel ? `Search ${kind} in ${destLabel}…` : `Search ${kind}…`}
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
          {destLabel && (
            <p className="text-[10px] text-muted-foreground px-1 mb-1.5">
              Showing live {kind} for {destLabel}
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
                            onAddSelfBooked(cityFilter !== "all" ? cityFilter : undefined);
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
                onClick={() => void pickCatalogItem(item)}
              >
                <span className="font-medium">{item.name}</span>
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
                {(item.city || item.destination?.name) && (
                  <span className="text-muted-foreground"> · {String(item.city || item.destination?.name)}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

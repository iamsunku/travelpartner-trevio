"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DestinationSelect } from "@/components/shared/destination-select";
import {
  PackageItineraryBuilder,
  ensureItineraryDays,
  itineraryDaysToPayload,
  mapPackageToItineraryDraft,
} from "@/components/shared/package-itinerary-builder";
import {
  PackageProductOptionsBuilder,
  activityPrice,
  calcDefaultCostsFromOptions,
  getOptionGroupsForType,
  hotelPrice,
  legacyJunctionsToOptions,
  mapRecordToOptionDraft,
  optionsToPayload,
  transferPrice,
  type ProductOptionDraft,
} from "@/components/shared/package-product-options-builder";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { TravelPackageRecord } from "@/types";

interface WizardData {
  packageName: string;
  destinationId: string;
  packageType: string;
  durationDays: string;
  durationNights: string;
  description: string;
  highlights: string;
  productOptions: ProductOptionDraft[];
  days: ReturnType<typeof mapPackageToItineraryDraft>;
  hotelCost: string;
  activityCost: string;
  transferCost: string;
  markup: string;
  tax: string;
  discount: string;
  heroImage: string;
  bannerImage: string;
  isFeatured: boolean;
}

const STEPS = ["Basic Info", "Hotels", "Activities", "Transfers", "Itinerary", "Pricing", "Overview"];
const PACKAGE_TYPES = ["Standard", "Premium", "Luxury", "Budget", "Honeymoon", "Family", "Adventure"];

const EMPTY: WizardData = {
  packageName: "", destinationId: "", packageType: "Standard",
  durationDays: "3", durationNights: "2", description: "", highlights: "",
  productOptions: [], days: [],
  hotelCost: "0", activityCost: "0", transferCost: "0", markup: "0", tax: "0", discount: "0",
  heroImage: "", bannerImage: "", isFeatured: false,
};

function calcFinal(d: WizardData) {
  const sub = Number(d.hotelCost) + Number(d.activityCost) + Number(d.transferCost) + Number(d.markup);
  return Math.max(0, sub + Number(d.tax) - Number(d.discount));
}

function loadInitialOptions(initial: TravelPackageRecord): ProductOptionDraft[] {
  if (initial.productOptions?.length) {
    return initial.productOptions.map((o) => mapRecordToOptionDraft(o));
  }
  return legacyJunctionsToOptions(initial.hotels ?? [], initial.activities ?? [], initial.transfers ?? []);
}

function toPayload(d: WizardData, publish: boolean) {
  const finalPrice = calcFinal(d);
  const opts = optionsToPayload(d.productOptions);
  const uniqueHotels = [...new Set(d.productOptions.filter((o) => o.productType === "HOTEL").map((o) => o.productId))];
  const uniqueActivities = [...new Set(d.productOptions.filter((o) => o.productType === "ACTIVITY").map((o) => o.productId))];
  const uniqueTransfers = [...new Set(d.productOptions.filter((o) => o.productType === "TRANSFER").map((o) => o.productId))];

  return {
    packageName: d.packageName,
    destinationId: d.destinationId,
    packageType: d.packageType,
    durationDays: parseInt(d.durationDays, 10) || 1,
    durationNights: parseInt(d.durationNights, 10) || 0,
    description: d.description || null,
    highlights: d.highlights.split(/[,|]/).map((s) => s.trim()).filter(Boolean),
    status: publish ? "Published" : "Draft",
    currency: "INR",
    heroImage: d.heroImage || null,
    bannerImage: d.bannerImage || null,
    isFeatured: d.isFeatured,
    hotelCost: parseInt(d.hotelCost, 10) || 0,
    activityCost: parseInt(d.activityCost, 10) || 0,
    transferCost: parseInt(d.transferCost, 10) || 0,
    markup: parseInt(d.markup, 10) || 0,
    tax: parseInt(d.tax, 10) || 0,
    discount: parseInt(d.discount, 10) || 0,
    finalPrice,
    startingPrice: finalPrice,
    productOptions: opts,
    hotels: uniqueHotels.map((id, i) => ({ id, sortOrder: i })),
    activities: uniqueActivities.map((id, i) => ({ id, sortOrder: i })),
    transfers: uniqueTransfers.map((id, i) => ({ id, sortOrder: i })),
    days: itineraryDaysToPayload(d.days),
  };
}

interface PackageWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: TravelPackageRecord | null;
  onSaved: () => void;
}

export function PackageWizard({ open, onOpenChange, initial, onSaved }: PackageWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    if (!initial) { setData(EMPTY); return; }
    setData({
      packageName: initial.packageName,
      destinationId: initial.destinationId,
      packageType: initial.packageType,
      durationDays: String(initial.durationDays),
      durationNights: String(initial.durationNights),
      description: initial.description ?? "",
      highlights: Array.isArray(initial.highlights) ? initial.highlights.join(", ") : "",
      productOptions: loadInitialOptions(initial),
      days: mapPackageToItineraryDraft(initial),
      hotelCost: String(initial.hotelCost),
      activityCost: String(initial.activityCost),
      transferCost: String(initial.transferCost),
      markup: String(initial.markup),
      tax: String(initial.tax),
      discount: String(initial.discount),
      heroImage: initial.heroImage ?? "",
      bannerImage: initial.bannerImage ?? "",
      isFeatured: initial.isFeatured,
    });
  }, [open, initial]);

  const finalPrice = useMemo(() => calcFinal(data), [data]);
  const set = <K extends keyof WizardData>(key: K, value: WizardData[K]) => setData((d) => ({ ...d, [key]: value }));

  const hotelOptionCount = data.productOptions.filter((o) => o.productType === "HOTEL" && o.status !== "Inactive").length;
  const activityOptionCount = data.productOptions.filter((o) => o.productType === "ACTIVITY" && o.status !== "Inactive").length;

  const autoFillCosts = () => {
    const costs = calcDefaultCostsFromOptions(data.productOptions);
    setData((d) => ({
      ...d,
      hotelCost: String(costs.hotelCost),
      activityCost: String(costs.activityCost),
      transferCost: String(costs.transferCost),
    }));
  };

  useEffect(() => {
    if (step === 5) autoFillCosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    if (step !== 4) return;
    setData((d) => ({
      ...d,
      days: ensureItineraryDays(d.days, parseInt(d.durationDays, 10) || 1),
    }));
  }, [step]);

  const save = async (publish: boolean) => {
    if (!data.packageName || !data.destinationId) return;
    if (publish && (hotelOptionCount < 1 || activityOptionCount < 1)) return;
    setSaving(true);
    try {
      const payload = toPayload(data, false);
      if (initial) {
        await apiFetch(`/api/packages/${initial.id}`, { method: "PATCH", body: JSON.stringify(payload) });
        if (publish) await apiFetch(`/api/packages/${initial.id}/publish`, { method: "PATCH" });
      } else {
        const created = await apiFetch<{ item: TravelPackageRecord }>("/api/packages", { method: "POST", body: JSON.stringify(payload) });
        if (publish) await apiFetch(`/api/packages/${created.item.id}/publish`, { method: "PATCH" });
      }
      onSaved();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const canNext = step === 0 ? data.packageName && data.destinationId : true;

  const optionGroups = useMemo(() => ({
    HOTEL: getOptionGroupsForType(data.productOptions, "HOTEL"),
    ACTIVITY: getOptionGroupsForType(data.productOptions, "ACTIVITY"),
    TRANSFER: getOptionGroupsForType(data.productOptions, "TRANSFER"),
  }), [data.productOptions]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] overflow-y-auto", step === 4 ? "max-w-6xl" : step >= 1 && step <= 3 ? "max-w-3xl" : "max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Package" : "Package Builder"}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 mb-4 flex-wrap">
          {STEPS.map((label, i) => (
            <div key={label} className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full border",
              i === step ? "bg-primary/10 border-primary text-primary" : i < step ? "bg-teal-50 border-teal-200 text-teal-700" : "text-muted-foreground"
            )}>
              {i < step ? <Check className="w-3 h-3" /> : <span>{i + 1}</span>}
              {label}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Package Name *</Label>
              <Input value={data.packageName} onChange={(e) => set("packageName", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Destination *</Label>
              <DestinationSelect value={data.destinationId} onChange={(v) => set("destinationId", v)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Package Type</Label>
              <Select value={data.packageType} onValueChange={(v) => set("packageType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PACKAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Days / Nights</Label>
              <div className="flex gap-2">
                <Input type="number" min={1} value={data.durationDays} onChange={(e) => set("durationDays", e.target.value)} placeholder="Days" />
                <Input type="number" min={0} value={data.durationNights} onChange={(e) => set("durationNights", e.target.value)} placeholder="Nights" />
              </div>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea rows={3} value={data.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Highlights (comma-separated)</Label>
              <Input value={data.highlights} onChange={(e) => set("highlights", e.target.value)} />
            </div>
          </div>
        )}

        {step === 1 && (
          <PackageProductOptionsBuilder
            productType="HOTEL"
            destinationId={data.destinationId}
            options={data.productOptions}
            onChange={(productOptions) => set("productOptions", productOptions)}
            apiPath="/api/products/hotels"
            getPrice={hotelPrice}
            getSubtitle={(p) => [p.city, p.country].filter(Boolean).join(", ")}
          />
        )}

        {step === 2 && (
          <PackageProductOptionsBuilder
            productType="ACTIVITY"
            destinationId={data.destinationId}
            options={data.productOptions}
            onChange={(productOptions) => set("productOptions", productOptions)}
            apiPath="/api/products/activities"
            getPrice={activityPrice}
            getSubtitle={(p) => String(p.location ?? p.duration ?? "")}
          />
        )}

        {step === 3 && (
          <PackageProductOptionsBuilder
            productType="TRANSFER"
            destinationId={data.destinationId}
            options={data.productOptions}
            onChange={(productOptions) => set("productOptions", productOptions)}
            apiPath="/api/products/transfers"
            getPrice={transferPrice}
            getSubtitle={(p) => `${p.pickupLocation} → ${p.dropLocation}`}
          />
        )}

        {step === 4 && (
          <PackageItineraryBuilder
            days={data.days}
            onChange={(days) => set("days", days)}
            optionGroups={optionGroups}
            packageName={data.packageName}
            showPreview
          />
        )}

        {step === 5 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
              Costs auto-calculated from default selections in each base tier (Standard / Included / Shared).
            </div>
            {(["hotelCost", "activityCost", "transferCost", "markup", "tax", "discount"] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                <Input type="number" min={0} value={data[key]} onChange={(e) => set(key, e.target.value)} />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={autoFillCosts}>Recalculate from defaults</Button>
            </div>
            <div className="sm:col-span-2 p-4 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">Final Selling Price</p>
              <p className="text-2xl font-bold text-primary tabular-nums">₹{finalPrice.toLocaleString("en-IN")}</p>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Hero Image URL</Label>
              <Input value={data.heroImage} onChange={(e) => set("heroImage", e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label className="text-xs">Banner Image URL</Label>
              <Input value={data.bannerImage} onChange={(e) => set("bannerImage", e.target.value)} />
            </div>
            <label className="sm:col-span-2 flex items-center gap-2 text-sm">
              <Checkbox checked={data.isFeatured} onCheckedChange={(v) => set("isFeatured", v === true)} />
              Featured package
            </label>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-sm">
            <div className="grid sm:grid-cols-2 gap-3">
              <div><span className="text-muted-foreground">Package</span><p className="font-medium">{data.packageName}</p></div>
              <div><span className="text-muted-foreground">Duration</span><p className="font-medium">{data.durationDays}D / {data.durationNights}N</p></div>
              <div><span className="text-muted-foreground">Hotel Options</span><p className="font-medium">{hotelOptionCount}</p></div>
              <div><span className="text-muted-foreground">Activity Options</span><p className="font-medium">{activityOptionCount}</p></div>
              <div><span className="text-muted-foreground">Transfer Options</span><p className="font-medium">{data.productOptions.filter((o) => o.productType === "TRANSFER").length}</p></div>
              <div><span className="text-muted-foreground">Itinerary Days</span><p className="font-medium">{data.days.length}</p></div>
              <div><span className="text-muted-foreground">Final Price</span><p className="font-bold text-primary">₹{finalPrice.toLocaleString("en-IN")}</p></div>
            </div>
            {hotelOptionCount < 1 || activityOptionCount < 1 ? (
              <p className="text-amber-600 text-xs">Publishing requires at least 1 hotel option and 1 activity option.</p>
            ) : null}
          </div>
        )}

        <div className="flex justify-between pt-4 border-t mt-4">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="w-4 h-4 mr-1" />Back
          </Button>
          <div className="flex gap-2">
            {step === 6 ? (
              <>
                <Button variant="outline" disabled={saving} onClick={() => save(false)}>Save Draft</Button>
                <Button disabled={saving || hotelOptionCount < 1 || activityOptionCount < 1} onClick={() => save(true)}>
                  {saving ? "Publishing..." : "Publish Package"}
                </Button>
              </>
            ) : (
              <Button disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

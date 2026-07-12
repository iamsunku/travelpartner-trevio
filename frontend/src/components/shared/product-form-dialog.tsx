"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ProductRecord } from "@/types";

export type ProductKind = "hotels" | "activities" | "transfers";

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ProductKind;
  initial?: ProductRecord | null;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}

const EMPTY = {
  hotels: {
    name: "", description: "", starCategory: "3", address: "", city: "", country: "India",
    mapsUrl: "", amenities: "", checkInTime: "14:00", checkOutTime: "11:00",
    contactPerson: "", contactPhone: "", contactEmail: "", website: "",
    currency: "INR", cancellationPolicy: "", status: "Active",
    roomName: "Deluxe", roomDescription: "", maxOccupancy: "2", maxAdults: "2", maxChildren: "0",
    mealPlan: "CP", priceSingle: "", priceDouble: "", priceExtraAdult: "", priceExtraChild: "",
  },
  activities: {
    name: "", description: "", duration: "", location: "", meetingPoint: "",
    inclusions: "", exclusions: "", operatingHours: "", minChildAge: "3",
    adultPrice: "", childPrice: "", currency: "INR", cancellationPolicy: "",
    rateValidFrom: "", rateValidTo: "", status: "Active",
  },
  transfers: {
    name: "", transferType: "Private", vehicleType: "Sedan",
    pickupLocation: "", dropLocation: "", pickupTime: "",
    privatePrice: "", sharedPrice: "", currency: "INR",
    rateValidFrom: "", rateValidTo: "", cancellationPolicy: "", status: "Active",
  },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

export function ProductFormDialog({ open, onOpenChange, kind, initial, onSubmit }: ProductFormDialogProps) {
  const [form, setForm] = useState<Record<string, string>>(EMPTY[kind]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!initial) {
      setForm(EMPTY[kind]);
      return;
    }
    if (kind === "hotels") {
      const rooms = Array.isArray(initial.roomCategories) ? (initial.roomCategories as Record<string, unknown>[]) : [];
      const room = rooms[0] ?? {};
      const pricing = (room.pricing as Record<string, number>) ?? {};
      setForm({
        name: String(initial.name ?? ""),
        description: String(initial.description ?? ""),
        starCategory: String(initial.starCategory ?? 3),
        address: String(initial.address ?? ""),
        city: String(initial.city ?? ""),
        country: String(initial.country ?? "India"),
        mapsUrl: String(initial.mapsUrl ?? ""),
        amenities: Array.isArray(initial.amenities) ? (initial.amenities as string[]).join(", ") : "",
        checkInTime: String(initial.checkInTime ?? "14:00"),
        checkOutTime: String(initial.checkOutTime ?? "11:00"),
        contactPerson: String(initial.contactPerson ?? ""),
        contactPhone: String(initial.contactPhone ?? ""),
        contactEmail: String(initial.contactEmail ?? ""),
        website: String(initial.website ?? ""),
        currency: String(initial.currency ?? "INR"),
        cancellationPolicy: String(initial.cancellationPolicy ?? ""),
        status: String(initial.status ?? "Active"),
        roomName: String(room.name ?? "Deluxe"),
        roomDescription: String(room.description ?? ""),
        maxOccupancy: String(room.maxOccupancy ?? 2),
        maxAdults: String(room.maxAdults ?? 2),
        maxChildren: String(room.maxChildren ?? 0),
        mealPlan: String(room.mealPlan ?? "CP"),
        priceSingle: String(pricing.single ?? ""),
        priceDouble: String(pricing.double ?? ""),
        priceExtraAdult: String(pricing.extraAdult ?? ""),
        priceExtraChild: String(pricing.extraChild ?? ""),
      });
    } else if (kind === "activities") {
      setForm({
        name: String(initial.name ?? ""),
        description: String(initial.description ?? ""),
        duration: String(initial.duration ?? ""),
        location: String(initial.location ?? ""),
        meetingPoint: String(initial.meetingPoint ?? ""),
        inclusions: Array.isArray(initial.inclusions) ? (initial.inclusions as string[]).join(", ") : "",
        exclusions: Array.isArray(initial.exclusions) ? (initial.exclusions as string[]).join(", ") : "",
        operatingHours: String(initial.operatingHours ?? ""),
        minChildAge: String(initial.minChildAge ?? 3),
        adultPrice: String(initial.adultPrice ?? ""),
        childPrice: String(initial.childPrice ?? ""),
        currency: String(initial.currency ?? "INR"),
        cancellationPolicy: String(initial.cancellationPolicy ?? ""),
        rateValidFrom: String(initial.rateValidFrom ?? ""),
        rateValidTo: String(initial.rateValidTo ?? ""),
        status: String(initial.status ?? "Active"),
      });
    } else {
      setForm({
        name: String(initial.name ?? ""),
        transferType: String(initial.transferType ?? "Private"),
        vehicleType: String(initial.vehicleType ?? "Sedan"),
        pickupLocation: String(initial.pickupLocation ?? ""),
        dropLocation: String(initial.dropLocation ?? ""),
        pickupTime: String(initial.pickupTime ?? ""),
        privatePrice: String(initial.privatePrice ?? ""),
        sharedPrice: String(initial.sharedPrice ?? ""),
        currency: String(initial.currency ?? "INR"),
        rateValidFrom: String(initial.rateValidFrom ?? ""),
        rateValidTo: String(initial.rateValidTo ?? ""),
        cancellationPolicy: String(initial.cancellationPolicy ?? ""),
        status: String(initial.status ?? "Active"),
      });
    }
  }, [open, initial, kind]);

  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      let payload: Record<string, unknown> = { status: form.status, currency: form.currency };
      if (kind === "hotels") {
        payload = {
          ...payload,
          name: form.name,
          description: form.description || null,
          starCategory: parseInt(form.starCategory, 10) || 3,
          address: form.address || null,
          city: form.city,
          country: form.country,
          mapsUrl: form.mapsUrl || null,
          amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
          checkInTime: form.checkInTime,
          checkOutTime: form.checkOutTime,
          contactPerson: form.contactPerson || null,
          contactPhone: form.contactPhone || null,
          contactEmail: form.contactEmail || null,
          website: form.website || null,
          cancellationPolicy: form.cancellationPolicy || null,
          roomCategories: [{
            name: form.roomName,
            description: form.roomDescription,
            maxOccupancy: parseInt(form.maxOccupancy, 10) || 2,
            maxAdults: parseInt(form.maxAdults, 10) || 2,
            maxChildren: parseInt(form.maxChildren, 10) || 0,
            mealPlan: form.mealPlan,
            pricing: {
              single: parseInt(form.priceSingle, 10) || 0,
              double: parseInt(form.priceDouble, 10) || 0,
              extraAdult: parseInt(form.priceExtraAdult, 10) || 0,
              extraChild: parseInt(form.priceExtraChild, 10) || 0,
            },
          }],
        };
      } else if (kind === "activities") {
        payload = {
          ...payload,
          name: form.name,
          description: form.description || null,
          duration: form.duration || null,
          location: form.location || null,
          meetingPoint: form.meetingPoint || null,
          inclusions: form.inclusions.split(",").map((s) => s.trim()).filter(Boolean),
          exclusions: form.exclusions.split(",").map((s) => s.trim()).filter(Boolean),
          operatingHours: form.operatingHours || null,
          minChildAge: parseInt(form.minChildAge, 10) || null,
          adultPrice: parseInt(form.adultPrice, 10) || 0,
          childPrice: parseInt(form.childPrice, 10) || 0,
          cancellationPolicy: form.cancellationPolicy || null,
          rateValidFrom: form.rateValidFrom || null,
          rateValidTo: form.rateValidTo || null,
        };
      } else {
        payload = {
          ...payload,
          name: form.name,
          transferType: form.transferType,
          vehicleType: form.vehicleType || null,
          pickupLocation: form.pickupLocation,
          dropLocation: form.dropLocation,
          pickupTime: form.pickupTime || null,
          privatePrice: form.privatePrice ? parseInt(form.privatePrice, 10) : null,
          sharedPrice: form.sharedPrice ? parseInt(form.sharedPrice, 10) : null,
          cancellationPolicy: form.cancellationPolicy || null,
          rateValidFrom: form.rateValidFrom || null,
          rateValidTo: form.rateValidTo || null,
        };
      }
      await onSubmit(payload);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  const title = initial ? `Edit ${kind.slice(0, -1)}` : `Add ${kind.slice(0, -1)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{title}</DialogTitle>
        </DialogHeader>

        {kind === "hotels" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Hotel Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Star Category">
              <Select value={form.starCategory} onValueChange={(v) => set("starCategory", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4, 5].map((s) => <SelectItem key={s} value={String(s)}>{s} Star</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2"><Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
            <Field label="Address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
            <Field label="City *"><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
            <Field label="Country"><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></Field>
            <Field label="Google Maps URL"><Input value={form.mapsUrl} onChange={(e) => set("mapsUrl", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Amenities (comma-separated)"><Input value={form.amenities} onChange={(e) => set("amenities", e.target.value)} /></Field></div>
            <Field label="Check-in"><Input value={form.checkInTime} onChange={(e) => set("checkInTime", e.target.value)} /></Field>
            <Field label="Check-out"><Input value={form.checkOutTime} onChange={(e) => set("checkOutTime", e.target.value)} /></Field>
            <Field label="Contact Person"><Input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} /></Field>
            <Field label="Contact Phone"><Input value={form.contactPhone} onChange={(e) => set("contactPhone", e.target.value)} /></Field>
            <Field label="Email"><Input value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} /></Field>
            <Field label="Website"><Input value={form.website} onChange={(e) => set("website", e.target.value)} /></Field>
            <Field label="Currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:col-span-2"><Field label="Cancellation Policy"><Textarea rows={2} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} /></Field></div>
            <Field label="Room Category"><Input value={form.roomName} onChange={(e) => set("roomName", e.target.value)} /></Field>
            <Field label="Meal Plan"><Input value={form.mealPlan} onChange={(e) => set("mealPlan", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Room Description"><Input value={form.roomDescription} onChange={(e) => set("roomDescription", e.target.value)} /></Field></div>
            <Field label="Max Occupancy"><Input type="number" value={form.maxOccupancy} onChange={(e) => set("maxOccupancy", e.target.value)} /></Field>
            <Field label="Max Adults"><Input type="number" value={form.maxAdults} onChange={(e) => set("maxAdults", e.target.value)} /></Field>
            <Field label="Max Children"><Input type="number" value={form.maxChildren} onChange={(e) => set("maxChildren", e.target.value)} /></Field>
            <Field label="Single Price"><Input type="number" value={form.priceSingle} onChange={(e) => set("priceSingle", e.target.value)} /></Field>
            <Field label="Double Price"><Input type="number" value={form.priceDouble} onChange={(e) => set("priceDouble", e.target.value)} /></Field>
            <Field label="Extra Adult"><Input type="number" value={form.priceExtraAdult} onChange={(e) => set("priceExtraAdult", e.target.value)} /></Field>
            <Field label="Extra Child"><Input type="number" value={form.priceExtraChild} onChange={(e) => set("priceExtraChild", e.target.value)} /></Field>
          </div>
        )}

        {kind === "activities" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Activity Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Duration"><Input value={form.duration} onChange={(e) => set("duration", e.target.value)} placeholder="6 hours" /></Field>
            <div className="sm:col-span-2"><Field label="Description"><Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field></div>
            <Field label="Location"><Input value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
            <Field label="Meeting Point"><Input value={form.meetingPoint} onChange={(e) => set("meetingPoint", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Inclusions (comma-separated)"><Input value={form.inclusions} onChange={(e) => set("inclusions", e.target.value)} /></Field></div>
            <div className="sm:col-span-2"><Field label="Exclusions (comma-separated)"><Input value={form.exclusions} onChange={(e) => set("exclusions", e.target.value)} /></Field></div>
            <Field label="Operating Hours"><Input value={form.operatingHours} onChange={(e) => set("operatingHours", e.target.value)} /></Field>
            <Field label="Min Child Age"><Input type="number" value={form.minChildAge} onChange={(e) => set("minChildAge", e.target.value)} /></Field>
            <Field label="Adult Price"><Input type="number" value={form.adultPrice} onChange={(e) => set("adultPrice", e.target.value)} /></Field>
            <Field label="Child Price"><Input type="number" value={form.childPrice} onChange={(e) => set("childPrice", e.target.value)} /></Field>
            <Field label="Currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rate Valid From"><Input type="date" value={form.rateValidFrom} onChange={(e) => set("rateValidFrom", e.target.value)} /></Field>
            <Field label="Rate Valid To"><Input type="date" value={form.rateValidTo} onChange={(e) => set("rateValidTo", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Cancellation Policy"><Textarea rows={2} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} /></Field></div>
          </div>
        )}

        {kind === "transfers" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Transfer Name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Transfer Type">
              <Select value={form.transferType} onValueChange={(v) => set("transferType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private">Private</SelectItem>
                  <SelectItem value="Shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Vehicle Type"><Input value={form.vehicleType} onChange={(e) => set("vehicleType", e.target.value)} /></Field>
            <Field label="Pickup Time"><Input value={form.pickupTime} onChange={(e) => set("pickupTime", e.target.value)} /></Field>
            <Field label="Pickup Location *"><Input value={form.pickupLocation} onChange={(e) => set("pickupLocation", e.target.value)} /></Field>
            <Field label="Drop Location *"><Input value={form.dropLocation} onChange={(e) => set("dropLocation", e.target.value)} /></Field>
            <Field label="Private Price"><Input type="number" value={form.privatePrice} onChange={(e) => set("privatePrice", e.target.value)} /></Field>
            <Field label="Shared Price (per person)"><Input type="number" value={form.sharedPrice} onChange={(e) => set("sharedPrice", e.target.value)} /></Field>
            <Field label="Currency"><Input value={form.currency} onChange={(e) => set("currency", e.target.value)} /></Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rate Valid From"><Input type="date" value={form.rateValidFrom} onChange={(e) => set("rateValidFrom", e.target.value)} /></Field>
            <Field label="Rate Valid To"><Input type="date" value={form.rateValidTo} onChange={(e) => set("rateValidTo", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Cancellation Policy"><Textarea rows={2} value={form.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} /></Field></div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving || !form.name.trim()} onClick={handleSave}>
            {saving ? "Saving..." : initial ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

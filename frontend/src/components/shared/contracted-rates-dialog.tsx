"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

export type ProductRateType = "HOTEL" | "TRANSFER" | "ACTIVITY" | "MEAL" | "FLIGHT";

type RateRow = {
  id: string;
  currency: string;
  contractedCost: number;
  validFrom: string;
  validTo: string;
  active: boolean;
  metadata?: Record<string, unknown>;
};

const EMPTY = {
  contractedCost: "",
  currency: "INR",
  validFrom: "",
  validTo: "",
  roomType: "",
  mealPlan: "",
  vehicleType: "",
  ticketType: "",
  cabinClass: "",
  transferType: "",
};

export function ContractedRatesDialog({
  open,
  onOpenChange,
  productType,
  productId,
  productName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productType: ProductRateType;
  productId: string;
  productName: string;
}) {
  const { toast } = useToast();
  const [rates, setRates] = useState<RateRow[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!open || !productId) return;
    try {
      const data = await apiFetch<{ rates: RateRow[] }>(
        `/api/contracted-rates?productType=${productType}&productId=${encodeURIComponent(productId)}`,
      );
      setRates(data.rates || []);
    } catch {
      toast({ title: "Could not load contracted rates", variant: "destructive" });
    }
  }, [open, productId, productType, toast]);

  useEffect(() => { void load(); }, [load]);

  function metadata() {
    return {
      roomType: form.roomType || undefined,
      mealPlan: form.mealPlan || undefined,
      vehicleType: form.vehicleType || undefined,
      ticketType: form.ticketType || undefined,
      cabinClass: form.cabinClass || undefined,
      transferType: form.transferType || undefined,
    };
  }

  async function save() {
    setBusy(true);
    try {
      const body = {
        productType,
        productId,
        contractedCost: Number(form.contractedCost),
        currency: form.currency || "INR",
        validFrom: form.validFrom,
        validTo: form.validTo,
        active: true,
        metadata: metadata(),
      };
      if (editingId) {
        await apiFetch(`/api/contracted-rates/${editingId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/api/contracted-rates", { method: "POST", body: JSON.stringify(body) });
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
      toast({ title: editingId ? "Rate updated" : "Rate added" });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not save rate", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(rate: RateRow) {
    try {
      await apiFetch(`/api/contracted-rates/${rate.id}`, { method: "PATCH", body: JSON.stringify({ active: !rate.active }) });
      await load();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not update rate", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contracted rates</DialogTitle>
          <DialogDescription>
            {productName}. Cost follows the validity period for the travel date. Overlapping active rates for the same variant are rejected.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {rates.length === 0 && <p className="text-sm text-muted-foreground">No contracted rates yet.</p>}
          {rates.map((rate) => (
            <div key={rate.id} className="rounded-md border p-3 text-sm flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{rate.currency} {rate.contractedCost.toLocaleString("en-IN")} · {rate.active ? "Active" : "Inactive"}</p>
                <p className="text-muted-foreground">{rate.validFrom} → {rate.validTo}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => {
                  const meta = rate.metadata || {};
                  setEditingId(rate.id);
                  setForm({
                    contractedCost: String(rate.contractedCost),
                    currency: rate.currency,
                    validFrom: rate.validFrom,
                    validTo: rate.validTo,
                    roomType: String(meta.roomType || ""),
                    mealPlan: String(meta.mealPlan || ""),
                    vehicleType: String(meta.vehicleType || ""),
                    ticketType: String(meta.ticketType || ""),
                    cabinClass: String(meta.cabinClass || ""),
                    transferType: String(meta.transferType || ""),
                  });
                }}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => deactivate(rate)}>{rate.active ? "Deactivate" : "Activate"}</Button>
              </div>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <Field label="Contracted cost" value={form.contractedCost} onChange={(v) => setForm({ ...form, contractedCost: v })} type="number" />
          <Field label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
          <Field label="Valid from" value={form.validFrom} onChange={(v) => setForm({ ...form, validFrom: v })} type="date" />
          <Field label="Valid to" value={form.validTo} onChange={(v) => setForm({ ...form, validTo: v })} type="date" />
          {productType === "HOTEL" && (
            <>
              <Field label="Room type (optional)" value={form.roomType} onChange={(v) => setForm({ ...form, roomType: v })} />
              <Field label="Meal plan (optional)" value={form.mealPlan} onChange={(v) => setForm({ ...form, mealPlan: v })} />
            </>
          )}
          {productType === "TRANSFER" && (
            <>
              <Field label="Vehicle type (optional)" value={form.vehicleType} onChange={(v) => setForm({ ...form, vehicleType: v })} />
              <Field label="Transfer type (optional)" value={form.transferType} onChange={(v) => setForm({ ...form, transferType: v })} />
            </>
          )}
          {productType === "ACTIVITY" && (
            <Field label="Ticket type (optional)" value={form.ticketType} onChange={(v) => setForm({ ...form, ticketType: v })} />
          )}
          {productType === "FLIGHT" && (
            <Field label="Cabin class (optional)" value={form.cabinClass} onChange={(v) => setForm({ ...form, cabinClass: v })} />
          )}
        </div>
        <div className="flex justify-end gap-2">
          {editingId && <Button variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>Cancel edit</Button>}
          <Button disabled={busy} onClick={save}>{editingId ? "Update rate" : "Add rate"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

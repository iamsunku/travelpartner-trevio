"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";

type Pricing = {
  hotelCost: number;
  activityCost: number;
  transferCost: number;
  packageBase: number;
  markup: number;
  sellingPrice: number;
};

interface TripPricePanelProps {
  requirementId: string;
  packageId: string;
  markup: number;
  hotelOptionGroup?: string | null;
  activityOptionGroup?: string | null;
  transferOptionGroup?: string | null;
  compact?: boolean;
}

export function TripPricePanel({
  requirementId, packageId, markup,
  hotelOptionGroup, activityOptionGroup, transferOptionGroup, compact,
}: TripPricePanelProps) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [hotelG, setHotelG] = useState(hotelOptionGroup ?? "");
  const [activityG, setActivityG] = useState(activityOptionGroup ?? "");
  const [transferG, setTransferG] = useState(transferOptionGroup ?? "");

  const load = useCallback(async () => {
    if (!packageId) return;
    const data = await apiFetch<{ pricing: Pricing }>(`/api/trip-requirements/${requirementId}/calculate-price`, {
      method: "POST",
      body: JSON.stringify({
        packageId,
        hotelOptionGroup: hotelG || null,
        activityOptionGroup: activityG || null,
        transferOptionGroup: transferG || null,
        markup,
      }),
    });
    setPricing(data.pricing);
  }, [requirementId, packageId, hotelG, activityG, transferG, markup]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (hotelOptionGroup) setHotelG(hotelOptionGroup);
    if (activityOptionGroup) setActivityG(activityOptionGroup);
    if (transferOptionGroup) setTransferG(transferOptionGroup);
  }, [hotelOptionGroup, activityOptionGroup, transferOptionGroup]);

  if (!pricing) return null;

  const rows: [string, number][] = [
    ["Hotel (selected tier)", pricing.hotelCost],
    ["Activities (selected tier)", pricing.activityCost],
    ["Transfer (selected tier)", pricing.transferCost],
    ["Package subtotal", pricing.packageBase],
    ["Markup", pricing.markup],
  ];

  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="p-4 space-y-3">
        <h4 className="font-semibold text-sm text-[#2A7BBD]">Live Price Calculation</h4>
        {!compact && (
          <div className="grid gap-2 sm:grid-cols-3 text-xs">
            <div className="space-y-1">
              <Label className="text-[10px]">Hotel tier</Label>
              <Select value={hotelG || "auto"} onValueChange={(v) => setHotelG(v === "auto" ? "" : v)}>
                <SelectTrigger className="h-8"><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Package default</SelectItem>
                  {["Standard", "Premium", "Luxury"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Activity tier</Label>
              <Select value={activityG || "auto"} onValueChange={(v) => setActivityG(v === "auto" ? "" : v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Package default</SelectItem>
                  {["Included", "Optional", "Premium"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Transfer tier</Label>
              <Select value={transferG || "auto"} onValueChange={(v) => setTransferG(v === "auto" ? "" : v)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Package default</SelectItem>
                  {["Shared", "Private", "Luxury"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <div className="space-y-1 text-sm">
          {rows.map(([label, val]) => (
            <div key={label} className="flex justify-between py-1 border-b border-border/40 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums font-medium">₹{val.toLocaleString("en-IN")}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 text-base font-bold">
            <span>Selling Price</span>
            <span className="text-[#2A7BBD] tabular-nums">₹{pricing.sellingPrice.toLocaleString("en-IN")}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

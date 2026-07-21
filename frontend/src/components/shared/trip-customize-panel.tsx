"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { PackageMatchRecord } from "@/types";

interface TripCustomizePanelProps {
  requirementId: string;
  match: PackageMatchRecord;
  markup: number;
  onClose: () => void;
  onSelected: () => void;
}

export function TripCustomizePanel({ requirementId, match, markup, onClose, onSelected }: TripCustomizePanelProps) {
  const pkg = match.package;
  const [hotelGroup, setHotelGroup] = useState(pkg.hotelOptionGroups?.[0] ?? "Standard");
  const [activityGroup, setActivityGroup] = useState(pkg.activityOptionGroups?.[0] ?? "Included");
  const [transferGroup, setTransferGroup] = useState(pkg.transferOptionGroups?.[0] ?? "Shared");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHotelGroup(pkg.hotelOptionGroups?.[0] ?? "Standard");
    setActivityGroup(pkg.activityOptionGroups?.[0] ?? "Included");
    setTransferGroup(pkg.transferOptionGroups?.[0] ?? "Shared");
  }, [pkg.id, pkg.hotelOptionGroups, pkg.activityOptionGroups, pkg.transferOptionGroups]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/trip-requirements/${requirementId}/select-package`, {
        method: "POST",
        body: JSON.stringify({
          packageId: match.packageId,
          hotelOptionGroup: hotelGroup,
          activityOptionGroup: activityGroup,
          transferOptionGroup: transferGroup,
          markup,
          matchScore: match.score,
          matchReasons: match.reasons,
        }),
      });
      onSelected();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Customize — {pkg.packageName}</h4>
          <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
        </div>
        <p className="text-xs text-muted-foreground">Selections apply only to this trip requirement, not the master package.</p>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs">Hotel Option Group</Label>
            <Select value={hotelGroup} onValueChange={setHotelGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(pkg.hotelOptionGroups?.length ? pkg.hotelOptionGroups : ["Standard", "Premium", "Luxury"]).map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Activity Group</Label>
            <Select value={activityGroup} onValueChange={setActivityGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(pkg.activityOptionGroups?.length ? pkg.activityOptionGroups : ["Included", "Optional", "Premium"]).map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Transfer Group</Label>
            <Select value={transferGroup} onValueChange={setTransferGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(pkg.transferOptionGroups?.length ? pkg.transferOptionGroups : ["Shared", "Private", "Luxury"]).map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save Package Selection"}
        </Button>
      </CardContent>
    </Card>
  );
}

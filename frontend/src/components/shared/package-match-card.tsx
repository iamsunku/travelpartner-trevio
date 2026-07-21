"use client";

import { MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PackageMatchRecord } from "@/types";

interface PackageMatchCardProps {
  match: PackageMatchRecord;
  selected?: boolean;
  onView: () => void;
  onCustomize: () => void;
}

export function PackageMatchCard({ match, selected, onView, onCustomize }: PackageMatchCardProps) {
  const pkg = match.package;
  const price = pkg.finalPrice ?? pkg.startingPrice;

  return (
    <Card className={cn("border-border/80 shadow-none overflow-hidden", selected && "ring-2 ring-[#2A7BBD]")}>
      <CardContent className="p-0">
        <div className="flex gap-3">
          {pkg.heroImage ? (
            <div className="w-24 shrink-0 bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pkg.heroImage} alt="" className="w-full h-full object-cover min-h-[88px]" />
            </div>
          ) : (
            <div className="w-24 shrink-0 bg-muted flex items-center justify-center min-h-[88px]">
              <MapPin className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 py-3 pr-3 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm truncate">{pkg.packageName}</p>
                <p className="text-xs text-muted-foreground">{pkg.destination?.name} · {pkg.durationDays}D/{pkg.durationNights}N</p>
              </div>
              <div className={cn(
                "shrink-0 text-xs font-bold px-2 py-1 rounded-full",
                match.score >= 90 ? "bg-teal-50 text-teal-700" : match.score >= 75 ? "bg-amber-50 text-amber-700" : "bg-muted text-muted-foreground"
              )}>
                {match.score}%
              </div>
            </div>
            <p className="text-sm font-semibold text-[#2A7BBD] mt-1 tabular-nums">From ₹{price.toLocaleString("en-IN")}</p>
            <ul className="mt-2 space-y-0.5">
              {match.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 text-teal-500 shrink-0" />{r}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onView}>View</Button>
              <Button type="button" size="sm" className="h-7 text-xs" onClick={onCustomize}>Customize</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

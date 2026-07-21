"use client";

import { Hotel, Activity, Car, FileText, Coffee, UtensilsCrossed, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItineraryProductRef, MealPlan, PackageDayRecord, PackageTimelineItemRecord } from "@/types";

const ITEM_ICONS = {
  HOTEL: Hotel,
  ACTIVITY: Activity,
  TRANSFER: Car,
  TEXT: FileText,
} as const;

function mealLabels(mealPlan?: MealPlan): string[] {
  if (!mealPlan) return [];
  const labels: string[] = [];
  if (mealPlan.breakfast) labels.push("Breakfast");
  if (mealPlan.lunch) labels.push("Lunch");
  if (mealPlan.dinner) labels.push("Dinner");
  if (mealPlan.snacks) labels.push("Snacks");
  return labels;
}

function formatTimeRange(start?: string | null, end?: string | null) {
  if (!start && !end) return null;
  if (start && end) return `${start} – ${end}`;
  return start ?? end;
}

function resolveItemImage(
  item: PackageTimelineItemRecord & { image?: string },
  hotels: ItineraryProductRef[],
  activities: ItineraryProductRef[],
  transfers: ItineraryProductRef[]
) {
  if (item.image) return item.image;
  const pool = item.itemType === "HOTEL" ? hotels : item.itemType === "ACTIVITY" ? activities : item.itemType === "TRANSFER" ? transfers : [];
  return pool.find((p) => p.id === item.referenceId)?.image;
}

interface PackageItineraryPreviewProps {
  packageName?: string;
  days: PackageDayRecord[];
  hotels?: ItineraryProductRef[];
  activities?: ItineraryProductRef[];
  transfers?: ItineraryProductRef[];
  compact?: boolean;
}

export function PackageItineraryPreview({
  packageName,
  days,
  hotels = [],
  activities = [],
  transfers = [],
  compact = false,
}: PackageItineraryPreviewProps) {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);

  if (!sorted.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        No itinerary days yet. Add days in the Itinerary step to see a live preview.
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", compact && "space-y-4")}>
      {packageName && (
        <div className="border-b pb-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Itinerary Preview</p>
          <h3 className="text-lg font-semibold text-[#2A7BBD]">{packageName}</h3>
        </div>
      )}

      {sorted.map((day) => {
        const meals = mealLabels(day.mealPlan);
        const items = [...(day.items ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

        return (
          <article key={day.id} className="rounded-xl border border-border/80 overflow-hidden bg-card">
            {day.coverImage && (
              <div className="h-32 bg-muted overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={day.coverImage} alt={day.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-[#2A7BBD] uppercase tracking-wide">Day {day.dayNumber}</span>
                  <h4 className="font-semibold">{day.title}</h4>
                  {day.description && <p className="text-sm text-muted-foreground mt-1">{day.description}</p>}
                </div>
                {meals.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {meals.map((m) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-100 flex items-center gap-1">
                        {m === "Breakfast" && <Coffee className="w-3 h-3" />}
                        {(m === "Lunch" || m === "Dinner") && <UtensilsCrossed className="w-3 h-3" />}
                        {m === "Snacks" && <Moon className="w-3 h-3" />}
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No timeline items</p>
              ) : (
                <ol className="relative pl-6 space-y-0">
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" aria-hidden />
                  {items.map((item, idx) => {
                    const Icon = ITEM_ICONS[item.itemType] ?? FileText;
                    const time = formatTimeRange(item.startTime, item.endTime);
                    const img = resolveItemImage(item, hotels, activities, transfers);

                    return (
                      <li key={item.id} className="relative pb-4 last:pb-0">
                        <span className="absolute -left-6 top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#2A7BBD] bg-background">
                          <Icon className="w-3 h-3 text-[#2A7BBD]" />
                        </span>
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                          <div className="flex gap-3">
                            {img && (
                              <div className="shrink-0 w-14 h-14 rounded-md overflow-hidden bg-muted">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={img} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-sm">{item.title}</p>
                                {time && <span className="text-[10px] text-muted-foreground tabular-nums">{time}</span>}
                              </div>
                              {item.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.description}</p>
                              )}
                              {item.notes && (
                                <p className="text-[10px] text-muted-foreground mt-1 italic">Note: {item.notes}</p>
                              )}
                            </div>
                          </div>
                        </div>
                        {idx < items.length - 1 && (
                          <div className="flex justify-center py-0.5" aria-hidden>
                            <span className="text-muted-foreground/40 text-xs">↓</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}

              {Array.isArray(day.gallery) && day.gallery.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pt-1">
                  {day.gallery.filter(Boolean).map((url, i) => (
                    <div key={i} className="shrink-0 w-16 h-16 rounded-md overflow-hidden bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

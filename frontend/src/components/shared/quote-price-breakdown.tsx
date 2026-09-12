"use client";

import type { ComponentType, ReactNode } from "react";
import {
  CalendarDays, DoorOpen, Users, User, Baby, Tag, ListOrdered, Minus, Plus,
} from "lucide-react";
import { formatFullINR } from "@/components/shared/ui-helpers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedQuoteCosting } from "@/lib/quote-costing";

function formatPrettyDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
  disabled,
}: {
  value: number;
  onChange?: (n: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const editable = Boolean(onChange) && !disabled;
  return (
    <div className="inline-flex items-center rounded-full border bg-background shadow-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        disabled={!editable || value <= min}
        onClick={() => onChange?.(Math.max(min, value - 1))}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        disabled={!editable || value >= max}
        onClick={() => onChange?.(Math.min(max, value + 1))}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card shadow-sm p-4 space-y-3", className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
        <Icon className="h-3.5 w-3.5 text-sky-600" />
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", bold && "font-semibold")}>
      <span className={cn(bold ? "text-foreground" : "text-slate-600")}>{label}</span>
      <span className={cn("tabular-nums", bold ? "text-foreground" : "text-slate-800")}>{value}</span>
    </div>
  );
}

export type QuotePriceBreakdownProps = {
  costing: ResolvedQuoteCosting;
  editable?: boolean;
  onChangeDates?: (checkIn: string, checkOut: string) => void;
  onChangeRooms?: (rooms: number) => void;
  onChangeTravellers?: (adults: number, children: number, infants: number) => void;
  showInternal?: boolean;
  audience?: "internal" | "agent" | "customer";
  className?: string;
};

export function QuotePriceBreakdown({
  costing,
  editable,
  onChangeDates,
  onChangeRooms,
  onChangeTravellers,
  showInternal,
  audience,
  className,
}: QuotePriceBreakdownProps) {
  const view = audience || (showInternal ? "internal" : "customer");
  const checkIn = costing.checkIn || "";
  const checkOut = costing.checkOut || "";

  return (
    <div className={cn("space-y-3", className)}>
      <SectionCard icon={CalendarDays} title="Stay Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Check-In</Label>
            {editable && onChangeDates ? (
              <Input
                type="date"
                className="h-9 border-rose-200 focus-visible:ring-rose-300"
                value={checkIn.slice(0, 10)}
                onChange={(e) => onChangeDates(e.target.value, checkOut.slice(0, 10))}
              />
            ) : (
              <div className="h-9 rounded-md border border-rose-200 px-3 flex items-center justify-between text-sm text-rose-700">
                <span>{formatPrettyDate(checkIn)}</span>
                <CalendarDays className="h-3.5 w-3.5 opacity-60" />
              </div>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Check-Out</Label>
            {editable && onChangeDates ? (
              <Input
                type="date"
                className="h-9 border-rose-200 focus-visible:ring-rose-300"
                value={checkOut.slice(0, 10)}
                onChange={(e) => onChangeDates(checkIn.slice(0, 10), e.target.value)}
              />
            ) : (
              <div className="h-9 rounded-md border border-rose-200 px-3 flex items-center justify-between text-sm text-rose-700">
                <span>{formatPrettyDate(checkOut)}</span>
                <CalendarDays className="h-3.5 w-3.5 opacity-60" />
              </div>
            )}
          </div>
        </div>
        {editable && (
          <p className="text-[11px] text-muted-foreground">Change dates to refresh hotel rates and totals.</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <DoorOpen className="h-4 w-4 text-slate-400" />
            Room Count
          </div>
          <Stepper
            value={costing.roomCount}
            min={1}
            onChange={editable ? onChangeRooms : undefined}
          />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wide uppercase text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Travellers
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400" />
              Adults (12+ yrs)
            </div>
            <Stepper
              value={costing.adults}
              min={1}
              onChange={
                editable && onChangeTravellers
                  ? (n) => onChangeTravellers(n, costing.children, costing.infants)
                  : undefined
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-slate-400" />
              Children (2-11 yrs)
            </div>
            <Stepper
              value={costing.children}
              onChange={
                editable && onChangeTravellers
                  ? (n) => onChangeTravellers(costing.adults, n, costing.infants)
                  : undefined
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Baby className="h-4 w-4 text-slate-400" />
              Infants (0-2 yrs)
            </div>
            <Stepper
              value={costing.infants}
              onChange={
                editable && onChangeTravellers
                  ? (n) => onChangeTravellers(costing.adults, costing.children, n)
                  : undefined
              }
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={Tag} title="Rate Breakdown">
        <Row label="Per Adult Price" value={formatFullINR(costing.perAdultPrice)} />
        <Row label="Per Child Price (2-11 yrs)" value={formatFullINR(costing.perChildPrice)} />
      </SectionCard>

      <SectionCard icon={ListOrdered} title="Price Summary">
        {view === "internal" && (
          <Row label="Contracted Cost" value={formatFullINR(costing.totalNetCost)} />
        )}
        {view === "internal" && (
          <Row label="Trevio Markup" value={formatFullINR(costing.trevioMarkupAmount || 0)} />
        )}
        {view !== "customer" && (
          <Row label="Trevio Selling Price" value={formatFullINR(costing.trevioSellingPrice || 0)} />
        )}
        {view !== "customer" && (
          <Row label="Agent Markup" value={formatFullINR(costing.agentMarkupAmount || 0)} />
        )}
        <Row label="Package Price (Base)" value={formatFullINR(costing.packageBase)} />
        <Row
          label={costing.taxConfigured === false || costing.taxRate <= 0 ? "Tax configuration required" : `Applicable tax (${costing.taxRate}%)`}
          value={costing.taxRate > 0 ? formatFullINR(costing.gst) : "—"}
        />
        <div className="border-t border-dashed my-1" />
        <Row label="Total Price" value={formatFullINR(costing.total)} bold />
        {view === "internal" && (
          <>
            <div className="border-t border-dashed my-1" />
            <Row label="Per person" value={formatFullINR(costing.perPersonCost)} />
            <Row label="Profit" value={formatFullINR(costing.grossProfit)} />
            <Row label="Margin" value={`${costing.profitMargin}%`} />
          </>
        )}
      </SectionCard>
    </div>
  );
}

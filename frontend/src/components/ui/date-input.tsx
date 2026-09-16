"use client";

import { useMemo, useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** Convert yyyy-mm-dd ↔ Date at noon to avoid timezone day shifts. */
function parseIsoDate(iso: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Always display as dd/mm/yyyy. */
export function formatDateDisplay(iso: string | undefined | null, empty = "dd/mm/yyyy"): string {
  const d = iso ? parseIsoDate(iso) : undefined;
  if (!d) return empty;
  const day = String(d.getDate()).padStart(2, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${m}/${d.getFullYear()}`;
}

type DateInputProps = {
  value?: string;
  onChange?: (iso: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  min?: string;
  max?: string;
};

/**
 * Date picker that stores ISO (yyyy-mm-dd) and always shows dd/mm/yyyy.
 * Drop-in replacement for native <input type="date"> display format.
 */
export function DateInput({
  value = "",
  onChange,
  className,
  disabled,
  id,
  name,
  placeholder = "dd/mm/yyyy",
  min,
  max,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseIsoDate(value), [value]);
  const minDate = useMemo(() => (min ? parseIsoDate(min) : undefined), [min]);
  const maxDate = useMemo(() => (max ? parseIsoDate(max) : undefined), [max]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal px-3",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{formatDateDisplay(value, placeholder)}</span>
          <CalendarIcon className="w-4 h-4 opacity-50 shrink-0" />
          {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="bottom" avoidCollisions={false}>
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={(date) => {
            if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
            if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
            return false;
          }}
          onSelect={(d) => {
            if (!d) {
              onChange?.("");
              return;
            }
            onChange?.(toIsoDate(d));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

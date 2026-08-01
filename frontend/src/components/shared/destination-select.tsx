"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

export interface DestinationOption {
  id: string;
  name: string;
  country?: string;
  region?: string | null;
}

interface DestinationSelectProps {
  value: string;
  onChange: (destinationId: string) => void;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function DestinationSelect({
  value,
  onChange,
  required,
  disabled,
  placeholder = "Select destination...",
}: DestinationSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DestinationOption[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "50",
        status: "Active",
        ...(q ? { q } : {}),
      });
      const data = await apiFetch<{ items: DestinationOption[] }>(`/api/destinations?${params}`);
      setOptions(data.items || []);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => load(query), 200);
    return () => clearTimeout(timer);
  }, [open, query, load]);

  useEffect(() => {
    if (!value || options.some((o) => o.id === value)) return;
    apiFetch<{ item: DestinationOption }>(`/api/destinations/${value}`)
      .then((data) => setOptions((prev) => (prev.some((o) => o.id === data.item.id) ? prev : [data.item, ...prev])))
      .catch(() => undefined);
  }, [value, options]);

  const selected = options.find((o) => o.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !value && "text-muted-foreground")}
        >
          <span className="truncate flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
            {selected ? `${selected.name}${selected.country ? `, ${selected.country}` : ""}` : placeholder}
            {required && !value && <span className="text-destructive">*</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
        <Input
          placeholder="Search destinations..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-48 overflow-y-auto space-y-0.5">
          {loading ? (
            <p className="text-xs text-muted-foreground p-2">Loading...</p>
          ) : options.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">
              No destinations found. Add them under Products → Destinations.
            </p>
          ) : options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={cn(
                "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted",
                value === opt.id && "bg-muted"
              )}
              onClick={() => {
                onChange(opt.id);
                setOpen(false);
              }}
            >
              <Check className={cn("h-4 w-4 shrink-0", value === opt.id ? "opacity-100" : "opacity-0")} />
              <span className="truncate">
                {opt.name}
                {(opt.region || opt.country) && (
                  <span className="text-muted-foreground text-xs ml-1">
                    — {[opt.region, opt.country].filter(Boolean).join(", ")}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

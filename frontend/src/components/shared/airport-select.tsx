"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  formatAirportValue,
  parseAirportValue,
  searchWorldAirports,
  type WorldAirport,
} from "@/lib/world-airports";

type AirportSelectProps = {
  value: string;
  onChange: (value: string, airport?: WorldAirport) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function AirportSelect({
  value,
  onChange,
  placeholder = "Select leaving airport…",
  disabled,
  className,
}: AirportSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const parsed = parseAirportValue(value);
  const results = useMemo(() => searchWorldAirports(query, 50), [query]);

  function pick(a: WorldAirport) {
    onChange(formatAirportValue(a), a);
    setOpen(false);
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 shrink-0 opacity-60" />
            {parsed.label || placeholder}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {value ? (
              <span
                role="button"
                tabIndex={0}
                className="rounded p-0.5 hover:bg-muted"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" && e.key !== " ") return;
                  e.preventDefault();
                  e.stopPropagation();
                  onChange("");
                }}
              >
                <X className="w-3.5 h-3.5 opacity-60" />
              </span>
            ) : null}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || !results[0]) return;
                e.preventDefault();
                pick(results[0]);
              }}
              placeholder="City, airport or IATA (e.g. Bengaluru, BLR)"
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {!query.trim() ? (
            <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Popular airports
            </p>
          ) : null}
          {results.length === 0 ? (
            <p className="px-3 py-6 text-sm text-center text-muted-foreground">
              No airports match &quot;{query}&quot;
            </p>
          ) : (
            results.map((a) => (
              <button
                key={a.code}
                type="button"
                onClick={() => pick(a)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60",
                  parsed.code === a.code && "bg-primary/10",
                )}
              >
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {a.city}{" "}
                    <span className="text-muted-foreground font-normal">· {a.name}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">{a.country}</p>
                </div>
                <span className="text-xs font-bold text-primary shrink-0">{a.code}</span>
              </button>
            ))
          )}
          <p className="px-3 py-2 text-[10px] text-muted-foreground border-t">
            {WORLD_AIRPORTS_COUNT_LABEL}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const WORLD_AIRPORTS_COUNT_LABEL = "Search 6,000+ IATA airports worldwide";

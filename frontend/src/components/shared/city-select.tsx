"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronsUpDown, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  loadWorldCities,
  parseCityValue,
  preloadWorldCities,
  searchWorldCities,
  type WorldCity,
} from "@/lib/world-cities";

type CompactCity = { n: string; o: string; p?: number };

type CitySelectProps = {
  value: string;
  onChange: (cityName: string, city?: WorldCity) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function CitySelect({
  value,
  onChange,
  placeholder = "Select City",
  disabled,
  className,
}: CitySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<CompactCity[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parsed = parseCityValue(value);

  // Warm cache as soon as the control mounts (Basic Details).
  useEffect(() => {
    preloadWorldCities();
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    if (cities) {
      setLoading(false);
      setError(null);
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);

    loadWorldCities()
      .then((list) => {
        if (!alive) return;
        setCities(list);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load world cities");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, cities]);

  const results = useMemo(
    () => (cities ? searchWorldCities(cities, query, 50) : []),
    [cities, query],
  );

  function pick(city: WorldCity) {
    onChange(city.name, city);
    setOpen(false);
    setQuery("");
  }

  const label = value
    ? (parsed.country ? parsed.label : value)
    : placeholder;

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
            {label}
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
              placeholder="City or country (e.g. Phuket, Goa, Thailand)"
              className="pl-8 h-9"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {loading && !cities ? (
            <p className="px-3 py-6 text-sm text-center text-muted-foreground">Loading world cities…</p>
          ) : error && !cities ? (
            <div className="px-3 py-4 space-y-2 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                className="text-xs text-sky-600 hover:underline"
                onClick={() => {
                  setCities(null);
                  setError(null);
                  setLoading(true);
                  loadWorldCities()
                    .then((list) => {
                      setCities(list);
                      setLoading(false);
                    })
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : "Could not load world cities");
                      setLoading(false);
                    });
                }}
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {!query.trim() ? (
                <p className="px-3 pt-1.5 pb-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                  Popular cities
                </p>
              ) : null}
              {results.length === 0 ? (
                <p className="px-3 py-6 text-sm text-center text-muted-foreground">
                  {query.trim() ? `No cities match "${query}"` : "Type to search cities…"}
                </p>
              ) : (
                results.map((c) => (
                  <button
                    key={`${c.name}|${c.country}`}
                    type="button"
                    onClick={() => pick(c)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60",
                      value === c.name && "bg-primary/10",
                    )}
                  >
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground">{c.country}</p>
                    </div>
                  </button>
                ))
              )}
              <p className="px-3 py-2 text-[10px] text-muted-foreground border-t">
                Search 140,000+ cities worldwide
              </p>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

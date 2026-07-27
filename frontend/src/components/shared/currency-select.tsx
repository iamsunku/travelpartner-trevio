"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCY_OPTIONS } from "@/lib/currency-options";

export function CurrencySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <Select value={value || "INR"} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
      <SelectContent>
        {CURRENCY_OPTIONS.map((c) => (
          <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

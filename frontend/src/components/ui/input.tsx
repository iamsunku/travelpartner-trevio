"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";

function Input({ className, type, value, defaultValue, onChange, ...props }: React.ComponentProps<"input">) {
  // App-wide: date fields always display/select as dd/mm/yyyy while storing yyyy-mm-dd.
  if (type === "date") {
    const iso = typeof value === "string" ? value : typeof defaultValue === "string" ? defaultValue : "";
    return (
      <DateInput
        id={props.id}
        name={props.name}
        disabled={props.disabled}
        className={className}
        value={iso}
        min={typeof props.min === "string" ? props.min : undefined}
        max={typeof props.max === "string" ? props.max : undefined}
        onChange={(next) => {
          onChange?.({
            target: { value: next },
            currentTarget: { value: next },
          } as React.ChangeEvent<HTMLInputElement>);
        }}
      />
    );
  }

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-lg border bg-transparent px-3 py-1 text-sm shadow-xs transition-enterprise outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      {...props}
    />
  );
}

export { Input };

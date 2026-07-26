"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DetailBackButton({
  label = "Back",
  onClick,
}: {
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 mb-1 h-8 text-muted-foreground hover:text-foreground" onClick={onClick} aria-label={label}>
      <ArrowLeft className="w-4 h-4 mr-1.5" aria-hidden />
      {label}
    </Button>
  );
}

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
    <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onClick}>
      <ArrowLeft className="w-4 h-4 mr-1" aria-hidden />
      {label}
    </Button>
  );
}

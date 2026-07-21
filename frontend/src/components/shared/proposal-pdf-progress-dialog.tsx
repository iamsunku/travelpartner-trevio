"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, FileText, ImageIcon, Loader2, Save, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

export type PdfProgressStep =
  | "preparing"
  | "rendering"
  | "images"
  | "generating"
  | "saving"
  | "complete"
  | "error";

const STEPS: { key: PdfProgressStep; label: string; icon: typeof FileText }[] = [
  { key: "preparing", label: "Preparing proposal", icon: FileText },
  { key: "rendering", label: "Rendering pages", icon: Sparkles },
  { key: "images", label: "Embedding images", icon: ImageIcon },
  { key: "generating", label: "Generating PDF", icon: Loader2 },
  { key: "saving", label: "Saving", icon: Save },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

const STEP_PROGRESS: Record<PdfProgressStep, number> = {
  preparing: 12,
  rendering: 35,
  images: 55,
  generating: 75,
  saving: 90,
  complete: 100,
  error: 100,
};

interface ProposalPdfProgressDialogProps {
  open: boolean;
  step: PdfProgressStep;
  error?: string | null;
  onOpenChange?: (open: boolean) => void;
}

export function ProposalPdfProgressDialog({
  open,
  step,
  error,
  onOpenChange,
}: ProposalPdfProgressDialogProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open || step === "complete" || step === "error") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 400);
    return () => window.clearInterval(id);
  }, [open, step]);

  const activeIdx = STEPS.findIndex((s) => s.key === step);
  const progress = STEP_PROGRESS[step] ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={step === "complete" || step === "error"}>
        <DialogHeader>
          <DialogTitle>Proposal PDF</DialogTitle>
          <DialogDescription>
            {error
              ? "Generation failed"
              : step === "complete"
                ? "Your branded travel proposal PDF is ready."
                : "Building a multi-page PDF from the proposal snapshot and quote template."}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-2" />

        <ul className="mt-4 space-y-2.5">
          {STEPS.map((s, idx) => {
            const done = step === "complete" || (activeIdx > idx && step !== "error");
            const active = s.key === step && step !== "error";
            const Icon = s.icon;
            return (
              <li
                key={s.key}
                className={`flex items-center gap-3 text-sm ${
                  done ? "text-foreground" : active ? "text-[#2A7BBD]" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                    done
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                      : active
                        ? "border-[#2A7BBD]/40 bg-[#2A7BBD]/10"
                        : "border-border"
                  }`}
                >
                  {active && s.key !== "complete" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Icon className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className={done || active ? "font-medium" : undefined}>
                  {s.label}
                  {active && step !== "complete" ? ".".repeat((tick % 3) + 1) : ""}
                </span>
              </li>
            );
          })}
        </ul>

        {error && (
          <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Advance UI stages while an async PDF generate call is in flight. */
export function runPdfProgressSequence(
  setStep: (step: PdfProgressStep) => void,
  signal: { cancelled: boolean }
): () => void {
  const schedule: { ms: number; step: PdfProgressStep }[] = [
    { ms: 0, step: "preparing" },
    { ms: 500, step: "rendering" },
    { ms: 1400, step: "images" },
    { ms: 2400, step: "generating" },
    { ms: 3600, step: "saving" },
  ];
  const timers = schedule.map(({ ms, step }) =>
    window.setTimeout(() => {
      if (!signal.cancelled) setStep(step);
    }, ms)
  );
  return () => timers.forEach((t) => window.clearTimeout(t));
}

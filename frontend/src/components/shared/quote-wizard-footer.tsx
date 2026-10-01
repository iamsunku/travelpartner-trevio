"use client";

import { BookOpen, ChevronLeft, ChevronRight, CopyPlus, FileDown, Loader2, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuoteWizardFooter({
  busy,
  isSaved = false,
  onBack,
  onSaveDraft,
  onSaveAsNew,
  onEdit,
  onNext,
  nextLabel,
  showNext = true,
  onCreatePdf,
  onSend,
  onBook,
  bookEnabled = true,
  bookDisabledReason,
  meta,
  error,
  className,
}: {
  busy?: boolean;
  /** True when a persisted quotation ID exists — unlocks post-save actions. */
  isSaved?: boolean;
  onBack?: () => void;
  onSaveDraft?: () => void | Promise<void>;
  /** Create a new quotation from the current wizard state and switch the wizard to it. */
  onSaveAsNew?: () => void | Promise<void>;
  /** Return to editing services (post-save). */
  onEdit?: () => void | Promise<void>;
  onNext?: () => void;
  nextLabel?: string;
  showNext?: boolean;
  onCreatePdf?: () => void | Promise<void>;
  onSend?: () => void | Promise<void>;
  onBook?: () => void | Promise<void>;
  /** When false, Book Now stays visible but blocked (e.g. not Accepted). */
  bookEnabled?: boolean;
  bookDisabledReason?: string;
  meta?: React.ReactNode;
  error?: string | null;
  className?: string;
}) {
  const savePrimary = Boolean(onSaveDraft) && !isSaved;

  return (
    <div
      className={cn(
        "shrink-0 border-t bg-card",
        className,
      )}
    >
      <div className="px-4 sm:px-5 py-3 space-y-3">
        {meta}
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {onBack ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} className="h-8" onClick={onBack}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : null}
            {onSaveDraft ? (
              <Button
                type="button"
                variant={savePrimary ? "default" : "outline"}
                size="sm"
                disabled={busy}
                className="h-8"
                onClick={() => void onSaveDraft()}
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Save Proposal
              </Button>
            ) : null}
            {isSaved && onSaveAsNew ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-8"
                onClick={() => void onSaveAsNew()}
                title="Create a new quotation from the current edits"
              >
                <CopyPlus className="w-3.5 h-3.5 mr-1.5" />
                Save as New
              </Button>
            ) : null}
            {isSaved && onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-8"
                onClick={() => void onEdit()}
              >
                <Pencil className="w-3.5 h-3.5 mr-1.5" />
                Edit
              </Button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {isSaved && onCreatePdf ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-8"
                onClick={() => void onCreatePdf()}
              >
                <FileDown className="w-3.5 h-3.5 mr-1.5" />
                Create PDF
              </Button>
            ) : null}
            {isSaved && onSend ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                className="h-8"
                onClick={() => void onSend()}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Send Quotation
              </Button>
            ) : null}
            {isSaved && onBook ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || bookEnabled === false}
                className="h-8"
                title={
                  bookEnabled === false
                    ? (bookDisabledReason || "Quotation must be Accepted before booking")
                    : undefined
                }
                onClick={() => void onBook()}
              >
                <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                Book Now
              </Button>
            ) : null}
            {showNext && onNext ? (
              <Button
                type="button"
                variant={savePrimary ? "outline" : "default"}
                size="sm"
                disabled={busy}
                className="h-8"
                onClick={onNext}
              >
                {nextLabel || "Next"}
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

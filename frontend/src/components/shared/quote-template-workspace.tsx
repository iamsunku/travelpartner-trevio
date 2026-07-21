"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { PageShell, PageHeader } from "@/components/shared/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QuoteTemplateBuilder, sectionsToPayload, createSectionDraft, type SectionDraft,
} from "@/components/shared/quote-template-builder";
import { QuoteTemplatePreview } from "@/components/shared/quote-template-preview";
import { apiFetch } from "@/lib/api";
import type { QuotePreviewMockData, QuoteTemplateRecord } from "@/types";

interface QuoteTemplateWorkspaceProps {
  onBack: () => void;
  onSaved: (id: string) => void;
}

const DEFAULT_SECTIONS = [
  "COVER", "OVERVIEW", "DESTINATION_HIGHLIGHTS", "ITINERARY", "HOTELS", "ACTIVITIES", "TRANSFERS", "PRICING",
  "INCLUSIONS", "EXCLUSIONS", "TERMS", "CONTACT",
] as const;

export function QuoteTemplateWorkspace({ onBack, onSaved }: QuoteTemplateWorkspaceProps) {
  const [templateName, setTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<SectionDraft[]>(
    DEFAULT_SECTIONS.map((t, i) => createSectionDraft(t, i))
  );
  const [mockData, setMockData] = useState<QuotePreviewMockData | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMockData({
      quoteNumber: "QT-2026-0042",
      quoteDate: "21 Jul 2026",
      validUntil: "28 Jul 2026",
      agency: { name: "Your Agency", tagline: "Travel quotations", phone: "", email: "", website: "" },
      customer: { name: "Sample Customer", email: "", phone: "", pax: "2 Adults" },
      package: { name: "Sample Package", destination: "Destination", duration: "5D/4N", travelDates: "—", heroImage: "https://images.unsplash.com/photo-1552465011-b21e7e7a2598?w=800" },
      highlights: ["Highlight 1", "Highlight 2"],
      days: [{ dayNumber: 1, title: "Day 1", items: [{ time: "09:00", title: "Activity", description: "" }] }],
      hotels: [], activities: [], flights: [], transfers: [],
      pricing: { hotelCost: 0, activityCost: 0, transferCost: 0, flightCost: 0, markup: 0, discount: 0, tax: 0, total: 0, currency: "INR" },
      inclusions: [], exclusions: [],
      visa: { required: false, details: "" },
      terms: "", cancellation: "", notes: "",
      contact: { executive: "", designation: "", phone: "", email: "" },
      customHtml: "",
    });
  }, []);

  const save = async () => {
    if (!templateName.trim()) {
      setError("Template name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ item: QuoteTemplateRecord }>("/api/quote-templates", {
        method: "POST",
        body: JSON.stringify({
          templateName: templateName.trim(),
          description: description.trim() || null,
          sections: sectionsToPayload(sections),
        }),
      });
      onSaved(res.item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = {
    primaryColor: "#2A7BBD",
    secondaryColor: "#00A79D",
    fontFamily: "Inter",
    logo: null,
    watermark: null,
    backgroundImage: null,
    showPageNumbers: true,
    footerStyle: {},
  };

  return (
    <PageShell>
      <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" />Back
      </Button>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <PageHeader title="New Quote Template" subtitle="Define sections and layout" />
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-1" />{saving ? "Saving…" : "Save Template"}</Button>
      </div>

      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <div className="space-y-3">
          <div>
            <Label>Template name *</Label>
            <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Premium Holiday Quote" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={2} />
          </div>
        </div>
        {mockData && (
          <QuoteTemplatePreview
            template={previewTemplate}
            sections={sections}
            mockData={mockData}
            compact
            className="max-h-[360px] overflow-y-auto"
          />
        )}
      </div>

      <QuoteTemplateBuilder sections={sections} onChange={setSections} />
    </PageShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Save, Star, CheckCircle, Archive } from "lucide-react";
import { PageShell, PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  QuoteTemplateBuilder, mapSectionsToDraft, sectionsToPayload, type SectionDraft,
} from "@/components/shared/quote-template-builder";
import { QuoteTemplatePreview } from "@/components/shared/quote-template-preview";
import { validateDefaultSections } from "@/lib/quote-template-sections";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { QuotePreviewMockData, QuoteTemplateRecord } from "@/types";

interface QuoteTemplateDetailProps {
  templateId: string;
  onBack: () => void;
}

const FONT_OPTIONS = ["Inter", "Georgia", "Times New Roman", "Arial", "Helvetica"];
const THEMES = ["Classic", "Modern", "Minimal", "Luxury"];

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function QuoteTemplateDetail({ templateId, onBack }: QuoteTemplateDetailProps) {
  const [item, setItem] = useState<QuoteTemplateRecord | null>(null);
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [mockData, setMockData] = useState<QuotePreviewMockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, preview] = await Promise.all([
        apiFetch<{ item: QuoteTemplateRecord }>(`/api/quote-templates/${templateId}`),
        apiFetch<{ template: QuoteTemplateRecord; mockData: QuotePreviewMockData }>(`/api/quote-templates/${templateId}/preview`),
      ]);
      setItem(detail.item);
      setSections(mapSectionsToDraft(detail.item.sections ?? []));
      setMockData(preview.mockData);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { load(); }, [load]);

  const patch = async (body: Record<string, unknown>, successMsg?: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch<{ item: QuoteTemplateRecord }>(`/api/quote-templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setItem(res.item);
      if (res.item.sections) setSections(mapSectionsToDraft(res.item.sections));
      if (successMsg) setMessage(successMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const saveOverview = () => {
    if (!item) return;
    patch({
      templateName: item.templateName,
      description: item.description,
      theme: item.theme,
      status: item.status,
    }, "Overview saved");
  };

  const saveSections = () => patch({ sections: sectionsToPayload(sections) }, "Sections saved");

  const saveBranding = () => {
    if (!item) return;
    patch({
      primaryColor: item.primaryColor,
      secondaryColor: item.secondaryColor,
      fontFamily: item.fontFamily,
      logo: item.logo,
      watermark: item.watermark,
      backgroundImage: item.backgroundImage,
      showPageNumbers: item.showPageNumbers,
      pageSize: item.pageSize,
      orientation: item.orientation,
      headerStyle: item.headerStyle ?? {},
      footerStyle: item.footerStyle ?? {},
    }, "Branding saved");
  };

  const activate = async () => {
    const err = validateDefaultSections(sections);
    if (err) { setError(err); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/quote-templates/${templateId}/activate`, { method: "PATCH" });
      await load();
      setMessage("Template activated");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Activation failed");
    } finally {
      setSaving(false);
    }
  };

  const setDefault = async () => {
    try {
      await apiFetch(`/api/quote-templates/${templateId}/default`, { method: "PATCH" });
      await load();
      setMessage("Set as default template");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set default");
    }
  };

  const archive = async () => {
    await apiFetch(`/api/quote-templates/${templateId}/archive`, { method: "PATCH" });
    await load();
    setMessage("Template archived");
  };

  if (loading) return <PageShell><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-96 w-full" /></PageShell>;
  if (!item || !mockData) return <PageShell><Button variant="ghost" onClick={onBack}>Back</Button><p className="mt-4 text-muted-foreground">Not found</p></PageShell>;

  return (
    <PageShell>
      <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-1" />Back
      </Button>

      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <PageHeader title={item.templateName} subtitle={item.description ?? "Quote template"} />
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={item.status} />
            {item.isDefault && <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Default</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.status === "Draft" && (
            <Button variant="outline" size="sm" onClick={activate} disabled={saving}>
              <CheckCircle className="w-4 h-4 mr-1" />Activate
            </Button>
          )}
          {item.status === "Active" && !item.isDefault && (
            <Button variant="outline" size="sm" onClick={setDefault}>
              <Star className="w-4 h-4 mr-1" />Set Default
            </Button>
          )}
          {item.status !== "Archived" && (
            <Button variant="outline" size="sm" onClick={archive}>
              <Archive className="w-4 h-4 mr-1" />Archive
            </Button>
          )}
        </div>
      </div>

      {(message || error) && (
        <p className={cn("text-sm mb-3", error ? "text-destructive" : "text-green-700")}>{error || message}</p>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Template name</Label>
                <Input value={item.templateName} onChange={(e) => setItem({ ...item, templateName: e.target.value })} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={item.description ?? ""} onChange={(e) => setItem({ ...item, description: e.target.value })} rows={3} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Theme</Label>
                  <Select value={item.theme} onValueChange={(v) => setItem({ ...item, theme: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {THEMES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={item.status} onValueChange={(v) => setItem({ ...item, status: v as QuoteTemplateRecord["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3 text-sm pt-2 border-t">
                <div><span className="text-muted-foreground">Created</span><p>{formatDate(item.createdAt)} by {item.createdByName ?? "—"}</p></div>
                <div><span className="text-muted-foreground">Updated</span><p>{formatDate(item.updatedAt)} by {item.updatedByName ?? "—"}</p></div>
              </div>
              <Button onClick={saveOverview} disabled={saving}><Save className="w-4 h-4 mr-1" />Save Overview</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="mt-4 space-y-4">
          <QuoteTemplateBuilder sections={sections} onChange={setSections} />
          <Button onClick={saveSections} disabled={saving}><Save className="w-4 h-4 mr-1" />Save Sections</Button>
        </TabsContent>

        <TabsContent value="branding" className="mt-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Primary color</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="w-14 h-9 p-1" value={item.primaryColor} onChange={(e) => setItem({ ...item, primaryColor: e.target.value })} />
                    <Input value={item.primaryColor} onChange={(e) => setItem({ ...item, primaryColor: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label>Secondary color</Label>
                  <div className="flex gap-2">
                    <Input type="color" className="w-14 h-9 p-1" value={item.secondaryColor} onChange={(e) => setItem({ ...item, secondaryColor: e.target.value })} />
                    <Input value={item.secondaryColor} onChange={(e) => setItem({ ...item, secondaryColor: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Font family</Label>
                  <Select value={item.fontFamily} onValueChange={(v) => setItem({ ...item, fontFamily: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Page size</Label>
                  <Select value={item.pageSize} onValueChange={(v) => setItem({ ...item, pageSize: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A4">A4</SelectItem>
                      <SelectItem value="Letter">Letter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Logo URL</Label>
                <Input value={item.logo ?? ""} onChange={(e) => setItem({ ...item, logo: e.target.value || null })} placeholder="https://..." />
              </div>
              <div>
                <Label>Watermark text</Label>
                <Input value={item.watermark ?? ""} onChange={(e) => setItem({ ...item, watermark: e.target.value || null })} />
              </div>
              <div>
                <Label>Background image URL</Label>
                <Input value={item.backgroundImage ?? ""} onChange={(e) => setItem({ ...item, backgroundImage: e.target.value || null })} />
              </div>
              <div>
                <Label>Footer text</Label>
                <Input
                  value={(item.footerStyle?.text as string) ?? ""}
                  onChange={(e) => setItem({ ...item, footerStyle: { ...item.footerStyle, text: e.target.value } })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Show page numbers</Label>
                <Switch checked={item.showPageNumbers} onCheckedChange={(v) => setItem({ ...item, showPageNumbers: v })} />
              </div>
              <Button onClick={saveBranding} disabled={saving}><Save className="w-4 h-4 mr-1" />Save Branding</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <QuoteTemplatePreview
            template={item}
            sections={sections}
            mockData={mockData}
            className="max-w-3xl mx-auto"
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {(item.history ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No history yet</p>
              ) : (
                <ul className="divide-y">
                  {(item.history ?? []).map((h) => (
                    <li key={h.id} className="px-4 py-3 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium capitalize">{h.action.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground text-xs">{formatDate(h.createdAt)}</span>
                      </div>
                      {h.summary && <p className="text-muted-foreground text-xs mt-0.5">{h.summary}</p>}
                      {h.createdByName && <p className="text-[10px] text-muted-foreground mt-0.5">{h.createdByName}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

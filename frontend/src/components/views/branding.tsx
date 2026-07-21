"use client";

import { useCallback, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageShell } from "@/components/shared/ui-helpers";
import { EnterprisePageHeader, PageLoadingSkeleton } from "@/components/shared/enterprise";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import type { AgencyBrandingRecord } from "@/types";

const FONT_OPTIONS = ["Inter", "Georgia", "Times New Roman", "Arial", "Helvetica"];

export function BrandingView() {
  const { toast } = useToast();
  const { submitting, runSubmit } = useSubmitLock();
  const [branding, setBranding] = useState<AgencyBrandingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ branding: AgencyBrandingRecord }>("/api/settings/branding");
      setBranding(data.branding);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load branding settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    if (!branding) return;
    runSubmit(async () => {
      setError(null);
      try {
        const data = await apiFetch<{ branding: AgencyBrandingRecord }>("/api/settings/branding", {
          method: "PATCH",
          body: JSON.stringify(branding),
        });
        setBranding(data.branding);
        toast({ title: "Branding saved", description: "Agency defaults updated successfully." });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Save failed";
        setError(message);
        toast({ title: "Save failed", description: message, variant: "destructive" });
      }
    });
  };

  if (loading) return <PageShell><PageLoadingSkeleton /></PageShell>;
  if (!branding) {
    return (
      <PageShell>
        <EnterprisePageHeader title="Branding" subtitle="Agency-wide defaults for quotations and documents" breadcrumbs={[{ label: "Settings" }, { label: "Branding" }]} />
        <p className="text-sm text-destructive">{error ?? "Unable to load branding settings"}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <EnterprisePageHeader
        title="Branding"
        subtitle="Agency-wide defaults for quotations and documents"
        breadcrumbs={[{ label: "Settings" }, { label: "Branding" }]}
        actions={
          <Button onClick={save} disabled={submitting}><Save className="w-4 h-4 mr-1" aria-hidden />{submitting ? "Saving…" : "Save Branding"}</Button>
        }
      />

      {error && <p className="text-sm text-destructive mb-3" role="alert">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Primary color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-14 h-9 p-1" value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} />
                  <Input value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Secondary color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-14 h-9 p-1" value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} />
                  <Input value={branding.secondaryColor} onChange={(e) => setBranding({ ...branding, secondaryColor: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <Label>Font family</Label>
              <Select value={branding.fontFamily} onValueChange={(v) => setBranding({ ...branding, fontFamily: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Logo URL</Label>
              <Input value={branding.logo ?? ""} onChange={(e) => setBranding({ ...branding, logo: e.target.value || null })} placeholder="https://..." />
            </div>
            <div>
              <Label>Watermark text</Label>
              <Input value={branding.watermark ?? ""} onChange={(e) => setBranding({ ...branding, watermark: e.target.value || null })} />
            </div>
            <div>
              <Label>Background image URL</Label>
              <Input value={branding.backgroundImage ?? ""} onChange={(e) => setBranding({ ...branding, backgroundImage: e.target.value || null })} />
            </div>
            <div>
              <Label>Footer text</Label>
              <Textarea value={branding.footerText ?? ""} onChange={(e) => setBranding({ ...branding, footerText: e.target.value || null })} rows={2} />
            </div>
            <div>
              <Label>Header HTML</Label>
              <Textarea value={branding.headerHtml ?? ""} onChange={(e) => setBranding({ ...branding, headerHtml: e.target.value || null })} rows={3} placeholder="Optional custom header HTML" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show page numbers on quotes</Label>
              <Switch checked={branding.showPageNumbers} onCheckedChange={(v) => setBranding({ ...branding, showPageNumbers: v })} />
            </div>
          </CardContent>
        </Card>

        <div
          className="rounded-xl border p-6 min-h-[320px] flex flex-col"
          style={{
            fontFamily: branding.fontFamily,
            backgroundImage: branding.backgroundImage ? `url(${branding.backgroundImage})` : undefined,
            backgroundSize: "cover",
          }}
        >
          {branding.watermark && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] text-5xl font-bold rotate-[-24deg]">
              {branding.watermark}
            </div>
          )}
          <div className="relative flex-1 bg-white/95 rounded-lg p-4 border">
            {branding.logo && <img src={branding.logo} alt="Logo preview" className="h-10 object-contain mb-4" />}
            {branding.headerHtml && (
              <div className="text-xs mb-4 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: branding.headerHtml }} />
            )}
            <div className="h-2 rounded mb-4" style={{ background: `linear-gradient(90deg, ${branding.primaryColor}, ${branding.secondaryColor})` }} />
            <p className="text-sm font-semibold" style={{ color: branding.primaryColor }}>Sample Quotation Section</p>
            <p className="text-xs text-muted-foreground mt-2">Preview of agency branding applied to quote documents.</p>
            {branding.footerText && (
              <p className="text-[10px] text-muted-foreground mt-auto pt-6 border-t">{branding.footerText}</p>
            )}
            {branding.showPageNumbers && <p className="text-[10px] text-center text-muted-foreground mt-2">Page 1</p>}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { QuoteTemplatePreview } from "@/components/shared/quote-template-preview";
import type { ProposalSnapshotData, QuotePreviewMockData, QuoteSectionType, TravelProposalRecord } from "@/types";

const HOTEL_TIERS = ["Standard", "Premium", "Luxury"];
const ACTIVITY_TIERS = ["Included", "Optional", "Premium"];
const TRANSFER_TIERS = ["Shared", "Private", "Luxury"];

interface TravelProposalWorkspaceProps {
  proposal: TravelProposalRecord;
  snapshot: ProposalSnapshotData;
  previewData: QuotePreviewMockData;
  onSnapshotChange: (snapshot: ProposalSnapshotData) => void;
  onProposalChange: (patch: Partial<TravelProposalRecord>) => void;
  readOnly?: boolean;
}

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export function TravelProposalWorkspace({
  proposal, snapshot, previewData, onSnapshotChange, onProposalChange, readOnly,
}: TravelProposalWorkspaceProps) {
  const template = snapshot.template as Record<string, unknown> | null;
  const branding = snapshot.branding as Record<string, unknown> | null;

  const previewTemplate = useMemo(() => ({
    primaryColor: String(template?.primaryColor ?? branding?.primaryColor ?? "#2A7BBD"),
    secondaryColor: String(template?.secondaryColor ?? branding?.secondaryColor ?? "#00A79D"),
    fontFamily: String(template?.fontFamily ?? branding?.fontFamily ?? "Inter"),
    logo: (template?.logo ?? branding?.logo) as string | null,
    watermark: (template?.watermark ?? branding?.watermark) as string | null,
    backgroundImage: (template?.backgroundImage ?? branding?.backgroundImage) as string | null,
    showPageNumbers: Boolean(template?.showPageNumbers ?? branding?.showPageNumbers ?? true),
    footerStyle: (template?.footerStyle as Record<string, unknown>) ?? { text: branding?.footerText },
  }), [template, branding]);

  const sections = useMemo(() => (
    ((template?.sections as Record<string, unknown>[]) ?? []).map((s) => ({
      sectionType: s.sectionType as QuoteSectionType,
      customTitle: s.customTitle as string | null,
      isVisible: s.isVisible as boolean,
    }))
  ), [template]);

  const updateSelections = (patch: Partial<ProposalSnapshotData["productSelections"]>) => {
    const next = { ...snapshot, productSelections: { ...snapshot.productSelections, ...patch } };
    onSnapshotChange(recalcLocal(next));
  };

  const updatePricing = (patch: Partial<ProposalSnapshotData["pricing"]>) => {
    const pricing = { ...snapshot.pricing, ...patch };
    const packageBase = pricing.hotelCost + pricing.activityCost + pricing.transferCost;
    const subtotal = Math.max(0, packageBase + pricing.markup - pricing.discount);
    pricing.total = Math.max(0, subtotal + pricing.tax);
    pricing.packageBase = packageBase;
    onSnapshotChange({ ...snapshot, pricing });
  };

  const recalcLocal = (snap: ProposalSnapshotData): ProposalSnapshotData => {
    const opts = snap.productOptions as { productType: string; productId: string; optionGroup: string; isDefault?: boolean; priceAdjustment?: number }[];
    function pickCost(type: string, group: string | null) {
      const typeOpts = opts.filter((o) => o.productType === type);
      if (!typeOpts.length) return 0;
      const g = group ?? typeOpts.find((o) => o.isDefault)?.optionGroup ?? typeOpts[0].optionGroup;
      const opt = typeOpts.find((o) => o.optionGroup === g && o.isDefault) ?? typeOpts.find((o) => o.optionGroup === g) ?? typeOpts[0];
      return (snap.productPrices[opt.productId] ?? 0) + (opt.priceAdjustment ?? 0);
    }
    const hotelCost = pickCost("HOTEL", snap.productSelections.hotelOptionGroup);
    const activityCost = pickCost("ACTIVITY", snap.productSelections.activityOptionGroup);
    const transferCost = pickCost("TRANSFER", snap.productSelections.transferOptionGroup);
    const packageBase = hotelCost + activityCost + transferCost;
    const subtotal = Math.max(0, packageBase + snap.pricing.markup - snap.pricing.discount);
    return {
      ...snap,
      pricing: {
        ...snap.pricing,
        hotelCost,
        activityCost,
        transferCost,
        packageBase,
        total: Math.max(0, subtotal + snap.pricing.tax),
      },
    };
  };

  const pkg = snapshot.package as Record<string, unknown>;
  const customerName = String(snapshot.customer?.name ?? snapshot.lead?.customerName ?? "—");

  return (
    <div className="grid xl:grid-cols-[360px_1fr] gap-4">
      <div className="space-y-3">
        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#2A7BBD]">Customer</h4>
            <p className="text-sm font-medium">{customerName}</p>
            <p className="text-xs text-muted-foreground">{String(snapshot.customer?.email ?? snapshot.lead?.email ?? "")}</p>
            <p className="text-xs text-muted-foreground">{proposal.proposalNumber} · v{proposal.currentVersion}</p>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#2A7BBD]">Hotels</h4>
            <Select
              value={snapshot.productSelections.hotelOptionGroup ?? "Standard"}
              onValueChange={(v) => updateSelections({ hotelOptionGroup: v })}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{HOTEL_TIERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#2A7BBD]">Activities</h4>
            <Select
              value={snapshot.productSelections.activityOptionGroup ?? "Included"}
              onValueChange={(v) => updateSelections({ activityOptionGroup: v })}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ACTIVITY_TIERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#2A7BBD]">Transfers</h4>
            <Select
              value={snapshot.productSelections.transferOptionGroup ?? "Private"}
              onValueChange={(v) => updateSelections({ transferOptionGroup: v })}
              disabled={readOnly}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TRANSFER_TIERS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#2A7BBD]">Pricing</h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between"><span>Hotels</span><span>{inr(snapshot.pricing.hotelCost)}</span></div>
              <div className="flex justify-between"><span>Activities</span><span>{inr(snapshot.pricing.activityCost)}</span></div>
              <div className="flex justify-between"><span>Transfers</span><span>{inr(snapshot.pricing.transferCost)}</span></div>
            </div>
            <div>
              <Label className="text-xs">Markup</Label>
              <Input
                type="number"
                value={snapshot.pricing.markup}
                disabled={readOnly}
                onChange={(e) => updatePricing({ markup: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label className="text-xs">Discount</Label>
              <Input
                type="number"
                value={snapshot.pricing.discount}
                disabled={readOnly}
                onChange={(e) => updatePricing({ discount: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="flex justify-between font-bold text-sm pt-2 border-t">
              <span>Total</span>
              <span className="text-[#2A7BBD]">{inr(snapshot.pricing.total)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 shadow-none">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-sm font-semibold text-[#2A7BBD]">Terms & Notes</h4>
            <div>
              <Label className="text-xs">Valid until</Label>
              <Input
                type="date"
                disabled={readOnly}
                value={proposal.validUntil ? proposal.validUntil.slice(0, 10) : ""}
                onChange={(e) => onProposalChange({ validUntil: e.target.value ? new Date(e.target.value).toISOString() : null })}
              />
            </div>
            <div>
              <Label className="text-xs">Proposal notes</Label>
              <Textarea rows={2} disabled={readOnly} value={proposal.notes ?? ""} onChange={(e) => onProposalChange({ notes: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Internal notes</Label>
              <Textarea rows={2} disabled={readOnly} value={proposal.internalNotes ?? ""} onChange={(e) => onProposalChange({ internalNotes: e.target.value })} />
            </div>
          </CardContent>
        </Card>

        <p className="text-[10px] text-muted-foreground px-1">
          Snapshot package: {String(pkg.packageName ?? "")} · frozen at {new Date(snapshot.capturedAt).toLocaleString("en-IN")}
        </p>
      </div>

      <div className="min-h-[600px]">
        <QuoteTemplatePreview
          template={previewTemplate}
          sections={sections.length ? sections : [
            { sectionType: "COVER", isVisible: true },
            { sectionType: "OVERVIEW", isVisible: true },
            { sectionType: "ITINERARY", isVisible: true },
            { sectionType: "PRICING", isVisible: true },
          ]}
          mockData={previewData}
          className="sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto"
        />
      </div>
    </div>
  );
}

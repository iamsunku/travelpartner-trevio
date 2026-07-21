"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Send, Star, CheckCircle, Archive } from "lucide-react";
import { PageShell, StatusBadge } from "@/components/shared/ui-helpers";
import { ActivityTimeline, DetailBackButton, EnterprisePageHeader } from "@/components/shared/enterprise";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TravelProposalWorkspace } from "@/components/shared/travel-proposal-workspace";
import { QuoteTemplatePreview } from "@/components/shared/quote-template-preview";
import { apiFetch } from "@/lib/api";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import type {
  ProposalHistoryRecord, ProposalSnapshotData, ProposalSnapshotRecord,
  QuotePreviewMockData, QuoteSectionType, TravelProposalRecord,
} from "@/types";

interface TravelProposalDetailProps {
  proposalId: string;
  onBack: () => void;
}

const STATUS_ACTIONS: Record<string, { label: string; next: string }[]> = {
  Draft: [{ label: "Submit for Review", next: "Internal Review" }],
  "Internal Review": [{ label: "Approve", next: "Approved" }, { label: "Back to Draft", next: "Draft" }],
  Approved: [{ label: "Mark as Sent", next: "Sent" }],
  Sent: [{ label: "Mark Viewed", next: "Viewed" }],
  Viewed: [{ label: "Accept", next: "Accepted" }, { label: "Reject", next: "Rejected" }],
  Accepted: [{ label: "Mark Booked", next: "Booked" }],
};

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function TravelProposalDetail({ proposalId, onBack }: TravelProposalDetailProps) {
  const [proposal, setProposal] = useState<TravelProposalRecord | null>(null);
  const [snapshot, setSnapshot] = useState<ProposalSnapshotData | null>(null);
  const [draftSnapshot, setDraftSnapshot] = useState<ProposalSnapshotData | null>(null);
  const [previewData, setPreviewData] = useState<QuotePreviewMockData | null>(null);
  const [versions, setVersions] = useState<ProposalSnapshotRecord[]>([]);
  const [history, setHistory] = useState<ProposalHistoryRecord[]>([]);
  const [compareV1, setCompareV1] = useState("1");
  const [compareV2, setCompareV2] = useState("2");
  const [compareDiff, setCompareDiff] = useState<{ field: string; before: unknown; after: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const { submitting, runSubmit } = useSubmitLock();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, preview, vers, hist] = await Promise.all([
        apiFetch<{ item: TravelProposalRecord; snapshot: ProposalSnapshotData }>(`/api/travel-proposals/${proposalId}`),
        apiFetch<{ previewData: QuotePreviewMockData }>(`/api/travel-proposals/${proposalId}/preview`),
        apiFetch<{ versions: ProposalSnapshotRecord[] }>(`/api/travel-proposals/${proposalId}/versions`),
        apiFetch<{ history: ProposalHistoryRecord[] }>(`/api/travel-proposals/${proposalId}/history`),
      ]);
      setProposal(detail.item);
      setSnapshot(detail.snapshot);
      setDraftSnapshot(detail.snapshot);
      setPreviewData(preview.previewData);
      setVersions(vers.versions as ProposalSnapshotRecord[]);
      setHistory(hist.history);
      if (vers.versions.length >= 2) {
        setCompareV1(String(vers.versions[1]?.versionNumber ?? 1));
        setCompareV2(String(vers.versions[0]?.versionNumber ?? 2));
      }
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    if (!proposal || !draftSnapshot || !snapshot) return;
    runSubmit(async () => {
      setError(null);
      setMessage(null);
      try {
        const snapshotEdits: Record<string, unknown> = {};
        if (JSON.stringify(draftSnapshot.productSelections) !== JSON.stringify(snapshot.productSelections)) {
          snapshotEdits.productSelections = draftSnapshot.productSelections;
        }
        if (draftSnapshot.pricing.markup !== snapshot.pricing.markup) snapshotEdits.markup = draftSnapshot.pricing.markup;
        if (draftSnapshot.pricing.discount !== snapshot.pricing.discount) snapshotEdits.discount = draftSnapshot.pricing.discount;
        if (draftSnapshot.pricing.tax !== snapshot.pricing.tax) snapshotEdits.tax = draftSnapshot.pricing.tax;

        const res = await apiFetch<{ item: TravelProposalRecord; snapshot: ProposalSnapshotData }>(`/api/travel-proposals/${proposalId}`, {
          method: "PATCH",
          body: JSON.stringify({
            notes: proposal.notes,
            internalNotes: proposal.internalNotes,
            validUntil: proposal.validUntil,
            changeSummary: Object.keys(snapshotEdits).length ? "Proposal edits saved" : "Notes updated",
            ...(Object.keys(snapshotEdits).length ? { snapshotEdits } : {}),
          }),
        });
        setProposal(res.item);
        setSnapshot(res.snapshot);
        setDraftSnapshot(res.snapshot);
        setMessage(`Saved as version ${res.item.currentVersion}`);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  };

  const changeStatus = async (next: string) => {
    setError(null);
    try {
      await apiFetch(`/api/travel-proposals/${proposalId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: next }),
      });
      setMessage(`Status updated to ${next}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status change failed");
    }
  };

  const runCompare = async () => {
    const data = await apiFetch<{ diff: { field: string; before: unknown; after: unknown }[] }>(
      `/api/travel-proposals/${proposalId}/versions/compare?v1=${compareV1}&v2=${compareV2}`
    );
    setCompareDiff(data.diff);
  };

  if (loading) return <PageShell><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-96 w-full" /></PageShell>;
  if (!proposal || !draftSnapshot || !previewData) {
    return <PageShell><Button variant="ghost" onClick={onBack}>Back</Button><p className="mt-4 text-muted-foreground">Not found</p></PageShell>;
  }

  const readOnly = ["Booked", "Cancelled", "Expired"].includes(proposal.proposalStatus);
  const actions = STATUS_ACTIONS[proposal.proposalStatus] ?? [];
  const template = draftSnapshot.template as Record<string, unknown> | null;
  const branding = draftSnapshot.branding as Record<string, unknown> | null;
  const previewTemplate = {
    primaryColor: String(template?.primaryColor ?? branding?.primaryColor ?? "#2A7BBD"),
    secondaryColor: String(template?.secondaryColor ?? branding?.secondaryColor ?? "#00A79D"),
    fontFamily: String(template?.fontFamily ?? branding?.fontFamily ?? "Inter"),
    logo: (template?.logo ?? branding?.logo) as string | null,
    watermark: (template?.watermark ?? branding?.watermark) as string | null,
    backgroundImage: (template?.backgroundImage ?? branding?.backgroundImage) as string | null,
    showPageNumbers: Boolean(template?.showPageNumbers ?? true),
    footerStyle: (template?.footerStyle as Record<string, unknown>) ?? {},
  };
  const sections = ((template?.sections as Record<string, unknown>[]) ?? []).map((s) => ({
    sectionType: s.sectionType as QuoteSectionType,
    customTitle: s.customTitle as string | null,
    isVisible: s.isVisible as boolean,
  }));

  return (
    <PageShell>
      <DetailBackButton onClick={onBack} label="Back to proposals" />

      <EnterprisePageHeader
        title={proposal.proposalNumber}
        subtitle={`${proposal.customer?.name ?? proposal.lead?.customerName ?? "Customer"} · ${proposal.travelRequirement?.requirementCode ?? "Standalone"}`}
        breadcrumbs={[
          { label: "Travel Proposals", onClick: onBack },
          { label: proposal.proposalNumber },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <Button onClick={save} disabled={submitting}>
                <Save className="w-4 h-4 mr-1" />{submitting ? "Saving…" : "Save Version"}
              </Button>
            )}
            {actions.map((a) => (
              <Button key={a.next} variant="outline" size="sm" onClick={() => changeStatus(a.next)}>
                {a.next === "Sent" ? <Send className="w-4 h-4 mr-1" /> : null}{a.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="flex items-center gap-2 -mt-2 mb-2">
        <StatusBadge status={proposal.proposalStatus} />
        <span className="text-xs text-muted-foreground">Version {proposal.currentVersion}</span>
      </div>

      {message && <p className="text-sm text-green-700 mb-3">{message}</p>}
      {error && <p className="text-sm text-destructive mb-3">{error}</p>}

      <Tabs defaultValue="proposal">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="proposal">Proposal</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/80 shadow-none">
            <CardContent className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{proposal.customer?.name ?? proposal.lead?.customerName ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Trip Requirement</span><p>{proposal.travelRequirement?.requirementCode ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Package (snapshot)</span><p>{String(draftSnapshot.package?.packageName ?? "—")}</p></div>
              <div><span className="text-muted-foreground">Template</span><p>{String((draftSnapshot.template as { templateName?: string } | null)?.templateName ?? "Default")}</p></div>
              <div><span className="text-muted-foreground">Valid Until</span><p>{formatDate(proposal.validUntil)}</p></div>
              <div><span className="text-muted-foreground">Total</span><p className="font-bold text-[#2A7BBD]">₹{draftSnapshot.pricing.total.toLocaleString("en-IN")}</p></div>
              <div><span className="text-muted-foreground">Created</span><p>{formatDate(proposal.createdAt)} by {proposal.createdByName ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Updated</span><p>{formatDate(proposal.updatedAt)} by {proposal.updatedByName ?? "—"}</p></div>
              {proposal.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes</span><p className="whitespace-pre-wrap">{proposal.notes}</p></div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proposal" className="mt-4">
          <TravelProposalWorkspace
            proposal={proposal}
            snapshot={draftSnapshot}
            previewData={previewData}
            onSnapshotChange={setDraftSnapshot}
            onProposalChange={(patch) => setProposal({ ...proposal, ...patch })}
            readOnly={readOnly}
          />
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card className="border-border/80 shadow-none max-w-lg">
            <CardContent className="p-4 space-y-2 text-sm">
              {[
                ["Hotels", draftSnapshot.pricing.hotelCost],
                ["Activities", draftSnapshot.pricing.activityCost],
                ["Transfers", draftSnapshot.pricing.transferCost],
                ["Subtotal", draftSnapshot.pricing.packageBase],
                ["Markup", draftSnapshot.pricing.markup],
                ["Discount", -draftSnapshot.pricing.discount],
                ["Tax", draftSnapshot.pricing.tax],
              ].map(([label, val]) => (
                <div key={String(label)} className="flex justify-between border-b border-border/40 py-1">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="tabular-nums">₹{Math.abs(val as number).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-base font-bold">
                <span>Grand Total</span>
                <span className="text-[#2A7BBD]">₹{draftSnapshot.pricing.total.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-2">Pricing computed from frozen snapshot product prices — master package changes do not affect this proposal.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-border/80 shadow-none">
            <CardContent className="p-4">
              <ActivityTimeline items={history} emptyMessage="No activity recorded for this proposal" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <Card className="border-border/80 shadow-none">
            <CardContent className="p-0">
              <ul className="divide-y">
                {versions.map((v) => (
                  <li key={v.id} className="px-4 py-3 text-sm flex justify-between">
                    <div>
                      <span className="font-medium">Version {v.versionNumber}</span>
                      {v.changeSummary && <p className="text-xs text-muted-foreground">{v.changeSummary}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {versions.length >= 2 && (
            <Card className="border-border/80 shadow-none">
              <CardContent className="p-4 space-y-3">
                <h4 className="font-semibold text-sm">Compare Versions</h4>
                <div className="flex flex-wrap gap-2 items-end">
                  <Select value={compareV1} onValueChange={setCompareV1}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{versions.map((v) => <SelectItem key={v.id} value={String(v.versionNumber)}>v{v.versionNumber}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-sm">vs</span>
                  <Select value={compareV2} onValueChange={setCompareV2}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{versions.map((v) => <SelectItem key={v.id} value={String(v.versionNumber)}>v{v.versionNumber}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={runCompare}>Compare</Button>
                </div>
                {compareDiff.length > 0 && (
                  <ul className="text-xs space-y-2 mt-2">
                    {compareDiff.map((d) => (
                      <li key={d.field} className="border rounded p-2">
                        <p className="font-medium">{d.field}</p>
                        <p className="text-muted-foreground">Before: {JSON.stringify(d.before)}</p>
                        <p>After: {JSON.stringify(d.after)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <QuoteTemplatePreview template={previewTemplate} sections={sections} mockData={previewData} className="max-w-3xl mx-auto" />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

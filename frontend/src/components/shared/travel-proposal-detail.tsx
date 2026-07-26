"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, FileText, RefreshCw, Save, Send, Trash2 } from "lucide-react";
import { PageShell, StatusBadge } from "@/components/shared/ui-helpers";
import { ActivityTimeline, DetailBackButton, EnterprisePageHeader } from "@/components/shared/enterprise";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TravelProposalWorkspace } from "@/components/shared/travel-proposal-workspace";
import { QuoteTemplatePreview } from "@/components/shared/quote-template-preview";
import {
  ProposalPdfProgressDialog,
  runPdfProgressSequence,
  type PdfProgressStep,
} from "@/components/shared/proposal-pdf-progress-dialog";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import { useSubmitLock } from "@/hooks/use-submit-lock";
import type {
  ProposalHistoryRecord, ProposalPdfRecord, ProposalSnapshotData, ProposalSnapshotRecord,
  QuotePreviewMockData, QuoteSectionType, TravelProposalRecord,
} from "@/types";

const PDF_ELIGIBLE = new Set([
  "Internal Review", "Approved", "Sent", "Viewed", "Accepted", "Booked",
]);

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
  const [pdfVersions, setPdfVersions] = useState<ProposalPdfRecord[]>([]);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [pdfStep, setPdfStep] = useState<PdfProgressStep>("preparing");
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfCancelRef = useRef({ cancelled: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, preview, vers, hist, pdfMeta] = await Promise.all([
        apiFetch<{ item: TravelProposalRecord; snapshot: ProposalSnapshotData }>(`/api/travel-proposals/${proposalId}`),
        apiFetch<{ previewData: QuotePreviewMockData }>(`/api/travel-proposals/${proposalId}/preview`),
        apiFetch<{ versions: ProposalSnapshotRecord[] }>(`/api/travel-proposals/${proposalId}/versions`),
        apiFetch<{ history: ProposalHistoryRecord[] }>(`/api/travel-proposals/${proposalId}/history`),
        apiFetch<{ proposal: TravelProposalRecord; versions: ProposalPdfRecord[] }>(
          `/api/travel-proposals/${proposalId}/pdf?meta=1`
        ).catch(() => ({ proposal: null as unknown as TravelProposalRecord, versions: [] as ProposalPdfRecord[] })),
      ]);
      setProposal({ ...detail.item, ...(pdfMeta.proposal ?? {}) });
      setSnapshot(detail.snapshot);
      setDraftSnapshot(detail.snapshot);
      setPreviewData(preview.previewData);
      setVersions(vers.versions as ProposalSnapshotRecord[]);
      setHistory(hist.history);
      setPdfVersions(pdfMeta.versions ?? []);
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

  const openPdfBlob = async (path: string, mode: "preview" | "download") => {
    const blob = await apiFetchBlob(path);
    const url = URL.createObjectURL(blob);
    if (mode === "preview") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal?.proposalNumber ?? "proposal"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const generatePdf = async (force = false) => {
    if (!proposal) return;
    setError(null);
    setPdfError(null);
    setPdfStep("preparing");
    setPdfDialogOpen(true);
    pdfCancelRef.current = { cancelled: false };
    const stopProgress = runPdfProgressSequence(setPdfStep, pdfCancelRef.current);
    try {
      const res = await apiFetch<{
        cached: boolean;
        downloadUrl: string;
        pdfVersion?: number | null;
        item: TravelProposalRecord;
      }>(`/api/travel-proposals/${proposalId}/generate-pdf`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      pdfCancelRef.current.cancelled = true;
      stopProgress();
      setPdfStep("complete");
      setProposal((prev) => (prev ? { ...prev, ...res.item } : res.item));
      setMessage(
        res.cached
          ? `Using cached PDF for version ${res.pdfVersion ?? proposal.currentVersion}`
          : force
            ? `PDF regenerated for version ${res.pdfVersion ?? proposal.currentVersion}`
            : `PDF generated for version ${res.pdfVersion ?? proposal.currentVersion}`
      );
      await load();
    } catch (e) {
      pdfCancelRef.current.cancelled = true;
      stopProgress();
      const msg = e instanceof Error ? e.message : "PDF generation failed";
      setPdfStep("error");
      setPdfError(msg);
      setError(msg);
    }
  };

  const deletePdfs = async () => {
    setError(null);
    try {
      await apiFetch(`/api/travel-proposals/${proposalId}/pdf`, { method: "DELETE" });
      setMessage("Generated PDFs deleted");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete PDFs");
    }
  };

  if (loading) return <PageShell><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-96 w-full" /></PageShell>;
  if (!proposal || !draftSnapshot || !previewData) {
    return <PageShell><Button variant="ghost" onClick={onBack}>Back</Button><p className="mt-4 text-muted-foreground">Not found</p></PageShell>;
  }

  const readOnly = ["Booked", "Cancelled", "Expired"].includes(proposal.proposalStatus);
  const canGeneratePdf = PDF_ELIGIBLE.has(proposal.proposalStatus);
  const hasPdf = Boolean(proposal.pdfUrl && proposal.pdfVersion);
  const actions = STATUS_ACTIONS[proposal.proposalStatus] ?? [];
  const template = draftSnapshot.template as Record<string, unknown> | null;
  const branding = draftSnapshot.branding as Record<string, unknown> | null;
  const previewTemplate = {
    primaryColor: String(template?.primaryColor ?? branding?.primaryColor ?? "var(--brand-blue)"),
    secondaryColor: String(template?.secondaryColor ?? branding?.secondaryColor ?? "var(--brand-teal)"),
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
            {canGeneratePdf && (
              <Button variant="outline" size="sm" onClick={() => generatePdf(Boolean(hasPdf))}>
                <FileText className="w-4 h-4 mr-1" />{hasPdf ? "Regenerate PDF" : "Generate PDF"}
              </Button>
            )}
            {hasPdf && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPdfBlob(`/api/travel-proposals/${proposalId}/pdf`, "preview")}
                >
                  <Eye className="w-4 h-4 mr-1" />Preview PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPdfBlob(`/api/travel-proposals/${proposalId}/pdf?download=1`, "download")}
                >
                  <Download className="w-4 h-4 mr-1" />Download PDF
                </Button>
              </>
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
          <TabsTrigger value="pdf">PDF</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardContent className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{proposal.customer?.name ?? proposal.lead?.customerName ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Trip Requirement</span><p>{proposal.travelRequirement?.requirementCode ?? "—"}</p></div>
              <div><span className="text-muted-foreground">Package (snapshot)</span><p>{String(draftSnapshot.package?.packageName ?? "—")}</p></div>
              <div><span className="text-muted-foreground">Template</span><p>{String((draftSnapshot.template as { templateName?: string } | null)?.templateName ?? "Default")}</p></div>
              <div><span className="text-muted-foreground">Valid Until</span><p>{formatDate(proposal.validUntil)}</p></div>
              <div><span className="text-muted-foreground">Total</span><p className="font-bold text-primary">₹{draftSnapshot.pricing.total.toLocaleString("en-IN")}</p></div>
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
          <Card className="max-w-lg">
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
                <span className="text-primary">₹{draftSnapshot.pricing.total.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-2">Pricing computed from frozen snapshot product prices — master package changes do not affect this proposal.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-4">
              <ActivityTimeline items={history} emptyMessage="No activity recorded for this proposal" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="versions" className="mt-4 space-y-4">
          <Card>
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
            <Card>
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

        <TabsContent value="pdf" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-sm">Proposal PDF Rendering</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xl">
                    Generates a branded multi-page PDF from the frozen proposal snapshot and selected quote template.
                    Cached until the proposal version changes.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canGeneratePdf ? (
                    <>
                      <Button size="sm" onClick={() => generatePdf(false)}>
                        <FileText className="w-4 h-4 mr-1" />{hasPdf ? "Generate / Use Cache" : "Generate PDF"}
                      </Button>
                      {hasPdf && (
                        <Button size="sm" variant="outline" onClick={() => generatePdf(true)}>
                          <RefreshCw className="w-4 h-4 mr-1" />Regenerate PDF
                        </Button>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                      Move the proposal to Internal Review (or later) to generate a PDF.
                    </p>
                  )}
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Current PDF version</span>
                  <p className="font-medium">{proposal.pdfVersion ?? "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Generated at</span>
                  <p className="font-medium">{formatDate(proposal.pdfGeneratedAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Proposal version</span>
                  <p className="font-medium">{proposal.currentVersion}</p>
                </div>
              </div>

              {hasPdf && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPdfBlob(`/api/travel-proposals/${proposalId}/pdf`, "preview")}
                  >
                    <Eye className="w-4 h-4 mr-1" />Preview PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openPdfBlob(`/api/travel-proposals/${proposalId}/pdf?download=1`, "download")}
                  >
                    <Download className="w-4 h-4 mr-1" />Download PDF
                  </Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={deletePdfs}>
                    <Trash2 className="w-4 h-4 mr-1" />Delete PDFs
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b">
                <h4 className="font-semibold text-sm">Version PDFs</h4>
                <p className="text-xs text-muted-foreground">Each proposal version can keep its own generated PDF.</p>
              </div>
              {pdfVersions.length === 0 ? (
                <p className="px-4 py-6 text-sm text-muted-foreground">No PDFs generated yet.</p>
              ) : (
                <ul className="divide-y">
                  {pdfVersions.map((pdf) => (
                    <li key={pdf.id} className="px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">Version {pdf.versionNumber}</span>
                        <p className="text-xs text-muted-foreground">
                          {pdf.pageCount} pages · {(pdf.fileSize / 1024).toFixed(0)} KB · {formatDate(pdf.generatedAt)}
                          {pdf.generatedByName ? ` · ${pdf.generatedByName}` : ""}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openPdfBlob(`/api/travel-proposals/${proposalId}/pdf/${pdf.versionNumber}`, "preview")
                          }
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />Preview
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openPdfBlob(
                              `/api/travel-proposals/${proposalId}/pdf/${pdf.versionNumber}?download=1`,
                              "download"
                            )
                          }
                        >
                          <Download className="w-3.5 h-3.5 mr-1" />Download
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <QuoteTemplatePreview template={previewTemplate} sections={sections} mockData={previewData} className="max-w-3xl mx-auto" />
        </TabsContent>
      </Tabs>

      <ProposalPdfProgressDialog
        open={pdfDialogOpen}
        step={pdfStep}
        error={pdfError}
        onOpenChange={setPdfDialogOpen}
      />
    </PageShell>
  );
}

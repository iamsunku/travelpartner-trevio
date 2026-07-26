"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Pencil, FileSpreadsheet, MapPin, Mail, Phone } from "lucide-react";
import { PageShell, PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { QuickActionsBar, WorkflowLinks } from "@/components/shared/enterprise";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PackageMatchCard } from "@/components/shared/package-match-card";
import { TripPricePanel } from "@/components/shared/trip-price-panel";
import { PackageItineraryPreview } from "@/components/shared/package-itinerary-preview";
import { mapPackageToItineraryDraft } from "@/components/shared/package-itinerary-builder";
import { mapRecordToOptionDraft, PackageProductOptionsDisplay } from "@/components/shared/package-product-options-builder";
import { apiFetch } from "@/lib/api";
import { useAppStore } from "@/store/app-store";
import type { PackageMatchRecord, TravelPackageRecord, TravelProposalRecord, TravelRequirementRecord } from "@/types";

interface TripRequirementDetailProps {
  requirementId: string;
  onBack: () => void;
  onEdit: () => void;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function TripRequirementDetail({ requirementId, onBack, onEdit }: TripRequirementDetailProps) {
  const setView = useAppStore((s) => s.setView);
  const [item, setItem] = useState<TravelRequirementRecord | null>(null);
  const [matches, setMatches] = useState<PackageMatchRecord[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<TravelPackageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [creatingProposal, setCreatingProposal] = useState(false);
  const [proposalError, setProposalError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [detail, recs] = await Promise.all([
        apiFetch<{ item: TravelRequirementRecord }>(`/api/trip-requirements/${requirementId}`),
        apiFetch<{ matches: PackageMatchRecord[] }>(`/api/trip-requirements/${requirementId}/recommendations`, { method: "POST" }),
      ]);
      setItem(detail.item);
      setMatches(recs.matches);
      const sel = detail.item.selections?.find((s) => s.isSelected);
      if (sel?.packageId) {
        const pkg = await apiFetch<{ item: TravelPackageRecord }>(`/api/packages/${sel.packageId}`);
        setSelectedPackage(pkg.item);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [requirementId]); // eslint-disable-line react-hooks/exhaustive-deps

  const createProposal = async () => {
    if (!item?.selectedPackageId) {
      setProposalError("Select a package before creating a proposal");
      return;
    }
    setCreatingProposal(true);
    setProposalError(null);
    try {
      const res = await apiFetch<{ item: TravelProposalRecord }>(
        `/api/travel-proposals/from-requirement/${requirementId}`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setView("travel-proposals");
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("view", "travel-proposals");
        url.searchParams.set("proposalId", res.item.id);
        window.history.replaceState({}, "", url.toString());
      }
    } catch (e) {
      setProposalError(e instanceof Error ? e.message : "Failed to create proposal");
    } finally {
      setCreatingProposal(false);
    }
  };

  if (loading) return <PageShell><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-64 w-full" /></PageShell>;
  if (!item) return <PageShell><Button variant="ghost" onClick={onBack}>Back</Button><p className="mt-4 text-muted-foreground">Not found</p></PageShell>;

  const selection = item.selections?.find((s) => s.isSelected);
  const productOptions = selectedPackage?.productOptions?.map((o) => mapRecordToOptionDraft(o)) ?? [];

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
          <PageHeader title={item.requirementCode} subtitle={`${item.destination?.name ?? ""} · ${item.adults} adults`} />
          <StatusBadge status={item.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {item.selectedPackageId && (
            <Button size="sm" onClick={createProposal} disabled={creatingProposal}>
              <FileSpreadsheet className="w-4 h-4 mr-1" />
              {creatingProposal ? "Creating…" : "Create Proposal"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}><Pencil className="w-4 h-4 mr-1" />Edit Requirement</Button>
        </div>
      </div>
      {proposalError && <p className="text-sm text-destructive mb-3">{proposalError}</p>}

      <WorkflowLinks
        className="mb-3"
        items={[
          ...(item.customer ? [{ label: "Customer", onClick: () => setView("customers") }] : []),
          { label: "Trip Requirement", onClick: () => {} },
          ...(item.selectedPackageId ? [{ label: "Travel Proposals", onClick: () => setView("travel-proposals") }] : []),
        ]}
      />

      <QuickActionsBar
        className="mb-4"
        actions={[
          ...(item.selectedPackageId ? [{
            id: "proposal",
            label: "Create Proposal",
            icon: FileSpreadsheet,
            onClick: createProposal,
            variant: "primary" as const,
            disabled: creatingProposal,
          }] : []),
          { id: "edit", label: "Edit Requirement", icon: Pencil, onClick: onEdit },
          ...(item.customer?.phone ? [{ id: "call", label: "Call", icon: Phone, onClick: () => window.open(`tel:${item.customer!.phone}`) }] : []),
          ...(item.customer?.email ? [{ id: "email", label: "Email", icon: Mail, onClick: () => window.open(`mailto:${item.customer!.email}`) }] : []),
          { id: "trip-planner", label: "All Requirements", icon: MapPin, onClick: onBack },
        ]}
      />

      <Tabs defaultValue="requirement">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="requirement">Requirement</TabsTrigger>
          <TabsTrigger value="recommended">Recommended Packages</TabsTrigger>
          <TabsTrigger value="selected">Selected Package</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="requirement" className="mt-4">
          <Card><CardContent className="p-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Customer</span><p className="font-medium">{item.customer?.name ?? item.lead?.customerName ?? "—"}</p></div>
            <div><span className="text-muted-foreground">Destination</span><p className="font-medium">{item.destination?.name}</p></div>
            <div><span className="text-muted-foreground">Travel Dates</span><p>{formatDate(item.travelStartDate)} – {formatDate(item.travelEndDate)}</p></div>
            <div><span className="text-muted-foreground">Duration</span><p>{item.days}D / {item.nights}N</p></div>
            <div><span className="text-muted-foreground">Passengers</span><p>{item.adults} adults, {item.children} children, {item.infants} infants</p></div>
            <div><span className="text-muted-foreground">Budget</span><p>₹{item.budgetMin.toLocaleString("en-IN")} – ₹{item.budgetMax.toLocaleString("en-IN")}</p></div>
            <div><span className="text-muted-foreground">Hotel Category</span><p>{item.hotelCategory ?? "—"}</p></div>
            <div><span className="text-muted-foreground">Package Type</span><p>{item.packageType ?? "—"}</p></div>
            <div className="sm:col-span-2 flex gap-4 text-xs text-muted-foreground">
              {item.flightRequired && <span>✈ Flight</span>}
              {item.visaRequired && <span>Visa</span>}
              {item.insuranceRequired && <span>Insurance</span>}
            </div>
            {item.specialRequests && (
              <div className="sm:col-span-2"><span className="text-muted-foreground">Special Requests</span><p className="whitespace-pre-wrap">{item.specialRequests}</p></div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="recommended" className="mt-4 space-y-3">
          {matches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No matching published packages for this destination.</p>
          ) : matches.map((m) => (
            <PackageMatchCard key={m.packageId} match={m} selected={selection?.packageId === m.packageId} onView={() => {}} onCustomize={onEdit} />
          ))}
        </TabsContent>

        <TabsContent value="selected" className="mt-4">
          {!selection || !selectedPackage ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No package selected yet. Edit requirement to customize a package.</p>
          ) : (
            <Card><CardContent className="p-4 space-y-3 text-sm">
              <p className="font-semibold text-lg">{selectedPackage.packageName}</p>
              <p className="text-muted-foreground">{selectedPackage.packageCode} · {selectedPackage.durationDays}D/{selectedPackage.durationNights}N</p>
              <div className="grid sm:grid-cols-3 gap-2 pt-2">
                <div><span className="text-xs text-muted-foreground">Hotel tier</span><p className="font-medium">{selection.hotelOptionGroup ?? "Default"}</p></div>
                <div><span className="text-xs text-muted-foreground">Activity tier</span><p className="font-medium">{selection.activityOptionGroup ?? "Default"}</p></div>
                <div><span className="text-xs text-muted-foreground">Transfer tier</span><p className="font-medium">{selection.transferOptionGroup ?? "Default"}</p></div>
              </div>
              {productOptions.length > 0 && <PackageProductOptionsDisplay options={productOptions} />}
            </CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          {selection?.packageId ? (
            <TripPricePanel
              requirementId={requirementId}
              packageId={selection.packageId}
              markup={selection.markup}
              hotelOptionGroup={selection.hotelOptionGroup}
              activityOptionGroup={selection.activityOptionGroup}
              transferOptionGroup={selection.transferOptionGroup}
              compact
            />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Select a package to see pricing.</p>
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          {selectedPackage?.days?.length ? (
            <PackageItineraryPreview packageName={selectedPackage.packageName} days={mapPackageToItineraryDraft(selectedPackage)} />
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">No itinerary on selected package.</p>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {(item.history ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No history yet.</p>
          ) : (
            <div className="space-y-2">
              {item.history!.map((h) => (
                <div key={h.id} className="p-3 rounded-lg border text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium capitalize">{h.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(h.createdAt)}</span>
                  </div>
                  {h.summary && <p className="text-xs text-muted-foreground mt-1">{h.summary}</p>}
                  {h.createdByName && <p className="text-[10px] text-muted-foreground">{h.createdByName}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

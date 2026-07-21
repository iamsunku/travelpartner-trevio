"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, Pencil, Copy, Archive, Trash2, Hotel, Activity, Car, History, DollarSign, Star, Map, Layers,
} from "lucide-react";
import { PageShell, PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { PackageWizard } from "@/components/shared/package-wizard";
import {
  PackageItineraryBuilder,
  itineraryDaysToPayload,
  mapPackageToItineraryDraft,
  type ItineraryDayDraft,
} from "@/components/shared/package-itinerary-builder";
import {
  PackageProductOptionsDisplay,
  getOptionGroupsForType,
  legacyJunctionsToOptions,
  mapRecordToOptionDraft,
  type ProductOptionDraft,
} from "@/components/shared/package-product-options-builder";
import { PackageItineraryPreview } from "@/components/shared/package-itinerary-preview";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { hasCrudPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/app-store";
import type { PackageVersionRecord, TravelPackageRecord } from "@/types";

interface PackageDetailProps {
  packageId: string;
  onBack: () => void;
  onRefreshList: () => void;
}

function formatPrice(n: number, c = "INR") {
  return `${c === "INR" ? "₹" : c + " "}${n.toLocaleString("en-IN")}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export function PackageDetail({ packageId, onBack, onRefreshList }: PackageDetailProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [item, setItem] = useState<TravelPackageRecord | null>(null);
  const [versions, setVersions] = useState<PackageVersionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [itineraryDays, setItineraryDays] = useState<ItineraryDayDraft[]>([]);
  const [itinerarySaving, setItinerarySaving] = useState(false);
  const [itineraryEdit, setItineraryEdit] = useState(false);

  const canEdit = user ? hasCrudPermission(user, "packages", "edit") : false;
  const canAdd = user ? hasCrudPermission(user, "packages", "add") : false;
  const canDelete = user ? hasCrudPermission(user, "packages", "delete") : false;

  const load = async () => {
    setLoading(true);
    try {
      const [detail, vers] = await Promise.all([
        apiFetch<{ item: TravelPackageRecord }>(`/api/packages/${packageId}`),
        apiFetch<{ versions: PackageVersionRecord[] }>(`/api/packages/${packageId}/versions`),
      ]);
      setItem(detail.item);
      setVersions(vers.versions);
      setItineraryDays(mapPackageToItineraryDraft(detail.item));
      setItineraryEdit(false);
    } catch {
      toast({ title: "Failed to load package", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [packageId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePublish = async () => {
    try {
      await apiFetch(`/api/packages/${packageId}/publish`, { method: "PATCH" });
      toast({ title: "Package published" });
      load(); onRefreshList();
    } catch (e) {
      toast({ title: "Publish failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const handleUnpublish = async () => {
    try {
      await apiFetch(`/api/packages/${packageId}/unpublish`, { method: "PATCH" });
      toast({ title: "Package unpublished" });
      load(); onRefreshList();
    } catch {
      toast({ title: "Unpublish failed", variant: "destructive" });
    }
  };

  const handleDuplicate = async () => {
    try {
      await apiFetch(`/api/packages/${packageId}/duplicate`, { method: "POST" });
      toast({ title: "Package duplicated" });
      onRefreshList();
    } catch {
      toast({ title: "Duplicate failed", variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    try {
      await apiFetch(`/api/packages/${packageId}/archive`, { method: "PATCH" });
      toast({ title: "Package archived" });
      load(); onRefreshList();
    } catch {
      toast({ title: "Archive failed", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/packages/${packageId}`, { method: "DELETE" });
      toast({ title: "Package deleted" });
      onRefreshList(); onBack();
    } catch (e) {
      toast({ title: "Delete failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    }
  };

  const handleSaveItinerary = async () => {
    setItinerarySaving(true);
    try {
      await apiFetch(`/api/packages/${packageId}/itinerary`, {
        method: "PUT",
        body: JSON.stringify({ days: itineraryDaysToPayload(itineraryDays) }),
      });
      toast({ title: "Itinerary saved" });
      setItineraryEdit(false);
      load();
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
    } finally {
      setItinerarySaving(false);
    }
  };

  if (loading) return <PageShell><Skeleton className="h-8 w-48 mb-4" /><Skeleton className="h-64 w-full" /></PageShell>;
  if (!item) return <PageShell><Button variant="ghost" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button><p className="mt-4 text-muted-foreground">Not found</p></PageShell>;

  const hero = item.heroImage || item.bannerImage;

  const productOptions: ProductOptionDraft[] = item.productOptions?.length
    ? item.productOptions.map((o) => mapRecordToOptionDraft(o))
    : legacyJunctionsToOptions(item.hotels ?? [], item.activities ?? [], item.transfers ?? []);

  const optionGroups = {
    HOTEL: getOptionGroupsForType(productOptions, "HOTEL"),
    ACTIVITY: getOptionGroupsForType(productOptions, "ACTIVITY"),
    TRANSFER: getOptionGroupsForType(productOptions, "TRANSFER"),
  };

  return (
    <PageShell>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" />Back to Packages</Button>
          <PageHeader title={item.packageName} subtitle={`${item.packageCode} · ${item.destination?.name ?? ""} · ${item.durationDays}D/${item.durationNights}N`} />
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={item.status === "Published" ? "Active" : item.status} />
            {item.isFeatured && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1"><Star className="w-3 h-3" />Featured</span>}
            <span className="text-xs text-muted-foreground">v{item.currentVersion}</span>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}><Pencil className="w-4 h-4 mr-1" />Edit</Button>}
          {canAdd && <Button variant="outline" size="sm" onClick={handleDuplicate}><Copy className="w-4 h-4 mr-1" />Duplicate</Button>}
          {canEdit && item.status === "Draft" && <Button size="sm" onClick={handlePublish}>Publish</Button>}
          {canEdit && item.status === "Published" && <Button variant="outline" size="sm" onClick={handleUnpublish}>Unpublish</Button>}
          {canEdit && item.status !== "Archived" && <Button variant="outline" size="sm" onClick={handleArchive}><Archive className="w-4 h-4 mr-1" />Archive</Button>}
          {canDelete && <Button variant="outline" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}><Trash2 className="w-4 h-4 mr-1" />Delete</Button>}
        </div>
      </div>

      {hero && (
        <div className="relative rounded-xl overflow-hidden h-44 bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero} alt={item.packageName} className="w-full h-full object-cover" />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="hotels"><Hotel className="w-3.5 h-3.5 mr-1" />Hotels</TabsTrigger>
          <TabsTrigger value="activities"><Activity className="w-3.5 h-3.5 mr-1" />Activities</TabsTrigger>
          <TabsTrigger value="transfers"><Car className="w-3.5 h-3.5 mr-1" />Transfers</TabsTrigger>
          <TabsTrigger value="options"><Layers className="w-3.5 h-3.5 mr-1" />Product Options</TabsTrigger>
          <TabsTrigger value="itinerary"><Map className="w-3.5 h-3.5 mr-1" />Itinerary</TabsTrigger>
          <TabsTrigger value="pricing"><DollarSign className="w-3.5 h-3.5 mr-1" />Pricing</TabsTrigger>
          <TabsTrigger value="history"><History className="w-3.5 h-3.5 mr-1" />History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card className="border-border/80 shadow-none"><CardContent className="p-4 space-y-3 text-sm">
            <p><span className="text-muted-foreground">Type:</span> {item.packageType}</p>
            {item.description && <p className="whitespace-pre-wrap">{item.description}</p>}
            {Array.isArray(item.highlights) && item.highlights.length > 0 && (
              <ul className="list-disc pl-5 text-muted-foreground">{item.highlights.map((h, i) => <li key={i}>{h}</li>)}</ul>
            )}
            <p className="text-2xl font-bold text-[#2A7BBD]">{formatPrice(item.finalPrice, item.currency)}</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="hotels" className="mt-4">
          <ProductTable rows={(item.hotels ?? []).map((h) => ({ name: h.hotelProduct?.name ?? "—", status: h.hotelProduct?.status, supplier: h.hotelProduct?.supplier?.name, price: "—" }))} empty="No hotels in this package" />
        </TabsContent>
        <TabsContent value="activities" className="mt-4">
          <ProductTable rows={(item.activities ?? []).map((a) => ({ name: a.activityProduct?.name ?? "—", status: a.activityProduct?.status, supplier: a.activityProduct?.supplier?.name, price: a.activityProduct?.adultPrice ? formatPrice(Number(a.activityProduct.adultPrice)) : "—" }))} empty="No activities" />
        </TabsContent>
        <TabsContent value="transfers" className="mt-4">
          <ProductTable rows={(item.transfers ?? []).map((t) => ({ name: t.transferProduct?.name ?? "—", status: t.transferProduct?.status, supplier: t.transferProduct?.supplier?.name, price: t.transferProduct?.privatePrice ? formatPrice(Number(t.transferProduct.privatePrice)) : "—" }))} empty="No transfers" />
        </TabsContent>

        <TabsContent value="options" className="mt-4">
          {productOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-12 text-center">No product options configured. Use the Package Builder to add option groups.</p>
          ) : (
            <PackageProductOptionsDisplay options={productOptions} />
          )}
        </TabsContent>

        <TabsContent value="itinerary" className="mt-4 space-y-4">
          <div className="flex justify-end gap-2">
            {canEdit && !itineraryEdit && (
              <Button variant="outline" size="sm" onClick={() => setItineraryEdit(true)}>
                <Pencil className="w-4 h-4 mr-1" />Edit Itinerary
              </Button>
            )}
            {canEdit && itineraryEdit && (
              <>
                <Button variant="outline" size="sm" onClick={() => { setItineraryDays(mapPackageToItineraryDraft(item)); setItineraryEdit(false); }}>Cancel</Button>
                <Button size="sm" disabled={itinerarySaving} onClick={handleSaveItinerary}>
                  {itinerarySaving ? "Saving..." : "Save Itinerary"}
                </Button>
              </>
            )}
          </div>
          {itineraryEdit ? (
            <PackageItineraryBuilder
              days={itineraryDays}
              onChange={setItineraryDays}
              optionGroups={optionGroups}
              packageName={item.packageName}
              showPreview
            />
          ) : (
            <PackageItineraryPreview
              packageName={item.packageName}
              days={itineraryDays}
            />
          )}
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card className="border-border/80 shadow-none"><CardContent className="p-4 space-y-2 text-sm">
            {[
              ["Hotel Cost", item.hotelCost], ["Activity Cost", item.activityCost], ["Transfer Cost", item.transferCost],
              ["Markup", item.markup], ["Tax", item.tax], ["Discount", item.discount],
            ].map(([label, val]) => (
              <div key={String(label)} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium tabular-nums">{formatPrice(Number(val), item.currency)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 text-base font-bold">
              <span>Final Selling Price</span>
              <span className="text-[#2A7BBD]">{formatPrice(item.finalPrice, item.currency)}</span>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {versions.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">No version history</p> : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="p-3 rounded-lg border border-border/80">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-sm">Version {v.versionNumber}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{v.changeSummary ?? "Updated"} · {v.createdByName ?? "System"}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <PackageWizard open={wizardOpen} onOpenChange={setWizardOpen} initial={item} onSaved={() => { load(); onRefreshList(); }} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete package?</AlertDialogTitle><AlertDialogDescription>Soft-delete this package.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function ProductTable({ rows, empty }: { rows: { name: string; status?: string; supplier?: string; price: string }[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground py-12 text-center">{empty}</p>;
  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead>Supplier</TableHead><TableHead>Price</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell>{r.status ? <StatusBadge status={r.status} /> : "—"}</TableCell>
              <TableCell className="text-muted-foreground">{r.supplier ?? "—"}</TableCell>
              <TableCell>{r.price}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

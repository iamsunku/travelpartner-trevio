"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus, Copy, Archive, Trash2, Pencil, Download, Layers, Star,
} from "lucide-react";
import { PageShell, MetricCard, StatusBadge } from "@/components/shared/ui-helpers";
import {
  CatalogToolbar, EnterprisePageHeader,
} from "@/components/shared/enterprise";
import { PackageWizard } from "@/components/shared/package-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { hasCrudPermission } from "@/lib/permissions";
import { useAuthStore } from "@/store/app-store";
import type { DestinationOption } from "@/components/shared/destination-select";
import type { TravelPackageRecord } from "@/types";

interface PackageCatalogProps {
  onSelect: (id: string) => void;
}

function formatPrice(amount: number, currency = "INR") {
  return `${currency === "INR" ? "₹" : currency + " "}${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function PackageCatalog({ onSelect }: PackageCatalogProps) {
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [items, setItems] = useState<TravelPackageRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("All");
  const [destinationId, setDestinationId] = useState("All");
  const [packageType, setPackageType] = useState("All");
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<TravelPackageRecord | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const canAdd = user ? hasCrudPermission(user, "packages", "add") : false;
  const canEdit = user ? hasCrudPermission(user, "packages", "edit") : false;
  const canDelete = user ? hasCrudPermission(user, "packages", "delete") : false;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page), pageSize: "20", sort: "updatedAt", order: "desc",
        ...(q ? { q } : {}),
        ...(status !== "All" ? { status } : {}),
        ...(destinationId !== "All" ? { destinationId } : {}),
        ...(packageType !== "All" ? { packageType } : {}),
      });
      const data = await apiFetch<{ items: TravelPackageRecord[]; total: number }>(`/api/packages?${params}`);
      setItems(data.items);
      setTotal(data.total);
      setSelected(new Set());
    } catch {
      toast({ title: "Failed to load packages", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [page, q, status, destinationId, packageType, toast]);

  useEffect(() => {
    apiFetch<{ items: DestinationOption[] }>("/api/destinations?pageSize=100")
      .then((d) => setDestinations(d.items))
      .catch(() => {
        toast({ title: "Could not load destinations for filter", variant: "destructive" });
      });
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDuplicate = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await apiFetch(`/api/packages/${id}/duplicate`, { method: "POST" });
      toast({ title: "Package duplicated" });
      load();
    } catch {
      toast({ title: "Duplicate failed", variant: "destructive" });
    }
  };

  const handleArchive = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await apiFetch(`/api/packages/${id}/archive`, { method: "PATCH" });
      toast({ title: "Package archived" });
      load();
    } catch {
      toast({ title: "Archive failed", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/api/packages/${id}`, { method: "DELETE" });
      toast({ title: "Package deleted" });
      setDeleteTarget(null);
      load();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const exportCsv = () => {
    const header = "Package Name,Code,Destination,Duration,Hotels,Activities,Transfers,Price,Status,Updated";
    const rows = items.map((item) => [
      item.packageName, item.packageCode, item.destination?.name ?? "",
      `${item.durationDays}D/${item.durationNights}N`,
      item._count?.hotels ?? 0, item._count?.activities ?? 0, item._count?.transfers ?? 0,
      item.finalPrice, item.status, formatDate(item.updatedAt),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "packages.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <PageShell>
      <EnterprisePageHeader
        title="Package Builder"
        subtitle="Create reusable travel packages linked to destinations — ready for quotations."
        breadcrumbs={[{ label: "Products" }, { label: "Packages" }]}
        actions={
          canAdd ? (
            <Button size="sm" onClick={() => { setEditing(null); setWizardOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />Build Package
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-xl">
        <MetricCard icon={Layers} label="Total Packages" value={total.toLocaleString("en-IN")} color="bg-sky-100 text-primary dark:bg-sky-500/15 dark:text-sky-400" index={0} />
        <MetricCard icon={Star} label="Published" value={items.filter((i) => i.status === "Published").length.toLocaleString("en-IN")} color="bg-teal-100 text-brand-teal dark:bg-teal-500/15 dark:text-teal-400" subtitle="On this page" index={1} />
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <CatalogToolbar
            searchValue={q}
            onSearchChange={(v) => { setQ(v); setPage(1); }}
            searchPlaceholder="Search packages..."
            filters={
              <>
                <Select value={destinationId} onValueChange={(v) => { setDestinationId(v); setPage(1); }}>
                  <SelectTrigger className="w-[150px]" aria-label="Filter by destination"><SelectValue placeholder="Destination" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Destinations</SelectItem>
                    {destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                  <SelectTrigger className="w-[130px]" aria-label="Filter by status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Draft">Draft</SelectItem>
                    <SelectItem value="Published">Published</SelectItem>
                    <SelectItem value="Archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={packageType} onValueChange={(v) => { setPackageType(v); setPage(1); }}>
                  <SelectTrigger className="w-[130px]" aria-label="Filter by type"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Types</SelectItem>
                    {["Standard", "Premium", "Luxury", "Budget", "Honeymoon", "Family", "Adventure"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            }
            actions={
              <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" />Export</Button>
            }
            bordered={false}
          />

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"><Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(items.map((i) => i.id)) : new Set())} /></TableHead>
                  <TableHead>Hero</TableHead>
                  <TableHead>Package Name</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Hotels</TableHead>
                  <TableHead>Activities</TableHead>
                  <TableHead>Transfers</TableHead>
                  <TableHead>Starting Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 12 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center py-12 text-muted-foreground">No packages found</TableCell></TableRow>
                ) : items.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(item.id)}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={(v) => {
                        setSelected((prev) => { const n = new Set(prev); v ? n.add(item.id) : n.delete(item.id); return n; });
                      }} />
                    </TableCell>
                    <TableCell>
                      {item.heroImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.heroImage} alt="" className="w-10 h-10 rounded-md object-cover border" />
                      ) : <div className="w-10 h-10 rounded-md bg-muted border" />}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{item.packageName}</div>
                      <div className="text-xs text-muted-foreground">{item.packageCode}</div>
                    </TableCell>
                    <TableCell>{item.destination?.name ?? "—"}</TableCell>
                    <TableCell>{item.durationDays}D / {item.durationNights}N</TableCell>
                    <TableCell>{item._count?.hotels ?? 0}</TableCell>
                    <TableCell>{item._count?.activities ?? 0}</TableCell>
                    <TableCell>{item._count?.transfers ?? 0}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatPrice(item.finalPrice || item.startingPrice, item.currency)}</TableCell>
                    <TableCell><StatusBadge status={item.status === "Published" ? "Active" : item.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(item.updatedAt)}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => { setEditing(item); setWizardOpen(true); }}><Pencil className="w-4 h-4" /></Button>}
                        {canAdd && <Button variant="ghost" size="icon" onClick={(e) => handleDuplicate(item.id, e)}><Copy className="w-4 h-4" /></Button>}
                        {canEdit && item.status !== "Archived" && <Button variant="ghost" size="icon" onClick={(e) => handleArchive(item.id, e)}><Archive className="w-4 h-4" /></Button>}
                        {canDelete && <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(item.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} total packages</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span>Page {page}</span>
              <Button variant="outline" size="sm" disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <PackageWizard open={wizardOpen} onOpenChange={(o) => { setWizardOpen(o); if (!o) setEditing(null); }} initial={editing} onSaved={load} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete package?</AlertDialogTitle><AlertDialogDescription>Soft-delete this package.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && handleDelete(deleteTarget)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { PageShell, StatusBadge } from "@/components/shared/ui-helpers";
import {
  CatalogTable, CatalogTableHead, CatalogToolbar, EmptyState, EnterprisePageHeader, PageLoadingSkeleton,
} from "@/components/shared/enterprise";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import type { TravelRequirementRecord } from "@/types";

interface TripPlannerCatalogProps {
  onCreate: () => void;
  onSelect: (id: string) => void;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function TripPlannerCatalog({ onCreate, onSelect }: TripPlannerCatalogProps) {
  const [items, setItems] = useState<TravelRequirementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const q = useDebouncedValue(searchInput, 350);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ pageSize: "50", ...(q ? { q } : {}) });
      const data = await apiFetch<{ items: TravelRequirementRecord[] }>(`/api/trip-requirements?${params}`);
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { load(); }, [load]);

  return (
    <PageShell>
      <EnterprisePageHeader
        title="Trip Planner"
        subtitle="Capture travel requirements and match packages"
        breadcrumbs={[{ label: "Sales & CRM" }, { label: "Trip Planner" }]}
        actions={
          <Button onClick={onCreate}><Plus className="w-4 h-4 mr-1" />New Trip Requirement</Button>
        }
      />

      <CatalogToolbar
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search requirements, customers, destinations…"
      />

      {loading ? (
        <PageLoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="No trip requirements yet"
          description="Start by capturing customer travel needs, then match published packages."
          action={{ label: "Create first requirement", onClick: onCreate }}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <CatalogTableHead>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Travel Dates</TableHead>
                <TableHead>Pax</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </CatalogTableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(item.id)}>
                  <TableCell className="font-medium text-primary">{item.requirementCode}</TableCell>
                  <TableCell>{item.customer?.name ?? item.lead?.customerName ?? "—"}</TableCell>
                  <TableCell>{item.destination?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(item.travelStartDate)} – {formatDate(item.travelEndDate)}
                  </TableCell>
                  <TableCell className="text-sm">{item.adults}A {item.children ? `+ ${item.children}C` : ""}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}

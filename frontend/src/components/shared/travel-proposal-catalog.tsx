"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { PageShell, StatusBadge } from "@/components/shared/ui-helpers";
import {
  CatalogToolbar, EmptyState, EnterprisePageHeader, PageLoadingSkeleton,
} from "@/components/shared/enterprise";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api";
import type { TravelProposalRecord } from "@/types";

interface TravelProposalCatalogProps {
  onSelect: (id: string) => void;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

function customerLabel(p: TravelProposalRecord) {
  return p.customer?.name ?? p.lead?.customerName ?? "—";
}

export function TravelProposalCatalog({ onSelect }: TravelProposalCatalogProps) {
  const [items, setItems] = useState<TravelProposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const q = useDebouncedValue(searchInput, 350);
  const [status, setStatus] = useState("All");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageSize: "50",
        ...(q ? { q } : {}),
        ...(status !== "All" ? { status } : {}),
      });
      const data = await apiFetch<{ items: TravelProposalRecord[] }>(`/api/travel-proposals?${params}`);
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => { load(); }, [load]);

  const duplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const res = await apiFetch<{ item: TravelProposalRecord }>(`/api/travel-proposals/${id}/duplicate`, { method: "POST" });
    onSelect(res.item.id);
  };

  return (
    <PageShell>
      <EnterprisePageHeader
        title="Travel Proposals"
        subtitle="Customer proposals with immutable package snapshots"
        breadcrumbs={[{ label: "Sales & CRM" }, { label: "Travel Proposals" }]}
      />

      <CatalogToolbar
        searchValue={q}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search proposals, customers…"
        filters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              {["Draft", "Internal Review", "Approved", "Sent", "Viewed", "Accepted", "Booked", "Rejected", "Expired", "Cancelled"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <PageLoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="No travel proposals yet"
          description="Create a proposal from a Trip Requirement with a selected package."
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Requirement</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="w-[60px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(item.id)}>
                  <TableCell className="font-medium text-primary">{item.proposalNumber}</TableCell>
                  <TableCell>{customerLabel(item)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.travelRequirement?.requirementCode ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={item.proposalStatus} /></TableCell>
                  <TableCell className="text-sm">{formatDate(item.validUntil)}</TableCell>
                  <TableCell className="text-sm">v{item.currentVersion}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate" onClick={(e) => duplicate(e, item.id)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageShell>
  );
}

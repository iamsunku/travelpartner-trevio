"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Copy, Star, Archive } from "lucide-react";
import { PageShell, StatusBadge } from "@/components/shared/ui-helpers";
import {
  CatalogToolbar, EmptyState, EnterprisePageHeader, PageLoadingSkeleton,
} from "@/components/shared/enterprise";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api";
import type { QuoteTemplateRecord } from "@/types";

interface QuoteTemplateCatalogProps {
  onCreate: () => void;
  onSelect: (id: string) => void;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export function QuoteTemplateCatalog({ onCreate, onSelect }: QuoteTemplateCatalogProps) {
  const [items, setItems] = useState<QuoteTemplateRecord[]>([]);
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
      const data = await apiFetch<{ items: QuoteTemplateRecord[] }>(`/api/quote-templates?${params}`);
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }, [q, status]);

  useEffect(() => { load(); }, [load]);

  const duplicate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await apiFetch(`/api/quote-templates/${id}/duplicate`, { method: "POST" });
    load();
  };

  const setDefault = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/quote-templates/${id}/default`, { method: "PATCH" });
      load();
    } catch {
      /* toast handled by apiFetch */
    }
  };

  const archive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await apiFetch(`/api/quote-templates/${id}/archive`, { method: "PATCH" });
    load();
  };

  return (
    <PageShell>
      <EnterprisePageHeader
        title="Quote Templates"
        subtitle="Design reusable layouts for travel quotations"
        breadcrumbs={[{ label: "Settings" }, { label: "Quote Templates" }]}
        actions={<Button onClick={onCreate}><Plus className="w-4 h-4 mr-1" />New Template</Button>}
      />

      <CatalogToolbar
        searchValue={q}
        onSearchChange={setSearchInput}
        searchPlaceholder="Search templates…"
        filters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {loading ? (
        <PageLoadingSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          title="No quote templates yet"
          description="Create reusable quotation layouts with sections, branding, and preview."
          action={{ label: "Create first template", onClick: onCreate }}
        />
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>Sections</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(item.id)}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#2A7BBD]">{item.templateName}</span>
                      {item.isDefault && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">Default</span>
                      )}
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{item.description}</p>}
                  </TableCell>
                  <TableCell className="text-sm">{item.theme}</TableCell>
                  <TableCell className="text-sm">{item._count?.sections ?? item.sections?.length ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={item.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(item.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Duplicate" onClick={(e) => duplicate(e, item.id)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {item.status === "Active" && !item.isDefault && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Set default" onClick={(e) => setDefault(e, item.id)}>
                          <Star className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {item.status !== "Archived" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Archive" onClick={(e) => archive(e, item.id)}>
                          <Archive className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
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

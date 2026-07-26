"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { PackageProductOptionRecord, PackageProductType, ProductRecord } from "@/types";

export const GROUP_PRESETS: Record<PackageProductType, string[]> = {
  HOTEL: ["Standard", "Premium", "Luxury"],
  ACTIVITY: ["Included", "Optional", "Premium"],
  TRANSFER: ["Shared", "Private", "Luxury"],
};

export type ProductOptionDraft = PackageProductOptionRecord & {
  productName?: string;
  basePrice?: number;
};

function newId() {
  return `tmp-${crypto.randomUUID()}`;
}

export function hotelPrice(p: ProductRecord): number {
  const rooms = Array.isArray(p.roomCategories) ? (p.roomCategories as Record<string, unknown>[]) : [];
  const pricing = (rooms[0]?.pricing as Record<string, number>) ?? {};
  return pricing.double ?? pricing.single ?? 0;
}

export function activityPrice(p: ProductRecord): number {
  return Number(p.adultPrice ?? 0);
}

export function transferPrice(p: ProductRecord): number {
  return Number(p.privatePrice ?? p.sharedPrice ?? 0);
}

const PRICE_FN: Record<PackageProductType, (p: ProductRecord) => number> = {
  HOTEL: hotelPrice,
  ACTIVITY: activityPrice,
  TRANSFER: transferPrice,
};

export function validateOptionGroupsClient(options: ProductOptionDraft[]): string | null {
  const active = options.filter((o) => o.status !== "Inactive");
  const groups = new Map<string, ProductOptionDraft[]>();
  for (const o of active) {
    const key = `${o.productType}::${o.optionGroup}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  for (const [, list] of groups) {
    const defaults = list.filter((o) => o.isDefault);
    if (defaults.length !== 1) {
      return `Each group needs exactly one default (${list[0]?.optionGroup})`;
    }
  }
  return null;
}

const BASE_TIER: Record<PackageProductType, string[]> = GROUP_PRESETS;

export function calcDefaultCostsFromOptions(options: ProductOptionDraft[]) {
  const active = options.filter((o) => o.status !== "Inactive");
  let hotelCost = 0;
  let activityCost = 0;
  let transferCost = 0;

  for (const type of ["HOTEL", "ACTIVITY", "TRANSFER"] as PackageProductType[]) {
    const typeOpts = active.filter((o) => o.productType === type);
    const groups = [...new Set(typeOpts.map((o) => o.optionGroup))];
    const baseGroup = BASE_TIER[type].find((g) => groups.includes(g)) ?? groups[0];
    if (!baseGroup) continue;
    const def = typeOpts.find((o) => o.optionGroup === baseGroup && o.isDefault)
      ?? typeOpts.find((o) => o.optionGroup === baseGroup);
    if (!def) continue;
    const cost = (def.basePrice ?? 0) + (def.priceAdjustment ?? 0);
    if (type === "HOTEL") hotelCost += cost;
    else if (type === "ACTIVITY") activityCost += cost;
    else transferCost += cost;
  }
  return { hotelCost, activityCost, transferCost };
}

export function optionsToPayload(options: ProductOptionDraft[]) {
  return options.map((o, i) => ({
    productType: o.productType,
    productId: o.productId,
    optionGroup: o.optionGroup,
    isDefault: o.isDefault,
    sortOrder: o.sortOrder ?? i,
    priceAdjustment: o.priceAdjustment ?? 0,
    status: o.status ?? "Active",
    notes: o.notes ?? null,
  }));
}

export function mapRecordToOptionDraft(
  record: PackageProductOptionRecord & { product?: ProductRecord & { basePrice?: number; name?: string } }
): ProductOptionDraft {
  const p = record.product;
  return {
    ...record,
    productName: p?.name ?? record.productId,
    basePrice: p?.basePrice ?? (p ? PRICE_FN[record.productType](p as ProductRecord) : 0),
  };
}

export function legacyJunctionsToOptions(
  hotels: { hotelProduct?: ProductRecord | null; sortOrder?: number }[],
  activities: { activityProduct?: ProductRecord | null; sortOrder?: number }[],
  transfers: { transferProduct?: ProductRecord | null; sortOrder?: number }[]
): ProductOptionDraft[] {
  const opts: ProductOptionDraft[] = [];
  hotels.forEach((h, i) => {
    if (!h.hotelProduct) return;
    opts.push({
      id: newId(),
      productType: "HOTEL",
      productId: h.hotelProduct.id,
      productName: h.hotelProduct.name,
      optionGroup: "Standard",
      isDefault: i === 0,
      sortOrder: h.sortOrder ?? i,
      priceAdjustment: 0,
      status: "Active",
      basePrice: hotelPrice(h.hotelProduct),
    });
  });
  activities.forEach((a, i) => {
    if (!a.activityProduct) return;
    opts.push({
      id: newId(),
      productType: "ACTIVITY",
      productId: a.activityProduct.id,
      productName: a.activityProduct.name,
      optionGroup: "Included",
      isDefault: i === 0,
      sortOrder: a.sortOrder ?? i,
      priceAdjustment: 0,
      status: "Active",
      basePrice: activityPrice(a.activityProduct),
    });
  });
  transfers.forEach((t, i) => {
    if (!t.transferProduct) return;
    opts.push({
      id: newId(),
      productType: "TRANSFER",
      productId: t.transferProduct.id,
      productName: t.transferProduct.name,
      optionGroup: "Shared",
      isDefault: i === 0,
      sortOrder: t.sortOrder ?? i,
      priceAdjustment: 0,
      status: "Active",
      basePrice: transferPrice(t.transferProduct),
    });
  });
  return opts;
}

export function getOptionGroupsForType(options: ProductOptionDraft[], productType: PackageProductType): string[] {
  const fromOpts = [...new Set(options.filter((o) => o.productType === productType).map((o) => o.optionGroup))];
  const preset = GROUP_PRESETS[productType];
  return [...new Set([...preset, ...fromOpts])];
}

function SortableOptionRow({
  option, onSetDefault, onRemove, onAdjustment, readOnly,
}: {
  option: ProductOptionDraft;
  onSetDefault: () => void;
  onRemove: () => void;
  onAdjustment: (v: number) => void;
  readOnly?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: option.id, disabled: readOnly });
  const total = (option.basePrice ?? 0) + (option.priceAdjustment ?? 0);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm"
    >
      {!readOnly && (
        <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        disabled={readOnly || option.isDefault}
        onClick={onSetDefault}
        className={cn("shrink-0", option.isDefault ? "text-amber-500" : "text-muted-foreground hover:text-amber-500")}
        title="Set as default"
      >
        <Star className={cn("w-4 h-4", option.isDefault && "fill-current")} />
      </button>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{option.productName ?? option.productId}</p>
        <p className="text-[10px] text-muted-foreground tabular-nums">Base ₹{(option.basePrice ?? 0).toLocaleString("en-IN")}</p>
      </div>
      {!readOnly ? (
        <Input
          type="number"
          className="w-20 h-8 text-xs"
          placeholder="+/−"
          value={option.priceAdjustment ?? 0}
          onChange={(e) => onAdjustment(parseInt(e.target.value, 10) || 0)}
        />
      ) : (
        <span className="text-xs text-muted-foreground tabular-nums">{option.priceAdjustment ? `±₹${option.priceAdjustment}` : "—"}</span>
      )}
      <span className="text-xs font-medium tabular-nums w-16 text-right">₹{total.toLocaleString("en-IN")}</span>
      {!readOnly && (
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
}

interface PackageProductOptionsBuilderProps {
  productType: PackageProductType;
  destinationId: string;
  options: ProductOptionDraft[];
  onChange: (options: ProductOptionDraft[]) => void;
  readOnly?: boolean;
  apiPath: string;
  getPrice: (p: ProductRecord) => number;
  getSubtitle: (p: ProductRecord) => string;
}

export function PackageProductOptionsBuilder({
  productType, destinationId, options, onChange, readOnly = false, apiPath, getPrice, getSubtitle,
}: PackageProductOptionsBuilderProps) {
  const [q, setQ] = useState("");
  const [pool, setPool] = useState<ProductRecord[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [extraGroups, setExtraGroups] = useState<string[]>([]);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const typeOptions = useMemo(() => options.filter((o) => o.productType === productType), [options, productType]);
  const groups = useMemo(
    () => [...new Set([...GROUP_PRESETS[productType], ...extraGroups, ...getOptionGroupsForType(options, productType)])],
    [options, productType, extraGroups]
  );

  const load = useCallback(async () => {
    if (!destinationId) { setPool([]); return; }
    const params = new URLSearchParams({ pageSize: "50", destinationId, ...(q ? { q } : {}) });
    const data = await apiFetch<{ items: ProductRecord[] }>(`${apiPath}?${params}`);
    setPool(data.items);
  }, [apiPath, destinationId, q]);

  useEffect(() => { load(); }, [load]);

  const updateTypeOptions = (next: ProductOptionDraft[]) => {
    onChange([...options.filter((o) => o.productType !== productType), ...next]);
  };

  const addProduct = (group: string, p: ProductRecord) => {
    if (typeOptions.some((o) => o.productId === p.id)) return;
    const inGroup = typeOptions.filter((o) => o.optionGroup === group);
    const opt: ProductOptionDraft = {
      id: newId(),
      productType,
      productId: p.id,
      productName: p.name,
      optionGroup: group,
      isDefault: inGroup.length === 0,
      sortOrder: inGroup.length,
      priceAdjustment: 0,
      status: "Active",
      basePrice: getPrice(p),
    };
    updateTypeOptions([...typeOptions, opt]);
  };

  const setDefault = (id: string) => {
    const target = typeOptions.find((o) => o.id === id);
    if (!target) return;
    updateTypeOptions(typeOptions.map((o) => ({
      ...o,
      isDefault: o.optionGroup === target.optionGroup ? o.id === id : o.isDefault,
    })));
  };

  const onDragEnd = (group: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const groupItems = typeOptions.filter((o) => o.optionGroup === group);
    const oldIndex = groupItems.findIndex((o) => o.id === active.id);
    const newIndex = groupItems.findIndex((o) => o.id === over.id);
    const reordered = arrayMove(groupItems, oldIndex, newIndex).map((o, i) => ({ ...o, sortOrder: i }));
    const others = typeOptions.filter((o) => o.optionGroup !== group);
    updateTypeOptions([...others, ...reordered]);
  };

  const validationError = validateOptionGroupsClient(typeOptions);

  if (!destinationId) {
    return <p className="text-sm text-muted-foreground">Select a destination in Step 1 first.</p>;
  }

  return (
    <div className="space-y-4">
      {validationError && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">{validationError}</p>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search products..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {groups.map((group) => {
        const groupItems = typeOptions.filter((o) => o.optionGroup === group).sort((a, b) => a.sortOrder - b.sortOrder);
        const available = pool.filter((p) => !typeOptions.some((o) => o.productId === p.id));

        return (
          <div key={group} className="rounded-lg border border-border overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
              <div>
                <p className="text-sm font-medium">{group}</p>
                <p className="text-[10px] text-muted-foreground">{groupItems.length} product{groupItems.length !== 1 ? "s" : ""}</p>
              </div>
              {groupItems.some((o) => o.isDefault) && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Default set</span>
              )}
            </div>
            <div className="p-3 space-y-2">
              {groupItems.length > 0 && (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(group)}>
                  <SortableContext items={groupItems.map((o) => o.id)} strategy={verticalListSortingStrategy}>
                    {groupItems.map((opt) => (
                      <SortableOptionRow
                        key={opt.id}
                        option={opt}
                        readOnly={readOnly}
                        onSetDefault={() => setDefault(opt.id)}
                        onRemove={() => updateTypeOptions(typeOptions.filter((o) => o.id !== opt.id))}
                        onAdjustment={(v) => updateTypeOptions(typeOptions.map((o) => (o.id === opt.id ? { ...o, priceAdjustment: v } : o)))}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
              {!readOnly && available.length > 0 && (
                <div className="max-h-28 overflow-y-auto space-y-1 border rounded-md p-2 bg-muted/20">
                  <Label className="text-[10px] text-muted-foreground">Add to {group}</Label>
                  {available.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-xs">
                      <Checkbox onCheckedChange={() => addProduct(group, p)} />
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-muted-foreground tabular-nums">₹{getPrice(p).toLocaleString("en-IN")}</span>
                    </label>
                  ))}
                </div>
              )}
              {groupItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No products in this group</p>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <div className="flex gap-2">
          <Input placeholder="New group name..." value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="h-8 text-sm" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!newGroup.trim() || groups.includes(newGroup.trim())}
            onClick={() => {
              if (newGroup.trim()) setExtraGroups((g) => [...g, newGroup.trim()]);
              setNewGroup("");
            }}
          >
            <Plus className="w-3 h-3 mr-1" />Add Group
          </Button>
        </div>
      )}
    </div>
  );
}

interface PackageProductOptionsDisplayProps {
  options: ProductOptionDraft[];
  readOnly?: boolean;
}

export function PackageProductOptionsDisplay({ options }: PackageProductOptionsDisplayProps) {
  const byType = useMemo(() => {
    const map: Record<PackageProductType, Map<string, ProductOptionDraft[]>> = {
      HOTEL: new Map(),
      ACTIVITY: new Map(),
      TRANSFER: new Map(),
    };
    for (const o of options) {
      const g = map[o.productType];
      g.set(o.optionGroup, [...(g.get(o.optionGroup) ?? []), o]);
    }
    return map;
  }, [options]);

  const labels: Record<PackageProductType, string> = { HOTEL: "Hotels", ACTIVITY: "Activities", TRANSFER: "Transfers" };

  return (
    <div className="space-y-6">
      {(["HOTEL", "ACTIVITY", "TRANSFER"] as PackageProductType[]).map((type) => {
        const groups = byType[type];
        if (groups.size === 0) return null;
        return (
          <div key={type}>
            <h4 className="text-sm font-semibold text-primary mb-2">{labels[type]}</h4>
            <div className="space-y-3">
              {[...groups.entries()].map(([group, items]) => (
                <div key={group} className="rounded-lg border overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 border-b text-sm font-medium">{group}</div>
                  <div className="divide-y">
                    {items.sort((a, b) => a.sortOrder - b.sortOrder).map((o) => (
                      <div key={o.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                        {o.isDefault && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                        <span className="flex-1 truncate">{o.productName ?? o.productId}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {o.priceAdjustment ? `±₹${o.priceAdjustment}` : ""}
                        </span>
                        <span className="text-xs tabular-nums font-medium">
                          ₹{((o.basePrice ?? 0) + (o.priceAdjustment ?? 0)).toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

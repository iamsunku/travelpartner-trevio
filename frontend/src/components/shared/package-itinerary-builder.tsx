"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Plus, Copy, Trash2, ChevronDown, ChevronUp, Hotel, Activity, Car, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PackageItineraryPreview } from "@/components/shared/package-itinerary-preview";
import type {
  ItineraryProductRef, MealPlan, PackageDayRecord, PackageTimelineItemRecord, TimelineItemType,
} from "@/types";

export type ItineraryDayDraft = PackageDayRecord & {
  items: (PackageTimelineItemRecord & { image?: string })[];
};

function newId() {
  return `tmp-${crypto.randomUUID()}`;
}

function emptyMealPlan(): MealPlan {
  return { breakfast: false, lunch: false, dinner: false, snacks: false };
}

export function createEmptyDay(dayNumber: number): ItineraryDayDraft {
  return {
    id: newId(),
    dayNumber,
    title: `Day ${dayNumber}`,
    description: "",
    mealPlan: emptyMealPlan(),
    coverImage: "",
    gallery: [],
    sortOrder: dayNumber - 1,
    items: [],
  };
}

export function ensureItineraryDays(days: ItineraryDayDraft[], durationDays: number): ItineraryDayDraft[] {
  if (days.length > 0) return days;
  const n = Math.max(1, durationDays);
  return Array.from({ length: n }, (_, i) => createEmptyDay(i + 1));
}

export function renumberItineraryDays(days: ItineraryDayDraft[]): ItineraryDayDraft[] {
  return [...days]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d, i) => ({ ...d, dayNumber: i + 1, sortOrder: i }));
}

export function validateItineraryDaysClient(days: ItineraryDayDraft[]): string | null {
  if (!days.length) return null;
  const numbers = days.map((d) => d.dayNumber).sort((a, b) => a - b);
  const unique = new Set(numbers);
  if (unique.size !== numbers.length) return "Duplicate day numbers are not allowed";
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) return "Days must be sequential starting from 1";
  }
  return null;
}

export function itineraryDaysToPayload(days: ItineraryDayDraft[]) {
  return days
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      description: d.description || null,
      mealPlan: d.mealPlan ?? {},
      coverImage: d.coverImage || null,
      gallery: (d.gallery ?? []).filter(Boolean),
      sortOrder: d.sortOrder ?? d.dayNumber - 1,
      items: [...d.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, i) => ({
          itemType: item.itemType,
          referenceId: item.referenceId ?? null,
          optionGroup: item.optionGroup ?? null,
          title: item.title,
          description: item.description ?? null,
          startTime: item.startTime ?? null,
          endTime: item.endTime ?? null,
          sortOrder: i,
          icon: item.icon ?? null,
          notes: item.notes ?? null,
        })),
    }));
}

function groupAutofill(type: TimelineItemType, group: string) {
  const label = type === "HOTEL" ? "Hotel" : type === "ACTIVITY" ? "Activity" : "Transfer";
  return {
    referenceId: null,
    optionGroup: group,
    title: `${group} ${label}`,
    description: `Selectable ${group.toLowerCase()} ${label.toLowerCase()} option`,
    image: undefined,
  };
}

const ITEM_TYPES: { type: TimelineItemType; label: string; icon: typeof Hotel }[] = [
  { type: "HOTEL", label: "Hotel", icon: Hotel },
  { type: "ACTIVITY", label: "Activity", icon: Activity },
  { type: "TRANSFER", label: "Transfer", icon: Car },
  { type: "TEXT", label: "Custom Text", icon: FileText },
];

interface PackageItineraryBuilderProps {
  days: ItineraryDayDraft[];
  onChange: (days: ItineraryDayDraft[]) => void;
  optionGroups?: Partial<Record<TimelineItemType, string[]>>;
  hotels?: ItineraryProductRef[];
  activities?: ItineraryProductRef[];
  transfers?: ItineraryProductRef[];
  packageName?: string;
  readOnly?: boolean;
  showPreview?: boolean;
}

function SortableDayButton({
  day, active, onSelect, readOnly, onDragProps,
}: {
  day: ItineraryDayDraft;
  active: boolean;
  onSelect: () => void;
  readOnly?: boolean;
  onDragProps?: { attributes: Record<string, unknown>; listeners: Record<string, unknown> };
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: day.id, disabled: readOnly });
  const dragProps = onDragProps ?? { attributes, listeners };

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1 rounded-lg border p-2 cursor-pointer transition-colors",
        active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
      )}
      onClick={onSelect}
    >
      {!readOnly && (
        <button type="button" className="cursor-grab text-muted-foreground shrink-0" {...dragProps.attributes} {...dragProps.listeners} onClick={(e) => e.stopPropagation()}>
          <GripVertical className="w-4 h-4" />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">Day {day.dayNumber}</p>
        <p className="text-sm truncate">{day.title}</p>
        <p className="text-[10px] text-muted-foreground">{day.items.length} items</p>
      </div>
    </div>
  );
}

function SortableTimelineItem({
  item, readOnly, collapsed, onToggleCollapse, onDuplicate, onDelete, onUpdate,
}: {
  item: PackageTimelineItemRecord & { image?: string };
  readOnly?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<PackageTimelineItemRecord & { image?: string }>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id, disabled: readOnly });
  const Icon = ITEM_TYPES.find((t) => t.type === item.itemType)?.icon ?? FileText;

  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 p-2 border-b border-border/50">
        {!readOnly && (
          <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <Icon className="w-4 h-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.title || "Untitled"}</p>
        {item.optionGroup && (
          <p className="text-[10px] text-primary">{item.optionGroup} tier</p>
        )}
          {(item.startTime || item.endTime) && (
            <p className="text-[10px] text-muted-foreground tabular-nums">{item.startTime}{item.endTime ? ` – ${item.endTime}` : ""}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleCollapse}>
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </Button>
          {!readOnly && (
            <>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
            </>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className="p-3 space-y-2 text-sm">
          {item.image && (
            <div className="w-full h-24 rounded-md overflow-hidden bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          {!readOnly ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={item.title} onChange={(e) => onUpdate({ title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Start</Label>
                  <Input placeholder="09:00" value={item.startTime ?? ""} onChange={(e) => onUpdate({ startTime: e.target.value || null })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End / Duration</Label>
                  <Input placeholder="12:00" value={item.endTime ?? ""} onChange={(e) => onUpdate({ endTime: e.target.value || null })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Description</Label>
                <Textarea rows={2} value={item.description ?? ""} onChange={(e) => onUpdate({ description: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Notes</Label>
                <Input value={item.notes ?? ""} onChange={(e) => onUpdate({ notes: e.target.value || null })} />
              </div>
            </>
          ) : (
            <>
              {item.description && <p className="text-muted-foreground text-xs">{item.description}</p>}
              {item.notes && <p className="text-xs italic text-muted-foreground">Note: {item.notes}</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function PackageItineraryBuilder({
  days, onChange, optionGroups = {}, hotels = [], activities = [], transfers = [], packageName, readOnly = false, showPreview = true,
}: PackageItineraryBuilderProps) {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(days[0]?.id ?? null);
  const [collapsedItems, setCollapsedItems] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<TimelineItemType>("ACTIVITY");
  const [addGroup, setAddGroup] = useState("");
  const [addTitle, setAddTitle] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [galleryInput, setGalleryInput] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortedDays = useMemo(() => [...days].sort((a, b) => a.dayNumber - b.dayNumber), [days]);
  const selectedDay = sortedDays.find((d) => d.id === selectedDayId) ?? sortedDays[0] ?? null;

  const updateDays = useCallback((fn: (prev: ItineraryDayDraft[]) => ItineraryDayDraft[]) => {
    onChange(fn(days));
  }, [days, onChange]);

  const updateDay = (dayId: string, patch: Partial<ItineraryDayDraft>) => {
    updateDays((prev) => prev.map((d) => (d.id === dayId ? { ...d, ...patch } : d)));
  };

  const updateMeal = (dayId: string, key: keyof MealPlan, checked: boolean) => {
    updateDays((prev) => prev.map((d) => {
      if (d.id !== dayId) return d;
      return { ...d, mealPlan: { ...emptyMealPlan(), ...d.mealPlan, [key]: checked } };
    }));
  };

  const addDay = () => {
    const nextNum = sortedDays.length ? Math.max(...sortedDays.map((d) => d.dayNumber)) + 1 : 1;
    const day = createEmptyDay(nextNum);
    updateDays((prev) => [...prev, day]);
    setSelectedDayId(day.id);
  };

  const duplicateDay = (dayId: string) => {
    const source = sortedDays.find((d) => d.id === dayId);
    if (!source) return;
    const nextNum = Math.max(...sortedDays.map((d) => d.dayNumber)) + 1;
    const copy: ItineraryDayDraft = {
      ...source,
      id: newId(),
      dayNumber: nextNum,
      title: `${source.title} (Copy)`,
      items: source.items.map((it) => ({ ...it, id: newId() })),
    };
    updateDays((prev) => renumberItineraryDays([...prev, copy]));
  };

  const deleteDay = (dayId: string) => {
    const next = renumberItineraryDays(sortedDays.filter((d) => d.id !== dayId));
    onChange(next);
    setSelectedDayId(next[0]?.id ?? null);
  };

  const onDayDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedDays.findIndex((d) => d.id === active.id);
    const newIndex = sortedDays.findIndex((d) => d.id === over.id);
    const moved = arrayMove(sortedDays, oldIndex, newIndex);
    onChange(renumberItineraryDays(moved));
  };

  const onItemDragEnd = (event: DragEndEvent) => {
    if (!selectedDay) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const items = [...selectedDay.items].sort((a, b) => a.sortOrder - b.sortOrder);
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex).map((it, i) => ({ ...it, sortOrder: i }));
    updateDay(selectedDay.id, { items: reordered });
  };

  const groupPool = addType === "HOTEL"
    ? (optionGroups.HOTEL ?? [])
    : addType === "ACTIVITY"
      ? (optionGroups.ACTIVITY ?? [])
      : addType === "TRANSFER"
        ? (optionGroups.TRANSFER ?? [])
        : [];

  const openAddItem = () => {
    setAddType("ACTIVITY");
    setAddGroup("");
    setAddTitle("");
    setAddDescription("");
    setAddOpen(true);
  };

  const confirmAddItem = () => {
    if (!selectedDay || !addTitle.trim()) return;
    let image: string | undefined;
    const item: PackageTimelineItemRecord & { image?: string } = {
      id: newId(),
      itemType: addType,
      referenceId: addType === "TEXT" ? null : null,
      optionGroup: addType !== "TEXT" ? (addGroup || null) : null,
      title: addTitle.trim(),
      description: addDescription || null,
      startTime: null,
      endTime: null,
      sortOrder: selectedDay.items.length,
      icon: null,
      notes: null,
      image,
    };
    updateDay(selectedDay.id, { items: [...selectedDay.items, item] });
    setAddOpen(false);
  };

  const onAddGroupSelect = (group: string) => {
    setAddGroup(group);
    const fill = groupAutofill(addType, group);
    setAddTitle(fill.title);
    setAddDescription(fill.description ?? "");
  };

  const validationError = validateItineraryDaysClient(days);

  return (
    <div className="space-y-4">
      {validationError && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">{validationError}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        {/* Days sidebar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Days</Label>
            {!readOnly && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={addDay}>
                <Plus className="w-3 h-3 mr-1" />Add
              </Button>
            )}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDayDragEnd}>
            <SortableContext items={sortedDays.map((d) => d.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                {sortedDays.map((day) => (
                  <SortableDayButton
                    key={day.id}
                    day={day}
                    active={selectedDay?.id === day.id}
                    onSelect={() => setSelectedDayId(day.id)}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Timeline panel */}
        <div className="space-y-3 min-w-0">
          {!selectedDay ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Select or add a day</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-medium">Day {selectedDay.dayNumber} — Timeline</h4>
                {!readOnly && (
                  <div className="flex gap-1">
                    <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => duplicateDay(selectedDay.id)}>
                      <Copy className="w-3 h-3 mr-1" />Duplicate Day
                    </Button>
                    {sortedDays.length > 1 && (
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteDay(selectedDay.id)}>
                        <Trash2 className="w-3 h-3 mr-1" />Delete Day
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {!readOnly && (
                <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-3 bg-muted/20">
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Day Title</Label>
                    <Input value={selectedDay.title} onChange={(e) => updateDay(selectedDay.id, { title: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Textarea rows={2} value={selectedDay.description ?? ""} onChange={(e) => updateDay(selectedDay.id, { description: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="text-xs mb-2 block">Meal Plan</Label>
                    <div className="flex flex-wrap gap-3">
                      {(["breakfast", "lunch", "dinner", "snacks"] as const).map((key) => (
                        <label key={key} className="flex items-center gap-1.5 text-xs capitalize">
                          <Checkbox
                            checked={!!selectedDay.mealPlan?.[key]}
                            onCheckedChange={(v) => updateMeal(selectedDay.id, key, v === true)}
                          />
                          {key}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cover Image URL</Label>
                    <Input value={selectedDay.coverImage ?? ""} onChange={(e) => updateDay(selectedDay.id, { coverImage: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Gallery URL</Label>
                    <div className="flex gap-1">
                      <Input
                        placeholder="https://..."
                        value={galleryInput}
                        onChange={(e) => setGalleryInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && galleryInput.trim()) {
                            e.preventDefault();
                            updateDay(selectedDay.id, { gallery: [...(selectedDay.gallery ?? []), galleryInput.trim()] });
                            setGalleryInput("");
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!galleryInput.trim()) return;
                          updateDay(selectedDay.id, { gallery: [...(selectedDay.gallery ?? []), galleryInput.trim()] });
                          setGalleryInput("");
                        }}
                      >
                        Add
                      </Button>
                    </div>
                    {(selectedDay.gallery ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(selectedDay.gallery ?? []).map((url, i) => (
                          <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-1 max-w-full truncate">
                            {url}
                            <button type="button" className="text-destructive" onClick={() => updateDay(selectedDay.id, { gallery: (selectedDay.gallery ?? []).filter((_, j) => j !== i) })}>×</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-xs">Timeline ({selectedDay.items.length})</Label>
                {!readOnly && (
                  <Button type="button" size="sm" className="h-7 text-xs" onClick={openAddItem}>
                    <Plus className="w-3 h-3 mr-1" />Add Item
                  </Button>
                )}
              </div>

              {selectedDay.items.length === 0 ? (
                <p className="text-xs text-muted-foreground border border-dashed rounded-lg py-6 text-center">
                  No timeline items. Add hotels, activities, transfers, or custom text.
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd}>
                  <SortableContext items={selectedDay.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                      {[...selectedDay.items].sort((a, b) => a.sortOrder - b.sortOrder).map((item) => (
                        <SortableTimelineItem
                          key={item.id}
                          item={item}
                          readOnly={readOnly}
                          collapsed={!!collapsedItems[item.id]}
                          onToggleCollapse={() => setCollapsedItems((c) => ({ ...c, [item.id]: !c[item.id] }))}
                          onDuplicate={() => {
                            const copy = { ...item, id: newId(), title: `${item.title} (Copy)`, sortOrder: selectedDay.items.length };
                            updateDay(selectedDay.id, { items: [...selectedDay.items, copy] });
                          }}
                          onDelete={() => updateDay(selectedDay.id, { items: selectedDay.items.filter((i) => i.id !== item.id) })}
                          onUpdate={(patch) => {
                            updateDay(selectedDay.id, {
                              items: selectedDay.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)),
                            });
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </>
          )}
        </div>
      </div>

      {showPreview && (
        <div className="border-t pt-4">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-3 block">Live Preview</Label>
          <PackageItineraryPreview
            packageName={packageName}
            days={days}
            hotels={hotels}
            activities={activities}
            transfers={transfers}
            compact
          />
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Timeline Item</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {ITEM_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => { setAddType(type); setAddGroup(""); setAddTitle(""); setAddDescription(""); }}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border text-sm",
                    addType === type ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  )}
                >
                  <Icon className="w-4 h-4" />{label}
                </button>
              ))}
            </div>

            {addType !== "TEXT" && (
              <div className="space-y-1">
                <Label className="text-xs">Select option group</Label>
                {groupPool.length === 0 ? (
                  <p className="text-xs text-amber-600">No {addType.toLowerCase()} option groups configured yet.</p>
                ) : (
                  <Select value={addGroup} onValueChange={onAddGroupSelect}>
                    <SelectTrigger><SelectValue placeholder="Choose group..." /></SelectTrigger>
                    <SelectContent>
                      {groupPool.map((g) => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs">Title *</Label>
              <Input value={addTitle} onChange={(e) => setAddTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Textarea rows={2} value={addDescription} onChange={(e) => setAddDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!addTitle.trim()} onClick={confirmAddItem}>Add to Timeline</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function mapPackageToItineraryDraft(initial?: { days?: PackageDayRecord[] } | null): ItineraryDayDraft[] {
  if (!initial?.days?.length) return [];
  return initial.days.map((d) => ({
    ...d,
    mealPlan: (d.mealPlan ?? {}) as MealPlan,
    gallery: Array.isArray(d.gallery) ? d.gallery : [],
    items: (d.items ?? []).map((it) => ({ ...it })),
  }));
}

export function productRefFromRecord(
  p: { id: string; name: string; description?: string | null; images?: unknown; duration?: string | null; thumbnail?: string; heroImage?: string },
): ItineraryProductRef {
  const imgs = Array.isArray(p.images) ? (p.images as string[]) : [];
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    duration: p.duration ?? undefined,
    image: imgs[0] ?? p.thumbnail ?? p.heroImage ?? undefined,
  };
}

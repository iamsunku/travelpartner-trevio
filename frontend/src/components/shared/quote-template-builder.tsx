"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDroppable, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical, Copy, Trash2, Eye, EyeOff, Settings2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  QUOTE_SECTION_DEFS, defaultSectionTitle, sectionLabel,
} from "@/lib/quote-template-sections";
import type { QuoteSectionType, QuoteTemplateSectionRecord } from "@/types";

export type SectionDraft = QuoteTemplateSectionRecord & { clientKey: string };

function newKey() {
  return `sec-${crypto.randomUUID()}`;
}

export function mapSectionsToDraft(sections: QuoteTemplateSectionRecord[]): SectionDraft[] {
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((s, i) => ({
      ...s,
      clientKey: s.id || newKey(),
      sortOrder: i,
    }));
}

export function sectionsToPayload(sections: SectionDraft[]) {
  return sections.map((s, i) => ({
    sectionType: s.sectionType,
    sortOrder: i,
    isVisible: s.isVisible,
    customTitle: s.customTitle ?? null,
    settings: s.settings ?? {},
  }));
}

export function createSectionDraft(type: QuoteSectionType, sortOrder: number): SectionDraft {
  return {
    id: newKey(),
    clientKey: newKey(),
    sectionType: type,
    sortOrder,
    isVisible: true,
    customTitle: defaultSectionTitle(type),
    settings: {},
  };
}

function PaletteItem({ type, onAdd }: { type: QuoteSectionType; onAdd: () => void }) {
  const def = QUOTE_SECTION_DEFS.find((d) => d.type === type)!;
  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full text-left rounded-lg border border-dashed border-border/80 p-2.5 hover:border-[#2A7BBD] hover:bg-[#2A7BBD]/5 transition-colors"
    >
      <p className="text-sm font-medium">{def.label}</p>
      <p className="text-[10px] text-muted-foreground line-clamp-2">{def.description}</p>
    </button>
  );
}

function CanvasSection({
  section, readOnly, onToggleVisible, onDuplicate, onDelete, onConfigure, onRename,
}: {
  section: SectionDraft;
  readOnly?: boolean;
  onToggleVisible: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onConfigure: () => void;
  onRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.clientKey,
    disabled: readOnly,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-lg border bg-card p-3",
        !section.isVisible && "opacity-50 border-dashed",
        isDragging && "shadow-lg ring-2 ring-[#2A7BBD]/30"
      )}
    >
      <div className="flex items-center gap-2">
        {!readOnly && (
          <button type="button" className="cursor-grab text-muted-foreground shrink-0" {...attributes} {...listeners}>
            <GripVertical className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{section.customTitle || sectionLabel(section.sectionType)}</p>
          <p className="text-[10px] text-muted-foreground">{sectionLabel(section.sectionType)}</p>
        </div>
        {!readOnly && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleVisible} title={section.isVisible ? "Hide" : "Show"}>
              {section.isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onRename} title="Rename">
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onConfigure} title="Configure">
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate} title="Duplicate">
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete} title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasDropZone({ children, empty }: { children: React.ReactNode; empty?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop" });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[320px] rounded-xl border-2 border-dashed p-3 space-y-2 transition-colors",
        isOver ? "border-[#2A7BBD] bg-[#2A7BBD]/5" : "border-border/60",
        empty && "flex items-center justify-center"
      )}
    >
      {empty ? <p className="text-sm text-muted-foreground">Add sections from the left panel</p> : children}
    </div>
  );
}

interface QuoteTemplateBuilderProps {
  sections: SectionDraft[];
  onChange: (sections: SectionDraft[]) => void;
  readOnly?: boolean;
}

export function QuoteTemplateBuilder({ sections, onChange, readOnly }: QuoteTemplateBuilderProps) {
  const [configSection, setConfigSection] = useState<SectionDraft | null>(null);
  const [renameSection, setRenameSection] = useState<SectionDraft | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const canvasIds = useMemo(() => sections.map((s) => s.clientKey), [sections]);

  const usedSingleTypes = useMemo(() => {
    const singles = new Set<string>();
    for (const s of sections) {
      const def = QUOTE_SECTION_DEFS.find((d) => d.type === s.sectionType);
      if (!def?.allowMultiple) singles.add(s.sectionType);
    }
    return singles;
  }, [sections]);

  const addSection = useCallback((type: QuoteSectionType) => {
    const def = QUOTE_SECTION_DEFS.find((d) => d.type === type);
    if (!def?.allowMultiple && sections.some((s) => s.sectionType === type)) return;
    onChange([...sections, createSectionDraft(type, sections.length)]);
  }, [sections, onChange]);

  const updateSection = useCallback((key: string, patch: Partial<SectionDraft>) => {
    onChange(sections.map((s) => (s.clientKey === key ? { ...s, ...patch } : s)));
  }, [sections, onChange]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.clientKey === active.id);
    const newIndex = sections.findIndex((s) => s.clientKey === over.id);
    if (oldIndex >= 0 && newIndex >= 0) {
      onChange(arrayMove(sections, oldIndex, newIndex).map((s, i) => ({ ...s, sortOrder: i })));
    }
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      {!readOnly && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">Available Sections</h3>
            <span className="text-[10px] text-muted-foreground">Click to add</span>
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {QUOTE_SECTION_DEFS.map((def) => {
              const disabled = !def.allowMultiple && usedSingleTypes.has(def.type);
              return (
                <div key={def.type} className={cn(disabled && "opacity-40 pointer-events-none")}>
                  <PaletteItem type={def.type} onAdd={() => addSection(def.type)} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Template Canvas</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={canvasIds} strategy={verticalListSortingStrategy}>
            <CanvasDropZone empty={sections.length === 0}>
              {sections.map((section) => (
                <CanvasSection
                  key={section.clientKey}
                  section={section}
                  readOnly={readOnly}
                  onToggleVisible={() => updateSection(section.clientKey, { isVisible: !section.isVisible })}
                  onDuplicate={() => {
                    const def = QUOTE_SECTION_DEFS.find((d) => d.type === section.sectionType);
                    if (!def?.allowMultiple && sections.some((s) => s.sectionType === section.sectionType)) return;
                    const copy = createSectionDraft(section.sectionType, sections.length);
                    copy.customTitle = `${section.customTitle || sectionLabel(section.sectionType)} (Copy)`;
                    copy.settings = { ...(section.settings ?? {}) };
                    onChange([...sections, copy]);
                  }}
                  onDelete={() => onChange(sections.filter((s) => s.clientKey !== section.clientKey))}
                  onConfigure={() => setConfigSection(section)}
                  onRename={() => {
                    setRenameSection(section);
                    setRenameValue(section.customTitle || sectionLabel(section.sectionType));
                  }}
                />
              ))}
            </CanvasDropZone>
          </SortableContext>
        </DndContext>
      </div>

      <Dialog open={!!renameSection} onOpenChange={(o) => !o && setRenameSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename Section</DialogTitle></DialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Section title" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSection(null)}>Cancel</Button>
            <Button onClick={() => {
              if (renameSection) updateSection(renameSection.clientKey, { customTitle: renameValue });
              setRenameSection(null);
            }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!configSection} onOpenChange={(o) => !o && setConfigSection(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Section Settings</DialogTitle></DialogHeader>
          {configSection && (
            <div className="space-y-3">
              <div>
                <Label>Display title</Label>
                <Input
                  value={configSection.customTitle || ""}
                  onChange={(e) => updateSection(configSection.clientKey, { customTitle: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Visible in quote</Label>
                <Switch
                  checked={configSection.isVisible}
                  onCheckedChange={(v) => updateSection(configSection.clientKey, { isVisible: v })}
                />
              </div>
              {configSection.sectionType === "CUSTOM_HTML" && (
                <div>
                  <Label>Placeholder note</Label>
                  <Textarea
                    placeholder="Custom HTML is configured when generating quotes"
                    value={(configSection.settings?.placeholder as string) || ""}
                    onChange={(e) => updateSection(configSection.clientKey, {
                      settings: { ...configSection.settings, placeholder: e.target.value },
                    })}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setConfigSection(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

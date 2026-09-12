"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BedDouble, Bus, Plus, Trash2, Utensils, Wand2, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import type {
  ProposalItineraryDay,
  ProposalLineItem,
  ProposalSnapshotData,
  TravelProposalRecord,
} from "@/types";

type PickerKind = "hotel" | "transfer" | "activity" | "meal" | "misc";

interface ProposalItineraryBuilderProps {
  proposalId: string;
  proposal: TravelProposalRecord;
  snapshot: ProposalSnapshotData;
  onSaved: (snapshot: ProposalSnapshotData, proposal?: TravelProposalRecord) => void;
  readOnly?: boolean;
}

function money(n: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n || 0);
}

function newId() {
  return `li-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function recomputeDay(day: ProposalItineraryDay): ProposalItineraryDay {
  const sum = (items: ProposalLineItem[]) => items.reduce((s, x) => s + (Number(x.total) || 0), 0);
  const hotel = day.hotel ? { ...day.hotel, total: Math.round((day.hotel.unitPrice || 0) * (day.hotel.qty || 1)) } : null;
  const transfers = (day.transfers || []).map((x) => ({ ...x, total: Math.round((x.unitPrice || 0) * (x.qty || 1)) }));
  const activities = (day.activities || []).map((x) => ({ ...x, total: Math.round((x.unitPrice || 0) * (x.qty || 1)) }));
  const meals = (day.meals || []).map((x) => ({ ...x, total: Math.round((x.unitPrice || 0) * (x.qty || 1)) }));
  const misc = (day.misc || []).map((x) => ({ ...x, total: Math.round((x.unitPrice || 0) * (x.qty || 1)) }));
  const dayTotal = (hotel?.total || 0) + sum(transfers) + sum(activities) + sum(meals) + sum(misc);
  return { ...day, hotel, transfers, activities, meals, misc, dayTotal };
}

export function ProposalItineraryBuilder({
  proposalId,
  proposal,
  snapshot,
  onSaved,
  readOnly,
}: ProposalItineraryBuilderProps) {
  const [days, setDays] = useState<ProposalItineraryDay[]>(() =>
    (snapshot.days || []).map((d) => recomputeDay(d as ProposalItineraryDay))
  );
  const [markup, setMarkup] = useState(snapshot.pricing?.markup ?? 0);
  const [discount, setDiscount] = useState(snapshot.pricing?.discount ?? 0);
  const [tax, setTax] = useState(snapshot.pricing?.tax ?? 0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ dayIndex: number; kind: PickerKind } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currency = snapshot.trip?.currency || snapshot.pricing?.currency || proposal.currency || "INR";
  const adults = snapshot.trip?.adults ?? 2;
  const children = snapshot.trip?.children ?? 0;

  const tripTotal = useMemo(() => {
    const base = days.reduce((s, d) => s + (d.dayTotal || 0), 0);
    return Math.max(0, base + Number(markup || 0) - Number(discount || 0) + Number(tax || 0));
  }, [days, markup, discount, tax]);

  useEffect(() => {
    setDays((snapshot.days || []).map((d) => recomputeDay(d as ProposalItineraryDay)));
    setMarkup(snapshot.pricing?.markup ?? 0);
    setDiscount(snapshot.pricing?.discount ?? 0);
    setTax(snapshot.pricing?.tax ?? 0);
  }, [snapshot]);

  const persist = useCallback(async (nextDays: ProposalItineraryDay[], opts?: { bump?: boolean; m?: number; d?: number; t?: number }) => {
    if (readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch<{ item: TravelProposalRecord; snapshot: ProposalSnapshotData }>(
        `/api/travel-proposals/${proposalId}/itinerary`,
        {
          method: "PATCH",
          body: JSON.stringify({
            days: nextDays,
            markup: opts?.m ?? markup,
            discount: opts?.d ?? discount,
            tax: opts?.t ?? tax,
            bumpVersion: opts?.bump ?? false,
          }),
        }
      );
      onSaved(res.snapshot, res.item);
      setMessage(opts?.bump ? "Version saved" : "Draft saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [proposalId, markup, discount, tax, onSaved, readOnly]);

  const scheduleAutosave = useCallback((nextDays: ProposalItineraryDay[]) => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(nextDays, { bump: false }); }, 900);
  }, [persist, readOnly]);

  const updateDays = (updater: (prev: ProposalItineraryDay[]) => ProposalItineraryDay[]) => {
    setDays((prev) => {
      const next = updater(prev).map(recomputeDay);
      scheduleAutosave(next);
      return next;
    });
  };

  const applyLine = (dayIndex: number, kind: PickerKind, item: ProposalLineItem) => {
    updateDays((prev) => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      if (kind === "hotel") return { ...day, hotel: item };
      if (kind === "transfer") return { ...day, transfers: [...(day.transfers || []), item] };
      if (kind === "activity") return { ...day, activities: [...(day.activities || []), item] };
      if (kind === "meal") return { ...day, meals: [...(day.meals || []), item] };
      return { ...day, misc: [...(day.misc || []), item] };
    }));
  };

  const removeLine = (dayIndex: number, kind: PickerKind, lineId?: string) => {
    updateDays((prev) => prev.map((day, i) => {
      if (i !== dayIndex) return day;
      if (kind === "hotel") return { ...day, hotel: null };
      if (kind === "transfer") return { ...day, transfers: day.transfers.filter((x) => x.id !== lineId) };
      if (kind === "activity") return { ...day, activities: day.activities.filter((x) => x.id !== lineId) };
      if (kind === "meal") return { ...day, meals: day.meals.filter((x) => x.id !== lineId) };
      return { ...day, misc: day.misc.filter((x) => x.id !== lineId) };
    }));
  };

  const LineList = ({
    items, kind, dayIndex,
  }: { items: ProposalLineItem[]; kind: PickerKind; dayIndex: number }) => (
    <div className="space-y-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between gap-2 text-sm rounded-md border px-2 py-1.5">
          <div className="min-w-0">
            <div className="font-medium truncate">{item.name}</div>
            <div className="text-xs text-muted-foreground">{money(item.total, item.currency || currency)} · qty {item.qty}</div>
          </div>
          {!readOnly && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(dayIndex, kind, item.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background/95 backdrop-blur px-4 py-3">
        <div>
          <div className="text-sm text-muted-foreground">{snapshot.trip?.title || proposal.proposalNumber}</div>
          <div className="text-lg font-semibold">{money(tripTotal, currency)}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" disabled={saving} onClick={() => persist(days, { bump: true })}>
                Save version
              </Button>
              <Button size="sm" onClick={() => setReviewOpen(true)}>Review</Button>
            </>
          )}
          {saving && <span className="text-xs text-muted-foreground self-center">Saving…</span>}
          {message && <span className="text-xs text-emerald-600 self-center">{message}</span>}
          {error && <span className="text-xs text-destructive self-center">{error}</span>}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Label>Markup</Label>
          <Input type="number" disabled={readOnly} value={markup} onChange={(e) => {
            const v = Number(e.target.value) || 0;
            setMarkup(v);
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => { void persist(days, { bump: false, m: v, d: discount, t: tax }); }, 900);
          }} />
        </div>
        <div className="space-y-1">
          <Label>Discount</Label>
          <Input type="number" disabled={readOnly} value={discount} onChange={(e) => {
            const v = Number(e.target.value) || 0;
            setDiscount(v);
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => { void persist(days, { bump: false, m: markup, d: v, t: tax }); }, 900);
          }} />
        </div>
        <div className="space-y-1">
          <Label>Tax</Label>
          <Input type="number" disabled={readOnly} value={tax} onChange={(e) => {
            const v = Number(e.target.value) || 0;
            setTax(v);
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(() => { void persist(days, { bump: false, m: markup, d: discount, t: v }); }, 900);
          }} />
        </div>
      </div>

      <div className="space-y-4">
        {days.map((day, dayIndex) => (
          <Card key={`${day.dayNumber}-${day.date}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span>Day {day.dayNumber} · {day.date} · {day.city}</span>
                <span className="text-sm font-normal text-muted-foreground">{money(day.dayTotal, currency)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Slot
                icon={<BedDouble className="w-4 h-4" />}
                title="Hotel"
                onAdd={readOnly ? undefined : () => setPicker({ dayIndex, kind: "hotel" })}
              >
                {day.hotel ? (
                  <div className="flex items-center justify-between gap-2 text-sm rounded-md border px-2 py-1.5">
                    <div>
                      <div className="font-medium">{day.hotel.name}</div>
                      <div className="text-xs text-muted-foreground">{money(day.hotel.total, currency)} · {day.hotel.source}</div>
                    </div>
                    {!readOnly && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLine(dayIndex, "hotel")}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No hotel selected</p>
                )}
              </Slot>

              <Slot icon={<Bus className="w-4 h-4" />} title="Transfers" onAdd={readOnly ? undefined : () => setPicker({ dayIndex, kind: "transfer" })}>
                <LineList items={day.transfers || []} kind="transfer" dayIndex={dayIndex} />
              </Slot>

              <Slot icon={<Wand2 className="w-4 h-4" />} title="Activities" onAdd={readOnly ? undefined : () => setPicker({ dayIndex, kind: "activity" })}>
                <LineList items={day.activities || []} kind="activity" dayIndex={dayIndex} />
              </Slot>

              <Slot icon={<Utensils className="w-4 h-4" />} title="Meals" onAdd={readOnly ? undefined : () => setPicker({ dayIndex, kind: "meal" })}>
                <LineList items={day.meals || []} kind="meal" dayIndex={dayIndex} />
              </Slot>

              <Slot icon={<StickyNote className="w-4 h-4" />} title="Miscellaneous" onAdd={readOnly ? undefined : () => setPicker({ dayIndex, kind: "misc" })}>
                <LineList items={day.misc || []} kind="misc" dayIndex={dayIndex} />
              </Slot>
            </CardContent>
          </Card>
        ))}
      </div>

      {picker && (
        <ProductPickerDialog
          open
          kind={picker.kind}
          city={days[picker.dayIndex]?.city || ""}
          currency={currency}
          adults={adults}
          childrenCount={children}
          onClose={() => setPicker(null)}
          onSelect={(item) => {
            applyLine(picker.dayIndex, picker.kind, item);
            setPicker(null);
          }}
        />
      )}

      <ProposalReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        proposal={proposal}
        days={days}
        tripTotal={tripTotal}
        currency={currency}
        snapshot={snapshot}
        markup={markup}
        discount={discount}
        tax={tax}
        onPersistTerms={async (terms) => {
          const res = await apiFetch<{ item: TravelProposalRecord; snapshot: ProposalSnapshotData }>(
            `/api/travel-proposals/${proposalId}/itinerary`,
            {
              method: "PATCH",
              body: JSON.stringify({ days, markup, discount, tax, terms, bumpVersion: true, changeSummary: "Review terms updated" }),
            }
          );
          onSaved(res.snapshot, res.item);
        }}
      />
    </div>
  );
}

function Slot({
  icon, title, onAdd, children,
}: { icon: ReactNode; title: string; onAdd?: () => void; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div>
        {onAdd && (
          <Button type="button" variant="outline" size="sm" className="h-7" onClick={onAdd}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

function ProductPickerDialog({
  open, kind, city, currency, adults, childrenCount, onClose, onSelect,
}: {
  open: boolean;
  kind: PickerKind;
  city: string;
  currency: string;
  adults: number;
  childrenCount: number;
  onClose: () => void;
  onSelect: (item: ProposalLineItem) => void;
}) {
  const [q, setQ] = useState(city);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [hotelTab, setHotelTab] = useState<"catalog" | "api">("catalog");
  const [miscName, setMiscName] = useState("");
  const [miscPrice, setMiscPrice] = useState(0);
  const [miscNote, setMiscNote] = useState("");

  const load = useCallback(async () => {
    if (kind === "misc") return;
    setLoading(true);
    try {
      if (kind === "hotel" && hotelTab === "api") {
        const data = await apiFetch<{ hotels: Record<string, unknown>[] }>(
          `/api/hotels/search?city=${encodeURIComponent(q || city)}&count=12`
        );
        setItems(data.hotels || []);
      } else {
        const path =
          kind === "hotel" ? "/api/products/hotels"
            : kind === "transfer" ? "/api/products/transfers"
              : kind === "activity" ? "/api/products/activities"
                : "/api/products/meals";
        const params = new URLSearchParams({ pageSize: "30", liveOnly: "true", ...(q ? { q } : {}) });
        const data = await apiFetch<{ items: Record<string, unknown>[] }>(`${path}?${params}`);
        setItems(data.items || []);
      }
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [kind, hotelTab, q, city]);

  useEffect(() => { void load(); }, [load]);

  const pickCatalogHotel = (row: Record<string, unknown>) => {
    const rooms = Array.isArray(row.roomCategories) ? row.roomCategories as Record<string, unknown>[] : [];
    const price = Number(rooms[0]?.price ?? rooms[0]?.basePrice ?? 0) || 0;
    onSelect({
      id: newId(),
      productId: String(row.id),
      source: "catalog",
      name: String(row.name || "Hotel"),
      meta: { city: row.city, stars: row.starCategory, description: row.description },
      unitPrice: price,
      qty: 1,
      total: price,
      currency: String(row.currency || currency),
    });
  };

  const pickApiHotel = (row: Record<string, unknown>) => {
    const price = Number(row.pricePerNight ?? row.price ?? row.totalPrice ?? 0) || 0;
    onSelect({
      id: newId(),
      externalId: String(row.id || row.hotelId || ""),
      source: "amadeus",
      name: String(row.name || "Hotel"),
      meta: { city: row.city || city, stars: row.starRating || row.rating },
      unitPrice: price,
      qty: 1,
      total: price,
      currency: String(row.currency || currency),
    });
  };

  const pickTransfer = (row: Record<string, unknown>) => {
    const price = Number(row.privatePrice ?? row.sharedPrice ?? 0) || 0;
    onSelect({
      id: newId(),
      productId: String(row.id),
      source: "catalog",
      name: String(row.name || "Transfer"),
      meta: {
        vehicleType: row.vehicleType,
        pickup: row.pickupLocation,
        drop: row.dropLocation,
        transferType: row.transferType,
      },
      unitPrice: price,
      qty: 1,
      total: price,
      currency: String(row.currency || currency),
    });
  };

  const pickActivity = (row: Record<string, unknown>) => {
    const unit = (Number(row.adultPrice) || 0) * adults + (Number(row.childPrice) || 0) * childrenCount;
    const qty = Math.max(1, adults + childrenCount);
    const unitPrice = qty ? Math.round(unit / qty) : Number(row.adultPrice) || 0;
    onSelect({
      id: newId(),
      productId: String(row.id),
      source: "catalog",
      name: String(row.name || "Activity"),
      meta: { description: row.description, duration: row.duration, location: row.location },
      unitPrice,
      qty,
      total: unit || unitPrice * qty,
      currency: String(row.currency || currency),
    });
  };

  const pickMeal = (row: Record<string, unknown>) => {
    const total = (Number(row.adultPrice) || 0) * adults + (Number(row.childPrice) || 0) * childrenCount;
    const qty = Math.max(1, adults + childrenCount);
    onSelect({
      id: newId(),
      productId: String(row.id),
      source: "catalog",
      name: String(row.name || "Meal"),
      meta: { mealType: row.mealType, city: row.city },
      unitPrice: qty ? Math.round(total / qty) : Number(row.adultPrice) || 0,
      qty,
      total,
      currency: String(row.currency || currency),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {kind === "hotel" ? "Select hotel"
              : kind === "transfer" ? "Select transfer"
                : kind === "activity" ? "Select activity"
                  : kind === "meal" ? "Select meal"
                    : "Add miscellaneous"}
          </DialogTitle>
        </DialogHeader>

        {kind === "misc" ? (
          <div className="space-y-3">
            <div className="space-y-1"><Label>Name</Label><Input value={miscName} onChange={(e) => setMiscName(e.target.value)} /></div>
            <div className="space-y-1"><Label>Amount</Label><Input type="number" value={miscPrice} onChange={(e) => setMiscPrice(Number(e.target.value) || 0)} /></div>
            <div className="space-y-1"><Label>Note</Label><Input value={miscNote} onChange={(e) => setMiscNote(e.target.value)} /></div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                disabled={!miscName.trim() || miscPrice < 0}
                onClick={() => onSelect({
                  id: newId(),
                  source: "manual",
                  name: miscName.trim(),
                  meta: { note: miscNote },
                  unitPrice: miscPrice,
                  qty: 1,
                  total: miscPrice,
                  currency,
                })}
              >
                Add
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {kind === "hotel" && (
              <Tabs value={hotelTab} onValueChange={(v) => setHotelTab(v as "catalog" | "api")}>
                <TabsList>
                  <TabsTrigger value="catalog">Catalog</TabsTrigger>
                  <TabsTrigger value="api">API (Amadeus)</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
            <div className="flex gap-2">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${city || "products"}…`} />
              <Button variant="outline" onClick={() => void load()}>Search</Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No results</p>
            ) : (
              <div className="space-y-2">
                {items.map((row, idx) => {
                  const id = String(row.id || row.hotelId || idx);
                  const name = String(row.name || "Item");
                  const priceHint =
                    kind === "hotel" && hotelTab === "api"
                      ? Number(row.pricePerNight ?? row.price ?? 0)
                      : kind === "hotel"
                        ? Number((Array.isArray(row.roomCategories) ? (row.roomCategories as Record<string, unknown>[])[0]?.price : 0) || 0)
                        : kind === "transfer"
                          ? Number(row.privatePrice ?? row.sharedPrice ?? 0)
                          : kind === "meal"
                            ? Number(row.adultPrice ?? 0)
                            : Number(row.adultPrice ?? 0);
                  return (
                    <button
                      key={id}
                      type="button"
                      className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/50"
                      onClick={() => {
                        if (kind === "hotel" && hotelTab === "api") pickApiHotel(row);
                        else if (kind === "hotel") pickCatalogHotel(row);
                        else if (kind === "transfer") pickTransfer(row);
                        else if (kind === "activity") pickActivity(row);
                        else pickMeal(row);
                      }}
                    >
                      <div className="font-medium text-sm">{name}</div>
                      <div className="text-xs text-muted-foreground">
                        {money(priceHint, String(row.currency || currency))}
                        {row.mealType ? ` · ${String(row.mealType)}` : ""}
                        {row.city ? ` · ${String(row.city)}` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProposalReviewDialog({
  open, onOpenChange, proposal, days, tripTotal, currency, snapshot, markup, discount, tax, onPersistTerms,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  proposal: TravelProposalRecord;
  days: ProposalItineraryDay[];
  tripTotal: number;
  currency: string;
  snapshot: ProposalSnapshotData;
  markup: number;
  discount: number;
  tax: number;
  onPersistTerms: (terms: ProposalSnapshotData["terms"]) => Promise<void>;
}) {
  const [inclusions, setInclusions] = useState((snapshot.terms?.inclusions || []).join("\n"));
  const [exclusions, setExclusions] = useState((snapshot.terms?.exclusions || []).join("\n"));
  const [termsText, setTermsText] = useState(snapshot.terms?.termsText || "");
  const [busy, setBusy] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [pdfMsg, setPdfMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setInclusions((snapshot.terms?.inclusions || []).join("\n"));
    setExclusions((snapshot.terms?.exclusions || []).join("\n"));
    setTermsText(snapshot.terms?.termsText || "");
  }, [open, snapshot]);

  const saveTerms = async () => {
    setBusy(true);
    try {
      await onPersistTerms({
        inclusions: inclusions.split("\n").map((s) => s.trim()).filter(Boolean),
        exclusions: exclusions.split("\n").map((s) => s.trim()).filter(Boolean),
        termsText,
        cancellationText: snapshot.terms?.cancellationText || "",
        visaRequired: Boolean(snapshot.terms?.visaRequired),
        visaDetails: snapshot.terms?.visaDetails || "",
      });
    } finally {
      setBusy(false);
    }
  };

  const generatePdf = async () => {
    setBusy(true);
    setPdfMsg(null);
    try {
      await saveTerms();
      await apiFetch(`/api/travel-proposals/${proposal.id}/generate-pdf`, {
        method: "POST",
        body: JSON.stringify({ force: true }),
      });
      setPdfMsg("PDF generated");
    } catch (e) {
      setPdfMsg(e instanceof Error ? e.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  };

  const share = async (channel: "Email" | "WhatsApp") => {
    setBusy(true);
    setShareMsg(null);
    try {
      await saveTerms();
      const res = await apiFetch<{ emailed?: boolean; mailto?: string; whatsappUrl?: string; note?: string }>(
        `/api/travel-proposals/${proposal.id}/share`,
        {
          method: "POST",
          body: JSON.stringify({
            channel,
            appOrigin: typeof window !== "undefined" ? window.location.origin : "",
          }),
        }
      );
      if (channel === "WhatsApp" && res.whatsappUrl) window.open(res.whatsappUrl, "_blank");
      if (channel === "Email" && !res.emailed && res.mailto) window.location.href = res.mailto;
      setShareMsg(res.note || "Shared");
    } catch (e) {
      setShareMsg(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review proposal {proposal.proposalNumber}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-md border p-3">
            <div className="font-medium">{snapshot.trip?.title}</div>
            <div className="text-muted-foreground">
              {(snapshot.trip?.cities || []).map((c) => `${c.city} (${c.nights}N)`).join(" → ")}
            </div>
            <div className="mt-1 font-semibold">{money(tripTotal, currency)}</div>
            <div className="text-xs text-muted-foreground">Markup {markup} · Discount {discount} · Tax {tax}</div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {days.map((d) => (
              <div key={d.dayNumber} className="border rounded-md p-2">
                <div className="font-medium">Day {d.dayNumber} · {d.city}</div>
                <ul className="text-xs text-muted-foreground list-disc pl-4">
                  {d.hotel && <li>Hotel: {d.hotel.name}</li>}
                  {(d.transfers || []).map((t) => <li key={t.id}>Transfer: {t.name}</li>)}
                  {(d.activities || []).map((t) => <li key={t.id}>Activity: {t.name}</li>)}
                  {(d.meals || []).map((t) => <li key={t.id}>Meal: {t.name}</li>)}
                  {(d.misc || []).map((t) => <li key={t.id}>Misc: {t.name}</li>)}
                </ul>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label>Inclusions (one per line)</Label>
            <textarea className="w-full min-h-[70px] rounded-md border px-3 py-2 text-sm" value={inclusions} onChange={(e) => setInclusions(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Exclusions (one per line)</Label>
            <textarea className="w-full min-h-[70px] rounded-md border px-3 py-2 text-sm" value={exclusions} onChange={(e) => setExclusions(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Terms</Label>
            <textarea className="w-full min-h-[70px] rounded-md border px-3 py-2 text-sm" value={termsText} onChange={(e) => setTermsText(e.target.value)} />
          </div>
          {pdfMsg && <p className="text-xs">{pdfMsg}</p>}
          {shareMsg && <p className="text-xs">{shareMsg}</p>}
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" disabled={busy} onClick={() => void saveTerms()}>Save terms</Button>
          <Button variant="outline" disabled={busy} onClick={() => void generatePdf()}>Generate PDF</Button>
          <Button variant="outline" disabled={busy} onClick={() => void share("Email")}>Email</Button>
          <Button disabled={busy} onClick={() => void share("WhatsApp")}>WhatsApp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

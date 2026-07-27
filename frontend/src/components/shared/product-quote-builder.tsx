"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/app-store";
import { useDemoDataStore } from "@/store/demo-data-store";
import { apiFetch } from "@/lib/api";
import { api } from "@/lib/api";
import { formatProductPrice } from "@/lib/currency";
import { CurrencySelect } from "@/components/shared/currency-select";
import { downloadProductQuotationPdf, type ProductQuoteLine } from "@/lib/product-quotation-pdf";
import type { ProductRecord } from "@/types";

type Destination = { id: string; name: string; country?: string };

type EditableLine = ProductQuoteLine & { id: string };

function firstImage(item: ProductRecord): string {
  if (Array.isArray(item.images) && item.images.length) return String(item.images[0]);
  if (item.destination?.thumbnail) return String(item.destination.thumbnail);
  if (item.destination?.heroImage) return String(item.destination.heroImage);
  return "";
}

function hotelRoomOptions(hotel: ProductRecord) {
  const rooms = Array.isArray(hotel.roomCategories) ? (hotel.roomCategories as Record<string, unknown>[]) : [];
  return rooms.map((r) => {
    const pricing = (r.pricing as Record<string, number>) ?? {};
    const price = Number(pricing.double ?? pricing.single ?? 0);
    return { name: String(r.name || "Room"), price };
  });
}

export function ProductQuoteBuilderDialog() {
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const addQuotation = useDemoDataStore((s) => s.addQuotation);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [hotels, setHotels] = useState<ProductRecord[]>([]);
  const [activities, setActivities] = useState<ProductRecord[]>([]);
  const [transfers, setTransfers] = useState<ProductRecord[]>([]);

  const [customerName, setCustomerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [travelFrom, setTravelFrom] = useState("");
  const [travelTo, setTravelTo] = useState("");
  const [nights, setNights] = useState("3");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [currency, setCurrency] = useState("INR");
  const [paymentTerms, setPaymentTerms] = useState("50% advance, balance before travel");
  const [cancellationPolicy, setCancellationPolicy] = useState("Free cancellation up to 15 days; else non-refundable");
  const [includes, setIncludes] = useState("Hotel, Activities, Transfers as selected");
  const [excludes, setExcludes] = useState("Personal expenses, tips, visa, GST/TCS unless specified");

  const [selectedHotelId, setSelectedHotelId] = useState("");
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedActivityIds, setSelectedActivityIds] = useState<string[]>([]);
  const [lines, setLines] = useState<EditableLine[]>([]);

  const destinationName = destinations.find((d) => d.id === destinationId)?.name || "";

  useEffect(() => {
    if (!open) return;
    apiFetch<{ items: Destination[] }>("/api/destinations?pageSize=100&status=Active")
      .then((d) => setDestinations(d.items || []))
      .catch(() => setDestinations([]));
  }, [open]);

  useEffect(() => {
    if (!destinationId) {
      setHotels([]);
      setActivities([]);
      setTransfers([]);
      return;
    }
    Promise.all([
      apiFetch<{ items: ProductRecord[] }>(`/api/products/hotels?liveOnly=true&destinationId=${destinationId}&pageSize=50`),
      apiFetch<{ items: ProductRecord[] }>(`/api/products/activities?liveOnly=true&destinationId=${destinationId}&pageSize=50`),
      apiFetch<{ items: ProductRecord[] }>(`/api/products/transfers?liveOnly=true&destinationId=${destinationId}&pageSize=50`),
    ])
      .then(([h, a, t]) => {
        setHotels(h.items || []);
        setActivities(a.items || []);
        setTransfers(t.items || []);
      })
      .catch(() => {
        setHotels([]);
        setActivities([]);
        setTransfers([]);
      });
  }, [destinationId]);

  const hotelRooms = useMemo(() => {
    const hotel = hotels.find((h) => h.id === selectedHotelId);
    return hotel ? hotelRoomOptions(hotel) : [];
  }, [hotels, selectedHotelId]);

  function autoBuild() {
    if (!destinationId) {
      toast({ title: "Select a destination first", variant: "destructive" });
      return;
    }
    const built: EditableLine[] = [];
    const paxAdults = parseInt(adults, 10) || 2;
    const paxChildren = parseInt(children, 10) || 0;
    const nightCount = parseInt(nights, 10) || 1;

    const hotel = hotels.find((h) => h.id === selectedHotelId);
    if (hotel && selectedRoom) {
      const room = hotelRoomOptions(hotel).find((r) => r.name === selectedRoom);
      const hotelCurrency = String(hotel.currency || currency);
      built.push({
        id: `hotel-${hotel.id}`,
        type: "hotel",
        title: `${hotel.name} — ${selectedRoom}`,
        description: String(hotel.description || "").slice(0, 200),
        imageUrl: firstImage(hotel),
        qty: nightCount,
        unitPrice: room?.price ?? 0,
        currency: hotelCurrency,
        meta: `${paxAdults}A${paxChildren > 0 ? ` + ${paxChildren}C` : ""} · ${nightCount} night(s)`,
      });
    }

    for (const actId of selectedActivityIds) {
      const act = activities.find((a) => a.id === actId);
      if (!act) continue;
      const actCurrency = String(act.currency || currency);
      const adultRate = Number(act.adultPrice ?? 0);
      const childRate = Number(act.childPrice ?? adultRate);
      const actTotal = adultRate * paxAdults + childRate * paxChildren;
      const unitPrice = paxAdults + paxChildren > 0 ? Math.round(actTotal / (paxAdults + paxChildren)) : adultRate;
      built.push({
        id: `activity-${act.id}`,
        type: "activity",
        title: String(act.name),
        description: String(act.description || act.duration || "").slice(0, 200),
        imageUrl: firstImage(act),
        qty: paxAdults + paxChildren,
        unitPrice,
        currency: actCurrency,
        meta: `${act.duration || "Activity"} · ${paxAdults}A${paxChildren > 0 ? ` ${paxChildren}C` : ""}`,
      });

      const transferOpts = Array.isArray(act.transferOptions) ? act.transferOptions as { transferProductId: string; label: string }[] : [];
      const firstTransfer = transferOpts[0];
      if (firstTransfer) {
        const tr = transfers.find((t) => t.id === firstTransfer.transferProductId);
        if (tr) {
          const trPrice = Number(tr.privatePrice ?? tr.sharedAdultPrice ?? tr.sharedPrice ?? 0);
          built.push({
            id: `transfer-${tr.id}-${act.id}`,
            type: "transfer",
            title: firstTransfer.label || String(tr.name),
            description: `${tr.pickupLocation || ""} → ${tr.dropLocation || ""}`.trim(),
            imageUrl: firstImage(tr),
            qty: 1,
            unitPrice: trPrice,
            currency: String(tr.currency || actCurrency),
            meta: `Bundled with ${act.name}`,
          });
        }
      }
    }

    if (built.length === 0) {
      toast({ title: "Nothing to build", description: "Select at least a hotel or one activity.", variant: "destructive" });
      return;
    }
    setLines(built);
    toast({ title: "Quote draft generated", description: "Review images, prices, and edit before saving or PDF." });
  }

  function updateLine(id: string, patch: Partial<EditableLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const gst = Math.round(subtotal * 0.18);
  const total = subtotal + gst;

  async function saveQuote(send: boolean) {
    if (!customerName || !destinationName || !travelFrom) {
      toast({ title: "Missing required fields", variant: "destructive" });
      return;
    }
    if (lines.length === 0) {
      toast({ title: "Add products to the quote", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      customerName,
      service: "Holiday" as const,
      items: lines.length,
      amount: subtotal,
      gst,
      total,
      validTill: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      createdBy: user?.name || "Team",
      destination: destinationName,
      travelDates: `${travelFrom}${travelTo ? ` → ${travelTo}` : ""}`,
      nights: parseInt(nights, 10) || 0,
      adults: parseInt(adults, 10) || 0,
      children: parseInt(children, 10) || 0,
      currency,
      packageIncludes: includes.split(",").map((s) => s.trim()).filter(Boolean),
      packageExcludes: excludes.split(",").map((s) => s.trim()).filter(Boolean),
      paymentTerms,
      cancellationPolicy,
      lineItems: lines.map((l) => ({
        description: `${l.title}${l.meta ? ` (${l.meta})` : ""}`,
        qty: l.qty,
        price: l.unitPrice,
        type: l.type,
        imageUrl: l.imageUrl,
        currency: l.currency,
      })),
      status: (send ? "Sent" : "Draft") as "Sent" | "Draft",
      approvalStatus: "Draft" as const,
    };
    try {
      await api.createQuotation(payload);
      addQuotation(payload);
      toast({ title: send ? "Quotation saved & marked sent" : "Quotation saved as draft" });
      setOpen(false);
    } catch {
      addQuotation(payload);
      toast({ title: "Saved locally", description: "API unavailable — stored in session." });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  function exportPdf() {
    if (!customerName || lines.length === 0) {
      toast({ title: "Build the quote first", variant: "destructive" });
      return;
    }
    const ok = downloadProductQuotationPdf({
      customerName,
      contactEmail,
      contactPhone,
      destination: destinationName,
      travelDates: `${travelFrom}${travelTo ? ` → ${travelTo}` : ""} (${nights}N)`,
      adults: parseInt(adults, 10),
      children: parseInt(children, 10),
      lines,
      includes: includes.split(",").map((s) => s.trim()).filter(Boolean),
      excludes: excludes.split(",").map((s) => s.trim()).filter(Boolean),
      paymentTerms,
      cancellationPolicy,
      currency,
      gst,
      createdBy: user?.name || "Team",
    });
    toast({
      title: ok ? "PDF ready" : "Popup blocked",
      description: ok ? "Print or Save as PDF from the dialog." : "Allow popups.",
      variant: ok ? "default" : "destructive",
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1"><Sparkles className="w-4 h-4" />Product Quote</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Product Quote Builder</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          System auto-builds the quote from approved hotel & activity products (with images). Product team can change selections, images, and prices before sending.
        </p>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <h4 className="text-sm font-semibold">1. Trip & Customer</h4>
                <div className="grid sm:grid-cols-2 gap-2">
                  <div className="space-y-1"><Label className="text-xs">Customer *</Label><Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Email</Label><Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Destination *</Label>
                    <Select value={destinationId} onValueChange={setDestinationId}>
                      <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                      <SelectContent>
                        {destinations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Travel from *</Label><Input type="date" value={travelFrom} onChange={(e) => setTravelFrom(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Travel to</Label><Input type="date" value={travelTo} onChange={(e) => setTravelTo(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Nights</Label><Input type="number" value={nights} onChange={(e) => setNights(e.target.value)} /></div>
                  <div className="space-y-1"><Label className="text-xs">Adults / Children</Label>
                    <div className="flex gap-2">
                      <Input type="number" value={adults} onChange={(e) => setAdults(e.target.value)} aria-label="Adults" />
                      <Input type="number" value={children} onChange={(e) => setChildren(e.target.value)} aria-label="Children" />
                    </div>
                  </div>
                  <div className="space-y-1"><Label className="text-xs">Quote currency</Label><CurrencySelect value={currency} onChange={setCurrency} /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <h4 className="text-sm font-semibold">2. Select Products (approved rates only)</h4>
                <div className="space-y-1">
                  <Label className="text-xs">Hotel</Label>
                  <Select value={selectedHotelId} onValueChange={(v) => { setSelectedHotelId(v); setSelectedRoom(""); }}>
                    <SelectTrigger><SelectValue placeholder="Optional hotel" /></SelectTrigger>
                    <SelectContent>
                      {hotels.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {selectedHotelId && (
                  <div className="space-y-1">
                    <Label className="text-xs">Room category</Label>
                    <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                      <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                      <SelectContent>
                        {hotelRooms.map((r) => (
                          <SelectItem key={r.name} value={r.name}>{r.name} — {formatProductPrice(r.price, hotels.find((h) => h.id === selectedHotelId)?.currency as string)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Activities</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto border rounded-md p-2">
                    {activities.map((a) => {
                      const on = selectedActivityIds.includes(a.id);
                      return (
                        <Badge
                          key={a.id}
                          variant={on ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setSelectedActivityIds((ids) => on ? ids.filter((x) => x !== a.id) : [...ids, a.id])}
                        >
                          {a.name}
                        </Badge>
                      );
                    })}
                    {activities.length === 0 && <span className="text-xs text-muted-foreground">No approved activities for this destination</span>}
                  </div>
                </div>
                <Button type="button" onClick={autoBuild} className="w-full gap-1">
                  <Sparkles className="w-4 h-4" /> Auto-build quote from selections
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">3. Review & customize (images, prices)</h4>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground border rounded-lg p-6 text-center">Select products and click Auto-build. You can then edit each line.</p>
            ) : (
              lines.map((line) => (
                <Card key={line.id}>
                  <CardContent className="pt-3 space-y-2">
                    <div className="flex items-start gap-3">
                      {line.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={line.imageUrl} alt="" className="w-20 h-14 object-cover rounded border" />
                      ) : (
                        <div className="w-20 h-14 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground">No image</div>
                      )}
                      <div className="flex-1 space-y-2">
                        <Input value={line.title} onChange={(e) => updateLine(line.id, { title: e.target.value })} className="h-8 text-sm font-medium" />
                        <Input value={line.imageUrl || ""} onChange={(e) => updateLine(line.id, { imageUrl: e.target.value })} placeholder="Image URL (change if needed)" className="h-8 text-xs" />
                        <Textarea rows={2} value={line.description || ""} onChange={(e) => updateLine(line.id, { description: e.target.value })} className="text-xs" />
                        <div className="grid grid-cols-3 gap-2">
                          <div><Label className="text-[10px]">Qty</Label><Input type="number" className="h-8" value={line.qty} onChange={(e) => updateLine(line.id, { qty: parseInt(e.target.value, 10) || 1 })} /></div>
                          <div><Label className="text-[10px]">Unit price</Label><Input type="number" className="h-8" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: parseInt(e.target.value, 10) || 0 })} /></div>
                          <div><Label className="text-[10px]">Currency</Label><CurrencySelect value={line.currency} onChange={(v) => updateLine(line.id, { currency: v })} /></div>
                        </div>
                        <p className="text-xs text-muted-foreground">Line total: {formatProductPrice(line.qty * line.unitPrice, line.currency)}</p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLine(line.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            {lines.length > 0 && (
              <div className="text-right text-sm space-y-1 border-t pt-3">
                <p>Subtotal: {formatProductPrice(subtotal, currency)}</p>
                <p>GST 18%: {formatProductPrice(gst, currency)}</p>
                <p className="font-bold text-base">Total: {formatProductPrice(total, currency)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs">Includes (comma-separated)</Label>
              <Input value={includes} onChange={(e) => setIncludes(e.target.value)} />
              <Label className="text-xs">Excludes</Label>
              <Input value={excludes} onChange={(e) => setExcludes(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={exportPdf} disabled={lines.length === 0}><FileDown className="w-4 h-4 mr-1" />PDF</Button>
          <Button type="button" variant="outline" disabled={saving || lines.length === 0} onClick={() => saveQuote(false)}>Save draft</Button>
          <Button type="button" disabled={saving || lines.length === 0} onClick={() => saveQuote(true)}>Save & send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

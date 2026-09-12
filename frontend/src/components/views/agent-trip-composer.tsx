"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "@/lib/api";
import { mapApiQuotation } from "@/lib/api-mappers";
import type { Quotation } from "@/types";
import { useDemoDataStore } from "@/store/demo-data-store";

type Line = { type: string; description: string; qty: string; sellingPrice: string };

const EMPTY_LINE: Line = { type: "Flight", description: "", qty: "1", sellingPrice: "" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (quote: Quotation) => void;
};

export function AgentTripComposerDialog({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const [busy, setBusy] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [destination, setDestination] = useState("");
  const [travelStart, setTravelStart] = useState("");
  const [travelEnd, setTravelEnd] = useState("");
  const [agentMarkup, setAgentMarkup] = useState("0");
  const [lines, setLines] = useState<Line[]>([{ ...EMPTY_LINE }]);

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setContactEmail("");
    setContactPhone("");
    setDestination("");
    setTravelStart("");
    setTravelEnd("");
    setAgentMarkup("0");
    setLines([{ ...EMPTY_LINE }]);
  }, [open]);

  async function submit() {
    if (!customerName.trim()) {
      toast({ title: "Customer name required", variant: "destructive" });
      return;
    }
    const payloadLines = lines
      .filter((l) => l.description.trim() && Number(l.sellingPrice) > 0)
      .map((l) => ({
        type: l.type,
        description: l.description.trim(),
        qty: Number(l.qty) || 1,
        sellingPrice: Number(l.sellingPrice) || 0,
      }));
    if (!payloadLines.length) {
      toast({ title: "Add at least one priced line", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await api.createAgentTripQuote({
        customerName: customerName.trim(),
        contactEmail,
        contactPhone,
        destination: destination || "Custom trip",
        travelStartDate: travelStart || undefined,
        travelEndDate: travelEnd || undefined,
        agentMarkup: Number(agentMarkup) || 0,
        lines: payloadLines,
      });
      const quote = mapApiQuotation(res.quotation);
      upsertQuotation(quote);
      onCreated?.(quote);
      toast({ title: "Trip quote created", description: quote.quoteNo });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Could not create trip quote",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compose custom trip</DialogTitle>
          <DialogDescription>
            Build a quote from flight, hotel, transfer, and activity lines with your markup.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Customer</Label>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Guest name" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
          <div>
            <Label>Destination</Label>
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Goa / Dubai…" />
          </div>
          <div>
            <Label>Agent markup (₹)</Label>
            <Input value={agentMarkup} onChange={(e) => setAgentMarkup(e.target.value)} />
          </div>
          <div>
            <Label>Travel start</Label>
            <Input type="date" value={travelStart} onChange={(e) => setTravelStart(e.target.value)} />
          </div>
          <div>
            <Label>Travel end</Label>
            <Input type="date" value={travelEnd} onChange={(e) => setTravelEnd(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Services</p>
            <Button size="sm" variant="outline" onClick={() => setLines((prev) => [...prev, { ...EMPTY_LINE }])}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Add line
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-12 items-end border rounded-lg p-2">
              <div className="sm:col-span-2">
                <Label className="text-[10px]">Type</Label>
                <Select
                  value={line.type}
                  onValueChange={(v) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, type: v } : l)))}
                >
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Flight", "Hotel", "Transfer", "Activity"].map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-5">
                <Label className="text-[10px]">Description</Label>
                <Input
                  className="h-8"
                  value={line.description}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)))}
                  placeholder="e.g. DEL-GOI economy"
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px]">Qty</Label>
                <Input
                  className="h-8"
                  value={line.qty}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)))}
                />
              </div>
              <div className="sm:col-span-2">
                <Label className="text-[10px]">Price ₹</Label>
                <Input
                  className="h-8"
                  value={line.sellingPrice}
                  onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, sellingPrice: e.target.value } : l)))}
                />
              </div>
              <div className="sm:col-span-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  disabled={lines.length <= 1}
                  onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Create trip quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

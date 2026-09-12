"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FileDown, Loader2, Mail, MessageCircle, Package, Search, Send, LifeBuoy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { api, apiFetch, ApiError } from "@/lib/api";
import { mapApiQuotation } from "@/lib/api-mappers";
import { formatFullINR } from "@/components/shared/ui-helpers";
import type { Quotation, TravelPackageRecord } from "@/types";
import {
  downloadQuotationPdf,
  deliverQuotationEmail,
  deliverQuotationWhatsApp,
} from "@/lib/quotation-actions";
import type { ClientBrochureOptions } from "@/lib/client-quotation-brochure";
import { useDemoDataStore } from "@/store/demo-data-store";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const HELP_TYPES = [
  "Missing product",
  "Price match",
  "Transfer not in system",
  "Custom itinerary",
  "Hotel not available",
  "Other",
];

type AgentQuotationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (quote: Quotation) => void;
};

export function AgentQuotationDialog({ open, onOpenChange, onCreated }: AgentQuotationDialogProps) {
  const { toast } = useToast();
  const upsertQuotation = useDemoDataStore((s) => s.upsertQuotation);
  const [step, setStep] = useState<"pick" | "details" | "send">("pick");
  const [loading, setLoading] = useState(false);
  const [packages, setPackages] = useState<TravelPackageRecord[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<TravelPackageRecord | null>(null);
  const [quote, setQuote] = useState<Quotation | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [agentMarkup, setAgentMarkup] = useState("0");
  const [travelStart, setTravelStart] = useState("");
  const [travelEnd, setTravelEnd] = useState("");
  const [optionalNote, setOptionalNote] = useState("");
  const [showPrices, setShowPrices] = useState(true);
  const [showLogo, setShowLogo] = useState(true);
  const [helpType, setHelpType] = useState(HELP_TYPES[0]);
  const [helpDesc, setHelpDesc] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("pick");
    setSelected(null);
    setQuote(null);
    setCustomerName("");
    setContactEmail("");
    setContactPhone("");
    setAgentMarkup("0");
    setTravelStart("");
    setTravelEnd("");
    setOptionalNote("");
    setShowPrices(true);
    setShowLogo(true);
    setHelpType(HELP_TYPES[0]);
    setHelpDesc("");
    apiFetch<{ items: TravelPackageRecord[] }>("/api/packages?status=Published&pageSize=50&sort=updatedAt&order=desc")
      .then((res) => setPackages(res.items || []))
      .catch(() => {
        setPackages([]);
        toast({
          title: "Could not load packages",
          description: "Ask your agency admin to publish holiday packages first.",
          variant: "destructive",
        });
      });
  }, [open, toast]);

  const filtered = useMemo(() => {
    if (!search.trim()) return packages;
    const q = search.toLowerCase();
    return packages.filter(
      (p) =>
        p.packageName.toLowerCase().includes(q) ||
        (p.destination?.name || "").toLowerCase().includes(q) ||
        p.packageCode.toLowerCase().includes(q),
    );
  }, [packages, search]);

  const basePrice = selected?.finalPrice ?? 0;
  const markupNum = Math.max(0, Number(agentMarkup) || 0);
  const previewTotal = basePrice + markupNum;

  const brochureOptions: ClientBrochureOptions = {
    showPrices,
    showLogo,
    agentBranding: showLogo,
  };

  async function createQuote() {
    if (!selected) return;
    if (!customerName.trim()) {
      toast({ title: "Customer name required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api.createAgentQuotationFromPackage({
        packageId: selected.id,
        customerName: customerName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        agentMarkup: markupNum,
        travelStartDate: travelStart || undefined,
        travelEndDate: travelEnd || undefined,
        specialRequests: optionalNote.trim() || undefined,
      });
      const mapped = mapApiQuotation(res.quotation);
      upsertQuotation(mapped);
      setQuote(mapped);
      setStep("send");
      onCreated?.(mapped);
      toast({ title: "Quotation created", description: mapped.quoteNo });
    } catch (e) {
      toast({
        title: "Could not create quotation",
        description: e instanceof ApiError ? e.message : "Try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function refreshMarkup() {
    if (!quote) return;
    setLoading(true);
    try {
      const res = await api.updateAgentQuotation(quote.id, {
        customerName: customerName.trim(),
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        agentMarkup: markupNum,
        specialRequests: optionalNote.trim() || undefined,
      });
      const mapped = mapApiQuotation(res.quotation);
      upsertQuotation(mapped);
      setQuote(mapped);
    } catch (e) {
      toast({
        title: "Update failed",
        description: e instanceof ApiError ? e.message : "Error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendPdf() {
    if (!quote) return;
    setLoading(true);
    try {
      if (markupNum !== (quote.agentMarkup || 0)) await refreshMarkup();
      const full = await api.getQuotationFull(quote.id).then((r) => mapApiQuotation(r.quotation));
      const ok = await downloadQuotationPdf(full, brochureOptions);
      if (ok) {
        await api.shareQuotation(quote.id, { channel: "Link", message: optionalNote || undefined });
      }
      toast({
        title: ok ? "PDF ready" : "PDF failed",
        description: ok ? "Customer PDF downloaded. Share it with your customer." : "Could not generate the PDF.",
        variant: ok ? "default" : "destructive",
      });
    } catch (e) {
      toast({
        title: "PDF blocked",
        description: e instanceof Error ? e.message : "Could not generate the PDF",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendEmail() {
    if (!quote) return;
    setLoading(true);
    try {
      const res = await deliverQuotationEmail(
        { ...quote, contactEmail, customerName },
        { recipient: contactEmail, message: optionalNote || undefined },
      );
      toast({
        title: res.ok ? "Email sent" : "Email failed",
        description: res.ok ? "Customer PDF emailed by the server." : res.error,
        variant: res.ok ? "default" : "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendWhatsApp() {
    if (!quote) return;
    setLoading(true);
    try {
      const res = await deliverQuotationWhatsApp(
        { ...quote, contactPhone, customerName },
        { recipient: contactPhone, message: optionalNote || undefined },
      );
      toast({
        title: res.ok ? "WhatsApp sent" : "WhatsApp failed",
        description: res.ok ? "Customer PDF delivered by WhatsApp." : res.error,
        variant: res.ok ? "default" : "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "pick" && "Create quotation from package"}
            {step === "details" && "Customer & markup"}
            {step === "send" && "Send to customer"}
          </DialogTitle>
          <DialogDescription>
            {step === "pick" && "Pick a published package, add your markup, and send a branded PDF instantly."}
            {step === "details" && selected ? `${selected.packageName} · ${formatFullINR(basePrice)} platform price` : ""}
            {step === "send" && quote ? `${quote.quoteNo} · ${formatFullINR(quote.total)} total` : ""}
          </DialogDescription>
        </DialogHeader>

        {step === "pick" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search destination or package…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="grid gap-2 max-h-[50vh] overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No published packages found.</p>
              ) : (
                filtered.map((pkg) => (
                  <Card
                    key={pkg.id}
                    className={`cursor-pointer transition-colors hover:border-teal-500/50 ${selected?.id === pkg.id ? "border-teal-600 ring-1 ring-teal-600/30" : ""}`}
                    onClick={() => setSelected(pkg)}
                  >
                    <CardContent className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{pkg.packageName}</p>
                        <p className="text-xs text-muted-foreground">
                          {pkg.destination?.name}
                          {pkg.destination?.country ? ` · ${pkg.destination.country}` : ""}
                          {" · "}
                          {pkg.durationNights}N / {pkg.durationDays}D
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-sm">{formatFullINR(pkg.finalPrice)}</p>
                        <Badge variant="secondary" className="text-[10px]">{pkg.packageCode}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}

        {step === "details" && selected && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 rounded-lg border p-3 bg-muted/30 flex items-center gap-3">
              <Package className="h-8 w-8 text-teal-600 shrink-0" />
              <div>
                <p className="font-medium text-sm">{selected.packageName}</p>
                <p className="text-xs text-muted-foreground">
                  Platform price {formatFullINR(basePrice)} + your markup = {formatFullINR(previewTotal)}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Guest name *</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" />
            </div>
            <div className="space-y-1.5">
              <Label>Your markup (₹)</Label>
              <Input
                type="number"
                min={0}
                value={agentMarkup}
                onChange={(e) => setAgentMarkup(e.target.value)}
                placeholder="e.g. 3000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Guest email</Label>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Guest phone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Travel from</Label>
              <Input type="date" value={travelStart} onChange={(e) => setTravelStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Travel to</Label>
              <Input type="date" value={travelEnd} onChange={(e) => setTravelEnd(e.target.value)} />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Optional note for customer</Label>
              <Textarea rows={2} value={optionalNote} onChange={(e) => setOptionalNote(e.target.value)} />
            </div>
          </div>
        )}

        {step === "send" && quote && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">PDF options</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={showPrices} onCheckedChange={(v) => setShowPrices(v === true)} />
                Include price on PDF
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={showLogo} onCheckedChange={(v) => setShowLogo(v === true)} />
                Include your agency logo (agent branding)
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={sendPdf} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileDown className="h-4 w-4 mr-1" />}
                Download PDF
              </Button>
              <Button variant="outline" onClick={sendEmail} disabled={loading}>
                <Mail className="h-4 w-4 mr-1" /> Email
              </Button>
              <Button variant="outline" onClick={sendWhatsApp} disabled={loading}>
                <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
              </Button>
            </div>
            <div className="rounded-lg border p-3 space-y-2 border-sky-200 bg-sky-50/50">
              <p className="text-xs font-semibold flex items-center gap-1"><LifeBuoy className="h-3.5 w-3.5" /> Request help from Trevio team</p>
              <p className="text-[10px] text-muted-foreground">Missing a transfer, need a price match, or custom costing? Ops will get a task.</p>
              <Select value={helpType} onValueChange={setHelpType}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HELP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              <Textarea rows={2} className="text-xs" value={helpDesc} onChange={(e) => setHelpDesc(e.target.value)} placeholder="e.g. Need transfer Jurong → JB on day 3" />
              <Button
                size="sm"
                variant="outline"
                disabled={loading || !helpDesc.trim()}
                onClick={async () => {
                  if (!quote) return;
                  setLoading(true);
                  try {
                    await api.requestQuotationHelp(quote.id, { helpType, description: helpDesc.trim() });
                    toast({ title: "Help request sent", description: "Operations will follow up on this quotation." });
                    setHelpDesc("");
                  } catch (e) {
                    toast({ title: "Request failed", description: e instanceof ApiError ? e.message : "Error", variant: "destructive" });
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Submit help request
              </Button>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          {step === "pick" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                className="bg-teal-600 hover:bg-teal-700"
                disabled={!selected}
                onClick={() => setStep("details")}
              >
                Next
              </Button>
            </>
          )}
          {step === "details" && (
            <>
              <Button variant="outline" onClick={() => setStep("pick")}>Back</Button>
              <Button className="bg-teal-600 hover:bg-teal-700" disabled={loading} onClick={createQuote}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Create & send
              </Button>
            </>
          )}
          {step === "send" && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

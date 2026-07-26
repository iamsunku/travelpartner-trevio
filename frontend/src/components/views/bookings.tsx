"use client";

import { useMemo, useState } from "react";
import {
  Plane, Building2, Palmtree,
  Search, Eye, Download, XCircle, RefreshCw, FileDown, Ticket,
  Calendar, Users, MapPin, User, CreditCard, IndianRupee,
} from "lucide-react";
import { useDemoDataStore } from "@/store/demo-data-store";
import type { Booking } from "@/types";
import {
  formatINR, formatFullINR, StatusBadge, PageHeader, PageShell,
} from "@/components/shared/ui-helpers";
import {
  Card, CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const SERVICE_ICON: Record<string, React.ElementType> = {
  Flight: Plane, Hotel: Building2, Holiday: Palmtree,
};

const SERVICE_COLORS: Record<string, string> = {
  Flight: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
  Hotel: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  Holiday: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

const STATUS_TABS = [
  { key: "All", label: "All" },
  { key: "Pending", label: "Pending" },
  { key: "Confirmed", label: "Confirmed" },
  { key: "Ticketed", label: "Ticketed" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" },
  { key: "Refunded", label: "Refunded" },
  { key: "Failed", label: "Failed" },
  { key: "Archived", label: "Archived" },
];

const TIMELINE_STEPS = ["Pending", "Confirmed", "Ticketed", "Completed"];

function BookingDetailDialog({
  booking,
  open,
  onOpenChange,
  onUpdateStatus,
}: {
  booking: Booking | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdateStatus: (id: string, status: Booking["status"]) => void;
}) {
  const { toast } = useToast();
  if (!booking) return null;
  const Icon = SERVICE_ICON[booking.service] || Plane;
  const currentStepIdx = TIMELINE_STEPS.indexOf(booking.status);
  const passengerCount = Math.max(1, Math.ceil(booking.amount / 14000));
  const passengers = Array.from({ length: Math.min(passengerCount, 3) }).map((_, i) => ({
    name: `${booking.customerName.split(" ")[0]} ${i + 1}`,
    type: i === 0 ? "Adult" : i === 1 ? "Adult" : "Child",
    seat: ["12A", "12B", "12C"][i],
  }));
  const baseFare = Math.round(booking.amount * 0.78);
  const taxes = Math.round(booking.amount * 0.16);
  const convenience = booking.amount - baseFare - taxes;
  const commission = booking.commission;

  function action(label: string, desc: string, variant?: "default" | "destructive", status?: Booking["status"]) {
    if (status && booking) onUpdateStatus(booking.id, status);
    toast({ title: label, description: desc, variant });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto scroll-thin">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2">
                {booking.bookingRef}
                <StatusBadge status={booking.status} />
              </DialogTitle>
              <DialogDescription>{booking.customerName} · Created {new Date(booking.createdAt).toLocaleDateString("en-IN")}</DialogDescription>
            </div>
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", SERVICE_COLORS[booking.service])}>
              <Icon className="w-6 h-6" />
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Itinerary */}
          <div className="rounded-lg border p-3 bg-gradient-to-br from-primary/5 to-brand-teal/5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Itinerary</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">{booking.route.split("→")[0].trim()}</p>
                <p className="text-[10px] text-muted-foreground">Departure</p>
              </div>
              <div className="flex-1 mx-3 relative">
                <div className="border-t border-dashed border-muted-foreground/30" />
                <Plane className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-background rounded-full p-0.5 text-teal-600" />
              </div>
              <div className="text-right">
                <p className="text-lg font-bold">{booking.route.split("→").pop()?.trim()}</p>
                <p className="text-[10px] text-muted-foreground">Arrival</p>
              </div>
            </div>
            <Separator className="my-2" />
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-muted-foreground" /> {new Date(booking.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
              <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {booking.agency}</div>
              <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-muted-foreground" /> {booking.agent}</div>
            </div>
          </div>

          {/* Status Timeline */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status Timeline</p>
            <div className="flex items-center justify-between">
              {TIMELINE_STEPS.map((step, i) => {
                const done = currentStepIdx >= i;
                const cancelled = booking.status === "Cancelled" || booking.status === "Failed";
                return (
                  <div key={step} className="flex-1 flex flex-col items-center relative">
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={cn("absolute top-3.5 left-1/2 w-full h-0.5", done && !cancelled ? "bg-emerald-400" : "bg-border")} />
                    )}
                    <div className={cn(
                      "relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold",
                      cancelled && i > 0 ? "bg-rose-100 text-rose-600" :
                      done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {done ? "✓" : i + 1}
                    </div>
                    <p className={cn("text-[10px] mt-1 text-center", done ? "font-medium" : "text-muted-foreground")}>{step}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Passengers */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/40 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Passenger / Guest Info</div>
            <div className="p-3 space-y-1.5">
              {passengers.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-500/15 text-teal-600 flex items-center justify-center text-[10px] font-semibold">
                      {p.name[0]}
                    </div>
                    <span className="font-medium">{p.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{p.type}</Badge>
                  </div>
                  <span className="text-muted-foreground">Seat {p.seat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Fare breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fare Breakdown</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Base Fare</span><span>{formatFullINR(baseFare)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Taxes & Fees</span><span>{formatFullINR(taxes)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Convenience</span><span>{formatFullINR(convenience)}</span></div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-sm"><span>Total</span><span className="text-teal-600">{formatFullINR(booking.amount)}</span></div>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Payment Info</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span>{booking.paymentMethod || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><StatusBadge status={booking.paymentStatus} /></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Commission</span><span className="text-emerald-600 font-medium">{formatFullINR(commission)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Service</span><span>{booking.service}</span></div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => action("Ticket generated", `${booking.bookingRef} ticket issued successfully`)}>
              <Ticket className="w-3.5 h-3.5 mr-1" /> Generate Ticket
            </Button>
            <Button variant="outline" size="sm" onClick={() => action("Ticket downloaded", `${booking.bookingRef}.pdf saved`)}>
              <Download className="w-3.5 h-3.5 mr-1" /> Download Ticket
            </Button>
            <Button variant="outline" size="sm" onClick={() => action("Reschedule requested", `New date request initiated for ${booking.bookingRef}`)}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reschedule
            </Button>
            <Button variant="outline" size="sm" className="text-amber-600" onClick={() => action("Refund initiated", `Refund request created for ${booking.bookingRef}`, undefined, "Refunded")}>
              <IndianRupee className="w-3.5 h-3.5 mr-1" /> Refund
            </Button>
            <Button variant="outline" size="sm" className="text-rose-600 ml-auto" onClick={() => action("Booking cancelled", `${booking.bookingRef} cancelled`, "destructive", "Cancelled")}>
              <XCircle className="w-3.5 h-3.5 mr-1" /> Cancel Booking
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BookingsView() {
  const { toast } = useToast();
  const bookings = useDemoDataStore((s) => s.bookings);
  const updateBookingStatus = useDemoDataStore((s) => s.updateBookingStatus);
  const [activeTab, setActiveTab] = useState("All");
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: bookings.length, Archived: 0 };
    bookings.forEach((b) => { c[b.status] = (c[b.status] || 0) + 1; });
    return c;
  }, [bookings]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (activeTab !== "All" && activeTab !== "Archived" && b.status !== activeTab) return false;
      if (serviceFilter !== "all" && b.service !== serviceFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!b.bookingRef.toLowerCase().includes(q) && !b.customerName.toLowerCase().includes(q) && !b.route.toLowerCase().includes(q)) return false;
      }
      if (dateFrom && new Date(b.travelDate) < new Date(dateFrom)) return false;
      if (dateTo && new Date(b.travelDate) > new Date(dateTo)) return false;
      return true;
    });
  }, [activeTab, serviceFilter, search, dateFrom, dateTo, bookings]);

  function openDetail(b: Booking) {
    setSelected(b);
    setDetailOpen(true);
  }

  return (
    <PageShell>
      <PageHeader
        title="Bookings"
        subtitle="Manage all your flight, hotel, holiday and other service bookings in one place."
      />

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
              activeTab === tab.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
            )}
          >
            {tab.label}
            <span className={cn("ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full", activeTab === tab.key ? "bg-white/20" : "bg-muted")}>
              {counts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-2 mb-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search booking ref, customer, route..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-full lg:w-[140px] h-9"><SelectValue placeholder="Service" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {["Flight", "Hotel", "Holiday"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 items-center">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-full lg:w-auto" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-full lg:w-auto" />
            </div>
          </div>

          <div className="rounded-lg border border-border max-h-[60vh] overflow-y-auto scroll-thin">
            <Table>
              <TableHeader className="sticky top-0 bg-card z-10">
                <TableRow>
                  <TableHead>Booking Ref</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Travel Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((b) => {
                  const Icon = SERVICE_ICON[b.service] || Plane;
                  return (
                    <TableRow key={b.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openDetail(b)}>
                      <TableCell className="font-medium text-xs">{b.bookingRef}</TableCell>
                      <TableCell className="text-xs">{b.customerName}</TableCell>
                      <TableCell>
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", SERVICE_COLORS[b.service])}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-medium">{b.route}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(b.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</TableCell>
                      <TableCell className="text-right text-xs font-semibold">{formatFullINR(b.amount)}</TableCell>
                      <TableCell className="text-right text-xs text-emerald-600 font-medium">{formatINR(b.commission)}</TableCell>
                      <TableCell><StatusBadge status={b.status} /></TableCell>
                      <TableCell><StatusBadge status={b.paymentStatus} /></TableCell>
                      <TableCell className="text-xs">{b.agent.split(" ")[0]}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-0.5 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View Ticket" onClick={(e) => { e.stopPropagation(); openDetail(b); }}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-cyan-600" title="Download" onClick={(e) => { e.stopPropagation(); toast({ title: "Downloaded", description: `${b.bookingRef}.pdf saved` }); }}>
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600" title="Cancel" onClick={(e) => { e.stopPropagation(); toast({ title: "Cancel requested", description: `${b.bookingRef} cancellation initiated`, variant: "destructive" }); }}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-sm text-muted-foreground py-8">No bookings match your filters.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Showing {filtered.length} of {bookings.length} bookings · Click a row to view ticket</p>
        </CardContent>
      </Card>

      <BookingDetailDialog booking={selected} open={detailOpen} onOpenChange={setDetailOpen} onUpdateStatus={updateBookingStatus} />
    </PageShell>
  );
}

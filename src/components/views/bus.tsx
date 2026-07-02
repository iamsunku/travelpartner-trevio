"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bus as BusIcon, MapPin, Search, Star, Clock, Users,
  Armchair, CheckCircle2, CreditCard, Wallet, Building2, Loader2, ShieldCheck,
  Snowflake, Wifi, Plug, Navigation, ArrowRight, Sparkles, BadgeIndianRupee,
  Briefcase,
} from "lucide-react";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { BUSES } from "@/lib/mock-data";
import type { Bus } from "@/types";
import { formatFullINR, PageHeader } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const CITIES = ["Mumbai", "Pune", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Goa", "Surat", "Indore", "Nagpur", "Nashik"];

const BUS_TYPE_FILTERS = ["AC Sleeper", "AC Seater", "Volvo Multi-Axle", "Mercedes"];

const TIME_SLOTS = [
  { id: "early", label: "Before 6 AM", range: [0, 6] },
  { id: "morning", label: "6 AM - 12 PM", range: [6, 12] },
  { id: "afternoon", label: "12 PM - 6 PM", range: [12, 18] },
  { id: "night", label: "After 6 PM", range: [18, 24] },
];

function amenityIcon(a: string) {
  if (a.includes("Charging")) return <Plug className="w-3 h-3" />;
  if (a.includes("Wifi")) return <Wifi className="w-3 h-3" />;
  if (a.includes("AC")) return <Snowflake className="w-3 h-3" />;
  if (a.includes("Tracking")) return <Navigation className="w-3 h-3" />;
  return <CheckCircle2 className="w-3 h-3" />;
}

// deterministic seat generator
function generateSeats(busId: string, isSleeper: boolean) {
  const seats: { id: string; label: string; deck: "lower" | "upper"; row: number; col: number; status: "available" | "booked" | "ladies"; }[] = [];
  let hash = 0;
  for (let i = 0; i < busId.length; i++) hash = busId.charCodeAt(i) + ((hash << 5) - hash);
  const rand = (n: number) => {
    hash = (hash * 9301 + 49297) % 233280;
    return Math.floor((hash / 233280) * n);
  };

  if (isSleeper) {
    const decks: ("lower" | "upper")[] = ["lower", "upper"];
    decks.forEach((deck) => {
      for (let row = 1; row <= 6; row++) {
        // 2 berths left, 1 berth right (2x1)
        for (let col = 1; col <= 3; col++) {
          const id = `${deck[0].toUpperCase()}${row}${col}`;
          const r = rand(10);
          const status = r < 3 ? "booked" : r < 4 ? "ladies" : "available";
          seats.push({ id, label: `${deck[0].toUpperCase()}-${row}${col}`, deck, row, col, status });
        }
      }
    });
  } else {
    for (let row = 1; row <= 8; row++) {
      for (let col = 1; col <= 4; col++) {
        const id = `S${row}${col}`;
        const r = rand(10);
        const status = r < 3 ? "booked" : r < 4 ? "ladies" : "available";
        seats.push({ id, label: `${row}${String.fromCharCode(64 + col)}`, deck: "lower", row, col, status });
      }
    }
  }
  return seats;
}

// Razorpay-style payment modal
function PaymentModal({
  amount, open, onClose, onSuccess, title,
}: {
  amount: number; open: boolean; onClose: () => void; onSuccess: () => void; title: string;
}) {
  const [method, setMethod] = useState("card");
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const handlePay = () => {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      onClose();
      toast({
        title: "Payment Successful",
        description: `${formatFullINR(amount)} paid via ${method === "card" ? "Card" : method === "upi" ? "UPI" : "Net Banking"}. Booking confirmed!`,
      });
      onSuccess();
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base">Razorpay Secure Payment</DialogTitle>
              <DialogDescription>{title}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border border-teal-200 dark:border-teal-900 p-4 text-center">
          <p className="text-xs text-muted-foreground">Amount Payable</p>
          <p className="text-3xl font-bold text-teal-700 dark:text-teal-300 mt-1">{formatFullINR(amount)}</p>
          <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 256-bit encrypted • PCI-DSS compliant
          </p>
        </div>

        <Tabs value={method} onValueChange={setMethod}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="card"><CreditCard className="w-3.5 h-3.5 mr-1" /> Card</TabsTrigger>
            <TabsTrigger value="upi"><Wallet className="w-3.5 h-3.5 mr-1" /> UPI</TabsTrigger>
            <TabsTrigger value="netbanking"><Building2 className="w-3.5 h-3.5 mr-1" /> Net</TabsTrigger>
          </TabsList>
          <TabsContent value="card" className="space-y-3 mt-3">
            <Input placeholder="Card Number • 4111 1111 1111 1111" />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="MM / YY" />
              <Input placeholder="CVV" />
            </div>
            <Input placeholder="Cardholder Name" />
          </TabsContent>
          <TabsContent value="upi" className="space-y-3 mt-3">
            <Input placeholder="yourname@upi" />
            <p className="text-xs text-muted-foreground">A collect request will be sent to your UPI app.</p>
          </TabsContent>
          <TabsContent value="netbanking" className="space-y-2 mt-3">
            {["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank"].map((b) => (
              <label key={b} className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 text-sm">
                <input type="radio" name="nb" defaultChecked={b === "HDFC Bank"} className="accent-teal-600" />
                {b}
              </label>
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button onClick={handlePay} disabled={processing} className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
            {processing ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : <><BadgeIndianRupee className="w-4 h-4" /> Pay {formatFullINR(amount)}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BusView() {
  const { toast } = useToast();
  const [fromCity, setFromCity] = useState("Mumbai");
  const [toCity, setToCity] = useState("Pune");
  const [date, setDate] = useState("2025-02-15");
  const [searched, setSearched] = useState(false);

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<number[]>([400, 1000]);
  const [minRating, setMinRating] = useState(0);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);

  const [seatDialogBus, setSeatDialogBus] = useState<Bus | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [boardingPoint, setBoardingPoint] = useState("");
  const [droppingPoint, setDroppingPoint] = useState("");
  const [expandedBoarding, setExpandedBoarding] = useState<string | null>(null);

  const [payOpen, setPayOpen] = useState(false);
  const [expandedBus, setExpandedBus] = useState<string | null>(null);

  const handleSearch = () => {
    if (fromCity === toCity) {
      toast({ title: "Invalid route", description: "From and To cannot be the same city.", variant: "destructive" });
      return;
    }
    setSearched(true);
  };

  const filteredBuses = useMemo(() => {
    let list = BUSES.filter((b) => b.origin === fromCity && b.destination === toCity);
    if (selectedTypes.length) list = list.filter((b) => selectedTypes.includes(b.busType));
    list = list.filter((b) => b.price >= priceRange[0] && b.price <= priceRange[1]);
    if (minRating > 0) list = list.filter((b) => b.rating >= minRating);
    if (timeSlots.length) {
      list = list.filter((b) => {
        const hour = parseInt(b.departTime.split(":")[0], 10);
        return timeSlots.some((slot) => {
          const slotDef = TIME_SLOTS.find((s) => s.id === slot);
          return slotDef && hour >= slotDef.range[0] && hour < slotDef.range[1];
        });
      });
    }
    return list;
  }, [fromCity, toCity, selectedTypes, priceRange, minRating, timeSlots]);

  const isSleeper = (busType: string) => busType.toLowerCase().includes("sleeper");
  const seats = useMemo(() => (seatDialogBus ? generateSeats(seatDialogBus.id, isSleeper(seatDialogBus.busType)) : []), [seatDialogBus]);

  const totalAmount = seatDialogBus ? selectedSeats.length * seatDialogBus.price : 0;

  const toggleSeat = (id: string, status: string) => {
    if (status === "booked") return;
    setSelectedSeats((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  const openSeatDialog = (bus: Bus) => {
    setSeatDialogBus(bus);
    setSelectedSeats([]);
    setBoardingPoint(bus.boardingPoints[0]);
    setDroppingPoint(bus.droppingPoints[0]);
  };

  const handleContinuePayment = () => {
    if (!selectedSeats.length) {
      toast({ title: "No seats selected", description: "Please pick at least one seat to continue.", variant: "destructive" });
      return;
    }
    if (!boardingPoint || !droppingPoint) {
      toast({ title: "Pickup points missing", description: "Please select boarding and dropping points.", variant: "destructive" });
      return;
    }
    setSeatDialogBus(null);
    setPayOpen(true);
  };

  const resetSelections = () => {
    setSelectedSeats([]);
    setBoardingPoint("");
    setDroppingPoint("");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Bus Booking" subtitle="Search, compare and book AC sleeper, Volvo & Mercedes buses across India." />

      {/* Search Panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-700 text-white p-5 lg:p-6 shadow-lg"
      >
        <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-12 w-56 h-56 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <Label className="text-teal-100 text-xs">From City</Label>
            <Select value={fromCity} onValueChange={setFromCity}>
              <SelectTrigger className="w-full bg-white/95 text-slate-800 border-0 mt-1 h-11">
                <MapPin className="w-4 h-4 mr-1 text-teal-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden md:flex md:col-span-1 items-center justify-center pb-2">
            <button
              onClick={() => { setFromCity(toCity); setToCity(fromCity); }}
              className="w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              title="Swap"
            >
              <ArrowRight className="w-4 h-4 rotate-0 md:-rotate-90" />
            </button>
          </div>
          <div className="md:col-span-3">
            <Label className="text-teal-100 text-xs">To City</Label>
            <Select value={toCity} onValueChange={setToCity}>
              <SelectTrigger className="w-full bg-white/95 text-slate-800 border-0 mt-1 h-11">
                <MapPin className="w-4 h-4 mr-1 text-rose-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label className="text-teal-100 text-xs">Date of Journey</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/95 text-slate-800 border-0 mt-1 h-11" />
          </div>
          <div className="md:col-span-2">
            <Button onClick={handleSearch} size="lg" className="w-full h-11 bg-amber-400 hover:bg-amber-300 text-amber-950 font-semibold">
              <Search className="w-4 h-4" /> Search Buses
            </Button>
          </div>
        </div>
        <div className="relative z-10 mt-4 flex flex-wrap gap-2 text-xs">
          {["Trending", "AC Sleeper", "Volvo", "Cashback Offers", "Live Tracking"].map((t, i) => (
            <span key={t} className={cn("px-2.5 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm flex items-center gap-1", i === 0 && "bg-amber-400/20 border-amber-300/30")}>
              {i === 0 && <Sparkles className="w-3 h-3 text-amber-200" />} {t}
            </span>
          ))}
        </div>
      </motion.div>

      {!searched ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Filter Sidebar */}
          <motion.aside
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3"
          >
            <Card className="sticky top-4">
              <CardContent className="p-4 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-teal-600" /> Filters
                  </h3>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => { setSelectedTypes([]); setPriceRange([400, 1000]); setMinRating(0); setTimeSlots([]); }}
                    className="text-xs h-7 text-teal-600 hover:text-teal-700"
                  >
                    Reset
                  </Button>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bus Type</p>
                  <div className="space-y-2">
                    {BUS_TYPE_FILTERS.map((t) => (
                      <label key={t} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground text-muted-foreground">
                        <Checkbox
                          checked={selectedTypes.includes(t)}
                          onCheckedChange={(c) => setSelectedTypes((p) => c ? [...p, t] : p.filter((x) => x !== t))}
                        />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Max Price</p>
                    <span className="text-xs font-medium text-teal-700 dark:text-teal-300">{formatFullINR(priceRange[1])}</span>
                  </div>
                  <Slider value={priceRange} min={300} max={1200} step={50} onValueChange={setPriceRange} />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>₹300</span><span>₹1,200</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Min Rating</p>
                  <div className="flex gap-2">
                    {[0, 3, 3.5, 4, 4.5].map((r) => (
                      <button
                        key={r}
                        onClick={() => setMinRating(r)}
                        className={cn(
                          "flex-1 text-xs py-1.5 rounded-md border transition",
                          minRating === r
                            ? "bg-teal-600 text-white border-teal-600"
                            : "bg-background hover:border-teal-400 hover:text-teal-700"
                        )}
                      >
                        {r === 0 ? "Any" : `${r}+`}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Departure Time</p>
                  <div className="space-y-2">
                    {TIME_SLOTS.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer text-sm hover:text-foreground text-muted-foreground">
                        <Checkbox
                          checked={timeSlots.includes(s.id)}
                          onCheckedChange={(c) => setTimeSlots((p) => c ? [...p, s.id] : p.filter((x) => x !== s.id))}
                        />
                        <Clock className="w-3 h-3 mr-1" /> {s.label}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.aside>

          {/* Results */}
          <div className="lg:col-span-9 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{filteredBuses.length}</span> buses found from <span className="font-medium">{fromCity}</span> to <span className="font-medium">{toCity}</span>
              </p>
              <Select defaultValue="departure">
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="departure">Sort: Departure Time</SelectItem>
                  <SelectItem value="duration">Sort: Duration</SelectItem>
                  <SelectItem value="price-low">Sort: Price (Low to High)</SelectItem>
                  <SelectItem value="rating">Sort: Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filteredBuses.length === 0 ? (
              <Card><CardContent className="p-10 text-center text-muted-foreground">
                <BusIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No buses match your filters for this route.</p>
                <p className="text-xs mt-1">Try adjusting filters or pick a different date.</p>
              </CardContent></Card>
            ) : (
              <AnimatePresence mode="popLayout">
                {filteredBuses.map((bus, i) => (
                  <motion.div
                    key={bus.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="overflow-hidden hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Left: operator info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-base">{bus.operator}</h3>
                              <Badge className="bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300 border-0">{bus.busType}</Badge>
                              <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {bus.rating}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 mt-3">
                              <div className="text-center">
                                <p className="text-xl font-bold tracking-tight">{bus.departTime}</p>
                                <p className="text-[11px] text-muted-foreground">{bus.origin}</p>
                              </div>
                              <div className="flex-1 flex flex-col items-center min-w-[80px]">
                                <p className="text-[10px] text-muted-foreground">{bus.duration}</p>
                                <div className="w-full h-px bg-border relative my-1">
                                  <BusIcon className="w-3 h-3 absolute -top-1.5 left-1/2 -translate-x-1/2 text-teal-600 bg-card px-0.5" />
                                </div>
                                <p className="text-[10px] text-muted-foreground">Non-stop</p>
                              </div>
                              <div className="text-center">
                                <p className="text-xl font-bold tracking-tight">{bus.arriveTime}</p>
                                <p className="text-[11px] text-muted-foreground">{bus.destination}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {bus.amenities.slice(0, 5).map((a) => (
                                <span key={a} className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                                  {amenityIcon(a)} {a}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Right: price + seats + CTA */}
                          <div className="flex lg:flex-col lg:items-end justify-between lg:justify-start gap-3 lg:gap-2 lg:min-w-[160px] lg:border-l lg:pl-4">
                            <div className="lg:text-right">
                              <p className="text-[11px] text-muted-foreground">Starting from</p>
                              <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{formatFullINR(bus.price)}</p>
                              <p className={cn("text-xs font-medium flex items-center gap-1 lg:justify-end mt-0.5", bus.seatsLeft < 15 ? "text-rose-600" : "text-emerald-600")}>
                                <Users className="w-3 h-3" /> {bus.seatsLeft} seats left
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={() => setExpandedBus(expandedBus === bus.id ? null : bus.id)}>
                                {expandedBus === bus.id ? "Hide" : "Details"}
                              </Button>
                              <Button size="sm" onClick={() => openSeatDialog(bus)} className="bg-teal-600 hover:bg-teal-700">
                                <Armchair className="w-4 h-4" /> Select Seats
                              </Button>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {expandedBus === bus.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 pt-4 border-t">
                                <div>
                                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-teal-600" /> Boarding Points ({bus.boardingPoints.length})</p>
                                  <div className="space-y-1.5">
                                    {bus.boardingPoints.map((p) => (
                                      <div key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" /> {p}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-rose-500" /> Dropping Points ({bus.droppingPoints.length})</p>
                                  <div className="space-y-1.5">
                                    {bus.droppingPoints.map((p) => (
                                      <div key={p} className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {p}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}

      {/* Seat Selection Dialog */}
      <Dialog open={!!seatDialogBus} onOpenChange={(o) => !o && setSeatDialogBus(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {seatDialogBus && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Armchair className="w-5 h-5 text-teal-600" /> Select Seats — {seatDialogBus.operator}
                </DialogTitle>
                <DialogDescription>
                  {seatDialogBus.busType} • {seatDialogBus.origin} → {seatDialogBus.destination} • {seatDialogBus.departTime}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-y-auto scroll-thin -mx-1 px-1">
                {/* Seat Layout */}
                <div className="md:col-span-3">
                  <div className="rounded-xl border-2 border-teal-200 dark:border-teal-900 p-3 bg-gradient-to-b from-teal-50/50 to-background dark:from-teal-950/20">
                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] mb-3">
                      <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border-2 border-teal-400 bg-teal-50 dark:bg-teal-900/30" /> Available</span>
                      <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border-2 border-teal-600 bg-teal-600" /> Selected</span>
                      <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border-2 border-slate-300 bg-slate-200 dark:bg-slate-700" /> Booked</span>
                      <span className="flex items-center gap-1"><span className="w-4 h-4 rounded border-2 border-pink-400 bg-pink-100 dark:bg-pink-900/30" /> Ladies</span>
                    </div>

                    {isSleeper(seatDialogBus.busType) ? (
                      <div className="space-y-3">
                        {(["lower", "upper"] as const).map((deck) => (
                          <div key={deck}>
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{deck} Deck</p>
                            <div className="grid grid-cols-3 gap-1.5">
                              {seats.filter((s) => s.deck === deck).map((s) => (
                                <SeatButton key={s.id} seat={s} selected={selectedSeats.includes(s.id)} onClick={() => toggleSeat(s.id, s.status)} sleeper />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Seater Layout (2 + 2)</p>
                        {Array.from({ length: 8 }).map((_, rowIdx) => {
                          const row = rowIdx + 1;
                          const rowSeats = seats.filter((s) => s.row === row);
                          return (
                            <div key={row} className="flex items-center gap-1.5">
                              <span className="w-5 text-[10px] text-muted-foreground font-medium">{row}</span>
                              <SeatButton seat={rowSeats[0]} selected={selectedSeats.includes(rowSeats[0].id)} onClick={() => toggleSeat(rowSeats[0].id, rowSeats[0].status)} />
                              <SeatButton seat={rowSeats[1]} selected={selectedSeats.includes(rowSeats[1].id)} onClick={() => toggleSeat(rowSeats[1].id, rowSeats[1].status)} />
                              <div className="w-4" />
                              <SeatButton seat={rowSeats[2]} selected={selectedSeats.includes(rowSeats[2].id)} onClick={() => toggleSeat(rowSeats[2].id, rowSeats[2].status)} />
                              <SeatButton seat={rowSeats[3]} selected={selectedSeats.includes(rowSeats[3].id)} onClick={() => toggleSeat(rowSeats[3].id, rowSeats[3].status)} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Boarding / Dropping / Summary */}
                <div className="md:col-span-2 space-y-3">
                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-teal-600" /> Boarding Point</p>
                    <RadioGroup value={boardingPoint} onValueChange={setBoardingPoint} className="gap-1.5 max-h-32 overflow-y-auto scroll-thin pr-1">
                      {seatDialogBus.boardingPoints.map((p) => (
                        <label key={p} className="flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer hover:bg-muted/50 has-[:checked]:border-teal-500 has-[:checked]:bg-teal-50 dark:has-[:checked]:bg-teal-950/30">
                          <RadioGroupItem value={p} id={`bp-${p}`} className="w-3.5 h-3.5" />
                          <span>{p}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div>
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-rose-500" /> Dropping Point</p>
                    <RadioGroup value={droppingPoint} onValueChange={setDroppingPoint} className="gap-1.5 max-h-32 overflow-y-auto scroll-thin pr-1">
                      {seatDialogBus.droppingPoints.map((p) => (
                        <label key={p} className="flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer hover:bg-muted/50 has-[:checked]:border-rose-500 has-[:checked]:bg-rose-50 dark:has-[:checked]:bg-rose-950/30">
                          <RadioGroupItem value={p} id={`dp-${p}`} className="w-3.5 h-3.5" />
                          <span>{p}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Selected Seats</span><span className="font-medium">{selectedSeats.length ? selectedSeats.join(", ") : "—"}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Fare / seat</span><span className="font-medium">{formatFullINR(seatDialogBus.price)}</span></div>
                    <Separator className="my-1" />
                    <div className="flex justify-between text-sm"><span className="font-semibold">Total</span><span className="font-bold text-teal-700 dark:text-teal-300">{formatFullINR(totalAmount)}</span></div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSeatDialogBus(null)}>Cancel</Button>
                <Button onClick={handleContinuePayment} disabled={!selectedSeats.length} className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
                  Continue to Payment {selectedSeats.length > 0 && `• ${formatFullINR(totalAmount)}`}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <PaymentModal
        open={payOpen}
        amount={totalAmount}
        title={seatDialogBus ? `${selectedSeats.length} seat(s) • ${seatDialogBus.operator}` : "Bus Booking"}
        onClose={() => setPayOpen(false)}
        onSuccess={resetSelections}
      />
    </div>
  );
}

function SeatButton({
  seat, selected, onClick, sleeper,
}: {
  seat: { id: string; label: string; status: string };
  selected: boolean;
  onClick: () => void;
  sleeper?: boolean;
}) {
  const isBooked = seat.status === "booked";
  const isLadies = seat.status === "ladies";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isBooked}
      title={seat.label}
      className={cn(
        "relative flex items-center justify-center text-[10px] font-medium transition-all",
        sleeper ? "h-8 rounded-md" : "w-7 h-7 rounded-md",
        isBooked
          ? "bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 text-slate-400 cursor-not-allowed"
          : isLadies
            ? "bg-pink-100 dark:bg-pink-900/30 border-2 border-pink-300 dark:border-pink-700 text-pink-700 dark:text-pink-300 hover:border-pink-500"
            : selected
              ? "bg-teal-600 border-2 border-teal-700 text-white"
              : "bg-teal-50 dark:bg-teal-950/30 border-2 border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:border-teal-500"
      )}
    >
      {selected ? <CheckCircle2 className="w-3 h-3" /> : seat.label}
    </button>
  );
}

function EmptyState() {
  const popular = [
    { from: "Mumbai", to: "Pune", price: 420, time: "3h 30m" },
    { from: "Delhi", to: "Jaipur", price: 650, time: "5h 15m" },
    { from: "Bangalore", to: "Chennai", price: 750, time: "6h 00m" },
    { from: "Hyderabad", to: "Goa", price: 1450, time: "11h 30m" },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {popular.map((r) => (
        <Card key={r.from + r.to} className="hover:border-teal-400 hover:shadow-md transition-all cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Popular</span>
              <BusIcon className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex items-center gap-2 mt-3 font-semibold">
              {r.from} <ArrowRight className="w-3 h-3 text-teal-600" /> {r.to}
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.time}</span>
              <span className="font-bold text-teal-700 dark:text-teal-300 text-sm">{formatFullINR(r.price)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

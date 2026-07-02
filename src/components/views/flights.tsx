"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane, Search, ArrowLeftRight, Calendar, Users, ChevronRight,
  Clock, Star, Sparkles, Filter, Loader2,
  CreditCard, Smartphone, Building2, Wallet, ShieldCheck,
  Plus, Minus, ArrowRight, PlaneTakeoff, PlaneLanding, Tag,
  CheckCircle2, RefreshCw, Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover, PopoverTrigger, PopoverContent,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatFullINR, PageHeader } from "@/components/shared/ui-helpers";
import { generateFlights } from "@/lib/mock-data";
import type { Flight } from "@/types";

/* ----------------------------- Constants ----------------------------- */

const CITIES = [
  { code: "BOM", city: "Mumbai" },
  { code: "DEL", city: "New Delhi" },
  { code: "BLR", city: "Bangalore" },
  { code: "MAA", city: "Chennai" },
  { code: "HYD", city: "Hyderabad" },
  { code: "CCU", city: "Kolkata" },
  { code: "GOI", city: "Goa" },
  { code: "COK", city: "Kochi" },
  { code: "DXB", city: "Dubai" },
  { code: "SIN", city: "Singapore" },
  { code: "BKK", city: "Bangkok" },
  { code: "LON", city: "London" },
];

const CABIN_CLASSES = ["Economy", "Premium Economy", "Business", "First"] as const;

const QUICK_ROUTES = [
  { from: "BOM", to: "DEL", label: "Mumbai → Delhi" },
  { from: "DEL", to: "GOI", label: "Delhi → Goa" },
  { from: "BLR", to: "BOM", label: "Bengaluru → Mumbai" },
  { from: "MAA", to: "SIN", label: "Chennai → Singapore" },
  { from: "HYD", to: "DXB", label: "Hyderabad → Dubai" },
  { from: "BOM", to: "BKK", label: "Mumbai → Bangkok" },
];

const AIRLINE_GRADIENTS: Record<string, string> = {
  "6E": "from-orange-400 to-rose-500",
  AI: "from-rose-400 to-red-500",
  UK: "from-violet-400 to-purple-500",
  SG: "from-rose-400 to-orange-500",
  QP: "from-amber-400 to-orange-500",
  IX: "from-rose-400 to-amber-500",
  EK: "from-red-400 to-rose-600",
  SQ: "from-teal-400 to-emerald-500",
  QR: "from-violet-400 to-fuchsia-500",
};

const SEAT_LETTERS = ["A", "B", "C", "D", "E", "F"];
const TOTAL_ROWS = 18;
const SEAT_PRICE = 500;

// Deterministic "booked" seats (no hydration mismatch)
const BOOKED_SEATS = new Set([
  "1A", "1F", "2C", "3B", "4D", "5A", "5F", "6C", "7B", "8D",
  "9A", "9E", "10B", "11C", "12D", "13A", "13F", "14B", "15C",
  "16D", "17A", "18F", "3E", "6F", "11A",
]);

const TIME_BANDS = [
  { id: "early", label: "Before 6 AM", range: [0, 6] },
  { id: "morning", label: "6 AM – 12 PM", range: [6, 12] },
  { id: "afternoon", label: "12 PM – 6 PM", range: [12, 18] },
  { id: "evening", label: "After 6 PM", range: [18, 24] },
];

type Step = "search" | "results";
type SortKey = "cheapest" | "fastest" | "earliest";
type PayMethod = "card" | "upi" | "netbanking" | "wallet";

/* ----------------------------- Helpers ----------------------------- */

function cityByCode(code: string) {
  return CITIES.find((c) => c.code === code)?.city ?? code;
}

function durationToMinutes(dur: string): number {
  const m = dur.match(/(\d+)h\s*(\d+)?m?/);
  if (!m) return 0;
  return parseInt(m[1] || "0") * 60 + parseInt(m[2] || "0");
}

function timeToHour(t: string): number {
  return parseInt(t.slice(0, 2));
}

function airlineGradient(code: string): string {
  return AIRLINE_GRADIENTS[code] ?? "from-teal-400 to-emerald-500";
}

/* ============================ Main View ============================ */

export function FlightsView() {
  const { toast } = useToast();

  /* Search state */
  const [tripType, setTripType] = useState<"oneway" | "round" | "multi">("oneway");
  const [from, setFrom] = useState("BOM");
  const [to, setTo] = useState("DEL");
  const [departDate, setDepartDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState<string>("Economy");

  /* Results state */
  const [step, setStep] = useState<Step>("search");
  const [results, setResults] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(false);

  /* Filters */
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 30000]);
  const [stopFilter, setStopFilter] = useState<"all" | "nonstop" | "one">("all");
  const [airlineFilter, setAirlineFilter] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("cheapest");
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  /* Seat selection */
  const [seatDialog, setSeatDialog] = useState(false);
  const [selectedFlight, setSelectedFlight] = useState<Flight | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  /* Review + payment */
  const [reviewDialog, setReviewDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);
  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [travellerName, setTravellerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const paxCount = adults + childrenCount;
  const maxPrice = useMemo(() => Math.max(30000, ...results.map((r) => r.price)), [results]);
  const minPrice = useMemo(() => Math.min(0, ...results.map((r) => r.price)), [results]);

  const uniqueAirlines = useMemo(() => {
    const map = new Map<string, string>();
    results.forEach((r) => map.set(r.airlineCode, r.airline));
    return Array.from(map.entries());
  }, [results]);

  const filteredResults = useMemo(() => {
    let r = results.filter((f) => {
      if (f.price < priceRange[0] || f.price > priceRange[1]) return false;
      if (stopFilter === "nonstop" && f.stops > 0) return false;
      if (stopFilter === "one" && f.stops !== 1) return false;
      if (airlineFilter.length && !airlineFilter.includes(f.airlineCode)) return false;
      if (timeFilter.length) {
        const hr = timeToHour(f.departTime);
        const inBand = TIME_BANDS.some((b) => {
          if (!timeFilter.includes(b.id)) return false;
          return hr >= b.range[0] && hr < b.range[1];
        });
        if (!inBand) return false;
      }
      return true;
    });
    r = [...r].sort((a, b) => {
      if (sortBy === "cheapest") return a.price - b.price;
      if (sortBy === "fastest") return durationToMinutes(a.duration) - durationToMinutes(b.duration);
      return a.departTime.localeCompare(b.departTime);
    });
    return r;
  }, [results, priceRange, stopFilter, airlineFilter, timeFilter, sortBy]);

  /* Actions */
  function handleSearch() {
    if (from === to) {
      toast({
        title: "Same city selected",
        description: "Origin and destination cannot be the same.",
        variant: "destructive",
      });
      return;
    }
    if (!departDate) {
      toast({
        title: "Select departure date",
        description: "Please pick a date for your trip.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const r = generateFlights(from, to, 8);
      setResults(r);
      const prices = r.map((f) => f.price);
      setPriceRange([Math.min(...prices), Math.max(...prices)]);
      setAirlineFilter([]);
      setStopFilter("all");
      setTimeFilter([]);
      setStep("results");
      setLoading(false);
    }, 650);
  }

  function swapCities() {
    setFrom(to);
    setTo(from);
  }

  function pickQuickRoute(route: { from: string; to: string }) {
    setFrom(route.from);
    setTo(route.to);
    if (!departDate) {
      const today = new Date();
      today.setDate(today.getDate() + 7);
      setDepartDate(today.toISOString().slice(0, 10));
    }
    handleSearch();
  }

  function toggleSeat(seatId: string) {
    if (BOOKED_SEATS.has(seatId)) return;
    setSelectedSeats((cur) =>
      cur.includes(seatId) ? cur.filter((s) => s !== seatId) : [...cur, seatId]
    );
  }

  function openSeatSelection(flight: Flight) {
    setSelectedFlight(flight);
    setSelectedSeats([]);
    setSeatDialog(true);
  }

  function continueToReview() {
    setSeatDialog(false);
    setReviewDialog(true);
  }

  function openPayment() {
    if (!travellerName.trim()) {
      toast({
        title: "Traveller name required",
        description: "Please add at least one traveller's name.",
        variant: "destructive",
      });
      return;
    }
    if (!contactEmail.trim() || !contactPhone.trim()) {
      toast({
        title: "Contact details required",
        description: "Please enter email and phone.",
        variant: "destructive",
      });
      return;
    }
    setReviewDialog(false);
    setPaymentDialog(true);
    setPaySuccess(false);
    setPaying(false);
  }

  function processPayment() {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      setPaySuccess(true);
      toast({
        title: "Booking confirmed!",
        description: `Flight ${selectedFlight?.flightNumber} • ${selectedSeats.length} seat(s) • ${formatFullINR(totalFare)}`,
      });
      setTimeout(() => {
        resetAll();
      }, 1800);
    }, 1900);
  }

  function resetAll() {
    setPaymentDialog(false);
    setReviewDialog(false);
    setSeatDialog(false);
    setStep("search");
    setSelectedFlight(null);
    setSelectedSeats([]);
    setTravellerName("");
    setContactEmail("");
    setContactPhone("");
    setPaySuccess(false);
    setPaying(false);
  }

  /* Fare calculation */
  const baseFare = selectedFlight ? selectedFlight.price * paxCount : 0;
  const seatCharges = selectedSeats.length * SEAT_PRICE;
  const taxes = Math.round(baseFare * 0.12);
  const totalFare = baseFare + taxes + seatCharges;

  /* ============================ Render ============================ */
  return (
    <div className="space-y-6">
      <PageHeader
        title="Flight Booking"
        subtitle="Search and book domestic & international flights at the best fares"
        action={
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0">
            <Sparkles className="w-3 h-3 mr-1" /> Best Price Guarantee
          </Badge>
        }
      />

      {/* SEARCH PANEL — always visible at top in search/results */}
      <SearchPanel
        tripType={tripType} setTripType={setTripType}
        from={from} setFrom={setFrom}
        to={to} setTo={setTo}
        swapCities={swapCities}
        departDate={departDate} setDepartDate={setDepartDate}
        returnDate={returnDate} setReturnDate={setReturnDate}
        adults={adults} setAdults={setAdults}
        childrenCount={childrenCount} setChildrenCount={setChildrenCount}
        infants={infants} setInfants={setInfants}
        cabin={cabin} setCabin={setCabin}
        onSearch={handleSearch}
        loading={loading}
      />

      {/* Quick route chips on search screen */}
      {step === "search" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" /> Popular routes:
          </span>
          {QUICK_ROUTES.map((r) => (
            <button
              key={r.label}
              onClick={() => pickQuickRoute(r)}
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "search" && (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <EmptyState />
          </motion.div>
        )}

        {step === "results" && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            {/* Search summary bar */}
            <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 via-card to-amber-500/5">
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 font-semibold">
                    <span className="text-lg">{from}</span>
                    <ArrowRight className="w-4 h-4 text-primary" />
                    <span className="text-lg">{to}</span>
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {departDate}
                    {tripType === "round" && returnDate && (
                      <> → {returnDate}</>
                    )}
                  </div>
                  <Separator orientation="vertical" className="h-6" />
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    {paxCount} Pax · {cabin}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("search")}
                  className="gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Modify
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
              {/* Filter sidebar (desktop) */}
              <aside className="hidden lg:block">
                <FilterPanel
                  priceRange={priceRange}
                  setPriceRange={setPriceRange}
                  minPrice={minPrice}
                  maxPrice={maxPrice}
                  stopFilter={stopFilter}
                  setStopFilter={setStopFilter}
                  uniqueAirlines={uniqueAirlines}
                  airlineFilter={airlineFilter}
                  setAirlineFilter={setAirlineFilter}
                  timeFilter={timeFilter}
                  setTimeFilter={setTimeFilter}
                />
              </aside>

              {/* Mobile filter trigger */}
              <div className="lg:hidden flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFiltersMobile(true)}
                  className="gap-1.5"
                >
                  <Filter className="w-4 h-4" /> Filters
                </Button>
                <SortControl sortBy={sortBy} setSortBy={setSortBy} />
              </div>

              {/* Results list */}
              <div>
                <div className="hidden lg:flex items-center justify-between mb-3">
                  <p className="text-sm text-muted-foreground">
                    Showing <span className="font-semibold text-foreground">{filteredResults.length}</span> of{" "}
                    {results.length} flights
                  </p>
                  <SortControl sortBy={sortBy} setSortBy={setSortBy} />
                </div>

                {loading ? (
                  <div className="space-y-3">
                    {[0, 1, 2].map((i) => (
                      <Card key={i} className="overflow-hidden">
                        <CardContent className="p-4">
                          <div className="h-20 rounded-lg bg-muted animate-pulse" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredResults.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Plane className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="font-medium">No flights match your filters</p>
                      <p className="text-sm text-muted-foreground mt-1">Try widening the price range or removing filters.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {filteredResults.map((flight, idx) => (
                        <motion.div
                          key={flight.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                        >
                          <FlightCard
                            flight={flight}
                            onSelect={() => openSeatSelection(flight)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile filter sheet */}
      <Dialog open={showFiltersMobile} onOpenChange={setShowFiltersMobile}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto scroll-thin">
            <FilterPanel
              priceRange={priceRange}
              setPriceRange={setPriceRange}
              minPrice={minPrice}
              maxPrice={maxPrice}
              stopFilter={stopFilter}
              setStopFilter={setStopFilter}
              uniqueAirlines={uniqueAirlines}
              airlineFilter={airlineFilter}
              setAirlineFilter={setAirlineFilter}
              timeFilter={timeFilter}
              setTimeFilter={setTimeFilter}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFiltersMobile(false)} className="w-full">
              Show {filteredResults.length} flights
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SEAT SELECTION DIALOG */}
      <Dialog open={seatDialog} onOpenChange={setSeatDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-primary" /> Select your seats
            </DialogTitle>
            <DialogDescription>
              {selectedFlight?.airline} · {selectedFlight?.flightNumber} ·{" "}
              {selectedFlight?.origin} → {selectedFlight?.destination} ·{" "}
              {selectedFlight?.departTime}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px] gap-4">
            {/* Seat map */}
            <div>
              <div className="rounded-t-[40%] border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-transparent pt-3 pb-2 px-3">
                <p className="text-center text-[10px] font-semibold text-primary/70 tracking-widest mb-2">
                  ✈ FRONT OF AIRCRAFT
                </p>
                <div className="space-y-1.5 max-h-72 overflow-y-auto scroll-thin pr-1">
                  {Array.from({ length: TOTAL_ROWS }).map((_, rowIdx) => {
                    const rowNum = rowIdx + 1;
                    return (
                      <div key={rowNum} className="flex items-center gap-1 justify-center">
                        <div className="w-5 text-[10px] text-muted-foreground text-right pr-1">
                          {rowNum}
                        </div>
                        {SEAT_LETTERS.map((letter, idx) => {
                          const seatId = `${rowNum}${letter}`;
                          const isBooked = BOOKED_SEATS.has(seatId);
                          const isSelected = selectedSeats.includes(seatId);
                          const showAisleGap = idx === 3;
                          return (
                            <div key={seatId} className="flex items-center">
                              {showAisleGap && <div className="w-3" />}
                              <button
                                disabled={isBooked}
                                onClick={() => toggleSeat(seatId)}
                                title={`Seat ${seatId}${isBooked ? " (booked)" : ""}`}
                                className={cn(
                                  "size-7 rounded-md text-[10px] font-semibold transition-all flex items-center justify-center",
                                  isBooked && "bg-muted text-muted-foreground/40 cursor-not-allowed",
                                  !isBooked && !isSelected && "border-2 border-primary/40 text-primary/70 hover:border-primary hover:bg-primary/10",
                                  isSelected && "bg-primary text-primary-foreground shadow-sm scale-105"
                                )}
                              >
                                {isBooked ? "×" : letter}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="size-4 rounded border-2 border-primary/40" /> Available
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-4 rounded bg-primary" /> Selected
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-4 rounded bg-muted" /> Booked
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Crown className="w-3 h-3" /> ₹{SEAT_PRICE} / seat
                </span>
              </div>
            </div>

            {/* Seat selection summary */}
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground mb-2">Selected seats</p>
                {selectedSeats.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">No seats selected</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSeats.map((s) => (
                      <Badge key={s} className="bg-primary text-primary-foreground">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base fare ({paxCount} pax)</span>
                  <span>{formatFullINR(baseFare)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Seat charges ({selectedSeats.length})</span>
                  <span>{formatFullINR(seatCharges)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxes & fees</span>
                  <span>{formatFullINR(taxes)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-semibold text-base">
                  <span>Total</span>
                  <span className="text-primary">{formatFullINR(totalFare)}</span>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={continueToReview}
                disabled={selectedSeats.length === 0}
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Seat selection is optional. You can skip and continue.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => { setSeatDialog(false); setReviewDialog(true); }}
              >
                Skip & continue
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* REVIEW & PAYMENT DIALOG */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review your booking</DialogTitle>
            <DialogDescription>
              {selectedFlight?.airline} · {selectedFlight?.flightNumber} ·{" "}
              {selectedFlight?.originCity} → {selectedFlight?.destinationCity}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-4">
            {/* Forms */}
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" /> Traveller details
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <Label htmlFor="tv-name" className="text-xs">Full name (adult 1)</Label>
                    <Input
                      id="tv-name"
                      value={travellerName}
                      onChange={(e) => setTravellerName(e.target.value)}
                      placeholder="e.g. Karthik Venkat"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Age</Label>
                    <Input type="number" defaultValue={28} min={1} max={120} />
                  </div>
                  <div>
                    <Label className="text-xs">Gender</Label>
                    <Select defaultValue="male">
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-primary" /> Contact details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="ct-email" className="text-xs">Email</Label>
                    <Input
                      id="ct-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="ct-phone" className="text-xs">Phone</Label>
                    <Input
                      id="ct-phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 90000 00000"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Free cancellation up to 24 hours before departure. Travel insurance available at checkout.
                </p>
              </div>
            </div>

            {/* Fare summary */}
            <div className="space-y-3">
              <div className="rounded-lg border bg-gradient-to-br from-primary/5 to-amber-500/5 p-4">
                <p className="text-sm font-semibold mb-3">Fare summary</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base × {paxCount}</span>
                    <span>{formatFullINR(baseFare)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Taxes & fees</span>
                    <span>{formatFullINR(taxes)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Seat charges</span>
                    <span>{formatFullINR(seatCharges)}</span>
                  </div>
                  {selectedSeats.length > 0 && (
                    <div className="text-[11px] text-muted-foreground pl-1">
                      Seats: {selectedSeats.join(", ")}
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold text-base">
                    <span>Total payable</span>
                    <span className="text-primary">{formatFullINR(totalFare)}</span>
                  </div>
                </div>
              </div>
              <Button className="w-full h-11" onClick={openPayment}>
                Proceed to pay <ArrowRight className="w-4 h-4" />
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                By proceeding, you agree to the fare rules and terms of service.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* PAYMENT DIALOG (Razorpay-style) */}
      <Dialog open={paymentDialog} onOpenChange={(o) => { if (!paying) setPaymentDialog(o); }}>
        <DialogContent className="sm:max-w-md" showCloseButton={!paying && !paySuccess}>
          {paySuccess ? (
            <div className="py-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 14 }}
                className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400" />
              </motion.div>
              <h3 className="text-lg font-semibold">Payment Successful</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your booking is confirmed. A confirmation has been sent to your email.
              </p>
              <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount paid</span>
                  <span className="font-semibold">{formatFullINR(totalFare)}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Booking ID</span>
                  <span className="font-mono text-xs">TP{Math.floor(Math.random() * 900000 + 100000)}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" /> Secure Payment
                </DialogTitle>
                <DialogDescription>
                  Powered by Razorpay · 256-bit encrypted
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-lg bg-gradient-to-r from-primary/10 to-amber-500/10 p-4 text-center">
                <p className="text-xs text-muted-foreground">Amount payable</p>
                <p className="text-3xl font-bold tracking-tight text-primary">{formatFullINR(totalFare)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedFlight?.airline} · {selectedFlight?.flightNumber}
                </p>
              </div>

              <Tabs value={payMethod} onValueChange={(v) => setPayMethod(v as PayMethod)}>
                <TabsList className="grid grid-cols-4 w-full h-auto">
                  <TabsTrigger value="card" className="flex-col py-1.5 gap-0.5">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-[10px]">Card</span>
                  </TabsTrigger>
                  <TabsTrigger value="upi" className="flex-col py-1.5 gap-0.5">
                    <Smartphone className="w-4 h-4" />
                    <span className="text-[10px]">UPI</span>
                  </TabsTrigger>
                  <TabsTrigger value="netbanking" className="flex-col py-1.5 gap-0.5">
                    <Building2 className="w-4 h-4" />
                    <span className="text-[10px]">Bank</span>
                  </TabsTrigger>
                  <TabsTrigger value="wallet" className="flex-col py-1.5 gap-0.5">
                    <Wallet className="w-4 h-4" />
                    <span className="text-[10px]">Wallet</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="card" className="space-y-2 mt-3">
                  <div>
                    <Label className="text-xs">Card number</Label>
                    <Input placeholder="4111 1111 1111 1111" maxLength={19} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Expiry</Label>
                      <Input placeholder="MM/YY" maxLength={5} />
                    </div>
                    <div>
                      <Label className="text-xs">CVV</Label>
                      <Input type="password" placeholder="•••" maxLength={3} />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="upi" className="space-y-2 mt-3">
                  <div>
                    <Label className="text-xs">UPI ID</Label>
                    <Input placeholder="yourname@upi" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["GPay", "PhonePe", "Paytm", "BHIM"].map((u) => (
                      <Badge key={u} variant="secondary" className="cursor-pointer hover:bg-primary/10">
                        {u}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="netbanking" className="space-y-2 mt-3">
                  <Label className="text-xs">Select bank</Label>
                  <Select defaultValue="hdfc">
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hdfc">HDFC Bank</SelectItem>
                      <SelectItem value="icici">ICICI Bank</SelectItem>
                      <SelectItem value="sbi">State Bank of India</SelectItem>
                      <SelectItem value="axis">Axis Bank</SelectItem>
                      <SelectItem value="kotak">Kotak Mahindra Bank</SelectItem>
                    </SelectContent>
                  </Select>
                </TabsContent>

                <TabsContent value="wallet" className="space-y-2 mt-3">
                  <div className="rounded-lg border p-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Wallet balance</span>
                      <span className="font-semibold">{formatFullINR(125000)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {["Amazon Pay", "Mobikwik", "Freecharge"].map((w) => (
                      <Badge key={w} variant="secondary" className="cursor-pointer hover:bg-primary/10">
                        {w}
                      </Badge>
                    ))}
                  </div>
                </TabsContent>
              </Tabs>

              <Button
                className="w-full h-11 text-base"
                onClick={processPayment}
                disabled={paying}
              >
                {paying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <LockIcon /> Pay {formatFullINR(totalFare)}
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> This is a demo payment. No real charge will be made.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================ Sub-components ============================ */

function SearchPanel(props: {
  tripType: string;
  setTripType: (v: "oneway" | "round" | "multi") => void;
  from: string; setFrom: (v: string) => void;
  to: string; setTo: (v: string) => void;
  swapCities: () => void;
  departDate: string; setDepartDate: (v: string) => void;
  returnDate: string; setReturnDate: (v: string) => void;
  adults: number; setAdults: (v: number) => void;
  childrenCount: number; setChildrenCount: (v: number) => void;
  infants: number; setInfants: (v: number) => void;
  cabin: string; setCabin: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const paxLabel = `${props.adults + props.childrenCount} Traveler${props.adults + props.childrenCount > 1 ? "s" : ""}${props.infants ? `, ${props.infants} Infant` : ""}`;

  return (
    <Card className="relative overflow-hidden border-0 shadow-lg">
      {/* Gradient backdrop */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800" />
      <div className="absolute inset-0 opacity-30 hero-pattern" />
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-emerald-300/20 rounded-full blur-3xl" />

      <CardContent className="relative p-5 sm:p-6 text-white">
        {/* Trip type toggle */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { id: "oneway", label: "One Way" },
            { id: "round", label: "Round Trip" },
            { id: "multi", label: "Multi City" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => props.setTripType(t.id as "oneway" | "round" | "multi")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                props.tripType === t.id
                  ? "bg-white text-teal-700 shadow-sm"
                  : "bg-white/15 text-white hover:bg-white/25"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Main inputs */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-end">
          <div className="rounded-xl bg-white/95 backdrop-blur p-3 text-foreground">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <PlaneTakeoff className="w-3 h-3" /> From
            </Label>
            <Select value={props.from} onValueChange={props.setFrom}>
              <SelectTrigger className="border-0 p-0 h-auto text-lg font-bold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} disabled={c.code === props.to}>
                    {c.code} · {c.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-0.5">{cityByCode(props.from)}</p>
          </div>

          <button
            onClick={props.swapCities}
            className="hidden md:flex size-10 -mb-2 items-center justify-center rounded-full bg-white text-teal-700 shadow-md hover:scale-110 hover:rotate-180 transition-transform"
            title="Swap cities"
          >
            <ArrowLeftRight className="w-4 h-4" />
          </button>

          <div className="rounded-xl bg-white/95 backdrop-blur p-3 text-foreground">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <PlaneLanding className="w-3 h-3" /> To
            </Label>
            <Select value={props.to} onValueChange={props.setTo}>
              <SelectTrigger className="border-0 p-0 h-auto text-lg font-bold focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.code} value={c.code} disabled={c.code === props.from}>
                    {c.code} · {c.city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-0.5">{cityByCode(props.to)}</p>
          </div>
        </div>

        {/* Date + pax row */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 mt-3">
          <div className="rounded-xl bg-white/95 backdrop-blur p-3 text-foreground">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Departure
            </Label>
            <Input
              type="date"
              value={props.departDate}
              min={today}
              onChange={(e) => props.setDepartDate(e.target.value)}
              className="border-0 p-0 h-auto text-sm font-semibold focus:ring-0"
            />
          </div>

          <div className={cn(
            "rounded-xl bg-white/95 backdrop-blur p-3 text-foreground transition-opacity",
            props.tripType !== "round" && "opacity-40 pointer-events-none"
          )}>
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3" /> Return
            </Label>
            <Input
              type="date"
              value={props.returnDate}
              min={props.departDate || today}
              disabled={props.tripType !== "round"}
              onChange={(e) => props.setReturnDate(e.target.value)}
              className="border-0 p-0 h-auto text-sm font-semibold focus:ring-0"
            />
          </div>

          {/* Passengers & class popover */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="rounded-xl bg-white/95 backdrop-blur p-3 text-left text-foreground hover:bg-white transition">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" /> Travelers & Class
                </Label>
                <p className="text-sm font-semibold mt-0.5">{paxLabel}</p>
                <p className="text-xs text-muted-foreground">{props.cabin}</p>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <PaxStepper
                label="Adults" sub="12+ years"
                value={props.adults} onChange={props.setAdults} min={1} max={9}
              />
              <Separator className="my-2" />
              <PaxStepper
                label="Children" sub="2–12 years"
                value={props.childrenCount} onChange={props.setChildrenCount} min={0} max={9}
              />
              <Separator className="my-2" />
              <PaxStepper
                label="Infants" sub="Under 2 years"
                value={props.infants} onChange={props.setInfants} min={0} max={4}
              />
              <Separator className="my-2" />
              <div>
                <p className="text-sm font-medium mb-2">Cabin class</p>
                <RadioGroup
                  value={props.cabin}
                  onValueChange={props.setCabin}
                  className="grid grid-cols-2 gap-1.5"
                >
                  {CABIN_CLASSES.map((c) => (
                    <label key={c} className="flex items-center gap-2 cursor-pointer rounded-md border p-1.5 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value={c} id={`c-${c}`} />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            onClick={props.onSearch}
            disabled={props.loading}
            className="h-full min-h-[68px] bg-amber-500 hover:bg-amber-600 text-white font-semibold text-base shadow-md gap-2"
          >
            {props.loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
            {props.loading ? "Searching…" : "Search Flights"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PaxStepper({ label, sub, value, onChange, min, max }: {
  label: string; sub: string; value: number;
  onChange: (v: number) => void; min: number; max: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="size-8 rounded-full border border-primary/40 text-primary flex items-center justify-center hover:bg-primary/5 disabled:opacity-30"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="w-6 text-center font-semibold text-sm">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="size-8 rounded-full border border-primary/40 text-primary flex items-center justify-center hover:bg-primary/5 disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="overflow-hidden border-dashed">
      <CardContent className="py-12 px-6 text-center">
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center mb-4 shadow-lg">
          <Plane className="w-10 h-10 text-white" />
        </div>
        <h3 className="text-xl font-bold">Where would you like to fly?</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Search across 500+ airlines for the best fares. Get instant ticketing,
          easy cancellations, and 24/7 customer support.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 max-w-2xl mx-auto">
          {[
            { icon: Tag, title: "Lowest Price", desc: "Best fares guaranteed" },
            { icon: ShieldCheck, title: "Secure Booking", desc: "100% safe payments" },
            { icon: CheckCircle2, title: "Instant Ticketing", desc: "Confirmed in seconds" },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-4 text-left">
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2">
                <f.icon className="w-4 h-4" />
              </div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SortControl({ sortBy, setSortBy }: { sortBy: SortKey; setSortBy: (s: SortKey) => void }) {
  return (
    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
      <SelectTrigger size="sm" className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="cheapest">Cheapest first</SelectItem>
        <SelectItem value="fastest">Fastest first</SelectItem>
        <SelectItem value="earliest">Earliest first</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FilterPanel(props: {
  priceRange: [number, number];
  setPriceRange: (v: [number, number]) => void;
  minPrice: number;
  maxPrice: number;
  stopFilter: "all" | "nonstop" | "one";
  setStopFilter: (v: "all" | "nonstop" | "one") => void;
  uniqueAirlines: [string, string][];
  airlineFilter: string[];
  setAirlineFilter: (v: string[]) => void;
  timeFilter: string[];
  setTimeFilter: (v: string[]) => void;
}) {
  return (
    <Card className="sticky top-4">
      <CardContent className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-primary" /> Filters
          </p>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              props.setStopFilter("all");
              props.setAirlineFilter([]);
              props.setTimeFilter([]);
              props.setPriceRange([props.minPrice, props.maxPrice]);
            }}
          >
            Reset all
          </button>
        </div>

        <Separator />

        {/* Stops */}
        <div>
          <p className="text-xs font-semibold mb-2">Stops</p>
          <RadioGroup
            value={props.stopFilter}
            onValueChange={(v) => props.setStopFilter(v as "all" | "nonstop" | "one")}
          >
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="all" id="st-all" /> Any
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="nonstop" id="st-non" /> Non-stop only
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <RadioGroupItem value="one" id="st-one" /> 1 stop
            </label>
          </RadioGroup>
        </div>

        <Separator />

        {/* Price */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold">Price range</p>
            <p className="text-xs text-muted-foreground">
              {formatFullINR(props.priceRange[0])} – {formatFullINR(props.priceRange[1])}
            </p>
          </div>
          <Slider
            min={props.minPrice}
            max={props.maxPrice}
            step={500}
            value={props.priceRange}
            onValueChange={(v) => props.setPriceRange([v[0], v[1]])}
            className="mt-3"
          />
        </div>

        <Separator />

        {/* Departure time */}
        <div>
          <p className="text-xs font-semibold mb-2">Departure time</p>
          <div className="space-y-1.5">
            {TIME_BANDS.map((b) => (
              <label key={b.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={props.timeFilter.includes(b.id)}
                  onCheckedChange={(c) => {
                    if (c) props.setTimeFilter([...props.timeFilter, b.id]);
                    else props.setTimeFilter(props.timeFilter.filter((t) => t !== b.id));
                  }}
                />
                {b.label}
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {/* Airlines */}
        <div>
          <p className="text-xs font-semibold mb-2">Airlines</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto scroll-thin">
            {props.uniqueAirlines.map(([code, name]) => (
              <label key={code} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={props.airlineFilter.includes(code)}
                  onCheckedChange={(c) => {
                    if (c) props.setAirlineFilter([...props.airlineFilter, code]);
                    else props.setAirlineFilter(props.airlineFilter.filter((a) => a !== code));
                  }}
                />
                <span className={cn("size-5 rounded-full bg-gradient-to-br text-white text-[8px] font-bold flex items-center justify-center", airlineGradient(code))}>
                  {code}
                </span>
                {name}
              </label>
            ))}
            {props.uniqueAirlines.length === 0 && (
              <p className="text-xs text-muted-foreground">Run a search first</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FlightCard({ flight, onSelect }: { flight: Flight; onSelect: () => void }) {
  const lowSeats = flight.seatsLeft < 8;
  return (
    <Card className="overflow-hidden hover:shadow-md hover:border-primary/40 transition-all group">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
          {/* Left: flight info */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 min-w-[160px]">
              <div className={cn(
                "size-11 rounded-full bg-gradient-to-br text-white text-xs font-bold flex items-center justify-center shadow-sm",
                airlineGradient(flight.airlineCode)
              )}>
                {flight.airlineCode}
              </div>
              <div>
                <p className="text-sm font-semibold leading-tight">{flight.airline}</p>
                <p className="text-xs text-muted-foreground">{flight.flightNumber}</p>
                <p className="text-[11px] text-muted-foreground/80">{flight.aircraft}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-1 justify-between sm:justify-around">
              {/* Departure */}
              <div className="text-center sm:text-left">
                <p className="text-lg font-bold tracking-tight">{flight.departTime}</p>
                <p className="text-sm font-medium text-foreground">{flight.origin}</p>
                <p className="text-[11px] text-muted-foreground">{flight.originCity}</p>
              </div>

              {/* Duration line */}
              <div className="flex-1 max-w-[180px] flex flex-col items-center">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="w-3 h-3" /> {flight.duration}
                </div>
                <div className="relative w-full flex items-center my-1">
                  <span className="size-1.5 rounded-full bg-primary" />
                  <div className="flex-1 h-px bg-border relative">
                    <Plane className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 text-primary fill-primary" />
                  </div>
                  <span className="size-1.5 rounded-full bg-primary" />
                </div>
                <p className="text-[11px] font-medium text-amber-600">
                  {flight.stops === 0 ? "Non-stop" : `${flight.stops} stop`}
                </p>
              </div>

              {/* Arrival */}
              <div className="text-center sm:text-right">
                <p className="text-lg font-bold tracking-tight">{flight.arriveTime}</p>
                <p className="text-sm font-medium text-foreground">{flight.destination}</p>
                <p className="text-[11px] text-muted-foreground">{flight.destinationCity}</p>
              </div>
            </div>
          </div>

          {/* Right: price + select */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 sm:gap-1 lg:min-w-[150px] sm:border-l sm:pl-4">
            <div className="text-left sm:text-right">
              <p className="text-[11px] text-muted-foreground">starting from</p>
              <p className="text-2xl font-bold tracking-tight text-primary">
                {formatFullINR(flight.price)}
              </p>
              <p className="text-[11px] text-muted-foreground">per adult · incl. taxes</p>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-1">
              <div className="flex items-center gap-1.5">
                {flight.refundable && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 border-0 text-[10px]">
                    Refundable
                  </Badge>
                )}
                <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400 border-0 text-[10px]">
                  {flight.cabin}
                </Badge>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{flight.rating.toFixed(1)}</span>
                {lowSeats && (
                  <span className="ml-1 text-rose-600 font-medium">· {flight.seatsLeft} seats left</span>
                )}
              </div>
            </div>
            <Button onClick={onSelect} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
              Select <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* small inline LockIcon to avoid cluttering imports */
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

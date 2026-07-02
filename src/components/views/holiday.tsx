"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Palmtree, MapPin, Search, Star, Clock, Heart, Users, Building2,
  Mountain, GraduationCap, Landmark, Compass, Plane, CheckCircle2,
  CreditCard, Wallet, Building2 as BankIcon, Loader2, ShieldCheck,
  BadgeIndianRupee, ArrowRight, Globe, Calendar, Sparkles, Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { HOLIDAY_PACKAGES } from "@/lib/mock-data";
import type { HolidayPackage } from "@/types";
import { formatFullINR, PageHeader } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

const PACKAGE_TYPES = [
  { id: "All", label: "All Packages", icon: Sparkles },
  { id: "Honeymoon", label: "Honeymoon", icon: Heart },
  { id: "Family", label: "Family", icon: Users },
  { id: "Group", label: "Group", icon: Compass },
  { id: "Corporate", label: "Corporate", icon: Building2 },
  { id: "Educational", label: "Educational", icon: GraduationCap },
  { id: "Religious", label: "Religious", icon: Landmark },
  { id: "Adventure", label: "Adventure", icon: Mountain },
];

const TYPE_GRADIENTS: Record<string, string> = {
  Honeymoon: "from-rose-500 via-pink-500 to-purple-600",
  Family: "from-teal-500 via-emerald-500 to-cyan-600",
  Group: "from-amber-500 via-orange-500 to-rose-500",
  Corporate: "from-slate-600 via-teal-700 to-emerald-700",
  Educational: "from-violet-500 via-purple-500 to-indigo-600",
  Religious: "from-orange-500 via-amber-500 to-yellow-500",
  Adventure: "from-emerald-500 via-teal-600 to-cyan-700",
};

// Sample day-by-day itinerary generator (deterministic from package id)
function buildItinerary(pkg: HolidayPackage) {
  const templates: Record<string, { title: string; desc: string }[]> = {
    "pk-1": [
      { title: "Day 1 — Arrival in Bali", desc: "Airport pickup, transfer to private pool villa in Seminyak. Welcome drinks & flower bouquet. Evening at leisure." },
      { title: "Day 2 — Uluwatu Temple & Kecak Dance", desc: "Half-day tour to Uluwatu cliff temple. Sunset Kecak fire dance performance. Seafood dinner at Jimbaran Bay." },
      { title: "Day 3 — Kintamani Volcano & Tirta Empul", desc: "Mount Batur viewpoint, Tirta Empul holy springs, Tegallalang rice terraces. Coffee plantation tour." },
      { title: "Day 4 — Nusa Penida Island", desc: "Full-day speedboat to Nusa Penida. Visit Kelingking Beach, Angel's Billabong, Broken Beach. Snorkeling with manta rays." },
      { title: "Day 5 — Sunset Dinner Cruise", desc: "Day at leisure. Evening sunset dinner cruise around Benoa Bay with live music." },
      { title: "Day 6 — Ubud Village & Departure", desc: "Ubud art market, Monkey Forest, Tegenungan waterfall. Transfer to airport for return flight." },
    ],
    "pk-2": [
      { title: "Day 1 — Srinagar Arrival & Shikara", desc: "Airport pickup. Check-in to Dal Lake houseboat. Evening Shikara ride on Dal Lake." },
      { title: "Day 2 — Gulmarg Day Trip", desc: "Drive to Gulmarg. Gondola ride to Kongdoori. Pony rides, golf course. Return to Srinagar." },
      { title: "Day 3 — Sonmarg Excursion", desc: "Full-day trip to Sonmarg — meadow of gold. Thajiwas glacier on pony. Return by evening." },
      { title: "Day 4 — Pahalgam Valley", desc: "Drive to Pahalgam via saffron fields. Lidder river, Betaab Valley, Aru valley." },
      { title: "Day 5 — Mughal Gardens & Departure", desc: "Visit Nishat, Shalimar, Chashm-e-Shahi gardens. Old Srinagar city. Airport drop." },
    ],
    "pk-3": [
      { title: "Day 1 — Dubai Arrival & Dhow Cruise", desc: "Airport pickup. Evening Dhow cruise dinner on Dubai Marina with city lights." },
      { title: "Day 2 — Dubai City Tour & Burj Khalifa", desc: "Half-day city tour — Jumeirah Mosque, Palm Jumeirah, Atlantis. Evening Burj Khalifa 124th floor access." },
      { title: "Day 3 — Desert Safari", desc: "Afternoon desert safari with dune bashing, camel ride, BBQ dinner, belly dance & tanura show." },
      { title: "Day 4 — Abu Dhabi Day Trip", desc: "Sheikh Zayed Grand Mosque, Ferrari World photo stop, Emirates Palace. Return to Dubai." },
      { title: "Day 5 — Dubai Mall & Departure", desc: "Visit Dubai Mall, aquarium, fountain show. Last-minute shopping. Airport drop." },
    ],
    "pk-4": [
      { title: "Day 1 — Port Blair Arrival", desc: "Airport pickup. Cellular Jail light & sound show in evening. Corbyn's Cove beach." },
      { title: "Day 2 — Havelock Island", desc: "Cruise to Havelock. Radhanagar Beach (Asia's #7 beach). Overnight at beach resort." },
      { title: "Day 3 — Scuba & Sea Walking", desc: "Morning scuba diving at Elephant Beach. Afternoon sea walking & water sports." },
      { title: "Day 4 — Neil Island", desc: "Cruise to Neil Island. Bharatpur Beach, Natural Bridge, Laxmanpur sunset. Return to Port Blair." },
      { title: "Day 5 — Ross Island & Departure", desc: "Ross Island (British-era ruins), North Bay water sports. Airport drop for return flight." },
    ],
    "pk-5": [
      { title: "Days 1-2 — Paris Arrival", desc: "Eiffel Tower, Seine cruise, Louvre Museum, Notre-Dame, Montmartre, Sacré-Cœur." },
      { title: "Days 3-4 — Amsterdam", desc: "Euro rail to Amsterdam. Canal cruise, Anne Frank House, Van Gogh Museum, Keukenhof gardens." },
      { title: "Days 5-6 — Switzerland", desc: "Travel to Lucerne. Mt. Titlis, Interlaken, Jungfrau, Rhine Falls. Swiss Travel Pass." },
      { title: "Days 7-8 — Italy (Rome & Vatican)", desc: "Colosseum, Vatican Museums, Sistine Chapel, St. Peter's Basilica, Trevi Fountain." },
      { title: "Days 9-10 — Florence & Venice", desc: "Uffizi Gallery, Ponte Vecchio, gondola ride in Venice, St. Mark's Square." },
      { title: "Days 11-12 — Return", desc: "Last-minute shopping. Transfer to airport. Return flight to India." },
    ],
    "pk-6": [
      { title: "Day 1 — Goa Arrival & Beach", desc: "Airport pickup. Check-in to Baga beach resort. Evening at beach shacks with sunset." },
      { title: "Day 2 — North Goa Tour", desc: "Fort Aguada, Sinquerim, Calangute, Anjuna flea market, Vagator. Evening casino cruise." },
      { title: "Day 3 — Dudhsagar & South Goa", desc: "Dudhsagar waterfalls jeep safari. Afternoon Old Goa churches, Mangueshi temple, Miramar beach." },
      { title: "Day 4 — Departure", desc: "Morning beach yoga. Airport drop for return flight." },
    ],
  };
  return templates[pkg.id] || [];
}

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
        title: "Package Booked!",
        description: `${formatFullINR(amount)} paid. Your holiday package is confirmed. Booking ID: HL-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
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
            <ShieldCheck className="w-3 h-3" /> 256-bit encrypted • Free cancellation up to 7 days
          </p>
        </div>

        <Tabs value={method} onValueChange={setMethod}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="card"><CreditCard className="w-3.5 h-3.5 mr-1" /> Card</TabsTrigger>
            <TabsTrigger value="upi"><Wallet className="w-3.5 h-3.5 mr-1" /> UPI</TabsTrigger>
            <TabsTrigger value="netbanking"><BankIcon className="w-3.5 h-3.5 mr-1" /> Net</TabsTrigger>
          </TabsList>
          <TabsContent value="card" className="space-y-3 mt-3">
            <Input placeholder="Card Number • 4111 1111 1111 1111" />
            <div className="grid grid-cols-2 gap-2"><Input placeholder="MM / YY" /><Input placeholder="CVV" /></div>
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

export function HolidayView() {
  const { toast } = useToast();
  const [typeFilter, setTypeFilter] = useState("All");
  const [scope, setScope] = useState<"all" | "domestic" | "international">("all");
  const [search, setSearch] = useState("");
  const [detailPkg, setDetailPkg] = useState<HolidayPackage | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payTitle, setPayTitle] = useState("");

  const filtered = useMemo(() => {
    return HOLIDAY_PACKAGES.filter((p) => {
      if (typeFilter !== "All" && p.type !== typeFilter) return false;
      if (scope === "domestic" && p.isInternational) return false;
      if (scope === "international" && !p.isInternational) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.destination.toLowerCase().includes(q) && !p.country.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [typeFilter, scope, search]);

  const discountPct = (p: HolidayPackage) => Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);

  const openPay = (p: HolidayPackage) => {
    setDetailPkg(null);
    setPayAmount(p.price);
    setPayTitle(`${p.title} • Holiday Package`);
    setPayOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Holiday Packages"
        subtitle="Curated domestic & international tours with flights, stays, transfers & sightseeing."
        action={
          <Button variant="outline" onClick={() => { setTypeFilter("All"); setScope("all"); setSearch(""); }}>
            Reset Filters
          </Button>
        }
      />

      {/* Filter bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border bg-card p-4 space-y-3"
      >
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by destination, country or package name…"
              className="pl-9 h-10"
            />
          </div>
          <Tabs value={scope} onValueChange={(v) => setScope(v as "all" | "domestic" | "international")}>
            <TabsList className="h-10">
              <TabsTrigger value="all" className="px-3"><Globe className="w-3.5 h-3.5 mr-1" /> All</TabsTrigger>
              <TabsTrigger value="domestic" className="px-3"><Sun className="w-3.5 h-3.5 mr-1" /> Domestic</TabsTrigger>
              <TabsTrigger value="international" className="px-3"><Plane className="w-3.5 h-3.5 mr-1" /> International</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2">
          {PACKAGE_TYPES.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTypeFilter(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-1.5",
                  typeFilter === t.id
                    ? "bg-teal-600 text-white border-teal-600 shadow-sm"
                    : "bg-background hover:border-teal-400 hover:text-teal-700"
                )}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Package grid */}
      {filtered.length === 0 ? (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Palmtree className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No packages match your filters.</p>
          <p className="text-xs mt-1">Try a different destination or category.</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
              >
                <Card className="overflow-hidden hover:shadow-xl transition-shadow group h-full flex flex-col">
                  {/* Image header with gradient */}
                  <div className={cn(
                    "relative h-40 bg-gradient-to-br p-4 text-white flex flex-col justify-between",
                    TYPE_GRADIENTS[p.type] || "from-teal-500 to-emerald-600"
                  )}>
                    <div className="absolute inset-0 opacity-30" style={{
                      backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.2) 0%, transparent 50%)",
                    }} />
                    <div className="relative z-10 flex items-start justify-between">
                      <Badge className="bg-white/25 text-white border-0 backdrop-blur-sm">
                        {p.isInternational ? <Plane className="w-3 h-3 mr-1" /> : <Sun className="w-3 h-3 mr-1" />}
                        {p.type}
                      </Badge>
                      <span className="text-xs font-medium bg-rose-500 text-white px-2 py-0.5 rounded-full">
                        {discountPct(p)}% OFF
                      </span>
                    </div>
                    <div className="relative z-10">
                      <h3 className="text-lg font-bold leading-tight">{p.destination}</h3>
                      <p className="text-xs text-white/85 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" /> {p.country}
                      </p>
                    </div>
                  </div>

                  <CardContent className="p-4 flex flex-col flex-1">
                    <h4 className="font-semibold text-sm leading-tight line-clamp-1">{p.title}</h4>

                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="flex items-center gap-0.5 text-amber-600 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {p.rating}
                      </span>
                      <span className="text-muted-foreground">({p.reviews} reviews)</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1.5">
                      <Clock className="w-3 h-3 text-teal-600" /> {p.duration}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.highlights.slice(0, 2).map((h) => (
                        <span key={h} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                          {h.length > 22 ? h.slice(0, 22) + "…" : h}
                        </span>
                      ))}
                      {p.highlights.length > 2 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">+{p.highlights.length - 2} more</span>
                      )}
                    </div>

                    <Separator className="my-3" />

                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        <p className="text-[10px] text-muted-foreground line-through">{formatFullINR(p.originalPrice)}</p>
                        <p className="text-xl font-bold text-teal-700 dark:text-teal-300">{formatFullINR(p.price)}</p>
                        <p className="text-[10px] text-muted-foreground">per person</p>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setDetailPkg(p)} className="h-7 text-xs">
                          View Details
                        </Button>
                        <Button size="sm" onClick={() => openPay(p)} className="h-7 text-xs bg-teal-600 hover:bg-teal-700">
                          Book Now
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Package detail dialog */}
      <Dialog open={!!detailPkg} onOpenChange={(o) => !o && setDetailPkg(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          {detailPkg && (
            <>
              <div className={cn(
                "relative -m-6 mb-0 h-32 bg-gradient-to-br p-5 text-white flex flex-col justify-end",
                TYPE_GRADIENTS[detailPkg.type] || "from-teal-500 to-emerald-600"
              )}>
                <div className="absolute inset-0 opacity-30" style={{
                  backgroundImage: "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.2) 0%, transparent 50%)",
                }} />
                <div className="relative z-10 flex items-start justify-between">
                  <div>
                    <Badge className="bg-white/25 text-white border-0 backdrop-blur-sm mb-2">
                      {detailPkg.isInternational ? <Plane className="w-3 h-3 mr-1" /> : <Sun className="w-3 h-3 mr-1" />}
                      {detailPkg.type}
                    </Badge>
                    <h2 className="text-2xl font-bold leading-tight">{detailPkg.title}</h2>
                    <p className="text-xs text-white/85 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {detailPkg.destination}, {detailPkg.country} • <Clock className="w-3 h-3 ml-1" /> {detailPkg.duration}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-amber-300 font-semibold">
                      <Star className="w-4 h-4 fill-amber-300 text-amber-300" /> {detailPkg.rating}
                    </div>
                    <p className="text-[10px] text-white/80">{detailPkg.reviews} reviews</p>
                  </div>
                </div>
              </div>

              <div className="overflow-y-auto scroll-thin -mx-1 px-1 space-y-4 mt-2">
                {/* Highlights */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Tour Highlights
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                    {detailPkg.highlights.map((h) => (
                      <div key={h} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inclusions */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600" /> Inclusions
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {detailPkg.inclusions.map((inc) => (
                      <span key={inc} className="text-xs px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                        {inc}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Itinerary */}
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                    <Calendar className="w-4 h-4 text-rose-600" /> Day-by-Day Itinerary
                  </h3>
                  <Accordion type="single" defaultValue="d-1" className="rounded-lg border px-3">
                    {buildItinerary(detailPkg).map((day, idx) => (
                      <AccordionItem key={idx} value={`d-${idx + 1}`}>
                        <AccordionTrigger className="text-sm font-medium hover:no-underline">
                          {day.title}
                        </AccordionTrigger>
                        <AccordionContent className="text-xs text-muted-foreground">
                          {day.desc}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                {/* Price summary */}
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">Original Price</span><span className="line-through text-muted-foreground">{formatFullINR(detailPkg.originalPrice)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="text-emerald-600 font-medium">- {formatFullINR(detailPkg.originalPrice - detailPkg.price)}</span></div>
                  <Separator className="my-1" />
                  <div className="flex justify-between text-sm"><span className="font-semibold">You Pay</span><span className="font-bold text-teal-700 dark:text-teal-300">{formatFullINR(detailPkg.price)} / pax</span></div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailPkg(null)}>Close</Button>
                <Button onClick={() => openPay(detailPkg)} className="bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700">
                  Book This Package • {formatFullINR(detailPkg.price)} <ArrowRight className="w-4 h-4" />
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment */}
      <PaymentModal
        open={payOpen}
        amount={payAmount}
        title={payTitle}
        onClose={() => setPayOpen(false)}
        onSuccess={() => { setPayAmount(0); setPayTitle(""); }}
      />
    </div>
  );
}

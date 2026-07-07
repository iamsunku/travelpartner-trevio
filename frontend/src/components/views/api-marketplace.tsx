"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plane, Hotel, Bus, Train, Search, Check, ExternalLink, Zap, Globe2, PlugZap, ShieldCheck,
} from "lucide-react";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, StatusBadge } from "@/components/shared/ui-helpers";
import { cn } from "@/lib/utils";

interface Vendor {
  id: string;
  name: string;
  description: string;
  pricing: number;
  coverage: string;
  connected: boolean;
  status: "Operational" | "Degraded";
  gradient: string;
  callsToday: number;
}

const VENDOR_GRADIENTS = [
  "from-teal-500 to-emerald-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-orange-500 to-red-600",
];

const FLIGHT_VENDORS: Vendor[] = [
  { id: "amadeus", name: "Amadeus", description: "Global GDS with 700+ airlines, real-time inventory and NDC content.", pricing: 4.5, coverage: "700+ airlines", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[0], callsToday: 18420 },
  { id: "sabre", name: "Sabre", description: "Premium GDS for flight distribution with deep low-cost carrier coverage.", pricing: 4.2, coverage: "400+ airlines", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[1], callsToday: 9320 },
  { id: "travelport", name: "Travelport", description: "Travel commerce platform with Smartpoint integration.", pricing: 3.9, coverage: "400+ airlines", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[2], callsToday: 0 },
  { id: "tbo", name: "TBO Holidays", description: "Aggregator with strong India + MEA inventory and competitive fares.", pricing: 2.5, coverage: "750+ airlines", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[3], callsToday: 22340 },
  { id: "kiwi", name: "Kiwi.com TEQUILA", description: "Self-transfer virtual interlining API with unique low-cost combinations.", pricing: 3.2, coverage: "800+ airlines", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[4], callsToday: 0 },
  { id: "skyscanner", name: "Skyscanner for Business", description: "Meta-search caching layer with affiliate booking flow.", pricing: 5.0, coverage: "1200+ airlines", connected: false, status: "Degraded", gradient: VENDOR_GRADIENTS[5], callsToday: 0 },
];

const HOTEL_VENDORS: Vendor[] = [
  { id: "booking", name: "Booking.com", description: "29M+ property inventory with instant confirmation.", pricing: 6.0, coverage: "29M properties", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[0], callsToday: 12480 },
  { id: "expedia", name: "Expedia Rapid", description: "700K+ properties with member rates and bundles.", pricing: 5.5, coverage: "700K properties", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[1], callsToday: 8210 },
  { id: "agoda", name: "Agoda", description: "Strong APAC coverage with 3.6M+ properties.", pricing: 4.8, coverage: "3.6M properties", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[2], callsToday: 0 },
  { id: "hotelbeds", name: "Hotelbeds", description: "B2B bedbank with 180K+ hotels in 185 countries.", pricing: 4.0, coverage: "180K hotels", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[3], callsToday: 6420 },
  { id: "webbeds", name: "WebBeds", description: "Global bedbank focusing on FIT and group bookings.", pricing: 3.8, coverage: "415K hotels", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[4], callsToday: 0 },
  { id: "desiya", name: "Desiya (GDS)", description: "Domestic India inventory with 18K+ Indian hotels.", pricing: 2.2, coverage: "18K Indian hotels", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[5], callsToday: 0 },
];

const BUS_VENDORS: Vendor[] = [
  { id: "redbus", name: "redBus API", description: "Largest bus inventory in India — 3500+ operators.", pricing: 1.5, coverage: "3500+ operators", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[0], callsToday: 9120 },
  { id: "abhibus", name: "abhibus", description: "Strong South + West India bus network.", pricing: 1.4, coverage: "2500+ operators", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[1], callsToday: 4200 },
  { id: "paytm", name: "Paytm Bus", description: "Bus aggregator with wallet payment flow.", pricing: 1.2, coverage: "2000+ operators", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[2], callsToday: 0 },
  { id: "makemytrip", name: "MakeMyTrip Bus", description: "Curated bus inventory with quality scoring.", pricing: 1.8, coverage: "3000+ operators", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[3], callsToday: 0 },
  { id: "yatra", name: "Yatra Bus", description: "Bus + train combos for intercity travel.", pricing: 1.3, coverage: "1800+ operators", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[4], callsToday: 0 },
  { id: "travelyaari", name: "TravelYaari", description: "Verified operator network with live tracking.", pricing: 1.1, coverage: "1500+ operators", connected: false, status: "Degraded", gradient: VENDOR_GRADIENTS[5], callsToday: 0 },
];

const TRAIN_VENDORS: Vendor[] = [
  { id: "irctc", name: "IRCTC API", description: "Official Indian Railways reservation API via authorized partner.", pricing: 2.0, coverage: "12K+ trains", connected: true, status: "Operational", gradient: VENDOR_GRADIENTS[0], callsToday: 7820 },
  { id: "railrabit", name: "RailRabbit", description: "Aggregated train data with seat availability predictions.", pricing: 1.7, coverage: "12K+ trains", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[1], callsToday: 0 },
  { id: "trainline", name: "Trainline", description: "European rail booking — 270+ operators in 45 countries.", pricing: 3.5, coverage: "270+ operators", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[2], callsToday: 0 },
  { id: "raileurope", name: "Rail Europe", description: "European rail passes and point-to-point tickets.", pricing: 3.0, coverage: "200+ operators", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[3], callsToday: 0 },
  { id: "kvhtrain", name: "KVH Train Connect", description: "Indian Railways PNR + timetable lookup.", pricing: 1.0, coverage: "12K+ trains", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[4], callsToday: 0 },
  { id: "etrain", name: "eTrain.info", description: "Train route + station info with live status.", pricing: 0.8, coverage: "All Indian trains", connected: false, status: "Operational", gradient: VENDOR_GRADIENTS[5], callsToday: 0 },
];

const CATEGORY_TABS = [
  { id: "flights", label: "Flight APIs", icon: Plane, vendors: FLIGHT_VENDORS },
  { id: "hotels", label: "Hotel APIs", icon: Hotel, vendors: HOTEL_VENDORS },
  { id: "bus", label: "Bus APIs", icon: Bus, vendors: BUS_VENDORS },
  { id: "train", label: "Train APIs", icon: Train, vendors: TRAIN_VENDORS },
];

function VendorCard({ vendor, onToggle }: { vendor: Vendor; onToggle: (id: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
      <Card className={cn("relative overflow-hidden h-full transition-shadow hover:shadow-md", vendor.connected && "ring-1 ring-teal-500/40")}>
        <div className={cn("absolute top-0 inset-x-0 h-1 bg-gradient-to-r", vendor.gradient)} />
        <CardContent className="p-4 pt-5 flex flex-col h-full">
          <div className="flex items-start justify-between gap-2">
            <div className={cn("w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-sm shrink-0", vendor.gradient)}>
              {vendor.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge status={vendor.status} className="text-[10px] px-1.5 py-0" />
              {vendor.connected && (
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] px-1.5 py-0">
                  <Check className="w-2.5 h-2.5 mr-0.5" /> Connected
                </Badge>
              )}
            </div>
          </div>

          <h3 className="font-semibold mt-3">{vendor.name}</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{vendor.description}</p>

          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Per Call</p>
              <p className="font-bold text-sm">₹{vendor.pricing.toFixed(2)}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2">
              <p className="text-muted-foreground text-[10px] uppercase tracking-wide">Coverage</p>
              <p className="font-semibold text-xs truncate">{vendor.coverage}</p>
            </div>
          </div>

          {vendor.connected && (
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-500" />
              {vendor.callsToday.toLocaleString("en-IN")} calls today
            </div>
          )}

          <div className="flex items-center gap-2 mt-auto pt-4">
            <Button
              size="sm"
              className={cn(
                "flex-1",
                vendor.connected
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400"
                  : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
              )}
              variant={vendor.connected ? "secondary" : "default"}
              onClick={() => onToggle(vendor.id)}
            >
              {vendor.connected ? (<><Check className="w-3.5 h-3.5 mr-1" /> Connected</>) : (<><PlugZap className="w-3.5 h-3.5 mr-1" /> Connect</>)}
            </Button>
            <Button size="sm" variant="outline" className="px-2.5" onClick={() => {}}>
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="sr-only">View docs</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ApiMarketplaceView() {
  const { toast } = useToast();
  const [tab, setTab] = useState("flights");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [state, setState] = useState<Record<string, Vendor[]>>({
    flights: FLIGHT_VENDORS, hotels: HOTEL_VENDORS, bus: BUS_VENDORS, train: TRAIN_VENDORS,
  });

  const allConnected = useMemo(
    () => Object.values(state).flat().filter((v) => v.connected).length,
    [state]
  );
  const totalCalls = useMemo(
    () => Object.values(state).flat().reduce((s, v) => s + v.callsToday, 0),
    [state]
  );

  function toggle(category: string, id: string) {
    setState((prev) => ({
      ...prev,
      [category]: prev[category].map((v) => v.id === id ? { ...v, connected: !v.connected, callsToday: !v.connected ? 0 : v.callsToday } : v),
    }));
    const v = state[category as keyof typeof state].find((x) => x.id === id);
    toast({ title: v?.connected ? "API disconnected" : "API connected", description: `${v?.name} ${v?.connected ? "removed from" : "added to"} your account.` });
  }

  const activeVendors = state[tab as keyof typeof state] || [];
  const filtered = activeVendors.filter((v) => {
    const s = v.name.toLowerCase().includes(search.toLowerCase()) || v.coverage.toLowerCase().includes(search.toLowerCase());
    const f = filter === "all" || (filter === "connected" && v.connected) || (filter === "available" && !v.connected);
    return s && f;
  });
  const connectedCount = activeVendors.filter((v) => v.connected).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Marketplace"
        subtitle="Connect third-party travel APIs across flights, hotels, buses and trains"
      />

      {/* Summary card */}
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-teal-500/10 blur-3xl translate-x-1/3 -translate-y-1/2" />
        <CardContent className="p-5 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white">
                <PlugZap className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Connected APIs</h3>
                <p className="text-xs text-muted-foreground">Across all categories</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 md:gap-8">
              <div>
                <p className="text-3xl font-bold text-teal-600">{allConnected}</p>
                <p className="text-xs text-muted-foreground">Vendors Connected</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-600">{totalCalls.toLocaleString("en-IN")}</p>
                <p className="text-xs text-muted-foreground">Calls Today</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-emerald-600">{Object.values(state).flat().length}</p>
                <p className="text-xs text-muted-foreground">Available Vendors</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <TabsList className="h-auto">
            {CATEGORY_TABS.map((c) => (
              <TabsTrigger key={c.id} value={c.id} className="flex items-center gap-1.5 py-1.5">
                <c.icon className="w-4 h-4" /> {c.label}
                <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 bg-muted/60">
                  {state[c.id as keyof typeof state].filter((v) => v.connected).length}/{state[c.id as keyof typeof state].length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search vendors..." className="pl-8 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="connected">Connected</SelectItem>
                <SelectItem value="available">Available</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {CATEGORY_TABS.map((c) => (
          <TabsContent key={c.id} value={c.id} className="mt-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {connectedCount} of {activeVendors.length} {c.label.toLowerCase()} connected
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((v) => <VendorCard key={v.id} vendor={v} onToggle={(id) => toggle(c.id, id)} />)}
            </div>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
                <ShieldCheck className="w-10 h-10 mb-2 opacity-40" />
                No vendors match your filters.
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

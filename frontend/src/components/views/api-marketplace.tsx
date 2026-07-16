"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plane, Hotel, Search, Check, ExternalLink, Zap, Globe2, PlugZap, ShieldCheck,
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
import { PageShell, PageHeader, BrandHero, MetricCard, StatusBadge } from "@/components/shared/ui-helpers";
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
  "from-[#2A7BBD] to-[#00A79D]",
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

const CATEGORY_TABS = [
  { id: "flights", label: "Flight APIs", icon: Plane, vendors: FLIGHT_VENDORS },
  { id: "hotels", label: "Hotel APIs", icon: Hotel, vendors: HOTEL_VENDORS },
];

function VendorCard({ vendor, onToggle }: { vendor: Vendor; onToggle: (id: string) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -3 }}>
      <Card className={cn("relative overflow-hidden h-full transition-shadow hover:shadow-sm", vendor.connected && "ring-1 ring-teal-500/40")}>
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
    flights: FLIGHT_VENDORS, hotels: HOTEL_VENDORS,
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
    <PageShell>
      <PageHeader
        title="API Marketplace"
        subtitle="Connect third-party travel APIs across flights, hotels, activities and transfers"
      />

      <BrandHero
        eyebrow="Integrations"
        title="Connected APIs"
        subtitle="Across all categories"
        actions={
          <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
            <div>
              <p className="text-2xl font-bold">{allConnected}</p>
              <p className="text-[11px] text-white/75">Vendors Connected</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCalls.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-white/75">Calls Today</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{Object.values(state).flat().length}</p>
              <p className="text-[11px] text-white/75">Available Vendors</p>
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <MetricCard icon={PlugZap} label="Connected Vendors" value={String(allConnected)} color="bg-sky-100 text-[#2A7BBD] dark:bg-sky-500/15 dark:text-sky-400" index={0} />
        <MetricCard icon={Zap} label="Calls Today" value={totalCalls.toLocaleString("en-IN")} color="bg-teal-100 text-[#00A79D] dark:bg-teal-500/15 dark:text-teal-400" index={1} />
        <MetricCard icon={Globe2} label="Available Vendors" value={String(Object.values(state).flat().length)} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400" index={2} />
      </div>

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
    </PageShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/shared/ui-helpers";
import { ContractedRatesDialog, type ProductRateType } from "@/components/shared/contracted-rates-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/app-store";

const PATHS: Record<ProductRateType, string> = {
  HOTEL: "/api/products/hotels",
  TRANSFER: "/api/products/transfers",
  ACTIVITY: "/api/products/activities",
  MEAL: "/api/products/meals",
  FLIGHT: "/api/products/flights",
};

type Item = { id: string; name: string; status?: string; city?: string; airline?: string; origin?: string };

export function ContractedRatesView() {
  const { toast } = useToast();
  const role = useAuthStore((s) => s.user?.role);
  const [type, setType] = useState<ProductRateType>("HOTEL");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("All");
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [flight, setFlight] = useState({ name: "", airline: "", flightNumber: "", origin: "", destinationAirport: "", cabinClass: "Economy" });

  useEffect(() => {
    const params = new URLSearchParams({ pageSize: "30", ...(q ? { q } : {}), ...(city ? { city } : {}), ...(status !== "All" ? { status } : {}) });
    apiFetch<{ items: Item[] }>(`${PATHS[type]}?${params}`)
      .then((data) => setItems(data.items || []))
      .catch(() => setItems([]));
  }, [type, q, city, status]);

  if (role === "travel_agent") {
    return <PageShell><p className="text-sm text-muted-foreground">Rate management is internal only.</p></PageShell>;
  }

  async function createFlight() {
    try {
      await apiFetch("/api/products/flights", { method: "POST", body: JSON.stringify(flight) });
      setFlight({ name: "", airline: "", flightNumber: "", origin: "", destinationAirport: "", cabinClass: "Economy" });
      setQ(flight.name);
      toast({ title: "Internal flight product created. Add a contracted rate next." });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : "Could not create flight", variant: "destructive" });
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Contracted rates"
        subtitle="Catalogue products keep their details. Contracted cost is a separate rate with an explicit validity period."
      />
      <div className="grid sm:grid-cols-4 gap-2 mb-4">
        <Select value={type} onValueChange={(v) => setType(v as ProductRateType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="HOTEL">Hotels</SelectItem>
            <SelectItem value="TRANSFER">Transfers</SelectItem>
            <SelectItem value="ACTIVITY">Activities</SelectItem>
            <SelectItem value="MEAL">Meals</SelectItem>
            <SelectItem value="FLIGHT">Internal flights</SelectItem>
          </SelectContent>
        </Select>
        <Input placeholder="Search name" value={q} onChange={(e) => setQ(e.target.value)} />
        <Input placeholder="City / origin" value={city} onChange={(e) => setCity(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Archived">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-lg border divide-y">
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No products match these filters.</p>}
        {items.map((item) => (
          <div key={item.id} className="p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.city || item.origin || "—"} · {item.status || "Active"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setSelected(item)}>Rates</Button>
          </div>
        ))}
      </div>
      {type === "FLIGHT" && (
        <div className="mt-6 rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Add internal contracted flight</p>
          <p className="text-xs text-muted-foreground">Amadeus search and manual employee flight entry stay available on quotations. This is only the internal catalogue product.</p>
          <div className="grid sm:grid-cols-3 gap-2">
            <Input placeholder="Name" value={flight.name} onChange={(e) => setFlight({ ...flight, name: e.target.value })} />
            <Input placeholder="Airline" value={flight.airline} onChange={(e) => setFlight({ ...flight, airline: e.target.value })} />
            <Input placeholder="Flight number" value={flight.flightNumber} onChange={(e) => setFlight({ ...flight, flightNumber: e.target.value })} />
            <Input placeholder="Origin" value={flight.origin} onChange={(e) => setFlight({ ...flight, origin: e.target.value })} />
            <Input placeholder="Destination" value={flight.destinationAirport} onChange={(e) => setFlight({ ...flight, destinationAirport: e.target.value })} />
            <Input placeholder="Cabin" value={flight.cabinClass} onChange={(e) => setFlight({ ...flight, cabinClass: e.target.value })} />
          </div>
          <Button size="sm" onClick={createFlight}>Create flight product</Button>
        </div>
      )}
      {selected && (
        <ContractedRatesDialog
          open={Boolean(selected)}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
          productType={type}
          productId={selected.id}
          productName={selected.name}
        />
      )}
    </PageShell>
  );
}

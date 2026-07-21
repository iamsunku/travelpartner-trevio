"use client";

import { useState, useEffect } from "react";
import { ProductCatalog, DestinationNameCell } from "@/components/shared/product-catalog";
import { PageHeader, SectionHeader, StatusBadge } from "@/components/shared/ui-helpers";
import type { ProductRecord } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info } from "lucide-react";

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£",
  SGD: "S$",
  AUD: "A$",
  CAD: "C$",
  JPY: "¥",
  CNY: "¥",
};

function ApprovalStatusBadge(item: ProductRecord) {
  const status = String(item.approvalStatus || "Draft");
  const mapped =
    status === "Approved" ? "Active" :
    status === "Pending" ? "Pending" :
    status === "Rejected" ? "Cancelled" :
    "Draft";
  return <StatusBadge status={mapped} />;
}

function ActivityPriceDisplay(item: ProductRecord) {
  const currency = String(item.currency || "INR");
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const price = Number(item.adultPrice ?? 0);
  return `${symbol}${price.toLocaleString("en-IN")}`;
}

function TransferPriceDisplay(item: ProductRecord) {
  const currency = String(item.currency || "INR");
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  const privatePrice = Number(item.privatePrice ?? 0);
  const sharedPrice = Number(item.sharedPrice ?? 0);

  if (privatePrice && sharedPrice) {
    return `${symbol}${privatePrice.toLocaleString("en-IN")} / ${symbol}${sharedPrice.toLocaleString("en-IN")}`;
  }
  if (privatePrice) {
    return `${symbol}${privatePrice.toLocaleString("en-IN")}`;
  }
  if (sharedPrice) {
    return `${symbol}${sharedPrice.toLocaleString("en-IN")}`;
  }
  return "—";
}

export function ActivityPackagesView() {
  const [activeTab, setActiveTab] = useState("activities");

  useEffect(() => {
    const tab = new URLSearchParams(window.location.search).get("tab");
    if (tab === "transfers" || tab === "activities") setActiveTab(tab);
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities & Experiences"
        subtitle="Manage tours, activities, and bundled packages with transfers"
      />

      <Alert className="border-border/80">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Bundle Packages:</strong> Create complete travel experiences by combining activities with transfers. Agents can select ticket-only, transfer-only, or complete packages when booking.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        <TabsContent value="activities" className="mt-6">
          <ProductCatalog
            title="Activities & Experiences"
            subtitle="Manage tour experiences, pricing, and availability"
            kind="activities"
            apiPath="/api/products/activities"
            columns={[
              { key: "name", label: "Activity" },
              { key: "destination", label: "Destination", render: (i) => <DestinationNameCell item={i} /> },
              { key: "location", label: "Location" },
              { key: "duration", label: "Duration" },
              { key: "adultPrice", label: "Adult Price", render: ActivityPriceDisplay },
              { key: "currency", label: "Currency" },
              { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
            ]}
          />
        </TabsContent>

        <TabsContent value="transfers" className="mt-6">
          <ProductCatalog
            title="Transfers"
            subtitle="Manage private and shared transfers with vehicle-based pricing"
            kind="transfers"
            apiPath="/api/products/transfers"
            columns={[
              { key: "name", label: "Transfer" },
              { key: "destination", label: "Destination", render: (i) => <DestinationNameCell item={i} /> },
              { key: "transferType", label: "Type" },
              { key: "pickupLocation", label: "Pickup" },
              { key: "dropLocation", label: "Drop" },
              { key: "vehicleType", label: "Vehicle" },
              { key: "privatePrice", label: "Price", render: TransferPriceDisplay },
              { key: "currency", label: "Currency" },
              { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
            ]}
          />
        </TabsContent>
      </Tabs>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="pb-2">
          <SectionHeader title="How to Create Bundles" description="Step-by-step guide for packaging activities with transfers" />
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">1. Create Your Activity</p>
            <p>Add a tour or activity with pricing and details. Submit for approval.</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">2. Create Transfer Option</p>
            <p>Add a private or shared transfer with pickup/drop locations and pricing.</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">3. Bundle in Quotations</p>
            <p>When creating a quotation, select the activity and optional transfer together to create a complete package.</p>
          </div>
          <div className="space-y-2">
            <p className="font-medium text-foreground">4. Agent Booking Options</p>
            <p>Agents can book:</p>
            <ul className="ml-4 space-y-1 list-disc">
              <li>Activity only (ticket)</li>
              <li>Transfer only (transport)</li>
              <li>Activity + Transfer (complete experience)</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

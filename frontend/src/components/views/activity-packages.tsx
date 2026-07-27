"use client";

import { useState } from "react";
import { ProductCatalog, DestinationNameCell } from "@/components/shared/product-catalog";
import { ActivityBookingPicker } from "@/components/shared/activity-booking-picker";
import { PageHeader, SectionHeader, StatusBadge } from "@/components/shared/ui-helpers";
import type { ProductRecord } from "@/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Info } from "lucide-react";

import { Info } from "lucide-react";
import { formatActivityPrice, formatProductPrice, formatTransferPrice, normalizeCurrency } from "@/lib/currency";

function ApprovalStatusBadge(item: ProductRecord) {
  const status = String(item.approvalStatus || "Draft");
  const mapped =
    status === "Approved" ? "Active" :
    status === "Pending" ? "Pending" :
    status === "Rejected" ? "Cancelled" :
    "Draft";
  return <StatusBadge status={mapped} />;
}

export function ActivityPackagesView() {
  const [activeTab, setActiveTab] = useState("book");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activities & Experiences"
        subtitle="Book ticket-only or activity + transfer bundles — transfers are linked to activities, not booked separately"
      />

      <Alert className="border-border">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How it works:</strong> Product team creates transfer products and links them to each activity. Agents then choose <em>Ticket Only</em> or add a bundled transfer on the same activity card.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="book">Book Activities</TabsTrigger>
          <TabsTrigger value="activities">Activity Catalog</TabsTrigger>
          <TabsTrigger value="transfers">Transfer Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="book" className="mt-6">
          <ActivityBookingPicker />
        </TabsContent>

        <TabsContent value="activities" className="mt-6">
          <ProductCatalog
            title="Activities & Experiences"
            subtitle="Manage tour experiences, link optional transfers, and submit for approval"
            kind="activities"
            apiPath="/api/products/activities"
            columns={[
              { key: "name", label: "Activity Name" },
              { key: "destination", label: "Destination", render: (i) => <DestinationNameCell item={i} /> },
              { key: "duration", label: "Duration" },
              { key: "adultPrice", label: "Adult Price", render: (i) => formatActivityPrice(i) },
              { key: "childPrice", label: "Child Price", render: (i) => formatProductPrice(Number(i.childPrice ?? 0), i.currency as string) },
              { key: "currency", label: "Currency", render: (i) => normalizeCurrency(i.currency as string) },
              { key: "rateValidTo", label: "Validity", render: (i) => String(i.rateValidTo || "—") },
              { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
            ]}
          />
        </TabsContent>

        <TabsContent value="transfers" className="mt-6">
          <ProductCatalog
            title="Transfer Inventory"
            subtitle="Create transfer products here, then link them to activities — agents never book transfers as a separate step"
            kind="transfers"
            apiPath="/api/products/transfers"
            columns={[
              { key: "name", label: "Transfer" },
              { key: "transferType", label: "Shared/Private" },
              { key: "vehicleType", label: "Vehicle Type" },
              { key: "destination", label: "Destination", render: (i) => <DestinationNameCell item={i} /> },
              { key: "privatePrice", label: "Price", render: (i) => formatTransferPrice(i) },
              { key: "currency", label: "Currency", render: (i) => normalizeCurrency(i.currency as string) },
              { key: "rateValidTo", label: "Validity", render: (i) => String(i.rateValidTo || "—") },
              { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
            ]}
          />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-2">
          <SectionHeader title="Agent booking flow" description="Matches ticket-only vs activity + transfer selection" />
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Product team adds activities and transfer inventory for the same destination.</p>
          <p>2. In the activity form, link one or more transfers (e.g. Private Car 2-way).</p>
          <p>3. Agents open <strong>Book Activities</strong> and pick Ticket Only or bundled transfer on each tour.</p>
        </CardContent>
      </Card>
    </div>
  );
}

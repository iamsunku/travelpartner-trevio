"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";

export function ActivitiesView() {
  return (
    <ProductCatalog
      title="Activities"
      subtitle="Manage tours, experiences, pricing, and blackout dates"
      kind="activities"
      apiPath="/api/products/activities"
      columns={[
        { key: "name", label: "Activity" },
        { key: "location", label: "Location" },
        { key: "duration", label: "Duration" },
        { key: "adultPrice", label: "Adult Price", render: (i) => `₹${Number(i.adultPrice ?? 0).toLocaleString("en-IN")}` },
        { key: "currency", label: "Currency" },
      ]}
    />
  );
}

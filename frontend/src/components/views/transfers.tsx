"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";

export function TransfersView() {
  return (
    <ProductCatalog
      title="Transfers"
      subtitle="Manage private and shared transfers with vehicle-based pricing"
      kind="transfers"
      apiPath="/api/products/transfers"
      columns={[
        { key: "name", label: "Transfer" },
        { key: "transferType", label: "Type" },
        { key: "pickupLocation", label: "Pickup" },
        { key: "dropLocation", label: "Drop" },
        { key: "vehicleType", label: "Vehicle" },
      ]}
    />
  );
}

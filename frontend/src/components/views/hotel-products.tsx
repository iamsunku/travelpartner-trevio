"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";
import { StatusBadge } from "@/components/shared/ui-helpers";
import type { ProductRecord } from "@/types";

function ApprovalStatusBadge(item: ProductRecord) {
  const status = String(item.approvalStatus || "Draft");
  const mapped =
    status === "Approved" ? "Active" :
    status === "Pending" ? "Pending" :
    status === "Rejected" ? "Cancelled" :
    "Draft";
  return <StatusBadge status={mapped} />;
}

export function HotelProductsView() {
  return (
    <ProductCatalog
      title="Hotel Products"
      subtitle="Manage hotel inventory, room categories, pricing, and availability. Submit rates for approval before going live."
      kind="hotels"
      apiPath="/api/products/hotels"
      columns={[
        { key: "name", label: "Hotel Name" },
        { key: "city", label: "City" },
        { key: "country", label: "Country" },
        { key: "starCategory", label: "Stars", render: (i) => `${i.starCategory ?? 3}★` },
        { key: "currency", label: "Currency" },
        { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
      ]}
    />
  );
}

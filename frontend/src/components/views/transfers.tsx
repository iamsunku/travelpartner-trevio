"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";
import { Badge } from "@/components/ui/badge";
import { formatTransferPrice, normalizeCurrency } from "@/lib/currency";
import type { ProductRecord } from "@/types";

function ApprovalStatusBadge(item: ProductRecord) {
  const status = item.approvalStatus || "Draft";
  const badgeColor: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-800",
    Pending: "bg-yellow-100 text-yellow-800",
    Approved: "bg-green-100 text-green-800",
    Rejected: "bg-red-100 text-red-800",
  };
  return (
    <Badge className={badgeColor[status] || "bg-gray-100 text-gray-800"}>
      {status}
    </Badge>
  );
}

export function TransfersView() {
  return (
    <ProductCatalog
      title="Transfers"
      subtitle="Manage private and shared transfers with vehicle-based pricing. Submit rates for approval before going live."
      kind="transfers"
      apiPath="/api/products/transfers"
      columns={[
        { key: "name", label: "Transfer" },
        { key: "transferType", label: "Type" },
        { key: "pickupLocation", label: "Pickup" },
        { key: "dropLocation", label: "Drop" },
        { key: "vehicleType", label: "Vehicle" },
        { key: "privatePrice", label: "Price", render: (item) => formatTransferPrice(item) },
        { key: "currency", label: "Currency", render: (item) => normalizeCurrency(item.currency as string) },
        { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
      ]}
    />
  );
}

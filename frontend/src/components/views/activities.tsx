"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";
import { Badge } from "@/components/ui/badge";

function ApprovalStatusBadge(item: any) {
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

export function ActivitiesView() {
  return (
    <ProductCatalog
      title="Activities & Experiences"
      subtitle="Manage tours, experiences, pricing, and blackout dates. Submit rates for approval before going live."
      kind="activities"
      apiPath="/api/products/activities"
      columns={[
        { key: "name", label: "Activity" },
        { key: "location", label: "Location" },
        { key: "duration", label: "Duration" },
        { key: "adultPrice", label: "Adult Price", render: (i) => `₹${Number(i.adultPrice ?? 0).toLocaleString("en-IN")}` },
        { key: "currency", label: "Currency" },
        { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
      ]}
    />
  );
}

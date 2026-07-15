"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";
import { Badge } from "@/components/ui/badge";

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
  AED: "د.إ",
  SAR: "﷼",
  QAR: "﷼",
};

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

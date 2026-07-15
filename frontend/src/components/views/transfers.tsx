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

function PriceDisplay(item: any) {
  const currency = item.currency || "INR";
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
        { key: "privatePrice", label: "Price", render: PriceDisplay },
        { key: "currency", label: "Currency" },
        { key: "approvalStatus", label: "Approval", render: ApprovalStatusBadge },
      ]}
    />
  );
}

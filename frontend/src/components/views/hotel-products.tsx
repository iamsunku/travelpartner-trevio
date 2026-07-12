"use client";

import { ProductCatalog } from "@/components/shared/product-catalog";

export function HotelProductsView() {
  return (
    <ProductCatalog
      title="Hotel Products"
      subtitle="Manage hotel inventory, room categories, pricing, and availability"
      kind="hotels"
      apiPath="/api/products/hotels"
      columns={[
        { key: "name", label: "Hotel Name" },
        { key: "city", label: "City" },
        { key: "country", label: "Country" },
        { key: "starCategory", label: "Stars", render: (i) => `${i.starCategory ?? 3}★` },
        { key: "currency", label: "Currency" },
      ]}
    />
  );
}

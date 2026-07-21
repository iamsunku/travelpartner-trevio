"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageCatalog } from "@/components/shared/package-catalog";
import { PackageDetail } from "@/components/shared/package-detail";

function getPackageIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("packageId");
}

function setPackageIdInUrl(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("packageId", id);
  else url.searchParams.delete("packageId");
  window.history.replaceState({}, "", url.toString());
}

export function PackagesView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  useEffect(() => { setSelectedId(getPackageIdFromUrl()); }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setPackageIdInUrl(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setPackageIdInUrl(null);
  }, []);

  const handleRefreshList = useCallback(() => { setListKey((k) => k + 1); }, []);

  if (selectedId) {
    return <PackageDetail packageId={selectedId} onBack={handleBack} onRefreshList={handleRefreshList} />;
  }

  return <PackageCatalog key={listKey} onSelect={handleSelect} />;
}

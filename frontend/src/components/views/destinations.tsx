"use client";

import { useCallback, useEffect, useState } from "react";
import { DestinationCatalog } from "@/components/shared/destination-catalog";
import { DestinationDetail } from "@/components/shared/destination-detail";

function getDestinationIdFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("destinationId");
}

function setDestinationIdInUrl(id: string | null) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("destinationId", id);
  else url.searchParams.delete("destinationId");
  window.history.replaceState({}, "", url.toString());
}

export function DestinationsView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  useEffect(() => {
    setSelectedId(getDestinationIdFromUrl());
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setDestinationIdInUrl(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedId(null);
    setDestinationIdInUrl(null);
  }, []);

  const handleRefreshList = useCallback(() => {
    setListKey((k) => k + 1);
  }, []);

  if (selectedId) {
    return (
      <DestinationDetail
        destinationId={selectedId}
        onBack={handleBack}
        onRefreshList={handleRefreshList}
      />
    );
  }

  return <DestinationCatalog key={listKey} onSelect={handleSelect} />;
}

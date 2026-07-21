"use client";

import { useCallback, useEffect, useState } from "react";
import { TravelProposalCatalog } from "@/components/shared/travel-proposal-catalog";
import { TravelProposalDetail } from "@/components/shared/travel-proposal-detail";

function getParam(key: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(key);
}

function setParams(updates: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [k, v] of Object.entries(updates)) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  window.history.replaceState({}, "", url.toString());
}

export function TravelProposalsView() {
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "detail">("list");

  useEffect(() => {
    const id = getParam("proposalId");
    if (id) {
      setProposalId(id);
      setMode("detail");
    } else {
      setProposalId(null);
      setMode("list");
    }
  }, []);

  const goList = useCallback(() => {
    setMode("list");
    setProposalId(null);
    setParams({ proposalId: null });
  }, []);

  const goDetail = useCallback((id: string) => {
    setProposalId(id);
    setMode("detail");
    setParams({ proposalId: id });
  }, []);

  if (mode === "detail" && proposalId) {
    return <TravelProposalDetail proposalId={proposalId} onBack={goList} />;
  }

  return <TravelProposalCatalog onSelect={goDetail} />;
}

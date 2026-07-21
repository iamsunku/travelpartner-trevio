"use client";

import { useCallback, useEffect, useState } from "react";
import { TripPlannerCatalog } from "@/components/shared/trip-planner-catalog";
import { TripPlannerWorkspace } from "@/components/shared/trip-planner-workspace";
import { TripRequirementDetail } from "@/components/shared/trip-requirement-detail";

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

export function TripPlannerView() {
  const [requirementId, setRequirementId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "edit" | "detail">("list");

  useEffect(() => {
    const id = getParam("requirementId");
    const isNew = getParam("new");
    if (id) {
      setRequirementId(id);
      setMode(getParam("edit") ? "edit" : "detail");
    } else if (isNew) {
      setRequirementId(null);
      setMode("create");
    } else {
      setRequirementId(null);
      setMode("list");
    }
  }, []);

  const goList = useCallback(() => {
    setMode("list");
    setRequirementId(null);
    setParams({ requirementId: null, new: null, edit: null });
  }, []);

  const goCreate = useCallback(() => {
    setMode("create");
    setRequirementId(null);
    setParams({ requirementId: null, new: "1", edit: null });
  }, []);

  const goDetail = useCallback((id: string) => {
    setRequirementId(id);
    setMode("detail");
    setParams({ requirementId: id, new: null, edit: null });
  }, []);

  const goEdit = useCallback((id: string) => {
    setRequirementId(id);
    setMode("edit");
    setParams({ requirementId: id, new: null, edit: "1" });
  }, []);

  if (mode === "create" || mode === "edit") {
    return (
      <TripPlannerWorkspace
        requirementId={mode === "edit" ? requirementId : null}
        onBack={goList}
        onSaved={(id) => goDetail(id)}
      />
    );
  }

  if (mode === "detail" && requirementId) {
    return (
      <TripRequirementDetail
        requirementId={requirementId}
        onBack={goList}
        onEdit={() => goEdit(requirementId)}
      />
    );
  }

  return (
    <TripPlannerCatalog
      onCreate={goCreate}
      onSelect={goDetail}
    />
  );
}

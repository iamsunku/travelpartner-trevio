"use client";

import { useCallback, useEffect, useState } from "react";
import { QuoteTemplateCatalog } from "@/components/shared/quote-template-catalog";
import { QuoteTemplateDetail } from "@/components/shared/quote-template-detail";
import { QuoteTemplateWorkspace } from "@/components/shared/quote-template-workspace";

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

export function QuoteTemplatesView() {
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "detail">("list");

  useEffect(() => {
    const id = getParam("templateId");
    const isNew = getParam("new");
    if (id) {
      setTemplateId(id);
      setMode("detail");
    } else if (isNew) {
      setTemplateId(null);
      setMode("create");
    } else {
      setTemplateId(null);
      setMode("list");
    }
  }, []);

  const goList = useCallback(() => {
    setMode("list");
    setTemplateId(null);
    setParams({ templateId: null, new: null });
  }, []);

  const goCreate = useCallback(() => {
    setMode("create");
    setTemplateId(null);
    setParams({ templateId: null, new: "1" });
  }, []);

  const goDetail = useCallback((id: string) => {
    setTemplateId(id);
    setMode("detail");
    setParams({ templateId: id, new: null });
  }, []);

  if (mode === "create") {
    return <QuoteTemplateWorkspace onBack={goList} onSaved={goDetail} />;
  }

  if (mode === "detail" && templateId) {
    return <QuoteTemplateDetail templateId={templateId} onBack={goList} />;
  }

  return (
    <QuoteTemplateCatalog
      onCreate={goCreate}
      onSelect={goDetail}
    />
  );
}

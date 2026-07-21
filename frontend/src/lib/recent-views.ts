import type { ViewKey } from "@/types";

const STORAGE_KEY = "tpp-recent-views";
const MAX = 8;

export interface RecentViewEntry {
  key: ViewKey;
  label: string;
  ts: number;
}

export function getRecentViews(): RecentViewEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentViewEntry[];
  } catch {
    return [];
  }
}

export function pushRecentView(key: ViewKey, label: string) {
  if (typeof window === "undefined") return;
  const prev = getRecentViews().filter((e) => e.key !== key);
  const next = [{ key, label, ts: Date.now() }, ...prev].slice(0, MAX);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

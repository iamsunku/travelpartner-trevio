import type { ViewKey } from "@/types";
import { Plus, User, Target, MapPin, FileSpreadsheet, Layers } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface QuickCreateAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  view: ViewKey;
  /** URL params to set when navigating */
  params?: Record<string, string>;
}

export const QUICK_CREATE_ACTIONS: QuickCreateAction[] = [
  {
    id: "customer",
    label: "New Customer",
    description: "Add a customer record",
    icon: User,
    view: "customers",
  },
  {
    id: "lead",
    label: "New Lead",
    description: "Create CRM enquiry",
    icon: Target,
    view: "crm",
  },
  {
    id: "trip",
    label: "New Trip Requirement",
    description: "Open Trip Planner",
    icon: MapPin,
    view: "trip-planner",
    params: { new: "1" },
  },
  {
    id: "proposal",
    label: "Travel Proposals",
    description: "View or create from Trip Planner",
    icon: FileSpreadsheet,
    view: "travel-proposals",
  },
  {
    id: "package",
    label: "New Package",
    description: "Package Builder wizard",
    icon: Layers,
    view: "packages",
    params: { new: "1" },
  },
];

export function applyQuickCreateParams(view: ViewKey, params?: Record<string, string>) {
  if (typeof window === "undefined" || !params) return;
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  window.history.replaceState({}, "", url.toString());
}

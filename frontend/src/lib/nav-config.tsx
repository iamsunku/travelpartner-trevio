"use client";

import {
  LayoutDashboard, Plane, Hotel, Palmtree, MapPin, Car, Package, Globe, Layers,
  Users, Target, FileSpreadsheet, Ticket, CreditCard, Wallet, Percent,
  BarChart3, UserCog, CheckSquare, LifeBuoy, Bell, Megaphone, LayoutGrid,
  Receipt, KeyRound, Settings, History, Building2, GitBranch, Store,
  Activity, LineChart, CalendarCheck, CheckCircle, Palette, FileText, type LucideIcon,
} from "lucide-react";
import type { Module, Role, User, ViewKey } from "@/types";
import { hasPermission } from "@/lib/permissions";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  module?: Module; // omitted for views everyone can always reach (e.g. dashboard)
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    title: "Bookings",
    items: [
      { key: "flights", label: "Flights", icon: Plane, module: "flights" },
      { key: "hotels", label: "Hotels", icon: Hotel, module: "hotels" },
      { key: "holiday", label: "Holiday Packages", icon: Palmtree, module: "holiday" },
      { key: "bookings", label: "Booking Management", icon: Ticket, module: "bookings" },
    ],
  },
  {
    title: "Products",
    items: [
      { key: "destinations", label: "Destinations", icon: Globe, module: "destinations" },
      { key: "hotel-products", label: "Hotels", icon: Hotel, module: "hotels" },
      { key: "activity-packages", label: "Activities & Transfers", icon: MapPin, module: "activities" },
      { key: "packages", label: "Packages", icon: Layers, module: "packages" },
      { key: "product-approvals", label: "Rate Approvals", icon: CheckCircle, module: "activities" },
    ],
  },
  {
    title: "Sales & CRM",
    items: [
      { key: "crm", label: "CRM / Leads", icon: Target, module: "crm" },
      { key: "customers", label: "Customers", icon: Users, module: "customers" },
      { key: "trip-planner", label: "Trip Planner", icon: MapPin, module: "trip-planner" },
      { key: "travel-proposals", label: "Travel Proposals", icon: FileSpreadsheet, module: "travel-proposals" },
      { key: "quotations", label: "Quotations", icon: FileSpreadsheet, module: "quotations" },
    ],
  },
  {
    title: "Finance",
    items: [
      { key: "payments", label: "Payments", icon: CreditCard, module: "payments" },
      { key: "wallet", label: "Wallet", icon: Wallet, module: "wallet" },
      { key: "commission", label: "Commission", icon: Percent, module: "commission" },
      { key: "finance", label: "Finance / GST", icon: Receipt, module: "finance" },
    ],
  },
  {
    title: "Insights",
    items: [
      { key: "reports", label: "Reports & Analytics", icon: BarChart3, module: "reports" },
      { key: "analytics", label: "Platform Analytics", icon: LineChart, module: "analytics" },
    ],
  },
  {
    title: "Team & Ops",
    items: [
      { key: "employees", label: "Employees", icon: UserCog, module: "employees" },
      { key: "attendance", label: "Attendance & Leave", icon: CalendarCheck, module: "attendance" },
      { key: "tasks", label: "Task Management", icon: CheckSquare, module: "tasks" },
      { key: "support", label: "Support", icon: LifeBuoy, module: "support" },
      { key: "notifications", label: "Notifications", icon: Bell, module: "notifications", badge: "3" },
    ],
  },
  {
    title: "Settings",
    items: [
      { key: "branding", label: "Branding", icon: Palette, module: "quote-templates" },
      { key: "quote-templates", label: "Quote Templates", icon: FileText, module: "quote-templates" },
    ],
  },
  {
    title: "Platform",
    items: [
      { key: "agencies", label: "Agency Management", icon: Building2, module: "agencies" },
      { key: "branches", label: "Branches", icon: GitBranch, module: "branches" },
      { key: "api-marketplace", label: "API Marketplace", icon: Store, module: "api-marketplace" },
      { key: "api-management", label: "API Management", icon: KeyRound, module: "api-management" },
      { key: "monitoring", label: "Monitoring", icon: Activity, module: "monitoring" },
      { key: "marketing", label: "Marketing", icon: Megaphone, module: "marketing" },
      { key: "cms", label: "CMS", icon: LayoutGrid, module: "cms" },
      { key: "audit-logs", label: "Audit Logs", icon: History, module: "audit-logs" },
      { key: "settings", label: "Settings", icon: Settings, module: "settings" },
    ],
  },
];

export function getNavForUser(user: Pick<User, "role" | "permissions">): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.module || hasPermission(user, item.module)),
  })).filter((section) => section.items.length > 0);
}

export function canAccessView(user: Pick<User, "role" | "permissions">, view: ViewKey): boolean {
  return NAV_SECTIONS.some((section) =>
    section.items.some((item) => item.key === view && (!item.module || hasPermission(user, item.module)))
  );
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  agency_admin: "Admin",
  branch_manager: "Branch Manager",
  employee: "Employee / Agent",
  accountant: "Finance",
  sales_executive: "Sales Executive",
  product_executive: "Product Executive",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Platform owner — manage all agencies, APIs & billing",
  agency_admin: "Agency owner — full control of your travel agency",
  branch_manager: "Manage a branch — oversee staff & approvals",
  employee: "Travel consultant — handle bookings & leads",
  accountant: "Finance staff — payments, GST & settlements",
  sales_executive: "Sales team — customers, quotations & bookings",
  product_executive: "Product team — manage hotels, activities & transfers",
};

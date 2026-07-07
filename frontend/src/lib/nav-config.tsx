"use client";

import {
  LayoutDashboard, Plane, Hotel, Bus, Train, Palmtree, FileText, Shield,
  Users, Target, FileSpreadsheet, Ticket, CreditCard, Wallet, Percent,
  BarChart3, UserCog, CheckSquare, LifeBuoy, Bell, Megaphone, LayoutGrid,
  Receipt, KeyRound, Settings, History, Building2, GitBranch, Store,
  Activity, type LucideIcon,
} from "lucide-react";
import type { Role, ViewKey } from "@/types";

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: Role[] = ["super_admin", "agency_admin", "branch_manager", "employee", "accountant"];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
    ],
  },
  {
    title: "Bookings",
    items: [
      { key: "flights", label: "Flights", icon: Plane, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "hotels", label: "Hotels", icon: Hotel, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "bus", label: "Bus", icon: Bus, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "train", label: "Train", icon: Train, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "holiday", label: "Holiday Packages", icon: Palmtree, roles: ALL },
      { key: "visa", label: "Visa", icon: FileText, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "insurance", label: "Insurance", icon: Shield, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "bookings", label: "Booking Management", icon: Ticket, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
    ],
  },
  {
    title: "Sales & CRM",
    items: [
      { key: "crm", label: "CRM / Leads", icon: Target, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "customers", label: "Customers", icon: Users, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "quotations", label: "Quotations", icon: FileSpreadsheet, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
    ],
  },
  {
    title: "Finance",
    items: [
      { key: "payments", label: "Payments", icon: CreditCard, roles: ["super_admin", "agency_admin", "branch_manager", "employee", "accountant"] },
      { key: "wallet", label: "Wallet", icon: Wallet, roles: ["super_admin", "agency_admin", "accountant"] },
      { key: "commission", label: "Commission", icon: Percent, roles: ["super_admin", "agency_admin", "accountant"] },
      { key: "finance", label: "Finance / GST", icon: Receipt, roles: ["super_admin", "agency_admin", "accountant"] },
    ],
  },
  {
    title: "Insights",
    items: [
      { key: "reports", label: "Reports & Analytics", icon: BarChart3, roles: ["super_admin", "agency_admin", "branch_manager", "employee", "accountant"] },
    ],
  },
  {
    title: "Team & Ops",
    items: [
      { key: "employees", label: "Employees", icon: UserCog, roles: ["super_admin", "agency_admin", "branch_manager"] },
      { key: "tasks", label: "Task Management", icon: CheckSquare, roles: ["super_admin", "agency_admin", "branch_manager", "employee"] },
      { key: "support", label: "Support", icon: LifeBuoy, roles: ALL },
      { key: "notifications", label: "Notifications", icon: Bell, roles: ALL, badge: "3" },
    ],
  },
  {
    title: "Platform",
    items: [
      { key: "agencies", label: "Agency Management", icon: Building2, roles: ["super_admin"] },
      { key: "branches", label: "Branches", icon: GitBranch, roles: ["super_admin", "agency_admin"] },
      { key: "api-marketplace", label: "API Marketplace", icon: Store, roles: ["super_admin"] },
      { key: "api-management", label: "API Management", icon: KeyRound, roles: ["super_admin", "agency_admin"] },
      { key: "monitoring", label: "Monitoring", icon: Activity, roles: ["super_admin"] },
      { key: "marketing", label: "Marketing", icon: Megaphone, roles: ["super_admin", "agency_admin"] },
      { key: "cms", label: "CMS", icon: LayoutGrid, roles: ["super_admin", "agency_admin"] },
      { key: "audit-logs", label: "Audit Logs", icon: History, roles: ["super_admin", "agency_admin"] },
      { key: "settings", label: "Settings", icon: Settings, roles: ["super_admin", "agency_admin"] },
    ],
  },
];

export function getNavForRole(role: Role): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  agency_admin: "Agency Admin",
  branch_manager: "Branch Manager",
  employee: "Employee / Agent",
  accountant: "Accountant",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Platform owner — manage all agencies, APIs & billing",
  agency_admin: "Agency owner — full control of your travel agency",
  branch_manager: "Manage a branch — oversee staff & approvals",
  employee: "Travel consultant — handle bookings & leads",
  accountant: "Finance staff — payments, GST & settlements",
};

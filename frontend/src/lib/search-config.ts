import type { ViewKey } from "@/types";
import {
  LayoutDashboard, Plane, Hotel, Palmtree,
  Users, Target, FileSpreadsheet, Ticket, CreditCard, Wallet, Percent,
  BarChart3, UserCog, CheckSquare, LifeBuoy, Bell, Megaphone, LayoutGrid,
  Receipt, KeyRound, Settings, History, Building2, GitBranch, Store, Activity,
  CalendarCheck, type LucideIcon,
} from "lucide-react";

export interface SearchItem {
  key: ViewKey;
  label: string;
  section: string;
  keywords: string[];
  icon: LucideIcon;
}

export const SEARCH_ITEMS: SearchItem[] = [
  { key: "dashboard", label: "Dashboard", section: "Overview", keywords: ["home", "overview", "kpi"], icon: LayoutDashboard },
  { key: "flights", label: "Flights", section: "Bookings", keywords: ["flight", "airline", "air"], icon: Plane },
  { key: "hotels", label: "Hotels", section: "Bookings", keywords: ["hotel", "stay", "room"], icon: Hotel },
  { key: "hotel-products", label: "Hotel Products", section: "Products", keywords: ["hotel", "product", "inventory", "room"], icon: Hotel },
  { key: "activity-packages", label: "Activities & Transfers", section: "Products", keywords: ["activity", "tour", "experience", "transfer", "vehicle", "pickup"], icon: Activity },
  { key: "product-approvals", label: "Rate Approvals", section: "Products", keywords: ["approval", "rate", "pending"], icon: Activity },
  { key: "holiday", label: "Holiday Packages", section: "Bookings", keywords: ["holiday", "package", "tour"], icon: Palmtree },
  { key: "bookings", label: "Booking Management", section: "Bookings", keywords: ["booking", "reservation", "ticket"], icon: Ticket },
  { key: "crm", label: "CRM / Leads", section: "Sales", keywords: ["crm", "lead", "enquiry", "pipeline"], icon: Target },
  { key: "customers", label: "Customers", section: "Sales", keywords: ["customer", "client"], icon: Users },
  { key: "quotations", label: "Quotations", section: "Sales", keywords: ["quote", "quotation", "proposal"], icon: FileSpreadsheet },
  { key: "payments", label: "Payments", section: "Finance", keywords: ["payment", "razorpay", "upi"], icon: CreditCard },
  { key: "wallet", label: "Wallet", section: "Finance", keywords: ["wallet", "balance", "top-up"], icon: Wallet },
  { key: "commission", label: "Commission", section: "Finance", keywords: ["commission", "settlement"], icon: Percent },
  { key: "finance", label: "Finance / GST", section: "Finance", keywords: ["finance", "gst", "invoice", "tax"], icon: Receipt },
  { key: "reports", label: "Reports & Analytics", section: "Insights", keywords: ["report", "analytics", "chart"], icon: BarChart3 },
  { key: "employees", label: "Employees", section: "Team", keywords: ["employee", "staff", "hr"], icon: UserCog },
  { key: "attendance", label: "Attendance & Leave", section: "Team", keywords: ["attendance", "leave", "checkin", "checkout"], icon: CalendarCheck },
  { key: "tasks", label: "Task Management", section: "Team", keywords: ["task", "todo"], icon: CheckSquare },
  { key: "support", label: "Support", section: "Team", keywords: ["support", "help", "ticket", "chat"], icon: LifeBuoy },
  { key: "notifications", label: "Notifications", section: "Team", keywords: ["notification", "alert"], icon: Bell },
  { key: "agencies", label: "Agency Management", section: "Platform", keywords: ["agency", "partner"], icon: Building2 },
  { key: "branches", label: "Branches", section: "Platform", keywords: ["branch", "office"], icon: GitBranch },
  { key: "api-marketplace", label: "API Marketplace", section: "Platform", keywords: ["api", "marketplace", "vendor"], icon: Store },
  { key: "api-management", label: "API Management", section: "Platform", keywords: ["api", "key", "webhook"], icon: KeyRound },
  { key: "monitoring", label: "Monitoring", section: "Platform", keywords: ["monitoring", "health", "uptime"], icon: Activity },
  { key: "marketing", label: "Marketing", section: "Platform", keywords: ["marketing", "campaign", "coupon"], icon: Megaphone },
  { key: "cms", label: "CMS", section: "Platform", keywords: ["cms", "blog", "content"], icon: LayoutGrid },
  { key: "audit-logs", label: "Audit Logs", section: "Platform", keywords: ["audit", "log", "history"], icon: History },
  { key: "settings", label: "Settings", section: "Platform", keywords: ["settings", "profile", "config"], icon: Settings },
];

export function filterSearchItems(query: string, allowedViews?: ViewKey[]): SearchItem[] {
  const q = query.trim().toLowerCase();
  return SEARCH_ITEMS.filter((item) => {
    if (allowedViews && !allowedViews.includes(item.key)) return false;
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.section.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.includes(q))
    );
  });
}

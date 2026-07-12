import type { Module, Role, User } from "@/types";

export const MODULES: Module[] = [
  "flights", "hotels", "holiday", "bookings", "crm", "customers",
  "quotations", "payments", "wallet", "commission", "finance",
  "reports", "analytics", "employees", "attendance", "leaves", "tasks",
  "support", "notifications", "marketing", "cms", "api-management",
  "settings", "audit-logs", "agencies", "branches", "api-marketplace",
  "monitoring",
];

// What a role gets access to by default — an individual user's `permissions`
// array (set at creation/edit time) overrides this entirely when present.
export const ROLE_DEFAULT_PERMISSIONS: Record<Role, Module[]> = {
  super_admin: [...MODULES],
  agency_admin: [
    "flights", "hotels", "holiday", "bookings", "crm", "customers",
    "quotations", "payments", "wallet", "commission", "finance",
    "reports", "employees", "attendance", "leaves", "tasks", "support",
    "notifications", "marketing", "cms", "api-management", "settings",
    "audit-logs", "branches",
  ],
  branch_manager: [
    "flights", "hotels", "holiday", "bookings", "crm", "customers",
    "quotations", "payments", "reports", "employees", "attendance",
    "leaves", "tasks", "support", "notifications",
  ],
  employee: [
    "flights", "hotels", "holiday", "bookings", "crm", "customers",
    "quotations", "payments", "reports", "tasks", "support",
    "notifications", "attendance", "leaves",
  ],
  accountant: [
    "payments", "wallet", "commission", "finance", "reports",
    "attendance", "leaves", "support", "notifications",
  ],
};

export function effectivePermissions(user: Pick<User, "role" | "permissions">): Module[] {
  return user.permissions ?? ROLE_DEFAULT_PERMISSIONS[user.role];
}

export function hasPermission(user: Pick<User, "role" | "permissions">, module: Module): boolean {
  return effectivePermissions(user).includes(module);
}

export const MODULE_LABELS: Record<Module, string> = {
  flights: "Flights", hotels: "Hotels", holiday: "Holiday Packages",
  bookings: "Booking Management", crm: "CRM / Leads", customers: "Customers",
  quotations: "Quotations", payments: "Payments", wallet: "Wallet",
  commission: "Commission", finance: "Finance / GST", reports: "Reports & Analytics",
  analytics: "Platform Analytics", employees: "Employees", attendance: "Attendance",
  leaves: "Leave Approvals", tasks: "Task Management", support: "Support",
  notifications: "Notifications", marketing: "Marketing", cms: "CMS",
  "api-management": "API Management", settings: "Settings", "audit-logs": "Audit Logs",
  agencies: "Agency Management", branches: "Branches", "api-marketplace": "API Marketplace",
  monitoring: "Monitoring",
};

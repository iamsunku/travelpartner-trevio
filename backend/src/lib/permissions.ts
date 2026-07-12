export const MODULES = [
  "flights", "hotels", "holiday", "bookings", "crm", "customers",
  "quotations", "payments", "wallet", "commission", "finance",
  "reports", "analytics", "employees", "attendance", "leaves", "tasks",
  "support", "notifications", "marketing", "cms", "api-management",
  "settings", "audit-logs", "agencies", "branches", "api-marketplace",
  "monitoring",
] as const;

export type Module = typeof MODULES[number];

export type Role = "super_admin" | "agency_admin" | "branch_manager" | "employee" | "accountant";

// What a role gets by default — an individual user's `permissions` column
// (set at creation/edit time) overrides this entirely when present.
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

export interface PermissionSubject {
  role: string;
  permissions?: unknown;
}

function isModule(value: unknown): value is Module {
  return typeof value === "string" && (MODULES as readonly string[]).includes(value);
}

export function effectivePermissions(subject: PermissionSubject): Module[] {
  if (Array.isArray(subject.permissions)) {
    return subject.permissions.filter(isModule);
  }
  return ROLE_DEFAULT_PERMISSIONS[subject.role as Role] ?? [];
}

export function hasPermission(subject: PermissionSubject, module: Module): boolean {
  return effectivePermissions(subject).includes(module);
}

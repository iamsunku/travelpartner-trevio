/** Role-based discount ceilings — keep in sync with backend `maxDiscountPercent` / `maxDiscountFixed`. */

export function maxDiscountPercent(role?: string): number {
  if (!role) return 5;
  if (["super_admin", "agency_admin"].includes(role)) return 100;
  if (["branch_manager", "management"].includes(role)) return 25;
  if (["sales_executive", "employee"].includes(role)) return 10;
  if (role === "accountant") return 15;
  return 5;
}

export function maxDiscountFixed(role?: string): number {
  if (!role) return 5_000;
  if (["super_admin", "agency_admin"].includes(role)) return Number.POSITIVE_INFINITY;
  if (["branch_manager", "management", "team_lead"].includes(role)) return 50_000;
  if (["sales_executive", "employee", "accountant"].includes(role)) return 10_000;
  return 5_000;
}

export function canApproveDiscount(role?: string): boolean {
  return ["super_admin", "agency_admin", "branch_manager", "management", "team_lead"].includes(role || "");
}

export function discountRequiresApproval(
  role: string | undefined,
  discountType?: string | null,
  discountValue?: number | null,
): boolean {
  const value = Number(discountValue || 0);
  if (!discountType || value <= 0) return false;
  if (["super_admin", "agency_admin"].includes(role || "")) return false;
  if (discountType === "Percentage") return value > maxDiscountPercent(role);
  if (discountType === "Fixed") return value > maxDiscountFixed(role);
  return false;
}

export function latestDiscountApproval(
  approvals?: Array<{ stage?: string | null; status?: string | null; comments?: string | null }> | null,
): { stage?: string | null; status?: string | null; comments?: string | null } | undefined {
  if (!Array.isArray(approvals)) return undefined;
  for (let i = approvals.length - 1; i >= 0; i -= 1) {
    if (approvals[i]?.stage === "Discount") return approvals[i];
  }
  return undefined;
}

export const SUPPLIER_TYPES = [
  { value: "Hotel", label: "Hotel" },
  { value: "Transfer", label: "Transfer" },
  { value: "Attraction", label: "Attraction" },
  { value: "Restaurant", label: "Restaurant" },
  { value: "DMC", label: "DMC" },
  { value: "Activity", label: "Activity" },
  { value: "General", label: "General" },
  { value: "Other", label: "Other" },
] as const;

export type SupplierType = (typeof SUPPLIER_TYPES)[number]["value"];

export const SUPPLIER_REGISTER_ROLES = ["super_admin", "agency_admin", "operations"] as const;

/** Map booking service type to preferred supplier types for picker filtering. */
export function supplierTypesForService(serviceType: string): SupplierType[] {
  const map: Record<string, SupplierType[]> = {
    Hotel: ["Hotel", "DMC", "General"],
    Flight: ["General", "DMC", "Other"],
    Transfer: ["Transfer", "DMC", "General"],
    Attraction: ["Attraction", "Activity", "DMC"],
    Activity: ["Attraction", "Activity", "DMC"],
    Visa: ["DMC", "General", "Other"],
    Insurance: ["General", "Other"],
    Other: ["DMC", "Hotel", "Transfer", "Attraction", "Restaurant", "Activity", "General", "Other"],
  };
  return map[serviceType] || ["DMC", "Hotel", "Transfer", "Attraction", "Restaurant", "Activity", "General", "Other"];
}

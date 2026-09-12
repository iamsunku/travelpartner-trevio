import type { User } from "@/types";

export type ProductAccess = {
  flights: boolean;
  hotels: boolean;
  packages: boolean;
};

const DEFAULT_AGENT: ProductAccess = {
  flights: true,
  hotels: true,
  packages: true,
};

const FULL_ACCESS: ProductAccess = {
  flights: true,
  hotels: true,
  packages: true,
};

export function resolveProductAccess(user: Pick<User, "role" | "productAccess"> | null): ProductAccess {
  if (!user) return FULL_ACCESS;
  if (user.productAccess) return user.productAccess;
  if (user.role === "travel_agent") return DEFAULT_AGENT;
  return FULL_ACCESS;
}

export function canBookProduct(user: Pick<User, "role" | "productAccess"> | null, product: keyof ProductAccess): boolean {
  return resolveProductAccess(user)[product];
}

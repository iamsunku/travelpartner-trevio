/** Client-side tax display helpers — mirrors Phase 3 TaxRule semantics. Never invent 18% or 5%. */

export type ClientTaxRule = {
  id: string;
  name: string;
  rate: number;
  method: "EXCLUSIVE" | "INCLUSIVE";
  active?: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export function pickActiveTaxRule(rules: ClientTaxRule[] | null | undefined, asOf?: string | null): ClientTaxRule | null {
  if (!Array.isArray(rules) || !rules.length) return null;
  const today = asOf || new Date().toISOString().slice(0, 10);
  const match = rules.find((rule) => {
    if (rule.active === false) return false;
    if (rule.effectiveFrom && today < rule.effectiveFrom) return false;
    if (rule.effectiveTo && today > rule.effectiveTo) return false;
    return true;
  });
  return match || null;
}

export function taxFromConfiguredRule(
  base: number,
  rule: ClientTaxRule | null | undefined,
): {
  configured: boolean;
  amount: number | null;
  rate: number | null;
  method: "EXCLUSIVE" | "INCLUSIVE" | null;
  label: string;
  total: number | null;
} {
  if (!rule || rule.active === false || !Number.isFinite(rule.rate) || rule.rate < 0) {
    return {
      configured: false,
      amount: null,
      rate: null,
      method: null,
      label: "Tax (configuration required)",
      total: null,
    };
  }
  const baseAmt = Math.max(0, Math.round(base));
  if (rule.method === "INCLUSIVE") {
    const amount = Math.round((baseAmt * rule.rate) / (100 + rule.rate));
    return {
      configured: true,
      amount,
      rate: rule.rate,
      method: "INCLUSIVE",
      label: `${rule.name} @ ${rule.rate}%`,
      total: baseAmt,
    };
  }
  const amount = Math.round((baseAmt * rule.rate) / 100);
  return {
    configured: true,
    amount,
    rate: rule.rate,
    method: "EXCLUSIVE",
    label: `${rule.name} @ ${rule.rate}%`,
    total: baseAmt + amount,
  };
}

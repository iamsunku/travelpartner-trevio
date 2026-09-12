/** Parse agency commission rule cards and resolve amount for a booking/quote. */

type RuleLike = {
  id?: string;
  title?: string;
  rate?: string;
  type?: string;
};

function parsePercent(rate: string | undefined): number {
  const nums = [...String(rate || "").matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  if (nums.length >= 2) return (nums[0] + nums[1]) / 2;
  if (nums.length === 1) return nums[0];
  return 5;
}

function matchRule(rules: RuleLike[], service: string): RuleLike | null {
  if (!rules.length) return null;
  const svc = (service || "").toLowerCase();
  const by = (pred: (r: RuleLike) => boolean) => rules.find(pred) || null;
  if (svc.includes("flight") || svc.includes("airline")) {
    return by((r) => /airline|flight/i.test(`${r.id || ""} ${r.title || ""}`));
  }
  if (svc.includes("hotel")) {
    return by((r) => /hotel/i.test(`${r.id || ""} ${r.title || ""}`));
  }
  if (svc.includes("activity") || svc.includes("transfer")) {
    return by((r) => /package|holiday|markup/i.test(`${r.id || ""} ${r.title || ""}`));
  }
  return (
    by((r) => /package|holiday/i.test(`${r.id || ""} ${r.title || ""}`)) ||
    rules[0] ||
    null
  );
}

export function resolveCommissionAmount(
  packageValue: number,
  service: string,
  rulesRaw: unknown,
  fallbackPct = 5,
): number {
  const value = Math.max(0, Math.round(Number(packageValue) || 0));
  if (value <= 0) return 0;
  const rules = Array.isArray(rulesRaw) ? (rulesRaw as RuleLike[]) : [];
  const rule = matchRule(rules, service);
  const pct = rule ? parsePercent(rule.rate) : fallbackPct;
  return Math.round(value * (pct / 100));
}

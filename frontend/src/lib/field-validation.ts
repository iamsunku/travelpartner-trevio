/** Shared client-side checks for contact / identity fields. */

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.toLowerCase() === "not-an-email") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function clampInt(raw: string, fallback: number, min: number, max: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function isValidPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Indian GSTIN: 15 chars, 2-digit state + PAN + entity + Z + checksum. */
export function isValidGstin(value: string): boolean {
  const v = value.trim().toUpperCase();
  if (!v) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v);
}

export function isValidRazorpayKeyId(value: string): boolean {
  return /^rzp_(live|test)_[A-Za-z0-9]+$/.test(value.trim());
}

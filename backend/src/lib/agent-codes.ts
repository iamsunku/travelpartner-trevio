import { db } from "./db.js";

/** Derive a short agency code from the company name (e.g. Wanderlust → WAN). */
export function deriveAgencyCodeBase(name: string): string {
  const cleaned = String(name || "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .toUpperCase();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const initials = parts.map((p) => p[0]).join("").slice(0, 4);
    if (initials.length >= 2) return initials;
  }
  const letters = cleaned.replace(/[^A-Z0-9]/g, "");
  if (letters.length >= 3) return letters.slice(0, 3);
  return (letters + "AGY").slice(0, 3);
}

export async function ensureAgencyCode(agencyId: string, agencyName?: string): Promise<string> {
  const agency = await db.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw new Error("Agency not found");
  if (agency.code) return agency.code;

  const base = deriveAgencyCodeBase(agencyName || agency.name);
  let code = base;
  let n = 1;
  while (await db.agency.findFirst({ where: { code } })) {
    code = `${base}${n++}`;
  }
  await db.agency.update({ where: { id: agencyId }, data: { code } });
  return code;
}

export async function allocateAgentCode(agencyId: string): Promise<string> {
  const agencyCode = await ensureAgencyCode(agencyId);
  const existing = await db.user.count({
    where: { agencyId, role: "travel_agent", agentCode: { not: null } },
  });
  let seq = existing + 1;
  let code = `${agencyCode}-AGT-${String(seq).padStart(4, "0")}`;
  while (await db.user.findFirst({ where: { agentCode: code } })) {
    seq += 1;
    code = `${agencyCode}-AGT-${String(seq).padStart(4, "0")}`;
  }
  return code;
}

/**
 * Ensure the user has an agent code (ADCI-AGT-0001).
 * Travel agents always get one. Other agency users get one when they create/own a quote
 * so Agency code and Agent code both populate on the quotation screen.
 */
export async function ensureUserAgentCode(userId: string, forQuote = false): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  if (user.agentCode) return user.agentCode;
  if (!user.agencyId) return null;
  if (user.role !== "travel_agent" && !forQuote) return null;
  const agentCode = await allocateAgentCode(user.agencyId);
  await db.user.update({ where: { id: userId }, data: { agentCode } });
  return agentCode;
}

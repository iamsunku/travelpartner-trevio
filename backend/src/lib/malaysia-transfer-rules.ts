/**
 * Malaysia airport-transfer passenger → vehicle rules (KTH sheet).
 * Shared by quotation save validation (backend) and catalogue UI (frontend mirror).
 */

export type MalaysiaVehicleBand = "car" | "van10" | "van18" | "van18Guide";

export function classifyMalaysiaVehicleBand(vehicleType: string): MalaysiaVehicleBand | null {
  const t = String(vehicleType || "").toLowerCase();
  if (/guide/.test(t)) return "van18Guide";
  if (/18/.test(t)) return "van18";
  if (/10/.test(t)) return "van10";
  if (/car|sedan/.test(t)) return "car";
  return null;
}

export function requiredVehicleBandForPax(pax: number): MalaysiaVehicleBand | "over_capacity" | null {
  const n = Math.floor(Number(pax) || 0);
  if (n < 1) return null;
  if (n <= 3) return "car";
  if (n <= 6) return "van10";
  if (n === 7) return "van18";
  if (n <= 13) return "van18Guide";
  return "over_capacity";
}

export function validateAirportVehicleForPax(
  vehicleType: string,
  pax: number,
): { ok: boolean; message?: string } {
  if (!(Math.floor(Number(pax) || 0) >= 1)) {
    return { ok: false, message: "Passenger count is required." };
  }
  if (!String(vehicleType || "").trim()) {
    return { ok: false, message: "Vehicle is required." };
  }
  // Any KTH vehicle column may be selected; capacity bands are advisory in the UI.
  return { ok: true };
}

/** True when transfer looks like Malaysia airport pickup (Airport → Hotel). */
export function isMalaysiaAirportPickupLine(row: Record<string, unknown>): boolean {
  const type = String(row.transferType || "").toLowerCase();
  const pickup = String(row.pickup || row.pickupLocation || "").toLowerCase();
  const name = String(row.name || "").toLowerCase();
  if (type.includes("airport")) return true;
  if (/airport|klia/.test(pickup)) return true;
  if (/airport pickup|airport.*hotel/.test(name)) return true;
  return false;
}

export function validateMalaysiaTransferLines(
  transfers: unknown,
  quotePax: number,
): string | null {
  if (!Array.isArray(transfers)) return null;
  for (const raw of transfers) {
    const row = raw as Record<string, unknown>;
    if (!isMalaysiaAirportPickupLine(row)) continue;
    const pax = Math.max(1, Number(row.pax || quotePax || 0));
    const vehicleType = String(row.vehicleType || "");
    const check = validateAirportVehicleForPax(vehicleType, pax);
    if (!check.ok) return check.message || "Invalid airport transfer vehicle for passenger count.";
  }
  return null;
}

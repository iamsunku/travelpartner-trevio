import { describe, expect, it } from "vitest";
import {
  requiredVehicleBandForPax,
  validateAirportVehicleForPax,
  validateMalaysiaTransferLines,
} from "./malaysia-transfer-rules.js";

describe("malaysia-transfer-rules", () => {
  it("suggests 18+guide for 8+ pax but allows any vehicle selection", () => {
    expect(requiredVehicleBandForPax(8)).toBe("van18Guide");
    expect(validateAirportVehicleForPax("Van 18-seater + Guide", 10).ok).toBe(true);
    expect(validateAirportVehicleForPax("Van 18-seater", 10).ok).toBe(true);
    expect(validateAirportVehicleForPax("Sedan / Car", 8).ok).toBe(true);
  });

  it("allows any airport pickup vehicle on save", () => {
    expect(
      validateMalaysiaTransferLines(
        [{ transferType: "Airport Pickup", vehicleType: "Sedan / Car", pax: 8 }],
        8,
      ),
    ).toBeNull();
    expect(
      validateMalaysiaTransferLines(
        [{ transferType: "Airport Pickup", vehicleType: "Van 18-seater + Guide", pax: 8 }],
        8,
      ),
    ).toBeNull();
  });

  it("ignores non-airport transfers", () => {
    expect(
      validateMalaysiaTransferLines(
        [{ transferType: "Private", vehicleType: "Sedan / Car", pax: 8 }],
        8,
      ),
    ).toBeNull();
  });
});

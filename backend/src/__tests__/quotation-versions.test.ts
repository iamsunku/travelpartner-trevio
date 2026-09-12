import { describe, expect, it } from "vitest";
import { quoteSendBlockReason } from "../lib/quote-access.js";
import {
  buildVersionSnapshot,
  hasMeaningfulQuotationChange,
  materialFingerprint,
  sanitizeVersionSnapshot,
} from "../lib/quotation-versions.js";

const baseQuote = {
  id: "q1",
  quoteNo: "TG-QT-2026-V1",
  customerName: "Dillip",
  destination: "Bali",
  travelStartDate: "2026-10-01",
  travelEndDate: "2026-10-05",
  adults: 2,
  children: 0,
  infants: 0,
  currency: "INR",
  amount: 10000,
  gst: 0,
  total: 10000,
  status: "Draft",
  approvalStatus: "Draft",
  internalNotes: "SECRET NOTES",
  totalNetCost: 8000,
  trevioMarkupValue: 10,
  agentMarkup: 500,
  contractedCost: 8000,
  packages: [
    {
      name: "Deluxe",
      hotels: [{ hotelName: "Ubud", contractedCost: 4000, supplier: "Hidden" }],
      flights: [],
      transfers: [],
      activities: [],
      meals: [],
      itinerary: [{ day: 1, title: "Arrival" }],
      inclusions: ["Breakfast"],
      exclusions: ["Flights"],
      pricing: {
        contractedCost: 8000,
        trevioMarkupAmount: 800,
        customerPrice: 10000,
        finalPrice: 10000,
      },
    },
  ],
};

describe("phase 7 quotation versioning", () => {
  it("D. version fingerprints are deterministic for identical content", () => {
    expect(materialFingerprint(baseQuote)).toBe(materialFingerprint({ ...baseQuote }));
  });

  it("E. meaningful quotation changes are detected", () => {
    const changed = {
      ...baseQuote,
      travelStartDate: "2026-11-01",
      packages: [{ ...baseQuote.packages[0], hotels: [{ hotelName: "Seminyak" }] }],
    };
    expect(hasMeaningfulQuotationChange(baseQuote, changed)).toBe(true);
  });

  it("F. trivial/no-op status-only or note-only edits are not meaningful", () => {
    expect(hasMeaningfulQuotationChange(baseQuote, {
      ...baseQuote,
      status: "In Progress",
      wizardStep: 3,
      internalNotes: "updated secret",
      updatedAt: new Date().toISOString(),
    })).toBe(false);
  });

  it("C. buildVersionSnapshot freezes packages without versions/shares mutation hooks", () => {
    const snap = buildVersionSnapshot({
      ...baseQuote,
      versions: [{ versionNumber: 1 }],
      shares: [{ id: "s1" }],
      documents: [{ id: "d1" }],
      approvals: [{ stage: "Team Lead", status: "Approved", comments: "ok look", approverName: "Boss" }],
    });
    expect(snap.versions).toBeUndefined();
    expect(snap.shares).toBeUndefined();
    expect(snap.documents).toBeUndefined();
    expect(Array.isArray(snap.packages)).toBe(true);
    expect((snap.packages as unknown[])[0]).toMatchObject({ name: "Deluxe" });
    const approvals = snap.approvals as Array<Record<string, unknown>>;
    expect(approvals[0].comments).toBeUndefined();
    expect(approvals[0].status).toBe("Approved");
  });

  it("L. sanitized historical snapshots do not leak cost/markup/notes/approvals", () => {
    const snap = sanitizeVersionSnapshot(baseQuote, "travel_agent");
    const json = JSON.stringify(snap);
    expect(json).not.toContain("SECRET NOTES");
    expect(json).not.toContain("Hidden");
    expect(json).not.toContain("contractedCost");
    expect(json).not.toContain("trevioMarkup");
    expect(json).not.toContain("8000");
    expect(snap.approvals).toBeUndefined();
    expect(snap.internalNotes).toBeUndefined();
    expect(Array.isArray(snap.packages)).toBe(true);
    expect((snap.packages as Array<Record<string, unknown>>)[0].name).toBe("Deluxe");
  });

  it("N. multi-package fingerprints keep packages independent", () => {
    const multi = {
      ...baseQuote,
      packages: [
        baseQuote.packages[0],
        { ...baseQuote.packages[0], name: "Premium", hotels: [{ hotelName: "Seminyak" }] },
      ],
    };
    const swapped = {
      ...multi,
      packages: [multi.packages[1], multi.packages[0]],
    };
    // sortOrder/name differences mean fingerprints differ when package contents differ
    expect(hasMeaningfulQuotationChange(multi, {
      ...multi,
      packages: [
        multi.packages[0],
        { ...multi.packages[1], hotels: [{ hotelName: "Canggu" }] },
      ],
    })).toBe(true);
    expect(materialFingerprint(multi)).not.toBe(materialFingerprint(swapped));
  });

  it("G-H. material change after approval cannot remain sendable without re-approval", () => {
    const approved = {
      status: "Sent to Agent",
      approvalStatus: "Approved",
      approvals: [{ stage: "Team Lead", status: "Approved" }],
    };
    expect(quoteSendBlockReason(approved)).toBeNull();
    const afterInvalidation = {
      status: "In Progress",
      approvalStatus: "Draft",
      approvals: [],
    };
    expect(quoteSendBlockReason(afterInvalidation)).toMatch(/approval/i);
  });

  it("M. historical pricing stays in the snapshot rather than current catalogue fields", () => {
    const snap = buildVersionSnapshot(baseQuote);
    const pkg = (snap.packages as Array<Record<string, unknown>>)[0];
    expect(pkg.pricing).toMatchObject({ customerPrice: 10000, finalPrice: 10000 });
    // contracted cost may exist in internal snapshot storage but is stripped for agents
    const agentView = sanitizeVersionSnapshot(snap, "travel_agent");
    const agentPkg = (agentView.packages as Array<Record<string, unknown>>)[0];
    expect(JSON.stringify(agentPkg.pricing || {})).not.toMatch(/contractedCost|trevioMarkupAmount/);
  });
});

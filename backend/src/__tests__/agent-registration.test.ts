import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { app } from "../app.js";
import { db } from "../lib/db.js";
import { signToken } from "../lib/jwt.js";
import { putPrivateObject, objectKey } from "../lib/document-storage.js";
import { REGISTRATION_STATUS } from "../lib/agent-registration.js";

const suffix = `${Date.now()}`;
const password = "Phase15-Test-Pass!";
let passwordHash = "";
let storageDir = "";
let claimToken = "";

const ids = {
  superAdmin: "",
  travelAgent: "",
  agencyAdminOther: "",
  agencyExisting: "",
  submittedAgency: "",
  submittedUser: "",
  rejectedAgency: "",
  rejectedUser: "",
  approvedAgency: "",
  approvedUser: "",
  proofDoc: "",
};

function tokenFor(userId: string, role: string, agencyId?: string | null) {
  return signToken({
    userId,
    email: `${userId}@example.com`,
    role,
    agencyId: agencyId || null,
    branchId: null,
    permissions: null,
  });
}

beforeAll(async () => {
  passwordHash = await bcrypt.hash(password, 4);
  storageDir = await mkdtemp(path.join(os.tmpdir(), "trevio-reg-"));
  process.env.DOCUMENT_STORAGE = "local";
  process.env.DOCUMENT_STORAGE_DIR = storageDir;
  process.env.ALLOW_PUBLIC_REGISTRATION = "true";
  process.env.QUOTATION_EMAIL_PROVIDER = "none";

  const existingAgency = await db.agency.create({
    data: {
      name: `Existing Agency ${suffix}`,
      owner: "Existing Owner",
      email: `existing-agency-${suffix}@example.com`,
      phone: `+91 700${suffix.slice(-7)}`,
      status: "Active",
      registrationStatus: REGISTRATION_STATUS.APPROVED,
    },
  });
  ids.agencyExisting = existingAgency.id;

  ids.superAdmin = (
    await db.user.create({
      data: {
        name: "Phase15 Super",
        email: `p15-super-${suffix}@example.com`,
        password: passwordHash,
        role: "super_admin",
        status: "Active",
      },
    })
  ).id;

  ids.travelAgent = (
    await db.user.create({
      data: {
        name: "Phase15 Agent",
        email: `p15-agent-${suffix}@example.com`,
        password: passwordHash,
        role: "travel_agent",
        status: "Active",
        agencyId: existingAgency.id,
      },
    })
  ).id;

  ids.agencyAdminOther = (
    await db.user.create({
      data: {
        name: "Phase15 Other Admin",
        email: `p15-other-admin-${suffix}@example.com`,
        password: passwordHash,
        role: "agency_admin",
        status: "Active",
        agencyId: existingAgency.id,
      },
    })
  ).id;

  const png = Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
    "hex",
  );
  const stored = await putPrivateObject(objectKey("gst-proof", `proof-${suffix}.png`), png, "image/png");
  claimToken = `claim-${suffix}-${Math.random().toString(36).slice(2, 10)}`;
  const proof = await db.registrationDocument.create({
    data: {
      claimToken,
      storageKey: stored.storageKey,
      storageProvider: stored.storageProvider,
      originalName: "gst.png",
      storedName: `proof-${suffix}.png`,
      mimeType: "image/png",
      sizeBytes: png.length,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  ids.proofDoc = proof.id;

  const submittedAgency = await db.agency.create({
    data: {
      name: `Submitted Co ${suffix}`,
      owner: "Submitted Owner",
      email: `p15-submitted-${suffix}@example.com`,
      phone: `+91 701${suffix.slice(-7)}`,
      status: "Trial",
      registrationStatus: REGISTRATION_STATUS.SUBMITTED,
      panNumber: "ABCDE1234F",
      gstNumber: "27ABCDE1234F1Z5",
      gstProofDocumentId: proof.id,
      address: "12 Business Park",
      country: "India",
      state: "Maharashtra",
      city: "Mumbai",
      termsAcceptedAt: new Date(),
    },
  });
  ids.submittedAgency = submittedAgency.id;
  await db.registrationDocument.update({ where: { id: proof.id }, data: { agencyId: submittedAgency.id } });
  ids.submittedUser = (
    await db.user.create({
      data: {
        name: "Submitted Owner",
        email: `p15-submitted-${suffix}@example.com`,
        password: passwordHash,
        role: "agency_admin",
        status: "Submitted",
        agencyId: submittedAgency.id,
      },
    })
  ).id;

  const rejectedAgency = await db.agency.create({
    data: {
      name: `Rejected Co ${suffix}`,
      owner: "Rejected Owner",
      email: `p15-rejected-${suffix}@example.com`,
      phone: `+91 702${suffix.slice(-7)}`,
      status: "Trial",
      registrationStatus: REGISTRATION_STATUS.REJECTED,
      registrationRejectionReason: "Incomplete documents",
    },
  });
  ids.rejectedAgency = rejectedAgency.id;
  ids.rejectedUser = (
    await db.user.create({
      data: {
        name: "Rejected Owner",
        email: `p15-rejected-${suffix}@example.com`,
        password: passwordHash,
        role: "agency_admin",
        status: "Rejected",
        agencyId: rejectedAgency.id,
      },
    })
  ).id;

  const approvedAgency = await db.agency.create({
    data: {
      name: `Approved Co ${suffix}`,
      owner: "Approved Owner",
      email: `p15-approved-${suffix}@example.com`,
      phone: `+91 703${suffix.slice(-7)}`,
      status: "Active",
      registrationStatus: REGISTRATION_STATUS.APPROVED,
    },
  });
  ids.approvedAgency = approvedAgency.id;
  ids.approvedUser = (
    await db.user.create({
      data: {
        name: "Approved Owner",
        email: `p15-approved-${suffix}@example.com`,
        password: passwordHash,
        role: "agency_admin",
        status: "Active",
        agencyId: approvedAgency.id,
      },
    })
  ).id;
}, 60_000);

afterAll(async () => {
  const agencyIds = [ids.submittedAgency, ids.rejectedAgency, ids.approvedAgency, ids.agencyExisting].filter(Boolean);
  const userIds = [ids.superAdmin, ids.travelAgent, ids.agencyAdminOther, ids.submittedUser, ids.rejectedUser, ids.approvedUser].filter(Boolean);
  await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: userIds } }, { agencyId: { in: agencyIds } }] } }).catch(() => undefined);
  await db.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
  await db.branch.deleteMany({ where: { agencyId: { in: agencyIds } } }).catch(() => undefined);
  await db.registrationDocument.deleteMany({ where: { OR: [{ id: ids.proofDoc }, { agencyId: { in: agencyIds } }] } }).catch(() => undefined);
  await db.agency.deleteMany({ where: { id: { in: agencyIds } } }).catch(() => undefined);
  if (storageDir) await rm(storageDir, { recursive: true, force: true }).catch(() => undefined);
  await db.$disconnect();
}, 60_000);

describe("Phase 15 agent registration approval", { timeout: 30_000 }, () => {
  it("A. public register creates SUBMITTED account without JWT", async () => {
    const png = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
      "hex",
    );
    const stored = await putPrivateObject(objectKey("gst-proof", `http-proof-${suffix}.png`), png, "image/png");
    const claim = `http-claim-${suffix}`;
    await db.registrationDocument.create({
      data: {
        claimToken: claim,
        storageKey: stored.storageKey,
        storageProvider: stored.storageProvider,
        originalName: "gst.png",
        storedName: `http-proof-${suffix}.png`,
        mimeType: "image/png",
        sizeBytes: png.length,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const phone = `9${suffix.slice(-9)}`.padEnd(10, "0").slice(0, 10);
    const res = await request(app).post("/api/auth/register").send({
      fullName: "HTTP Applicant",
      companyName: `HTTP Co ${suffix}`,
      address: "99 Registration Road",
      email: `p15-http-${suffix}@example.com`,
      countryCode: "+91",
      phone,
      country: "India",
      state: "Karnataka",
      city: "Bengaluru",
      panNumber: "AAAAA1111A",
      password,
      confirmPassword: password,
      gstNumber: "29AAAAA1111A1Z5",
      gstProofId: claim,
      termsAccepted: true,
      termsVersion: "2026-09-1",
    });

    expect(res.status, `register failed: ${JSON.stringify(res.body)}`).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.status).toBe("Submitted");
    expect(res.body.registrationId).toBeTruthy();

    const agency = await db.agency.findUnique({ where: { id: res.body.registrationId } });
    const user = await db.user.findUnique({ where: { id: res.body.user.id } });
    expect(agency?.registrationStatus).toBe("Submitted");
    expect(user?.status).toBe("Submitted");

    await db.user.deleteMany({ where: { agencyId: res.body.registrationId } });
    await db.branch.deleteMany({ where: { agencyId: res.body.registrationId } });
    await db.registrationDocument.deleteMany({ where: { agencyId: res.body.registrationId } });
    await db.agency.delete({ where: { id: res.body.registrationId } }).catch(() => undefined);
  }, 30_000);

  it("B. submitted agent cannot login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `p15-submitted-${suffix}@example.com`, password });
    expect(res.status).toBe(403);
    expect(res.body.token).toBeUndefined();
    expect(String(res.body.error)).toMatch(/pending admin approval/i);
  });

  it("C. rejected agent cannot login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `p15-rejected-${suffix}@example.com`, password });
    expect(res.status).toBe(403);
    expect(String(res.body.error)).toMatch(/rejected/i);
  });

  it("D. approved agent can login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `p15-approved-${suffix}@example.com`, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("E. agent cannot approve another registration", async () => {
    const res = await request(app)
      .post(`/api/agent-registrations/${ids.submittedAgency}/approve`)
      .set("Authorization", `Bearer ${tokenFor(ids.travelAgent, "travel_agent", ids.agencyExisting)}`)
      .send({ comment: "nope" });
    expect(res.status).toBe(403);
  });

  it("F. unauthorized user cannot approve/reject", async () => {
    const approve = await request(app)
      .post(`/api/agent-registrations/${ids.submittedAgency}/approve`)
      .set("Authorization", `Bearer ${tokenFor(ids.agencyAdminOther, "agency_admin", ids.agencyExisting)}`)
      .send({});
    expect(approve.status).toBe(403);

    const reject = await request(app)
      .post(`/api/agent-registrations/${ids.submittedAgency}/reject`)
      .set("Authorization", `Bearer ${tokenFor(ids.agencyAdminOther, "agency_admin", ids.agencyExisting)}`)
      .send({ reason: "nope" });
    expect(reject.status).toBe(403);
  });

  it("G. authorized admin can approve", async () => {
    const agency = await db.agency.create({
      data: {
        name: `To Approve ${suffix}`,
        owner: "To Approve",
        email: `p15-to-approve-${suffix}@example.com`,
        phone: `+91 704${suffix.slice(-7)}`,
        status: "Trial",
        registrationStatus: REGISTRATION_STATUS.SUBMITTED,
      },
    });
    const user = await db.user.create({
      data: {
        name: "To Approve",
        email: `p15-to-approve-${suffix}@example.com`,
        password: passwordHash,
        role: "agency_admin",
        status: "Submitted",
        agencyId: agency.id,
      },
    });

    const res = await request(app)
      .post(`/api/agent-registrations/${agency.id}/approve`)
      .set("Authorization", `Bearer ${tokenFor(ids.superAdmin, "super_admin")}`)
      .send({ comment: "Looks good" });
    expect(res.status).toBe(200);
    expect(res.body.registration.registrationStatus).toBe("Approved");

    const login = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(login.status).toBe(200);

    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await db.agency.delete({ where: { id: agency.id } }).catch(() => undefined);
  });

  it("H. authorized admin can reject", async () => {
    const agency = await db.agency.create({
      data: {
        name: `To Reject ${suffix}`,
        owner: "To Reject",
        email: `p15-to-reject-${suffix}@example.com`,
        phone: `+91 705${suffix.slice(-7)}`,
        status: "Trial",
        registrationStatus: REGISTRATION_STATUS.SUBMITTED,
      },
    });
    const user = await db.user.create({
      data: {
        name: "To Reject",
        email: `p15-to-reject-${suffix}@example.com`,
        password: passwordHash,
        role: "agency_admin",
        status: "Submitted",
        agencyId: agency.id,
      },
    });

    const res = await request(app)
      .post(`/api/agent-registrations/${agency.id}/reject`)
      .set("Authorization", `Bearer ${tokenFor(ids.superAdmin, "super_admin")}`)
      .send({ reason: "Missing GST proof" });
    expect(res.status).toBe(200);
    expect(res.body.registration.registrationStatus).toBe("Rejected");
    expect(res.body.registration.registrationRejectionReason).toBe("Missing GST proof");

    const login = await request(app).post("/api/auth/login").send({ email: user.email, password });
    expect(login.status).toBe(403);

    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await db.agency.delete({ where: { id: agency.id } }).catch(() => undefined);
  });

  it("I. GST/VAT proof remains private", async () => {
    const denied = await request(app)
      .get(`/api/agencies/${ids.submittedAgency}/gst-proof`)
      .set("Authorization", `Bearer ${tokenFor(ids.travelAgent, "travel_agent", ids.agencyExisting)}`);
    expect([403, 404]).toContain(denied.status);

    const allowed = await request(app)
      .get(`/api/agencies/${ids.submittedAgency}/gst-proof`)
      .set("Authorization", `Bearer ${tokenFor(ids.superAdmin, "super_admin")}`);
    expect(allowed.status).toBe(200);
    expect(String(allowed.headers["cache-control"] || "")).toMatch(/private/i);
  });

  it("J. existing approved agents continue to login", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: `p15-approved-${suffix}@example.com`, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it("K. registration data is not exposed to unauthorized users", async () => {
    const list = await request(app)
      .get("/api/agent-registrations?status=Submitted")
      .set("Authorization", `Bearer ${tokenFor(ids.travelAgent, "travel_agent", ids.agencyExisting)}`);
    expect(list.status).toBe(403);

    const detail = await request(app)
      .get(`/api/agent-registrations/${ids.submittedAgency}`)
      .set("Authorization", `Bearer ${tokenFor(ids.agencyAdminOther, "agency_admin", ids.agencyExisting)}`);
    expect(detail.status).toBe(403);

    const adminList = await request(app)
      .get("/api/agent-registrations?status=Submitted")
      .set("Authorization", `Bearer ${tokenFor(ids.superAdmin, "super_admin")}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.registrations.some((r: { id: string }) => r.id === ids.submittedAgency)).toBe(true);
    expect(JSON.stringify(adminList.body)).not.toMatch(/"password"/i);
  });
});

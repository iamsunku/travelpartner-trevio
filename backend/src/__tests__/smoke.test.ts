import { describe, it, expect, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { db } from "../lib/db.js";

const SEEDED_EMAIL = "superadmin@travelpartner.pro";
const SEEDED_PASSWORD = "Passw0rd@123";
const EMPLOYEE_EMAIL = "sneha@wanderlusttravels.in";

describe("smoke", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("GET /api/health returns 200", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  it("rejects login with a wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEEDED_EMAIL, password: "wrong-password" });
    expect(res.status).toBe(401);
  });

  it("logs in with the seeded demo password and returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: SEEDED_EMAIL, password: SEEDED_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.password).toBeUndefined();
  });

  it("blocks an employee-role token from creating an agency (RBAC regression guard)", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: EMPLOYEE_EMAIL, password: SEEDED_PASSWORD });
    expect(login.status).toBe(200);

    const res = await request(app)
      .post("/api/agencies")
      .set("Authorization", `Bearer ${login.body.token}`)
      .send({ name: "Test Agency", owner: "X", email: "x@x.com", phone: "1234567890" });
    expect(res.status).toBe(403);
  });
});

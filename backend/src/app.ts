import express from "express";
import crypto from "crypto";
import cors from "cors";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import { validateEnv } from "./lib/env.js";
import { logger } from "./lib/logger.js";
import { db } from "./lib/db.js";
import { signToken } from "./lib/jwt.js";
import { requireAuth, optionalAuth, requireRole, type AuthRequest } from "./middleware/auth.js";
import { generateFlights, generateHotels } from "./lib/mock-data.js";
import {
  validate, loginSchema, bookingSchema, customerSchema, leadSchema, quotationSchema,
  paymentSchema, employeeSchema, employeeUpdateSchema, taskSchema, agencySchema,
  agencyUpdateSchema, branchSchema, branchUpdateSchema, walletSchema,
} from "./lib/validation.js";

validateEnv();

// Every role except super_admin only ever sees rows from its own agency.
// A missing agencyId on a non-super_admin token resolves to a sentinel that
// matches nothing, rather than silently falling through to "see everything".
function agencyScope(req: AuthRequest): Record<string, unknown> {
  if (req.auth?.role === "super_admin") return {};
  return { agencyId: req.auth?.agencyId ?? "__no_agency__" };
}

// The agencyId a create/write should be stamped with — always the caller's own
// agency for non-super_admin roles, ignoring whatever the client body claims.
function ownAgencyId(req: AuthRequest, fallback?: string): string | undefined {
  if (req.auth?.role === "super_admin") return fallback ?? req.auth?.agencyId ?? undefined;
  return req.auth?.agencyId ?? undefined;
}

// A readable one-time password for freshly created logins (e.g. "Rk4-Wmp2-Tq9x").
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const group = () => Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use(pinoHttp({ logger }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
app.use("/api", apiLimiter);

let requestCount = 0;
let errorCount = 0;
const requestWindowStart = Date.now();
app.use((req, res, next) => {
  requestCount += 1;
  res.on("finish", () => {
    if (res.statusCode >= 500) errorCount += 1;
  });
  next();
});

app.get("/api/health", async (_req, res) => {
  try {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: "ok", service: "travelpro-backend", timestamp: new Date().toISOString() });
  } catch (e) {
    logger.error(e);
    res.status(503).json({ status: "unavailable", service: "travelpro-backend", timestamp: new Date().toISOString() });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    name: "Trevio Global API",
    version: "0.3.0",
    auth: "JWT Bearer",
    endpoints: [
      "/api/health",
      "/api/auth/login",
      "/api/auth/me",
      "/api/bookings",
      "/api/customers",
      "/api/leads",
      "/api/quotations",
      "/api/payments",
      "/api/employees",
      "/api/tasks",
      "/api/branches",
      "/api/dashboard",
      "/api/reports",
      "/api/commission",
      "/api/finance",
      "/api/agencies",
      "/api/notifications",
      "/api/audit-logs",
      "/api/wallet",
      "/api/flights/search",
      "/api/hotels/search",
      "/api/analytics/platform",
      "/api/analytics/employees",
    ],
  });
});

app.post("/api/auth/login", authLimiter, validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.user.findUnique({
      where: { email },
      include: { agency: true, branch: true },
    });
    if (!user || !user.password) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await db.auditLog.create({
      data: { userId: user.id, agencyId: user.agencyId, userName: user.name, action: "Login", module: "Auth", ip: req.ip || "0.0.0.0" },
    });
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
    });
    const { password: _password, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await db.user.findUnique({
      where: { id: req.auth!.userId },
      include: { agency: true, branch: true },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const { password: _password, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/bookings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const status = req.query.status as string | undefined;
    const service = req.query.service as string | undefined;
    const search = req.query.q as string | undefined;
    const where: Record<string, unknown> = { ...agencyScope(req) };
    if (status && status !== "All") where.status = status;
    if (service && service !== "All") where.service = service;
    if (search) where.customerName = { contains: search };
    const bookings = await db.booking.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ bookings, total: bookings.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/bookings", requireAuth, validate(bookingSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const booking = await db.booking.create({
      data: {
        bookingRef: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
        customerName: body.customerName,
        service: body.service,
        route: body.route,
        travelDate: body.travelDate,
        amount: body.amount,
        commission: body.commission || 0,
        status: body.status || "Confirmed",
        paymentStatus: body.paymentStatus || "Paid",
        paymentMethod: body.paymentMethod || "Razorpay",
        agentName: body.agentName || "System",
        agencyId: ownAgencyId(req, body.agencyId),
        agencyName: body.agencyName || "",
      },
    });
    res.status(201).json({ booking });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const data: Record<string, string> = {};
    if (status) data.status = status;
    if (paymentStatus) data.paymentStatus = paymentStatus;
    const booking = await db.booking.update({ where: { id: req.params.id as string }, data });
    res.json({ booking });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/customers", requireAuth, async (req: AuthRequest, res) => {
  try {
    const customers = await db.customer.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ customers, total: customers.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/customers", requireAuth, validate(customerSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const customer = await db.customer.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        type: body.type || "Individual",
        tier: body.tier || "Silver",
        passportNo: body.passportNo,
        visaStatus: body.visaStatus,
        city: body.city || "",
        agencyId: ownAgencyId(req, body.agencyId),
      },
    });
    res.status(201).json({ customer });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/leads", requireAuth, async (req: AuthRequest, res) => {
  try {
    const leads = await db.lead.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ leads, total: leads.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/leads", requireAuth, validate(leadSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const lead = await db.lead.create({
      data: {
        customerName: body.customerName,
        email: body.email || "",
        phone: body.phone || "",
        source: body.source,
        service: body.service,
        value: body.value,
        stage: body.stage || "New",
        assignedTo: body.assignedTo || "Unassigned",
        expectedClose: body.expectedClose || new Date().toISOString().slice(0, 10),
        notes: body.notes || "",
        agencyId: ownAgencyId(req),
      },
    });
    res.status(201).json({ lead });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    const { stage } = req.body;
    const lead = await db.lead.update({
      where: { id: req.params.id as string },
      data: { stage },
    });
    res.json({ lead });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/quotations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const quotations = await db.quotation.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ quotations, total: quotations.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/quotations", requireAuth, validate(quotationSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const count = await db.quotation.count();
    const quoteNo = body.quoteNo || `QT-2025-${String(count + 1).padStart(3, "0")}`;
    const quotation = await db.quotation.create({
      data: {
        quoteNo,
        customerName: body.customerName,
        service: body.service,
        items: body.items,
        amount: body.amount,
        gst: body.gst,
        total: body.total,
        status: body.status || "Draft",
        validTill: body.validTill,
        createdBy: body.createdBy || req.auth?.email || "System",
        agencyId: ownAgencyId(req),
      },
    });
    res.status(201).json({ quotation });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/payments", requireAuth, async (req: AuthRequest, res) => {
  try {
    const payments = await db.payment.findMany({ where: agencyScope(req), orderBy: { date: "desc" }, take: 200 });
    res.json({ payments, total: payments.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/payments", requireAuth, validate(paymentSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const txnId = `pay_${Date.now().toString(36).toUpperCase()}`;
    const payment = await db.payment.create({
      data: {
        txnId,
        customerName: body.customerName,
        bookingRef: body.bookingRef || "—",
        amount: body.amount,
        method: body.method,
        status: body.status || "Success",
        type: body.type || "Payment",
        gateway: body.gateway || "Razorpay",
        agencyId: ownAgencyId(req),
      },
    });
    res.status(201).json({ payment });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Razorpay: order creation + signature verification ─────────────────────
// Falls back to { configured: false } when no keys are set so the frontend
// can simulate payment locally (demo mode) without erroring out.
app.post("/api/payments/razorpay/order", requireAuth, async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return res.json({ configured: false });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
      }),
    });

    if (!rzpRes.ok) {
      const detail = await rzpRes.text();
      logger.error({ detail }, "Razorpay order creation failed");
      return res.status(502).json({ error: "Payment gateway error" });
    }

    const order = await rzpRes.json() as { id: string; amount: number; currency: string };
    res.json({ configured: true, orderId: order.id, amount: order.amount, currency: order.currency, keyId });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/payments/razorpay/verify", requireAuth, async (req, res) => {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const { orderId, paymentId, signature } = req.body ?? {};
    if (!keySecret || !orderId || !paymentId || !signature) {
      return res.status(400).json({ verified: false });
    }
    const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
    const verified = expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    res.json({ verified });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/agencies", requireAuth, requireRole("super_admin"), async (_req, res) => {
  try {
    const agencies = await db.agency.findMany({ orderBy: { createdAt: "desc" } });
    const enriched = await Promise.all(
      agencies.map(async (a) => {
        const [branches, employees] = await Promise.all([
          db.branch.count({ where: { agencyId: a.id } }),
          db.employee.count({ where: { agencyId: a.id } }),
        ]);
        const apiAllocation = a.apiAllocation && typeof a.apiAllocation === "object"
          ? a.apiAllocation
          : { flights: 0, hotels: 0, bus: 0, train: 0 };
        return { ...a, apiAllocation, branches, employees };
      })
    );
    res.json({ agencies: enriched, total: enriched.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/branches", requireAuth, async (req: AuthRequest, res) => {
  try {
    const requestedAgencyId = req.query.agencyId as string | undefined;
    const where = req.auth?.role === "super_admin"
      ? (requestedAgencyId ? { agencyId: requestedAgencyId } : {})
      : agencyScope(req);
    const branches = await db.branch.findMany({ where, orderBy: { createdAt: "desc" } });
    const enriched = await Promise.all(
      branches.map(async (b) => {
        const employees = await db.employee.count({
          where: { agencyId: b.agencyId, branch: { contains: b.city } },
        });
        return { ...b, employees: employees || 0 };
      })
    );
    res.json({ branches: enriched, total: enriched.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/employees", requireAuth, async (req: AuthRequest, res) => {
  try {
    const requestedAgencyId = req.query.agencyId as string | undefined;
    const where = req.auth?.role === "super_admin"
      ? (requestedAgencyId ? { agencyId: requestedAgencyId } : {})
      : agencyScope(req);
    const employees = await db.employee.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ employees, total: employees.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/employees", requireAuth, requireRole("super_admin", "agency_admin", "branch_manager"), validate(employeeSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    // branch managers may only onboard rank-and-file employees, not peers/accountants
    const role = req.auth?.role === "branch_manager" ? "employee" : body.role || "employee";
    const agencyId = ownAgencyId(req, body.agencyId);

    const employee = await db.employee.create({
      data: {
        agencyId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        designation: body.designation,
        department: body.department || "Sales",
        branch: body.branch || "",
        role,
        status: "Active",
        salary: body.salary || 0,
        target: body.target || 0,
        joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
      },
    });

    let tempPassword: string | undefined;
    try {
      tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      await db.user.create({
        data: {
          name: body.name,
          email: body.email,
          phone: body.phone,
          password: passwordHash,
          role,
          designation: body.designation,
          agencyId,
        },
      });
    } catch {
      // Email already has a login (or another conflict) — the Employee record
      // above still succeeds; no new/duplicate login is created.
      tempPassword = undefined;
    }

    res.status(201).json({ employee, tempPassword });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const tasks = await db.task.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ tasks, total: tasks.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/tasks", requireAuth, validate(taskSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const task = await db.task.create({
      data: {
        title: body.title,
        description: body.description || "",
        assignedTo: body.assignedTo,
        assignedBy: body.assignedBy || "System",
        priority: body.priority || "Medium",
        status: body.status || "To Do",
        dueDate: body.dueDate,
        relatedTo: body.relatedTo,
        agencyId: ownAgencyId(req),
      },
    });
    res.status(201).json({ task });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const { status, priority } = req.body;
    const data: Record<string, string> = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    const task = await db.task.update({ where: { id: req.params.id as string }, data });
    res.json({ task });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/audit-logs", requireAuth, requireRole("super_admin", "agency_admin"), async (req: AuthRequest, res) => {
  try {
    const logs = await db.auditLog.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ logs, total: logs.length });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/reports", requireAuth, async (req: AuthRequest, res) => {
  try {
    const scope = agencyScope(req);
    const [bookings, payments] = await Promise.all([
      db.booking.findMany({ where: scope, select: { service: true, amount: true, commission: true, createdAt: true, status: true } }),
      db.payment.findMany({ where: scope, select: { method: true, amount: true, status: true, type: true } }),
    ]);

    const byService: Record<string, { bookings: number; revenue: number }> = {};
    for (const b of bookings) {
      if (!byService[b.service]) byService[b.service] = { bookings: 0, revenue: 0 };
      byService[b.service].bookings += 1;
      byService[b.service].revenue += b.amount;
    }

    const byMethod: Record<string, number> = {};
    for (const p of payments.filter((x) => x.status === "Success")) {
      byMethod[p.method] = (byMethod[p.method] || 0) + 1;
    }

    const totalRevenue = bookings.reduce((s, b) => s + b.amount, 0);
    const totalCommission = bookings.reduce((s, b) => s + b.commission, 0);
    const confirmedBookings = bookings.filter((b) => !["Cancelled", "Failed"].includes(b.status)).length;

    res.json({
      summary: {
        totalRevenue,
        totalCommission,
        totalBookings: bookings.length,
        confirmedBookings,
        successPayments: payments.filter((p) => p.status === "Success").length,
      },
      byService: Object.entries(byService).map(([service, data]) => ({ service, ...data })),
      byPaymentMethod: Object.entries(byMethod).map(([method, count]) => ({ method, count })),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/flights/search", optionalAuth, async (req, res) => {
  const origin = (req.query.origin as string) || "BOM";
  const destination = (req.query.destination as string) || "DEL";
  const count = Math.min(parseInt(req.query.count as string) || 8, 20);
  res.json({ flights: generateFlights(origin, destination, count) });
});

app.get("/api/hotels/search", optionalAuth, async (req, res) => {
  const city = (req.query.city as string) || "Mumbai";
  const count = Math.min(parseInt(req.query.count as string) || 8, 20);
  res.json({ hotels: generateHotels(city, count) });
});

app.get("/api/dashboard", requireAuth, async (req: AuthRequest, res) => {
  try {
    const scope = agencyScope(req);
    const isSuperAdmin = req.auth?.role === "super_admin";
    const [bookings, agencies, customers, leads, payments] = await Promise.all([
      db.booking.count({ where: scope }),
      isSuperAdmin ? db.agency.count({ where: { status: "Active" } }) : Promise.resolve(1),
      db.customer.count({ where: scope }),
      db.lead.count({ where: scope }),
      db.payment.count({ where: { ...scope, status: "Success" } }),
    ]);
    res.json({ stats: { bookings, agencies, customers, leads, payments } });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/notifications", requireAuth, async (req: AuthRequest, res) => {
  try {
    const notifications = await db.notification.findMany({ where: agencyScope(req), orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ notifications });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const notification = await db.notification.update({
      where: { id: req.params.id as string },
      data: { read: true },
    });
    res.json({ notification });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.query.agencyId as string | undefined;
    if (!agencyId) {
      res.status(400).json({ error: "agencyId required" });
      return;
    }
    if (req.auth?.role !== "super_admin" && agencyId !== req.auth?.agencyId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const agency = await db.agency.findUnique({ where: { id: agencyId } });
    const txns = await db.walletTransaction.findMany({
      where: { agencyId },
      orderBy: { date: "desc" },
      take: 50,
    });
    res.json({ balance: agency?.walletBalance ?? 0, transactions: txns });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/wallet", requireAuth, validate(walletSchema), async (req: AuthRequest, res) => {
  try {
    const { agencyId, type, amount, source, description } = req.body;
    const id = agencyId || req.auth?.agencyId;
    if (!id || !type || !amount) {
      res.status(400).json({ error: "agencyId, type, and amount required" });
      return;
    }
    if (req.auth?.role !== "super_admin" && id !== req.auth?.agencyId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const agency = await db.agency.findUnique({ where: { id } });
    if (!agency) {
      res.status(404).json({ error: "Agency not found" });
      return;
    }
    const delta = type === "Credit" ? amount : -amount;
    const balance = agency.walletBalance + delta;
    if (balance < 0) {
      res.status(400).json({ error: "Insufficient balance" });
      return;
    }
    await db.agency.update({ where: { id }, data: { walletBalance: balance } });
    const txn = await db.walletTransaction.create({
      data: {
        agencyId: id,
        type,
        source: source || (type === "Credit" ? "Top-up" : "Transfer"),
        amount,
        balance,
        description: description || `${type} transaction`,
      },
    });
    res.status(201).json({ balance, transaction: txn });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});


// ── PATCH /api/quotations/:id ────────────────────────────────────────────────
app.patch("/api/quotations/:id", requireAuth, async (req, res) => {
  try {
    const { status, validTill } = req.body;
    const data: Record<string, string> = {};
    if (status) data.status = status;
    if (validTill) data.validTill = validTill;
    const quotation = await db.quotation.update({ where: { id: req.params.id as string }, data });
    res.json({ quotation });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/customers/:id ─────────────────────────────────────────────────
app.patch("/api/customers/:id", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, type, tier, passportNo, visaStatus, city } = req.body;
    const data: Record<string, string | undefined> = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (type) data.type = type;
    if (tier) data.tier = tier;
    if (passportNo !== undefined) data.passportNo = passportNo;
    if (visaStatus !== undefined) data.visaStatus = visaStatus;
    if (city !== undefined) data.city = city;
    const customer = await db.customer.update({ where: { id: req.params.id as string }, data });
    res.json({ customer });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/customers/:id ─────────────────────────────────────────────────
app.delete("/api/customers/:id", requireAuth, async (req, res) => {
  try {
    await db.customer.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/bookings/:id  (soft-cancel) ───────────────────────────────────
app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    const booking = await db.booking.update({
      where: { id: req.params.id as string },
      data: { status: "Cancelled" },
    });
    res.json({ booking });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    await db.task.delete({ where: { id: req.params.id as string } });
    res.json({ success: true });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/employees/:id ──────────────────────────────────────────────────
app.patch("/api/employees/:id", requireAuth, requireRole("super_admin", "agency_admin", "branch_manager"), validate(employeeUpdateSchema), async (req, res) => {
  try {
    const { name, email, phone, designation, department, branch, role, status, salary, target } = req.body;
    const data: Record<string, string | number | undefined> = {};
    if (name) data.name = name;
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (designation) data.designation = designation;
    if (department) data.department = department;
    if (branch !== undefined) data.branch = branch;
    if (role) data.role = role;
    if (status) data.status = status;
    if (salary !== undefined) data.salary = salary;
    if (target !== undefined) data.target = target;
    const employee = await db.employee.update({ where: { id: req.params.id as string }, data });
    res.json({ employee });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/branches ────────────────────────────────────────────────────────
app.post("/api/branches", requireAuth, requireRole("super_admin", "agency_admin"), validate(branchSchema), async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const branch = await db.branch.create({
      data: {
        agencyId: body.agencyId || req.auth?.agencyId || "",
        name: body.name,
        manager: body.manager,
        city: body.city,
        revenue: body.revenue || 0,
      },
    });
    res.status(201).json({ branch });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/branches/:id ───────────────────────────────────────────────────
app.patch("/api/branches/:id", requireAuth, requireRole("super_admin", "agency_admin"), validate(branchUpdateSchema), async (req, res) => {
  try {
    const { name, manager, city, revenue } = req.body;
    const data: Record<string, string | number | undefined> = {};
    if (name) data.name = name;
    if (manager) data.manager = manager;
    if (city) data.city = city;
    if (revenue !== undefined) data.revenue = revenue;
    const branch = await db.branch.update({ where: { id: req.params.id as string }, data });
    res.json({ branch });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/agencies ────────────────────────────────────────────────────────
app.post("/api/agencies", requireAuth, requireRole("super_admin"), validate(agencySchema), async (req, res) => {
  try {
    const body = req.body;
    const agency = await db.agency.create({
      data: {
        name: body.name,
        owner: body.owner,
        email: body.email,
        phone: body.phone,
        plan: body.plan || "Starter",
        status: body.status || "Trial",
        walletBalance: body.walletBalance || 0,
        apiAllocation: body.apiAllocation || { flights: 5000, hotels: 3000, bus: 2000, train: 1000 },
        gstNumber: body.gstNumber,
        panNumber: body.panNumber,
        address: body.address,
      },
    });

    let tempPassword: string | undefined;
    try {
      tempPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      await db.user.create({
        data: {
          name: body.owner,
          email: body.email,
          phone: body.phone,
          password: passwordHash,
          role: "agency_admin",
          designation: "Agency Owner",
          agencyId: agency.id,
        },
      });
    } catch {
      tempPassword = undefined;
    }

    res.status(201).json({ agency, tempPassword });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/agencies/:id ───────────────────────────────────────────────────
app.patch("/api/agencies/:id", requireAuth, requireRole("super_admin"), validate(agencyUpdateSchema), async (req, res) => {
  try {
    const { name, owner, email, phone, plan, status, walletBalance, apiAllocation, gstNumber, panNumber, address } = req.body;
    const data: Record<string, string | number | object | undefined> = {};
    if (name) data.name = name;
    if (owner) data.owner = owner;
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (plan) data.plan = plan;
    if (status) data.status = status;
    if (walletBalance !== undefined) data.walletBalance = walletBalance;
    if (apiAllocation) data.apiAllocation = apiAllocation;
    if (gstNumber !== undefined) data.gstNumber = gstNumber;
    if (panNumber !== undefined) data.panNumber = panNumber;
    if (address !== undefined) data.address = address;
    const agency = await db.agency.update({ where: { id: req.params.id as string }, data });
    res.json({ agency });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/commission ───────────────────────────────────────────────────────
app.get("/api/commission", requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookings = await db.booking.findMany({
      where: agencyScope(req),
      select: { agencyId: true, agencyName: true, agentName: true, commission: true, amount: true, status: true, createdAt: true },
    });

    const confirmedBookings = bookings.filter((b) => !["Cancelled", "Failed"].includes(b.status));

    // Per-agency commission
    const agencyMap: Record<string, { agency: string; bookings: number; revenue: number; commission: number }> = {};
    for (const b of confirmedBookings) {
      const key = b.agencyId || "unknown";
      if (!agencyMap[key]) agencyMap[key] = { agency: b.agencyName, bookings: 0, revenue: 0, commission: 0 };
      agencyMap[key].bookings += 1;
      agencyMap[key].revenue += b.amount;
      agencyMap[key].commission += b.commission;
    }

    // Per-agent top earners
    const agentMap: Record<string, { agent: string; bookings: number; commission: number }> = {};
    for (const b of confirmedBookings) {
      const key = b.agentName;
      if (!agentMap[key]) agentMap[key] = { agent: key, bookings: 0, commission: 0 };
      agentMap[key].bookings += 1;
      agentMap[key].commission += b.commission;
    }
    const topAgents = Object.values(agentMap)
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 10);

    // Monthly breakdown (last 6 months)
    const monthlyMap: Record<string, { month: string; bookings: number; commission: number }> = {};
    for (const b of confirmedBookings) {
      const m = b.createdAt.toISOString().slice(0, 7); // "YYYY-MM"
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, bookings: 0, commission: 0 };
      monthlyMap[m].bookings += 1;
      monthlyMap[m].commission += b.commission;
    }
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

    const totalCommission = confirmedBookings.reduce((s, b) => s + b.commission, 0);
    const totalRevenue = confirmedBookings.reduce((s, b) => s + b.amount, 0);
    const pendingCommission = Math.round(totalCommission * 0.12); // 12% held
    const paidCommission = totalCommission - pendingCommission;

    res.json({
      summary: { totalCommission, paidCommission, pendingCommission, totalRevenue, totalBookings: confirmedBookings.length },
      byAgency: Object.values(agencyMap),
      topAgents,
      monthly,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/finance ──────────────────────────────────────────────────────────
app.get("/api/finance", requireAuth, async (req: AuthRequest, res) => {
  try {
    const scope = agencyScope(req);
    const [bookings, payments] = await Promise.all([
      db.booking.findMany({
        where: scope,
        select: { amount: true, commission: true, status: true, service: true, createdAt: true, bookingRef: true, customerName: true, agencyName: true },
      }),
      db.payment.findMany({
        where: scope,
        select: { amount: true, method: true, status: true, type: true, date: true, txnId: true, customerName: true, bookingRef: true },
      }),
    ]);

    const confirmedBookings = bookings.filter((b) => !["Cancelled", "Failed"].includes(b.status));
    const successPayments = payments.filter((p) => p.status === "Success");

    const totalRevenue = confirmedBookings.reduce((s, b) => s + b.amount, 0);
    const totalCommission = confirmedBookings.reduce((s, b) => s + b.commission, 0);
    const gstRate = 0.18;
    const totalGst = Math.round(totalRevenue * gstRate);
    const netRevenue = totalRevenue - totalGst;
    const totalExpenses = Math.round(netRevenue * 0.32); // estimated 32% operating
    const netProfit = netRevenue - totalExpenses;

    // Monthly P&L (last 6 months)
    const monthlyMap: Record<string, { month: string; revenue: number; gst: number; expenses: number; profit: number }> = {};
    for (const b of confirmedBookings) {
      const m = b.createdAt.toISOString().slice(0, 7);
      if (!monthlyMap[m]) monthlyMap[m] = { month: m, revenue: 0, gst: 0, expenses: 0, profit: 0 };
      const rev = b.amount;
      const gst = Math.round(rev * gstRate);
      const net = rev - gst;
      const exp = Math.round(net * 0.32);
      monthlyMap[m].revenue += rev;
      monthlyMap[m].gst += gst;
      monthlyMap[m].expenses += exp;
      monthlyMap[m].profit += net - exp;
    }
    const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

    // By service revenue
    const serviceMap: Record<string, number> = {};
    for (const b of confirmedBookings) {
      serviceMap[b.service] = (serviceMap[b.service] || 0) + b.amount;
    }
    const byService = Object.entries(serviceMap).map(([service, revenue]) => ({ service, revenue }));

    // Latest invoices (top 20 bookings as invoices)
    const invoices = confirmedBookings
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20)
      .map((b) => ({
        ref: b.bookingRef,
        customer: b.customerName,
        agency: b.agencyName,
        service: b.service,
        amount: b.amount,
        gst: Math.round(b.amount * gstRate),
        total: b.amount + Math.round(b.amount * gstRate),
        date: b.createdAt.toISOString().slice(0, 10),
      }));

    res.json({
      summary: { totalRevenue, totalGst, netRevenue, totalCommission, totalExpenses, netProfit },
      monthly,
      byService,
      invoices,
      paymentMethods: successPayments.reduce((acc: Record<string, number>, p) => {
        acc[p.method] = (acc[p.method] || 0) + p.amount;
        return acc;
      }, {}),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/analytics/platform ───────────────────────────────────────────────
app.get("/api/analytics/platform", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const range = req.query.range === "yearly" ? "yearly" : "monthly";
    const [bookings, agencies, totalUsers] = await Promise.all([
      db.booking.findMany({
        select: { agencyId: true, agencyName: true, amount: true, commission: true, status: true, createdAt: true },
      }),
      db.agency.findMany({ select: { id: true, status: true } }),
      db.user.count(),
    ]);

    const confirmedBookings = bookings.filter((b) => !["Cancelled", "Failed"].includes(b.status));

    const bucketKey = (d: Date) => (range === "yearly" ? String(d.getFullYear()) : d.toISOString().slice(0, 7));
    const trendMap: Record<string, { period: string; revenue: number; commission: number; bookings: number }> = {};
    for (const b of confirmedBookings) {
      const key = bucketKey(b.createdAt);
      if (!trendMap[key]) trendMap[key] = { period: key, revenue: 0, commission: 0, bookings: 0 };
      trendMap[key].revenue += b.amount;
      trendMap[key].commission += b.commission;
      trendMap[key].bookings += 1;
    }
    const trendLimit = range === "yearly" ? 5 : 12;
    const trend = Object.values(trendMap).sort((a, b) => a.period.localeCompare(b.period)).slice(-trendLimit);

    const agencyMap: Record<string, { agency: string; bookings: number; revenue: number; commission: number }> = {};
    for (const b of confirmedBookings) {
      const key = b.agencyId || "unknown";
      if (!agencyMap[key]) agencyMap[key] = { agency: b.agencyName, bookings: 0, revenue: 0, commission: 0 };
      agencyMap[key].bookings += 1;
      agencyMap[key].revenue += b.amount;
      agencyMap[key].commission += b.commission;
    }
    const byAgency = Object.values(agencyMap).sort((a, b) => b.revenue - a.revenue);

    const totalRevenue = confirmedBookings.reduce((s, b) => s + b.amount, 0);
    const totalCommission = confirmedBookings.reduce((s, b) => s + b.commission, 0);

    res.json({
      summary: {
        totalRevenue,
        totalCommission,
        totalBookings: confirmedBookings.length,
        activeAgencies: agencies.filter((a) => a.status === "Active").length,
        totalUsers,
      },
      trend,
      byAgency,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/analytics/employees ──────────────────────────────────────────────
app.get("/api/analytics/employees", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const range = req.query.range === "yearly" ? "yearly" : "monthly";
    const [employees, bookings] = await Promise.all([
      db.employee.findMany({ orderBy: { createdAt: "desc" } }),
      db.booking.findMany({
        select: { agentName: true, amount: true, commission: true, status: true, createdAt: true },
      }),
    ]);

    const confirmedBookings = bookings.filter((b) => !["Cancelled", "Failed"].includes(b.status));
    const bucketKey = (d: Date) => (range === "yearly" ? String(d.getFullYear()) : d.toISOString().slice(0, 7));
    const trendLimit = range === "yearly" ? 5 : 12;

    const performance = employees.map((e) => {
      const own = confirmedBookings.filter((b) => b.agentName === e.name);
      const revenue = own.reduce((s, b) => s + b.amount, 0);
      const commission = own.reduce((s, b) => s + b.commission, 0);

      const trendMap: Record<string, { period: string; revenue: number; commission: number; bookings: number }> = {};
      for (const b of own) {
        const key = bucketKey(b.createdAt);
        if (!trendMap[key]) trendMap[key] = { period: key, revenue: 0, commission: 0, bookings: 0 };
        trendMap[key].revenue += b.amount;
        trendMap[key].commission += b.commission;
        trendMap[key].bookings += 1;
      }
      const trend = Object.values(trendMap).sort((a, b) => a.period.localeCompare(b.period)).slice(-trendLimit);

      return {
        id: e.id,
        name: e.name,
        designation: e.designation,
        department: e.department,
        branch: e.branch,
        status: e.status,
        target: e.target,
        achieved: commission || e.achieved,
        attendance: e.attendance,
        bookings: own.length,
        revenue,
        commission,
        trend,
      };
    });

    const topPerformers = [...performance].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    res.json({
      employees: performance,
      topPerformers,
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// --- Phase 2 Endpoints ---

app.get("/api/marketing/campaigns", optionalAuth, async (req, res) => {
  try {
    const campaigns = await db.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ campaigns });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/marketing/campaigns", requireAuth, requireRole("super_admin", "agency_admin"), async (req, res) => {
  try {
    const data = req.body;
    const campaign = await db.marketingCampaign.create({ data });
    res.json(campaign);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/cms/pages", optionalAuth, async (req, res) => {
  try {
    const pages = await db.contentPage.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ pages });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/cms/pages", requireAuth, requireRole("super_admin", "agency_admin"), async (req, res) => {
  try {
    const data = req.body;
    const page = await db.contentPage.create({ data });
    res.json(page);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/management/keys", optionalAuth, async (req, res) => {
  try {
    const keys = await db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ keys });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/management/keys", requireAuth, requireRole("super_admin", "agency_admin"), async (req, res) => {
  try {
    const data = req.body;
    const key = await db.apiKey.create({ data });
    res.json(key);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/support/tickets", optionalAuth, async (req, res) => {
  try {
    const tickets = await db.supportTicket.findMany({
      include: { messages: true },
      orderBy: { createdAt: "desc" }
    });
    res.json({ tickets });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/support/tickets", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const ticket = await db.supportTicket.create({ data });
    res.json(ticket);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/settings", requireAuth, async (req: AuthRequest, res) => {
  try {
    const agencyId = req.auth?.agencyId || "ag-1";
    let settings = await db.settings.findUnique({ where: { agencyId } });
    if (!settings) {
      settings = await db.settings.create({ data: { agencyId } });
    }
    res.json(settings);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/settings", requireAuth, requireRole("super_admin", "agency_admin"), async (req: AuthRequest, res) => {
  try {
    const agencyId = req.auth?.agencyId || "ag-1";
    const data = req.body;
    const settings = await db.settings.upsert({
      where: { agencyId },
      update: data,
      create: { ...data, agencyId }
    });
    res.json(settings);
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/monitoring/metrics", requireAuth, requireRole("super_admin"), async (req, res) => {
  try {
    const dbStart = Date.now();
    let dbHealthy = true;
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      dbHealthy = false;
    }
    const dbLatencyMs = Date.now() - dbStart;
    const mem = process.memoryUsage();
    const uptimeMinutes = process.uptime() / 60;
    const requestsPerMin = uptimeMinutes > 0 ? Math.round(requestCount / uptimeMinutes) : requestCount;
    const errorRate = requestCount > 0 ? ((errorCount / requestCount) * 100).toFixed(2) + "%" : "0.00%";
    res.json({
      uptime: process.uptime(),
      memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
      db: { healthy: dbHealthy, latencyMs: dbLatencyMs },
      requestsPerMin,
      totalRequests: requestCount,
      errorRate,
      windowStart: new Date(requestWindowStart).toISOString(),
    });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export { app, PORT };

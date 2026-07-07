import express from "express";
import cors from "cors";
import { db } from "./lib/db.js";
import { signToken } from "./lib/jwt.js";
import { requireAuth, optionalAuth, type AuthRequest } from "./middleware/auth.js";
import { generateFlights, generateHotels } from "./lib/mock-data.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "travelpro-backend", timestamp: new Date().toISOString() });
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
    ],
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, role } = req.body;
    const user = await db.user.findFirst({
      where: { OR: [{ email }, ...(role ? [{ role }] : [])] },
      include: { agency: true, branch: true },
    });
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    await db.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await db.auditLog.create({
      data: { userId: user.id, userName: user.name, action: "Login", module: "Auth", ip: req.ip || "0.0.0.0" },
    });
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      agencyId: user.agencyId,
    });
    res.json({ user, token });
  } catch {
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
    res.json({ user });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/bookings", optionalAuth, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const service = req.query.service as string | undefined;
    const search = req.query.q as string | undefined;
    const where: Record<string, unknown> = {};
    if (status && status !== "All") where.status = status;
    if (service && service !== "All") where.service = service;
    if (search) where.customerName = { contains: search };
    const bookings = await db.booking.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ bookings, total: bookings.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/bookings", requireAuth, async (req: AuthRequest, res) => {
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
        agencyId: body.agencyId || req.auth?.agencyId,
        agencyName: body.agencyName || "",
      },
    });
    res.status(201).json({ booking });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const data: Record<string, string> = {};
    if (status) data.status = status;
    if (paymentStatus) data.paymentStatus = paymentStatus;
    const booking = await db.booking.update({ where: { id: req.params.id }, data });
    res.json({ booking });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/customers", optionalAuth, async (_req, res) => {
  try {
    const customers = await db.customer.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ customers, total: customers.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/customers", requireAuth, async (req: AuthRequest, res) => {
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
        agencyId: body.agencyId || req.auth?.agencyId,
      },
    });
    res.status(201).json({ customer });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/leads", optionalAuth, async (_req, res) => {
  try {
    const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ leads, total: leads.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/leads", requireAuth, async (req, res) => {
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
      },
    });
    res.status(201).json({ lead });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/leads/:id", requireAuth, async (req, res) => {
  try {
    const { stage } = req.body;
    const lead = await db.lead.update({
      where: { id: req.params.id },
      data: { stage },
    });
    res.json({ lead });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/quotations", optionalAuth, async (_req, res) => {
  try {
    const quotations = await db.quotation.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ quotations, total: quotations.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/quotations", requireAuth, async (req: AuthRequest, res) => {
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
      },
    });
    res.status(201).json({ quotation });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/payments", optionalAuth, async (_req, res) => {
  try {
    const payments = await db.payment.findMany({ orderBy: { date: "desc" }, take: 200 });
    res.json({ payments, total: payments.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/payments", requireAuth, async (req, res) => {
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
      },
    });
    res.status(201).json({ payment });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/agencies", optionalAuth, async (_req, res) => {
  try {
    const agencies = await db.agency.findMany({ orderBy: { createdAt: "desc" } });
    const enriched = await Promise.all(
      agencies.map(async (a) => {
        const [branches, employees] = await Promise.all([
          db.branch.count({ where: { agencyId: a.id } }),
          db.employee.count({ where: { agencyId: a.id } }),
        ]);
        let apiAllocation = { flights: 0, hotels: 0, bus: 0, train: 0 };
        try {
          apiAllocation = JSON.parse(a.apiAllocation);
        } catch {
          /* keep defaults */
        }
        return { ...a, apiAllocation, branches, employees };
      })
    );
    res.json({ agencies: enriched, total: enriched.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/branches", optionalAuth, async (req, res) => {
  try {
    const agencyId = req.query.agencyId as string | undefined;
    const where = agencyId ? { agencyId } : {};
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
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/employees", optionalAuth, async (req, res) => {
  try {
    const agencyId = req.query.agencyId as string | undefined;
    const where = agencyId ? { agencyId } : {};
    const employees = await db.employee.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ employees, total: employees.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/employees", requireAuth, async (req: AuthRequest, res) => {
  try {
    const body = req.body;
    const employee = await db.employee.create({
      data: {
        agencyId: body.agencyId || req.auth?.agencyId,
        name: body.name,
        email: body.email,
        phone: body.phone,
        designation: body.designation,
        department: body.department || "Sales",
        branch: body.branch || "",
        role: body.role || "employee",
        status: "Active",
        salary: body.salary || 0,
        target: body.target || 0,
        joinDate: body.joinDate || new Date().toISOString().slice(0, 10),
      },
    });
    res.status(201).json({ employee });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/tasks", optionalAuth, async (_req, res) => {
  try {
    const tasks = await db.task.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
    res.json({ tasks, total: tasks.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/tasks", requireAuth, async (req, res) => {
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
      },
    });
    res.status(201).json({ task });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const { status, priority } = req.body;
    const data: Record<string, string> = {};
    if (status) data.status = status;
    if (priority) data.priority = priority;
    const task = await db.task.update({ where: { id: req.params.id }, data });
    res.json({ task });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/audit-logs", requireAuth, async (_req, res) => {
  try {
    const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
    res.json({ logs, total: logs.length });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/reports", optionalAuth, async (_req, res) => {
  try {
    const [bookings, payments] = await Promise.all([
      db.booking.findMany({ select: { service: true, amount: true, commission: true, createdAt: true, status: true } }),
      db.payment.findMany({ select: { method: true, amount: true, status: true, type: true } }),
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
  } catch {
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

app.get("/api/dashboard", optionalAuth, async (_req, res) => {
  try {
    const [bookings, agencies, customers, leads, payments] = await Promise.all([
      db.booking.count(),
      db.agency.count({ where: { status: "Active" } }),
      db.customer.count(),
      db.lead.count(),
      db.payment.count({ where: { status: "Success" } }),
    ]);
    res.json({ stats: { bookings, agencies, customers, leads, payments } });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/notifications", optionalAuth, async (_req, res) => {
  try {
    const notifications = await db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
    res.json({ notifications });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const notification = await db.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json({ notification });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/wallet", optionalAuth, async (req, res) => {
  try {
    const agencyId = req.query.agencyId as string | undefined;
    if (!agencyId) {
      res.status(400).json({ error: "agencyId required" });
      return;
    }
    const agency = await db.agency.findUnique({ where: { id: agencyId } });
    const txns = await db.walletTransaction.findMany({
      where: { agencyId },
      orderBy: { date: "desc" },
      take: 50,
    });
    res.json({ balance: agency?.walletBalance ?? 0, transactions: txns });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/wallet", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { agencyId, type, amount, source, description } = req.body;
    const id = agencyId || req.auth?.agencyId;
    if (!id || !type || !amount) {
      res.status(400).json({ error: "agencyId, type, and amount required" });
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
  } catch {
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
    const quotation = await db.quotation.update({ where: { id: req.params.id }, data });
    res.json({ quotation });
  } catch {
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
    const customer = await db.customer.update({ where: { id: req.params.id }, data });
    res.json({ customer });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/customers/:id ─────────────────────────────────────────────────
app.delete("/api/customers/:id", requireAuth, async (req, res) => {
  try {
    await db.customer.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/bookings/:id  (soft-cancel) ───────────────────────────────────
app.delete("/api/bookings/:id", requireAuth, async (req, res) => {
  try {
    const booking = await db.booking.update({
      where: { id: req.params.id },
      data: { status: "Cancelled" },
    });
    res.json({ booking });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── DELETE /api/tasks/:id ─────────────────────────────────────────────────────
app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    await db.task.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/employees/:id ──────────────────────────────────────────────────
app.patch("/api/employees/:id", requireAuth, async (req, res) => {
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
    const employee = await db.employee.update({ where: { id: req.params.id }, data });
    res.json({ employee });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/branches ────────────────────────────────────────────────────────
app.post("/api/branches", requireAuth, async (req: AuthRequest, res) => {
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
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/branches/:id ───────────────────────────────────────────────────
app.patch("/api/branches/:id", requireAuth, async (req, res) => {
  try {
    const { name, manager, city, revenue } = req.body;
    const data: Record<string, string | number | undefined> = {};
    if (name) data.name = name;
    if (manager) data.manager = manager;
    if (city) data.city = city;
    if (revenue !== undefined) data.revenue = revenue;
    const branch = await db.branch.update({ where: { id: req.params.id }, data });
    res.json({ branch });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── POST /api/agencies ────────────────────────────────────────────────────────
app.post("/api/agencies", requireAuth, async (req, res) => {
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
        apiAllocation: JSON.stringify(body.apiAllocation || { flights: 5000, hotels: 3000, bus: 2000, train: 1000 }),
        gstNumber: body.gstNumber,
        panNumber: body.panNumber,
        address: body.address,
      },
    });
    res.status(201).json({ agency });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── PATCH /api/agencies/:id ───────────────────────────────────────────────────
app.patch("/api/agencies/:id", requireAuth, async (req, res) => {
  try {
    const { name, owner, email, phone, plan, status, walletBalance, apiAllocation, gstNumber, panNumber, address } = req.body;
    const data: Record<string, string | number | undefined> = {};
    if (name) data.name = name;
    if (owner) data.owner = owner;
    if (email) data.email = email;
    if (phone) data.phone = phone;
    if (plan) data.plan = plan;
    if (status) data.status = status;
    if (walletBalance !== undefined) data.walletBalance = walletBalance;
    if (apiAllocation) data.apiAllocation = JSON.stringify(apiAllocation);
    if (gstNumber !== undefined) data.gstNumber = gstNumber;
    if (panNumber !== undefined) data.panNumber = panNumber;
    if (address !== undefined) data.address = address;
    const agency = await db.agency.update({ where: { id: req.params.id }, data });
    res.json({ agency });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/commission ───────────────────────────────────────────────────────
app.get("/api/commission", optionalAuth, async (_req, res) => {
  try {
    const bookings = await db.booking.findMany({
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
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/finance ──────────────────────────────────────────────────────────
app.get("/api/finance", optionalAuth, async (_req, res) => {
  try {
    const [bookings, payments] = await Promise.all([
      db.booking.findMany({
        select: { amount: true, commission: true, status: true, service: true, createdAt: true, bookingRef: true, customerName: true, agencyName: true },
      }),
      db.payment.findMany({
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
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// --- Phase 2 Endpoints ---

app.get("/api/marketing/campaigns", optionalAuth, async (req, res) => {
  try {
    const campaigns = await db.marketingCampaign.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ campaigns });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/marketing/campaigns", optionalAuth, async (req, res) => {
  try {
    const data = req.body;
    const campaign = await db.marketingCampaign.create({ data });
    res.json(campaign);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/cms/pages", optionalAuth, async (req, res) => {
  try {
    const pages = await db.contentPage.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ pages });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/cms/pages", optionalAuth, async (req, res) => {
  try {
    const data = req.body;
    const page = await db.contentPage.create({ data });
    res.json(page);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/management/keys", optionalAuth, async (req, res) => {
  try {
    const keys = await db.apiKey.findMany({ orderBy: { createdAt: "desc" } });
    res.json({ keys });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/management/keys", optionalAuth, async (req, res) => {
  try {
    const data = req.body;
    const key = await db.apiKey.create({ data });
    res.json(key);
  } catch (e) {
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
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/support/tickets", optionalAuth, async (req, res) => {
  try {
    const data = req.body;
    const ticket = await db.supportTicket.create({ data });
    res.json(ticket);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/settings", optionalAuth, async (req, res) => {
  try {
    const agencyId = "ag-1";
    let settings = await db.settings.findUnique({ where: { agencyId } });
    if (!settings) {
      settings = await db.settings.create({ data: { agencyId } });
    }
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/settings", optionalAuth, async (req, res) => {
  try {
    const agencyId = "ag-1";
    const data = req.body;
    const settings = await db.settings.upsert({
      where: { agencyId },
      update: data,
      create: { ...data, agencyId }
    });
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/monitoring/metrics", optionalAuth, async (req, res) => {
  try {
    res.json({
      cpu: "12%",
      memory: "1.2GB",
      uptime: process.uptime(),
      requestsPerMin: 124,
      errorRate: "0.1%",
    });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/bus/search", optionalAuth, async (req, res) => {
  res.json({ results: [{ id: "bs-1", operator: "VRL Travels", route: "MUM-GOA", price: 1200 }] });
});

app.get("/api/train/search", optionalAuth, async (req, res) => {
  res.json({ results: [{ id: "tr-1", trainName: "Rajdhani Exp", route: "MUM-DEL", price: 3200 }] });
});

app.get("/api/holiday/search", optionalAuth, async (req, res) => {
  res.json({ results: [{ id: "hol-1", title: "Goa Beach Resort", duration: "3N/4D", price: 15000 }] });
});

app.get("/api/visa/search", optionalAuth, async (req, res) => {
  res.json({ results: [{ id: "vs-1", country: "Schengen", type: "Tourist", price: 12000 }] });
});

app.get("/api/insurance/search", optionalAuth, async (req, res) => {
  res.json({ results: [{ id: "ins-1", provider: "ICICI Lombard", coverage: "100K USD", price: 1800 }] });
});


app.listen(PORT, () => {
  console.log(`Trevio API running on http://localhost:${PORT}`);

});

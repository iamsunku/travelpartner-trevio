import type { Express, Response } from "express";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { requireAuth, requirePermission, type AuthRequest } from "../middleware/auth.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;
type OwnAgencyFn = (req: AuthRequest, fallback?: string) => string | null | undefined;
type BranchScopeFn = (req: AuthRequest, field: string) => Record<string, unknown>;

function agencyIdOrNull(req: AuthRequest, ownAgencyId: OwnAgencyFn): string | null {
  return ownAgencyId(req) || req.auth?.agencyId || null;
}

export function mountFinanceRoutes(
  app: Express,
  agencyScope: ScopeFn,
  ownAgencyId: OwnAgencyFn,
  branchScope: BranchScopeFn,
) {
  app.get("/api/finance", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      const bookingScope = { ...agencyScope(req), ...branchScope(req, "agentId") };
      const paymentScope = { ...agencyScope(req), ...branchScope(req, "collectedById") };
      const agencyId = agencyIdOrNull(req, ownAgencyId);
      const expenseWhere = agencyId ? { agencyId } : {};
      const invoiceWhere = agencyId ? { agencyId } : {};

      const [bookings, payments, invoicesRows, expenses, tdsRows] = await Promise.all([
        db.booking.findMany({
          where: bookingScope,
          select: {
            amount: true,
            commission: true,
            status: true,
            service: true,
            createdAt: true,
            bookingRef: true,
            customerName: true,
            agencyName: true,
            paymentStatus: true,
          },
        }),
        db.payment.findMany({
          where: paymentScope,
          select: { amount: true, method: true, status: true },
        }),
        db.bookingInvoice.findMany({
          where: invoiceWhere,
          include: {
            booking: {
              select: {
                customerName: true,
                bookingRef: true,
                service: true,
                agencyName: true,
                paymentStatus: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.expense.findMany({
          where: expenseWhere,
          orderBy: { date: "desc" },
          take: 200,
        }),
        db.tdsEntry.findMany({
          where: expenseWhere,
          orderBy: { date: "desc" },
          take: 200,
        }),
      ]);

      const confirmedBookings = bookings.filter((b) => !["Cancelled", "Failed"].includes(b.status));
      const successPayments = payments.filter((p) => p.status === "Success");

      const totalRevenue = confirmedBookings.reduce((s, b) => s + b.amount, 0);
      const totalCommission = confirmedBookings.reduce((s, b) => s + b.commission, 0);
      const totalGst = invoicesRows.reduce((s, inv) => s + inv.gst, 0);
      const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
      const totalTds = tdsRows.reduce((s, t) => s + t.deducted, 0);
      const netRevenue = Math.max(0, totalRevenue - totalGst);
      const netProfit = totalRevenue - totalExpenses - totalTds - totalCommission;

      const monthlyMap: Record<string, { month: string; revenue: number; gst: number; expenses: number; profit: number }> = {};
      for (const b of confirmedBookings) {
        const m = b.createdAt.toISOString().slice(0, 7);
        if (!monthlyMap[m]) monthlyMap[m] = { month: m, revenue: 0, gst: 0, expenses: 0, profit: 0 };
        monthlyMap[m].revenue += b.amount;
      }
      for (const inv of invoicesRows) {
        const m = inv.createdAt.toISOString().slice(0, 7);
        if (!monthlyMap[m]) monthlyMap[m] = { month: m, revenue: 0, gst: 0, expenses: 0, profit: 0 };
        monthlyMap[m].gst += inv.gst;
      }
      for (const e of expenses) {
        const m = (e.date || "").slice(0, 7);
        if (!m) continue;
        if (!monthlyMap[m]) monthlyMap[m] = { month: m, revenue: 0, gst: 0, expenses: 0, profit: 0 };
        monthlyMap[m].expenses += e.amount;
      }
      for (const row of Object.values(monthlyMap)) {
        row.profit = row.revenue - row.expenses - row.gst;
      }
      const monthly = Object.values(monthlyMap).sort((a, b) => a.month.localeCompare(b.month)).slice(-6);

      const serviceMap: Record<string, number> = {};
      for (const b of confirmedBookings) {
        serviceMap[b.service] = (serviceMap[b.service] || 0) + b.amount;
      }
      const byService = Object.entries(serviceMap).map(([service, revenue]) => ({ service, revenue }));

      const expenseByCategoryMap: Record<string, number> = {};
      for (const e of expenses) {
        expenseByCategoryMap[e.category] = (expenseByCategoryMap[e.category] || 0) + e.amount;
      }
      const expenseByCategory = Object.entries(expenseByCategoryMap).map(([name, value]) => ({ name, value }));

      const invoices = invoicesRows.map((inv) => {
        const paid = inv.booking?.paymentStatus === "Paid" || inv.booking?.paymentStatus === "Success";
        return {
          id: inv.id,
          ref: inv.invoiceNo,
          bookingRef: inv.booking?.bookingRef || "",
          bookingId: inv.bookingId,
          customer: inv.booking?.customerName || "Customer",
          agency: inv.booking?.agencyName || "",
          service: inv.booking?.service || inv.invoiceType,
          amount: inv.amount,
          gst: inv.gst,
          total: inv.total,
          status: inv.status === "Cancelled" ? "Cancelled" : paid ? "Paid" : "Pending",
          date: inv.createdAt.toISOString().slice(0, 10),
          invoiceType: inv.invoiceType,
        };
      });

      // GST filing summary from invoice months
      const gstFilingMap: Record<string, { month: string; taxable: number; cgst: number; sgst: number; igst: number; status: string }> = {};
      for (const inv of invoicesRows) {
        const m = inv.createdAt.toISOString().slice(0, 7);
        if (!gstFilingMap[m]) {
          gstFilingMap[m] = { month: m, taxable: 0, cgst: 0, sgst: 0, igst: 0, status: "Pending" };
        }
        const taxable = Math.max(0, inv.amount - inv.gst);
        gstFilingMap[m].taxable += taxable;
        const half = Math.round(inv.gst / 2);
        gstFilingMap[m].cgst += half;
        gstFilingMap[m].sgst += inv.gst - half;
      }
      const gstFilings = Object.values(gstFilingMap).sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12);

      res.json({
        summary: {
          totalRevenue,
          totalGst,
          netRevenue,
          totalCommission,
          totalExpenses,
          totalTds,
          netProfit,
        },
        monthly,
        byService,
        invoices,
        expenses: expenses.map((e) => ({
          id: e.id,
          category: e.category,
          description: e.description,
          amount: e.amount,
          date: e.date,
          paidBy: e.paidBy || "",
        })),
        expenseByCategory,
        tds: tdsRows.map((t) => ({
          id: t.id,
          section: t.section,
          nature: t.nature,
          amount: t.amount,
          rate: t.rate,
          deducted: t.deducted,
          status: t.status,
          date: t.date,
          partyName: t.partyName || "",
        })),
        gstFilings,
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

  app.post("/api/finance/expenses", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = agencyIdOrNull(req, ownAgencyId);
      if (!agencyId) {
        res.status(400).json({ error: "Agency context required" });
        return;
      }
      const { category, description, amount, date, paidBy } = req.body ?? {};
      if (!category || !description || !amount || !date) {
        res.status(400).json({ error: "category, description, amount, and date are required" });
        return;
      }
      const expense = await db.expense.create({
        data: {
          agencyId,
          category: String(category),
          description: String(description),
          amount: Math.round(Number(amount) || 0),
          date: String(date).slice(0, 10),
          paidBy: paidBy ? String(paidBy) : req.auth?.email || null,
          createdById: req.auth?.userId,
        },
      });
      res.status(201).json({ expense });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/finance/expenses/:id", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = agencyIdOrNull(req, ownAgencyId);
      const id = String(req.params.id);
      const existing = await db.expense.findFirst({
        where: { id, ...(agencyId ? { agencyId } : {}) },
      });
      if (!existing) {
        res.status(404).json({ error: "Expense not found" });
        return;
      }
      await db.expense.delete({ where: { id } });
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/finance/tds", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = agencyIdOrNull(req, ownAgencyId);
      if (!agencyId) {
        res.status(400).json({ error: "Agency context required" });
        return;
      }
      const { section, nature, amount, rate, date, partyName, status } = req.body ?? {};
      if (!section || !nature || amount == null || rate == null || !date) {
        res.status(400).json({ error: "section, nature, amount, rate, and date are required" });
        return;
      }
      const base = Math.round(Number(amount) || 0);
      const pct = Number(rate) || 0;
      const deducted = Math.round(base * (pct / 100));
      const entry = await db.tdsEntry.create({
        data: {
          agencyId,
          section: String(section),
          nature: String(nature),
          amount: base,
          rate: pct,
          deducted,
          date: String(date).slice(0, 10),
          partyName: partyName ? String(partyName) : null,
          status: status ? String(status) : "Pending",
          createdById: req.auth?.userId,
        },
      });
      res.status(201).json({ tds: entry });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.patch("/api/finance/tds/:id", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = agencyIdOrNull(req, ownAgencyId);
      const id = String(req.params.id);
      const existing = await db.tdsEntry.findFirst({
        where: { id, ...(agencyId ? { agencyId } : {}) },
      });
      if (!existing) {
        res.status(404).json({ error: "TDS entry not found" });
        return;
      }
      const status = req.body?.status ? String(req.body.status) : existing.status;
      const updated = await db.tdsEntry.update({
        where: { id },
        data: { status },
      });
      res.json({ tds: updated });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  /** Printable tax invoice HTML (branding + signature). */
  app.get("/api/finance/invoices/:id/print", requireAuth, requirePermission("finance"), async (req: AuthRequest, res: Response) => {
    try {
      const agencyId = agencyIdOrNull(req, ownAgencyId);
      const id = String(req.params.id);
      const invoice = await db.bookingInvoice.findFirst({
        where: { id, ...(agencyId ? { agencyId } : {}) },
        include: {
          booking: {
            select: {
              customerName: true,
              bookingRef: true,
              service: true,
              route: true,
              travelDate: true,
              agencyId: true,
            },
          },
        },
      });
      if (!invoice) {
        res.status(404).json({ error: "Invoice not found" });
        return;
      }
      const aid = invoice.agencyId || invoice.booking?.agencyId || agencyId;
      const [agency, branding] = await Promise.all([
        aid ? db.agency.findUnique({ where: { id: aid } }) : null,
        aid ? db.agencyBranding.findUnique({ where: { agencyId: aid } }) : null,
      ]);
      const company = agency?.name || "Trevio Global";
      const logo = branding?.logo || agency?.logo || "";
      const signature = branding?.signatureUrl || "";
      const signatory = branding?.authorizedSignatory || agency?.owner || "Authorized Signatory";
      const address = [agency?.address, agency?.city, agency?.state, agency?.country].filter(Boolean).join(", ");
      const gstin = agency?.gstNumber || "";
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${invoice.invoiceNo}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;color:#0f172a;padding:28px;max-width:800px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f766e;padding-bottom:14px;margin-bottom:18px}
.logo{max-height:56px;max-width:180px}
.muted{color:#64748b;font-size:12px}
table{width:100%;border-collapse:collapse;margin-top:12px}
th,td{padding:8px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:left}
.totals{width:280px;margin-left:auto;margin-top:16px}
.sign{margin-top:48px;display:flex;justify-content:flex-end;text-align:center}
.sign img{max-height:64px;max-width:160px;display:block;margin:0 auto 6px}
</style></head><body>
<div class="header">
  <div>
    ${logo ? `<img class="logo" src="${logo}" alt="logo"/>` : `<h2 style="margin:0;color:#0f766e">${company}</h2>`}
    <p class="muted">${address || ""}</p>
    <p class="muted">${agency?.email || ""} · ${agency?.phone || ""}</p>
    ${gstin ? `<p class="muted">GSTIN: ${gstin}</p>` : ""}
  </div>
  <div style="text-align:right">
    <div><strong>${invoice.invoiceType}</strong></div>
    <div>${invoice.invoiceNo}</div>
    <div class="muted">${invoice.createdAt.toISOString().slice(0, 10)}</div>
  </div>
</div>
<p><strong>Bill To:</strong> ${invoice.booking?.customerName || "Customer"}</p>
<p class="muted">Booking ${invoice.booking?.bookingRef || ""} · ${invoice.booking?.service || ""} · ${invoice.booking?.route || ""}</p>
<table>
  <thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
  <tbody>
    <tr><td>Travel package / services</td><td style="text-align:right">₹${invoice.amount.toLocaleString("en-IN")}</td></tr>
  </tbody>
</table>
<table class="totals">
  <tr><td>Taxable</td><td style="text-align:right">₹${Math.max(0, invoice.amount - invoice.gst).toLocaleString("en-IN")}</td></tr>
  <tr><td>GST</td><td style="text-align:right">₹${invoice.gst.toLocaleString("en-IN")}</td></tr>
  <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>₹${invoice.total.toLocaleString("en-IN")}</strong></td></tr>
</table>
<div class="sign">
  <div>
    ${signature ? `<img src="${signature}" alt="signature"/>` : `<div style="height:48px"></div>`}
    <div><strong>${signatory}</strong></div>
    <div class="muted">Authorized Signatory · ${company}</div>
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

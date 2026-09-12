import type { Express, Response } from "express";
import rateLimit from "express-rate-limit";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { isAgentLike } from "../lib/quotations.js";
import { agentCanAccessQuote, agentQuoteScope } from "../lib/quote-access.js";
import {
  CustomerAccessError,
  createCustomerAccessLink,
  getCustomerQuotationByToken,
  resolveAppOrigin,
  revokeCustomerAccessForQuotation,
  submitCustomerResponse,
  type CustomerResponseType,
} from "../lib/quotation-customer-access.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;
type BranchScopeFn = (req: AuthRequest, field?: string) => Record<string, unknown>;

function paramToken(req: AuthRequest): string {
  const raw = req.params.token;
  return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
}

function paramId(req: AuthRequest): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
}

const customerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 60 : 400,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: { error: "Too many requests. Please try again later." },
});

async function loadQuoteScoped(
  req: AuthRequest,
  agencyScope: ScopeFn,
  branchScope: BranchScopeFn,
) {
  const quote = await db.quotation.findFirst({
    where: {
      id: paramId(req),
      deletedAt: null,
      ...agencyScope(req),
      ...branchScope(req, "createdById"),
      ...agentQuoteScope(req.auth?.role, req.auth?.userId),
    },
    include: { approvals: true },
  });
  if (!quote) return null;
  if (!agentCanAccessQuote(req.auth?.role, req.auth?.userId, quote)) return null;
  return quote;
}

function handleCustomerError(res: Response, e: unknown) {
  if (e instanceof CustomerAccessError) {
    res.status(e.statusCode).json({ error: e.message, code: e.code });
    return;
  }
  logger.error(e);
  res.status(500).json({ error: "Server error" });
}

export function mountCustomerQuotationRoutes(
  app: Express,
  agencyScope: ScopeFn,
  branchScope: BranchScopeFn,
) {
  // ── Public customer API (token in path; no login) ─────────────────────────
  app.get("/api/customer/quotations/:token", customerLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const result = await getCustomerQuotationByToken(paramToken(req));
      res.json(result);
    } catch (e) {
      handleCustomerError(res, e);
    }
  });

  app.post("/api/customer/quotations/:token/accept", customerLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const result = await submitCustomerResponse({
        rawToken: paramToken(req),
        responseType: "Accept",
        comment: req.body?.comment,
        customerName: req.body?.customerName || req.body?.personName,
        customerEmail: req.body?.customerEmail || req.body?.email,
        selectedPackageId: req.body?.selectedPackageId,
        personName: req.body?.personName || req.body?.customerName,
      });
      res.json({
        ok: true,
        idempotent: result.idempotent,
        response: {
          id: result.response?.id,
          responseType: result.response?.responseType,
          versionNumber: result.response?.versionNumber,
          createdAt: result.response?.createdAt,
          comment: result.response?.comment,
        },
        quotation: result.quotation,
      });
    } catch (e) {
      handleCustomerError(res, e);
    }
  });

  app.post("/api/customer/quotations/:token/reject", customerLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const result = await submitCustomerResponse({
        rawToken: paramToken(req),
        responseType: "Reject",
        comment: req.body?.reason || req.body?.comment,
        customerName: req.body?.customerName || req.body?.personName,
        customerEmail: req.body?.customerEmail || req.body?.email,
        personName: req.body?.personName || req.body?.customerName,
      });
      res.json({
        ok: true,
        idempotent: result.idempotent,
        response: {
          id: result.response?.id,
          responseType: result.response?.responseType,
          versionNumber: result.response?.versionNumber,
          createdAt: result.response?.createdAt,
          comment: result.response?.comment,
        },
        quotation: result.quotation,
      });
    } catch (e) {
      handleCustomerError(res, e);
    }
  });

  app.post("/api/customer/quotations/:token/revision-request", customerLimiter, async (req: AuthRequest, res: Response) => {
    try {
      const comment = String(req.body?.comments || req.body?.comment || req.body?.requestedChanges || "").trim();
      if (!comment) {
        res.status(400).json({ error: "A comment is required when requesting a revision" });
        return;
      }
      const result = await submitCustomerResponse({
        rawToken: paramToken(req),
        responseType: "RevisionRequested" satisfies CustomerResponseType,
        comment,
        customerName: req.body?.customerName || req.body?.personName,
        customerEmail: req.body?.customerEmail || req.body?.email,
        personName: req.body?.personName || req.body?.customerName,
      });
      res.json({
        ok: true,
        idempotent: result.idempotent,
        response: {
          id: result.response?.id,
          responseType: result.response?.responseType,
          versionNumber: result.response?.versionNumber,
          createdAt: result.response?.createdAt,
          comment: result.response?.comment,
        },
        quotation: result.quotation,
      });
    } catch (e) {
      handleCustomerError(res, e);
    }
  });

  // ── Internal: issue / revoke / list customer responses ────────────────────
  app.post("/api/quotations/:id/customer-link", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await loadQuoteScoped(req, agencyScope, branchScope);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const created = await createCustomerAccessLink({
        quotationId: existing.id,
        createdById: req.auth?.userId,
        createdByName: req.auth?.email,
        appOrigin: resolveAppOrigin(req.body?.appOrigin),
      });
      // Never log rawToken. Return once to the authorized caller.
      res.status(201).json({
        accessId: created.accessId,
        versionNumber: created.versionNumber,
        expiresAt: created.expiresAt,
        url: created.url,
        token: created.rawToken,
      });
    } catch (e) {
      handleCustomerError(res, e);
    }
  });

  app.post("/api/quotations/:id/customer-link/revoke", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      if (isAgentLike(req.auth?.role)) {
        // Agents may revoke only for quotes they can access (already scoped); keep allowed.
      }
      const existing = await loadQuoteScoped(req, agencyScope, branchScope);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const revoked = await revokeCustomerAccessForQuotation(existing.id);
      res.json({ revoked });
    } catch (e) {
      handleCustomerError(res, e);
    }
  });

  app.get("/api/quotations/:id/customer-responses", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      const existing = await loadQuoteScoped(req, agencyScope, branchScope);
      if (!existing) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const responses = await db.quotationCustomerResponse.findMany({
        where: { quotationId: existing.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          versionNumber: true,
          responseType: true,
          comment: true,
          customerName: true,
          customerEmail: true,
          selectedPackageId: true,
          createdAt: true,
        },
      });
      res.json({
        responses,
        acceptedVersionNumber: existing.acceptedVersionNumber,
        currentVersion: existing.currentVersion,
      });
    } catch (e) {
      handleCustomerError(res, e);
    }
  });
}

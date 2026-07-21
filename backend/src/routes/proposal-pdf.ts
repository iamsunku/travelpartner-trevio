import type { Express, Response } from "express";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requireCrudPermission } from "../middleware/auth.js";
import { logger } from "../lib/logger.js";
import {
  ProposalPdfValidationError,
  deleteProposalPdfFiles,
  generateProposalPdf,
  getProposalPdfBuffer,
  getProposalPdfMeta,
} from "../lib/proposal-pdf/index.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

function paramId(req: AuthRequest): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function paramVersion(req: AuthRequest): number | undefined {
  const raw = req.params.version;
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function handlePdfError(e: unknown, res: Response) {
  if (e instanceof ProposalPdfValidationError) {
    res.status(e.statusCode).json({ error: e.message });
    return;
  }
  logger.error(e);
  res.status(500).json({ error: "Server error" });
}

/**
 * PDF endpoints for travel proposals.
 * Mounted alongside existing travel-proposal routes — does not alter builder workflows.
 */
export function mountProposalPdfRoutes(app: Express, agencyScope: ScopeFn) {
  const base = "/api/travel-proposals";

  app.post(
    `${base}/:id/generate-pdf`,
    requireAuth,
    requireCrudPermission("travel-proposals", "edit"),
    async (req: AuthRequest, res: Response) => {
      try {
        const force = Boolean(req.body?.force);
        const result = await generateProposalPdf(paramId(req), agencyScope(req), {
          force,
          generatedByName: req.auth?.email ?? null,
        });
        res.json({
          cached: result.cached,
          downloadUrl: result.downloadUrl,
          pdfUrl: result.downloadUrl,
          pdfGeneratedAt: result.pdfGeneratedAt,
          pdfVersion: result.pdfVersion,
          pageCount: "pageCount" in result ? result.pageCount : undefined,
          fileSize: "fileSize" in result ? result.fileSize : undefined,
          pdf: result.pdf,
          item: result.proposal,
        });
      } catch (e) {
        handlePdfError(e, res);
      }
    }
  );

  app.get(
    `${base}/:id/pdf`,
    requireAuth,
    requireCrudPermission("travel-proposals", "view"),
    async (req: AuthRequest, res: Response) => {
      try {
        const id = paramId(req);
        const download = String(req.query.download ?? "") === "1";
        const metaOnly = String(req.query.meta ?? "") === "1";

        if (metaOnly) {
          const meta = await getProposalPdfMeta(id, agencyScope(req));
          res.json(meta);
          return;
        }

        const { buffer, fileName } = await getProposalPdfBuffer(id, agencyScope(req));
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `${download ? "attachment" : "inline"}; filename="${fileName}"`
        );
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
      } catch (e) {
        handlePdfError(e, res);
      }
    }
  );

  app.get(
    `${base}/:id/pdf/:version`,
    requireAuth,
    requireCrudPermission("travel-proposals", "view"),
    async (req: AuthRequest, res: Response) => {
      try {
        const version = paramVersion(req);
        if (!version) {
          res.status(400).json({ error: "Invalid version" });
          return;
        }
        const download = String(req.query.download ?? "") === "1";
        const { buffer, fileName } = await getProposalPdfBuffer(
          paramId(req),
          agencyScope(req),
          version
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `${download ? "attachment" : "inline"}; filename="${fileName}"`
        );
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
      } catch (e) {
        handlePdfError(e, res);
      }
    }
  );

  app.delete(
    `${base}/:id/pdf`,
    requireAuth,
    requireCrudPermission("travel-proposals", "delete"),
    async (req: AuthRequest, res: Response) => {
      try {
        const result = await deleteProposalPdfFiles(paramId(req), agencyScope(req));
        res.json({ ok: true, item: result.proposal });
      } catch (e) {
        handlePdfError(e, res);
      }
    }
  );
}

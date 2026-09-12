import type { Express, Response } from "express";
import multer from "multer";
import type { AuthRequest } from "../middleware/auth.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { db } from "../lib/db.js";
import { logger } from "../lib/logger.js";
import { isAgentLike } from "../lib/quotations.js";
import { agentQuoteScope } from "../lib/quote-access.js";
import { agentBookingScope, agentCanAccessBooking } from "../lib/booking-access.js";
import {
  URL_UPLOAD_REJECTED,
  assignVisibility,
  bookingLinkFromQuoteDocument,
  canDeleteDocument,
  claimToken,
  contentDisposition,
  documentMaxBytes,
  gstProofMaxBytes,
  normalizeDocType,
  normalizeVisibility,
  rejectUrlUpload,
  safeStoredName,
  validateUpload,
  visibilityAllows,
} from "../lib/documents.js";
import { deletePrivateObject, objectKey, putPrivateObject, readPrivateObject } from "../lib/document-storage.js";

type ScopeFn = (req: AuthRequest) => Record<string, unknown>;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: documentMaxBytes(), files: 1 },
});

function param(req: AuthRequest, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : String(value ?? "");
}

function publicMeta(doc: {
  id: string;
  docType: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  visibility?: string | null;
  relatedEntity?: string | null;
  description?: string | null;
  uploadedBy?: string | null;
  createdAt: Date;
}, downloadPath: string) {
  return {
    id: doc.id,
    docType: doc.docType,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    visibility: normalizeVisibility(doc.visibility),
    relatedEntity: doc.relatedEntity,
    description: doc.description,
    uploadedBy: doc.uploadedBy,
    createdAt: doc.createdAt,
    downloadPath,
  };
}

async function loadQuote(req: AuthRequest, agencyScope: ScopeFn) {
  return db.quotation.findFirst({
    where: {
      id: param(req, "id"),
      deletedAt: null,
      ...agencyScope(req),
      ...agentQuoteScope(req.auth?.role, req.auth?.userId),
    },
  });
}

async function loadBooking(req: AuthRequest, agencyScope: ScopeFn) {
  const booking = await db.booking.findFirst({
    where: {
      id: param(req, "id"),
      ...agencyScope(req),
      ...agentBookingScope(req.auth?.role, req.auth?.userId),
    },
  });
  if (!booking) return null;
  if (!agentCanAccessBooking(req.auth?.role, req.auth?.userId, booking)) return null;
  return booking;
}

export function mountDocumentRoutes(app: Express, agencyScope: ScopeFn) {
  app.post("/api/quotations/:id/documents", requireAuth, requirePermission("quotations"), (req, res, next) => {
    if (rejectUrlUpload(req.body)) {
      res.status(400).json({ error: URL_UPLOAD_REJECTED });
      return;
    }
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
        return;
      }
      next();
    });
  }, async (req: AuthRequest, res: Response) => {
    try {
      if (req.auth?.role === "customer") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const quote = await loadQuote(req, agencyScope);
      if (!quote) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: URL_UPLOAD_REJECTED });
        return;
      }
      const docType = normalizeDocType(req.body?.docType);
      const visibility = assignVisibility(req.auth?.role, req.body?.visibility);
      if (!docType || !visibility) {
        res.status(400).json({ error: !docType ? "Unsupported document type" : "That visibility is not allowed" });
        return;
      }
      const checked = validateUpload({
        originalName: file.originalname,
        declaredMime: file.mimetype,
        bytes: file.buffer,
        limit: documentMaxBytes(),
      });
      if (!checked.ok) {
        res.status(400).json({ error: checked.error });
        return;
      }
      const storedName = safeStoredName(checked.extension);
      const stored = await putPrivateObject(objectKey(`quote-${quote.id}`, storedName), file.buffer, checked.mime);
      const document = await db.quotationDocument.create({
        data: {
          quotationId: quote.id,
          docType,
          fileName: file.originalname.slice(0, 180),
          fileUrl: "",
          mimeType: checked.mime,
          sizeBytes: file.size,
          visibility,
          relatedEntity: req.body?.relatedEntity ? String(req.body.relatedEntity).slice(0, 120) : null,
          description: req.body?.description ? String(req.body.description).slice(0, 500) : null,
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          storedName,
          uploadedBy: req.auth?.email,
          uploadedById: req.auth?.userId,
        },
      });
      res.status(201).json({
        document: publicMeta(document, `/api/quotations/${quote.id}/documents/${document.id}/content`),
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/quotations/:id/documents", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      const quote = await loadQuote(req, agencyScope);
      if (!quote) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const rows = await db.quotationDocument.findMany({ where: { quotationId: quote.id }, orderBy: { createdAt: "desc" } });
      const documents = rows
        .filter((row) => visibilityAllows(req.auth?.role, row.visibility))
        .map((row) => publicMeta(row, `/api/quotations/${quote.id}/documents/${row.id}/content`));
      res.json({ documents });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/quotations/:id/documents/:docId/content", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      const quote = await loadQuote(req, agencyScope);
      if (!quote) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const document = await db.quotationDocument.findFirst({ where: { id: param(req, "docId"), quotationId: quote.id } });
      if (!document || !visibilityAllows(req.auth?.role, document.visibility) || !document.storageKey) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const bytes = await readPrivateObject(document.storageKey);
      if (!bytes) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", contentDisposition(document.fileName));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(bytes);
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/quotations/:id/documents/:docId", requireAuth, requirePermission("quotations"), async (req: AuthRequest, res: Response) => {
    try {
      const quote = await loadQuote(req, agencyScope);
      if (!quote) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const document = await db.quotationDocument.findFirst({ where: { id: param(req, "docId"), quotationId: quote.id } });
      if (!document) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const decision = canDeleteDocument({
        role: req.auth?.role,
        userId: req.auth?.userId,
        visibility: document.visibility,
        uploadedById: document.uploadedById,
        canAccessParent: true,
      });
      if (decision === "not_found") {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (decision === "forbidden") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const shared = await db.bookingDocument.count({ where: { storageKey: document.storageKey || "__none__" } });
      await db.quotationDocument.delete({ where: { id: document.id } });
      if (!shared) await deletePrivateObject(document.storageKey);
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/bookings/:id/documents", requireAuth, requirePermission("bookings"), (req, res, next) => {
    if (rejectUrlUpload(req.body)) {
      res.status(400).json({ error: URL_UPLOAD_REJECTED });
      return;
    }
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
        return;
      }
      next();
    });
  }, async (req: AuthRequest, res: Response) => {
    try {
      if (req.auth?.role === "customer") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const booking = await loadBooking(req, agencyScope);
      if (!booking) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: URL_UPLOAD_REJECTED });
        return;
      }
      const docType = normalizeDocType(req.body?.docType);
      const visibility = assignVisibility(req.auth?.role, req.body?.visibility);
      if (!docType || !visibility) {
        res.status(400).json({ error: !docType ? "Unsupported document type" : "That visibility is not allowed" });
        return;
      }
      const checked = validateUpload({
        originalName: file.originalname,
        declaredMime: file.mimetype,
        bytes: file.buffer,
        limit: documentMaxBytes(),
      });
      if (!checked.ok) {
        res.status(400).json({ error: checked.error });
        return;
      }
      const storedName = safeStoredName(checked.extension);
      const stored = await putPrivateObject(objectKey(`booking-${booking.id}`, storedName), file.buffer, checked.mime);
      const document = await db.bookingDocument.create({
        data: {
          bookingId: booking.id,
          passengerId: req.body?.passengerId ? String(req.body.passengerId) : null,
          docType,
          fileName: file.originalname.slice(0, 180),
          fileUrl: "",
          mimeType: checked.mime,
          sizeBytes: file.size,
          visibility,
          relatedEntity: req.body?.relatedEntity ? String(req.body.relatedEntity).slice(0, 120) : null,
          description: req.body?.description ? String(req.body.description).slice(0, 500) : null,
          storageProvider: stored.storageProvider,
          storageKey: stored.storageKey,
          storedName,
          uploadedBy: req.auth?.email,
          uploadedById: req.auth?.userId,
        },
      });
      res.status(201).json({
        document: publicMeta(document, `/api/bookings/${booking.id}/documents/${document.id}/content`),
      });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/bookings/:id/documents/:docId/content", requireAuth, requirePermission("bookings"), async (req: AuthRequest, res: Response) => {
    try {
      const booking = await loadBooking(req, agencyScope);
      if (!booking) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const document = await db.bookingDocument.findFirst({ where: { id: param(req, "docId"), bookingId: booking.id } });
      if (!document || !visibilityAllows(req.auth?.role, document.visibility) || !document.storageKey) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const bytes = await readPrivateObject(document.storageKey);
      if (!bytes) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.setHeader("Content-Type", document.mimeType || "application/octet-stream");
      res.setHeader("Content-Disposition", contentDisposition(document.fileName));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(bytes);
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/bookings/:id/documents/:docId", requireAuth, requirePermission("bookings"), async (req: AuthRequest, res: Response) => {
    try {
      const booking = await loadBooking(req, agencyScope);
      if (!booking) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const document = await db.bookingDocument.findFirst({ where: { id: param(req, "docId"), bookingId: booking.id } });
      if (!document) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const decision = canDeleteDocument({
        role: req.auth?.role,
        userId: req.auth?.userId,
        visibility: document.visibility,
        uploadedById: document.uploadedById,
        canAccessParent: true,
      });
      if (decision === "not_found") {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (decision === "forbidden") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      await db.bookingDocument.delete({ where: { id: document.id } });
      if (!document.quotationDocumentId) await deletePrivateObject(document.storageKey);
      res.json({ ok: true });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/auth/register/gst-proof", (req, res, next) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Upload failed" });
        return;
      }
      next();
    });
  }, async (req: AuthRequest, res: Response) => {
    try {
      if (rejectUrlUpload(req.body)) {
        res.status(400).json({ error: URL_UPLOAD_REJECTED });
        return;
      }
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: URL_UPLOAD_REJECTED });
        return;
      }
      const checked = validateUpload({
        originalName: file.originalname,
        declaredMime: file.mimetype,
        bytes: file.buffer,
        limit: gstProofMaxBytes(),
      });
      if (!checked.ok) {
        res.status(400).json({ error: checked.error });
        return;
      }
      const storedName = safeStoredName(checked.extension);
      const stored = await putPrivateObject(objectKey("gst-proof", storedName), file.buffer, checked.mime);
      const token = claimToken();
      await db.registrationDocument.create({
        data: {
          purpose: "GST_VAT_PROOF",
          originalName: file.originalname.slice(0, 180),
          storedName,
          storageKey: stored.storageKey,
          storageProvider: stored.storageProvider,
          mimeType: checked.mime,
          sizeBytes: file.size,
          claimToken: token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      res.status(201).json({ gstProofId: token });
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.get("/api/agencies/:id/gst-proof", requireAuth, requireRole("super_admin", "agency_admin", "management"), async (req: AuthRequest, res: Response) => {
    try {
      const agency = await db.agency.findFirst({ where: { id: param(req, "id"), ...agencyScope(req) } });
      if (!agency?.gstProofDocumentId) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const document = await db.registrationDocument.findFirst({ where: { id: agency.gstProofDocumentId, agencyId: agency.id } });
      if (!document) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      const bytes = await readPrivateObject(document.storageKey);
      if (!bytes) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      res.setHeader("Content-Type", document.mimeType);
      res.setHeader("Content-Disposition", contentDisposition(document.originalName));
      res.setHeader("Cache-Control", "private, no-store");
      res.send(bytes);
    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: "Server error" });
    }
  });
}

export async function copyQuoteDocumentsToBooking(quotationId: string, bookingId: string, tx: { quotationDocument: typeof db.quotationDocument; bookingDocument: typeof db.bookingDocument }) {
  const docs = (await tx.quotationDocument.findMany({ where: { quotationId } })).filter((doc) => doc.storageKey);
  if (!docs.length) return;
  await tx.quotationDocument.updateMany({ where: { id: { in: docs.map((doc) => doc.id) } }, data: { bookingId } });
  for (const doc of docs) {
    const link = bookingLinkFromQuoteDocument(doc, bookingId);
    await tx.bookingDocument.create({ data: link });
  }
}

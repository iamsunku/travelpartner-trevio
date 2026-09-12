import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import {
  URL_UPLOAD_REJECTED,
  bookingLinkFromQuoteDocument,
  canDeleteDocument,
  gstProofMaxBytes,
  rejectUrlUpload,
  validateUpload,
  visibilityAllows,
} from "../lib/documents.js";
import { objectKey, privateStorageRoot, putPrivateObject, readPrivateObject } from "../lib/document-storage.js";
import { app } from "../app.js";

const png = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

const dir = await mkdtemp(path.join(os.tmpdir(), "trevio-docs-"));
process.env.DOCUMENT_STORAGE = "local";
process.env.DOCUMENT_STORAGE_DIR = dir;

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("phase 4 documents", () => {
  it("1. an authenticated upload stores an allowed file privately", async () => {
    const mini = express();
    mini.post("/upload", (req, res, next) => {
      if (req.headers.authorization !== "Bearer employee") {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      next();
    }, async (req, res) => {
      const checked = validateUpload({ originalName: "voucher.png", declaredMime: "image/png", bytes: png, limit: 1024 * 1024 });
      if (!checked.ok) {
        res.status(400).json({ error: checked.error });
        return;
      }
      const stored = await putPrivateObject(objectKey("quote-1", "voucher.png"), png, checked.mime);
      res.status(201).json({ document: { id: "doc-1", mimeType: checked.mime, storageProvider: stored.storageProvider, downloadPath: "/api/quotations/q1/documents/doc-1/content" } });
    });
    const denied = await request(mini).post("/upload");
    expect(denied.status).toBe(401);
    const uploaded = await request(mini).post("/upload").set("Authorization", "Bearer employee");
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.document.downloadPath).toContain("/content");
    expect(uploaded.body.document.fileUrl).toBeUndefined();
    const saved = await readPrivateObject("documents/quote-1/voucher.png");
    expect(saved?.equals(png)).toBe(true);
    expect(privateStorageRoot()).toBe(dir);
    expect(privateStorageRoot().includes(`${path.sep}public${path.sep}`)).toBe(false);
  });

  it("2. invalid file type is rejected", () => {
    const text = Buffer.from("this is not a pdf");
    const checked = validateUpload({ originalName: "notes.pdf", declaredMime: "application/pdf", bytes: text, limit: 1024 });
    expect(checked.ok).toBe(false);
  });

  it("3. oversized GST/VAT proof is rejected", () => {
    expect(gstProofMaxBytes()).toBeLessThanOrEqual(5 * 1024 * 1024);
    const checked = validateUpload({
      originalName: "gst.png",
      declaredMime: "image/png",
      bytes: Buffer.concat([png, Buffer.alloc(gstProofMaxBytes())]),
      limit: gstProofMaxBytes(),
    });
    expect(checked.ok).toBe(false);
    if (!checked.ok) expect(checked.error).toMatch(/5 MB/);
  });

  it("4-8. visibility and quote ownership are enforced", () => {
    expect(visibilityAllows("travel_agent", "INTERNAL")).toBe(false);
    expect(visibilityAllows("travel_agent", "AGENT")).toBe(true);
    expect(visibilityAllows("customer", "INTERNAL")).toBe(false);
    expect(visibilityAllows("customer", "CUSTOMER")).toBe(true);
    expect(visibilityAllows("sales_executive", "INTERNAL")).toBe(true);
    expect(canDeleteDocument({ role: "travel_agent", userId: "a", visibility: "INTERNAL", canAccessParent: false })).toBe("not_found");
    expect(canDeleteDocument({ role: "customer", visibility: "CUSTOMER", canAccessParent: true })).toBe("forbidden");
  });

  it("9. an arbitrary fileUrl cannot create a document", () => {
    expect(rejectUrlUpload({ fileUrl: "https://some-random-site.com/file.pdf" })).toBe(URL_UPLOAD_REJECTED);
    expect(rejectUrlUpload({ gstProofUrl: "data:application/pdf;base64,abc" })).toBe(URL_UPLOAD_REJECTED);
  });

  it("10. an unauthorized user cannot delete a document", () => {
    expect(canDeleteDocument({
      role: "travel_agent",
      userId: "agent-b",
      visibility: "AGENT",
      uploadedById: "agent-a",
      canAccessParent: true,
    })).toBe("forbidden");
    expect(canDeleteDocument({
      role: "travel_agent",
      userId: "agent-a",
      visibility: "INTERNAL",
      canAccessParent: true,
    })).toBe("not_found");
  });

  it("11. a document is not reachable by swapping the quote id", () => {
    const owned = canDeleteDocument({ role: "travel_agent", userId: "agent-a", visibility: "AGENT", uploadedById: "agent-a", canAccessParent: true });
    const otherQuote = canDeleteDocument({ role: "travel_agent", userId: "agent-a", visibility: "AGENT", uploadedById: "agent-a", canAccessParent: false });
    expect(owned).toBe("ok");
    expect(otherQuote).toBe("not_found");
  });

  it("12. stored files are not served from an unrestricted public URL", async () => {
    await putPrivateObject("documents/quote-1/secret.png", png, "image/png");
    const bytes = await readFile(path.join(dir, "documents", "quote-1", "secret.png"));
    const publicHit = await request(app).get("/uploads/documents/quote-1/secret.png");
    const storageHit = await request(app).get("/storage/private-documents/documents/quote-1/secret.png");
    expect(publicHit.status).not.toBe(200);
    expect(storageHit.status).not.toBe(200);
    expect(publicHit.body).not.toEqual(bytes);
    expect(String(publicHit.text || "")).not.toContain(bytes.toString("utf8"));
  });

  it("13. booking conversion reuses the stored object and does not copy a public URL", () => {
    const linked = bookingLinkFromQuoteDocument({
      id: "qd-1",
      docType: "HOTEL_VOUCHER",
      fileName: "voucher.pdf",
      storageKey: "documents/quote-1/voucher.pdf",
      storageProvider: "local",
      visibility: "CUSTOMER",
    }, "booking-1");
    expect(linked.bookingId).toBe("booking-1");
    expect(linked.quotationDocumentId).toBe("qd-1");
    expect(linked.storageKey).toBe("documents/quote-1/voucher.pdf");
    expect(linked.fileUrl).toBe("");
    expect(linked.fileUrl).not.toMatch(/^https?:/);
  });
});

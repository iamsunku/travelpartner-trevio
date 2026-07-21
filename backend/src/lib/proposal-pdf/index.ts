import { db } from "../db.js";
import { logger } from "../logger.js";
import type { ProposalSnapshotData } from "../proposal-snapshot.js";
import { resolveBranding, resolveTemplateMeta } from "./branding.js";
import { buildDocumentContent } from "./content.js";
import { renderProposalPdf } from "./renderer.js";
import {
  deleteProposalPdfs,
  fileExists,
  pdfFilePath,
  readPdfFile,
  writePdfFile,
} from "./storage.js";
import {
  isPdfEligibleStatus,
  type GeneratePdfOptions,
  type PdfRenderInput,
} from "./types.js";

export * from "./types.js";

export class ProposalPdfValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "ProposalPdfValidationError";
    this.statusCode = statusCode;
  }
}

async function loadAgency(agencyId: string | null | undefined) {
  if (!agencyId) return null;
  return db.agency.findUnique({
    where: { id: agencyId },
    select: { name: true, phone: true, email: true, address: true, logo: true },
  });
}

function assertCanGenerate(proposal: {
  proposalStatus: string;
  selectedTemplateId: string | null;
}, snapshot: ProposalSnapshotData | null): asserts snapshot is ProposalSnapshotData {
  if (!isPdfEligibleStatus(proposal.proposalStatus)) {
    throw new ProposalPdfValidationError(
      `PDF can only be generated when status is Internal Review or later (current: ${proposal.proposalStatus})`
    );
  }
  if (!snapshot) {
    throw new ProposalPdfValidationError("Proposal snapshot is required before generating a PDF");
  }
  if (!snapshot.template && !proposal.selectedTemplateId) {
    throw new ProposalPdfValidationError("Quote template is required before generating a PDF");
  }
}

/**
 * Proposal Rendering Engine entrypoint.
 * Reads snapshot + template + branding, renders PDF, stores file, updates DB.
 */
export async function generateProposalPdf(
  proposalId: string,
  agencyScope: Record<string, unknown>,
  options: GeneratePdfOptions = {}
) {
  const proposal = await db.travelProposal.findFirst({
    where: { id: proposalId, ...agencyScope, deletedAt: null },
  });
  if (!proposal) {
    throw new ProposalPdfValidationError("Proposal not found", 404);
  }

  const snapshotRow = await db.proposalSnapshot.findFirst({
    where: { proposalId },
    orderBy: { versionNumber: "desc" },
  });
  const snapshot = snapshotRow ? (snapshotRow.snapshot as ProposalSnapshotData) : null;
  assertCanGenerate(proposal, snapshot);

  const versionNumber = proposal.currentVersion;

  // Cache: reuse existing PDF for this version unless force regenerate
  if (!options.force && proposal.pdfVersion === versionNumber && proposal.pdfUrl) {
    const existingPath = pdfFilePath(proposalId, versionNumber);
    if (await fileExists(existingPath)) {
      const existing = await db.proposalPdf.findUnique({
        where: { proposalId_versionNumber: { proposalId, versionNumber } },
      });
      return {
        cached: true as const,
        proposal,
        pdf: existing,
        downloadUrl: proposal.pdfUrl,
        pdfGeneratedAt: proposal.pdfGeneratedAt,
        pdfVersion: proposal.pdfVersion,
      };
    }
  }

  const agency = await loadAgency(proposal.agencyId);
  const input: PdfRenderInput = {
    proposalId,
    proposalNumber: proposal.proposalNumber,
    versionNumber,
    validUntil: proposal.validUntil,
    notes: proposal.notes,
    snapshot,
    agency,
  };

  const branding = resolveBranding(input);
  const template = resolveTemplateMeta(input);
  const content = buildDocumentContent(input);
  const fileName = `${proposal.proposalNumber.replace(/[^\w.-]+/g, "_")}_v${versionNumber}.pdf`;

  let rendered;
  try {
    rendered = await renderProposalPdf({ branding, template, content, fileName });
  } catch (err) {
    logger.error({ err, proposalId }, "Proposal PDF render failed");
    throw new ProposalPdfValidationError("Failed to render proposal PDF", 500);
  }

  const stored = await writePdfFile(proposalId, versionNumber, rendered.buffer);

  const pdfRecord = await db.proposalPdf.upsert({
    where: { proposalId_versionNumber: { proposalId, versionNumber } },
    create: {
      proposalId,
      versionNumber,
      fileName: stored.fileName,
      filePath: stored.filePath,
      fileUrl: stored.fileUrl,
      fileSize: stored.fileSize,
      pageCount: rendered.pageCount,
      generatedByName: options.generatedByName ?? null,
    },
    update: {
      fileName: stored.fileName,
      filePath: stored.filePath,
      fileUrl: stored.fileUrl,
      fileSize: stored.fileSize,
      pageCount: rendered.pageCount,
      generatedByName: options.generatedByName ?? null,
      generatedAt: new Date(),
    },
  });

  const updated = await db.travelProposal.update({
    where: { id: proposalId },
    data: {
      pdfUrl: stored.fileUrl,
      pdfGeneratedAt: new Date(),
      pdfVersion: versionNumber,
    },
  });

  await db.proposalHistory.create({
    data: {
      proposalId,
      action: options.force ? "pdf_regenerated" : "pdf_generated",
      summary: `PDF ${options.force ? "regenerated" : "generated"} for version ${versionNumber} (${rendered.pageCount} pages)`,
      versionNumber,
      createdByName: options.generatedByName ?? null,
    },
  });

  return {
    cached: false as const,
    proposal: updated,
    pdf: pdfRecord,
    downloadUrl: stored.fileUrl,
    pdfGeneratedAt: updated.pdfGeneratedAt,
    pdfVersion: updated.pdfVersion,
    pageCount: rendered.pageCount,
    fileSize: stored.fileSize,
  };
}

export async function getProposalPdfMeta(proposalId: string, agencyScope: Record<string, unknown>) {
  const proposal = await db.travelProposal.findFirst({
    where: { id: proposalId, ...agencyScope, deletedAt: null },
    select: {
      id: true,
      proposalNumber: true,
      proposalStatus: true,
      currentVersion: true,
      pdfUrl: true,
      pdfGeneratedAt: true,
      pdfVersion: true,
    },
  });
  if (!proposal) throw new ProposalPdfValidationError("Proposal not found", 404);

  const versions = await db.proposalPdf.findMany({
    where: { proposalId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      pageCount: true,
      generatedAt: true,
      generatedByName: true,
    },
  });

  return { proposal, versions };
}

export async function getProposalPdfBuffer(
  proposalId: string,
  agencyScope: Record<string, unknown>,
  version?: number
): Promise<{ buffer: Buffer; fileName: string; versionNumber: number }> {
  const proposal = await db.travelProposal.findFirst({
    where: { id: proposalId, ...agencyScope, deletedAt: null },
  });
  if (!proposal) throw new ProposalPdfValidationError("Proposal not found", 404);

  const versionNumber = version ?? proposal.pdfVersion ?? proposal.currentVersion;
  const record = await db.proposalPdf.findUnique({
    where: { proposalId_versionNumber: { proposalId, versionNumber } },
  });

  const filePath = record?.filePath ?? pdfFilePath(proposalId, versionNumber);
  const buffer = await readPdfFile(filePath);
  if (!buffer) {
    throw new ProposalPdfValidationError("PDF not found for this proposal version", 404);
  }

  const fileName =
    record?.fileName ??
    `${proposal.proposalNumber.replace(/[^\w.-]+/g, "_")}_v${versionNumber}.pdf`;

  return { buffer, fileName, versionNumber };
}

export async function deleteProposalPdfFiles(
  proposalId: string,
  agencyScope: Record<string, unknown>
) {
  const proposal = await db.travelProposal.findFirst({
    where: { id: proposalId, ...agencyScope, deletedAt: null },
  });
  if (!proposal) throw new ProposalPdfValidationError("Proposal not found", 404);

  await db.proposalPdf.deleteMany({ where: { proposalId } });
  await deleteProposalPdfs(proposalId);

  const updated = await db.travelProposal.update({
    where: { id: proposalId },
    data: { pdfUrl: null, pdfGeneratedAt: null, pdfVersion: null },
  });

  await db.proposalHistory.create({
    data: {
      proposalId,
      action: "pdf_deleted",
      summary: "All generated proposal PDFs deleted",
    },
  });

  return { proposal: updated };
}

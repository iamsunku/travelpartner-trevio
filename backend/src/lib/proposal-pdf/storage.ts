import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** backend/storage/proposal-pdfs */
export function storageRoot(): string {
  return path.resolve(__dirname, "../../../storage/proposal-pdfs");
}

export function proposalDir(proposalId: string): string {
  return path.join(storageRoot(), proposalId);
}

export function pdfFilePath(proposalId: string, versionNumber: number): string {
  return path.join(proposalDir(proposalId), `v${versionNumber}.pdf`);
}

export function pdfPublicUrl(proposalId: string, versionNumber: number): string {
  return `/api/travel-proposals/${proposalId}/pdf/${versionNumber}`;
}

export async function ensureProposalDir(proposalId: string): Promise<string> {
  const dir = proposalDir(proposalId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function writePdfFile(
  proposalId: string,
  versionNumber: number,
  buffer: Buffer
): Promise<{ filePath: string; fileUrl: string; fileName: string; fileSize: number }> {
  await ensureProposalDir(proposalId);
  const fileName = `v${versionNumber}.pdf`;
  const filePath = pdfFilePath(proposalId, versionNumber);
  await fs.writeFile(filePath, buffer);
  return {
    fileName,
    filePath,
    fileUrl: pdfPublicUrl(proposalId, versionNumber),
    fileSize: buffer.length,
  };
}

export async function readPdfFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function deleteProposalPdfs(proposalId: string): Promise<void> {
  const dir = proposalDir(proposalId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export async function deletePdfVersion(proposalId: string, versionNumber: number): Promise<void> {
  try {
    await fs.unlink(pdfFilePath(proposalId, versionNumber));
  } catch {
    /* ignore */
  }
}

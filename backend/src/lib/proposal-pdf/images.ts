import fs from "node:fs/promises";
import path from "node:path";

const IMAGE_CACHE = new Map<string, Buffer | null>();
const FETCH_TIMEOUT_MS = 8000;

/** Tiny 1x1 PNG used when image cannot be loaded */
export const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

function isDataUrl(src: string): boolean {
  return src.startsWith("data:image/");
}

function parseDataUrl(src: string): Buffer | null {
  try {
    const match = /^data:image\/[a-zA-Z0-9+.-]+;base64,(.+)$/.exec(src);
    if (!match) return null;
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}

async function fetchRemote(url: string): Promise<Buffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("image") && !contentType.includes("octet-stream")) {
      return null;
    }
    const ab = await res.arrayBuffer();
    if (!ab.byteLength || ab.byteLength > 8_000_000) return null;
    return Buffer.from(ab);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readLocal(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Resolve an image URL / data URL / local path to a Buffer.
 * Never throws — returns null on failure so the renderer can use placeholders.
 */
export async function loadImageBuffer(src: string | null | undefined): Promise<Buffer | null> {
  if (!src || !String(src).trim()) return null;
  const key = String(src).trim();

  if (IMAGE_CACHE.has(key)) return IMAGE_CACHE.get(key) ?? null;

  let buffer: Buffer | null = null;

  if (isDataUrl(key)) {
    buffer = parseDataUrl(key);
  } else if (/^https?:\/\//i.test(key)) {
    buffer = await fetchRemote(key);
  } else if (path.isAbsolute(key) || key.startsWith(".") || key.startsWith("/")) {
    buffer = await readLocal(key);
  }

  IMAGE_CACHE.set(key, buffer);
  return buffer;
}

export function clearImageCache(): void {
  IMAGE_CACHE.clear();
}

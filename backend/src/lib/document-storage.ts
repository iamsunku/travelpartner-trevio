import { mkdir, readFile, writeFile, unlink } from "fs/promises";
import path from "path";

export type StoredObject = {
  storageProvider: "local" | "s3";
  storageKey: string;
};

const SAFE_KEY = /^documents\/[a-z0-9][a-z0-9/_.-]{0,220}$/i;

export function storageProviderName(): "local" | "s3" {
  return process.env.DOCUMENT_STORAGE === "s3" ? "s3" : "local";
}

export function privateStorageRoot(): string {
  const configured = process.env.DOCUMENT_STORAGE_DIR;
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "storage", "private-documents");
}

export function assertPrivateKey(key: string): string {
  const normalized = key.replace(/\\/g, "/");
  if (!SAFE_KEY.test(normalized) || normalized.includes("..")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function localPath(key: string): string {
  const safe = assertPrivateKey(key);
  const full = path.resolve(privateStorageRoot(), ...safe.split("/"));
  const root = path.resolve(privateStorageRoot());
  if (!full.startsWith(root + path.sep) && full !== root) throw new Error("Invalid storage key");
  return full;
}

async function putLocal(key: string, body: Buffer): Promise<void> {
  const full = localPath(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, body);
}

async function getLocal(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

async function deleteLocal(key: string): Promise<void> {
  try {
    await unlink(localPath(key));
  } catch {
    /* already gone */
  }
}

type S3ClientLike = {
  send: (command: unknown) => Promise<unknown>;
};

let s3Client: S3ClientLike | null = null;

async function s3(): Promise<{ client: S3ClientLike; bucket: string; PutObjectCommand: new (input: unknown) => unknown; GetObjectCommand: new (input: unknown) => unknown; DeleteObjectCommand: new (input: unknown) => unknown }> {
  const bucket = process.env.DOCUMENT_S3_BUCKET || "";
  const region = process.env.DOCUMENT_S3_REGION || "";
  const accessKeyId = process.env.DOCUMENT_S3_ACCESS_KEY_ID || "";
  const secretAccessKey = process.env.DOCUMENT_S3_SECRET_ACCESS_KEY || "";
  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error("S3 document storage is selected but DOCUMENT_S3_BUCKET, DOCUMENT_S3_REGION, DOCUMENT_S3_ACCESS_KEY_ID, and DOCUMENT_S3_SECRET_ACCESS_KEY are required.");
  }
  const sdkName = "@aws-sdk/client-s3";
  const sdk = await import(sdkName).catch(() => null) as {
    S3Client: new (input: unknown) => S3ClientLike;
    PutObjectCommand: new (input: unknown) => unknown;
    GetObjectCommand: new (input: unknown) => unknown;
    DeleteObjectCommand: new (input: unknown) => unknown;
  } | null;
  if (!sdk) {
    throw new Error("S3 document storage requires @aws-sdk/client-s3. No production provider is hardcoded.");
  }
  if (!s3Client) {
    s3Client = new sdk.S3Client({
      region,
      endpoint: process.env.DOCUMENT_S3_ENDPOINT || undefined,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: Boolean(process.env.DOCUMENT_S3_ENDPOINT),
    });
  }
  return { client: s3Client, bucket, PutObjectCommand: sdk.PutObjectCommand, GetObjectCommand: sdk.GetObjectCommand, DeleteObjectCommand: sdk.DeleteObjectCommand };
}

export async function putPrivateObject(key: string, body: Buffer, mimeType: string): Promise<StoredObject> {
  const storageKey = assertPrivateKey(key);
  if (storageProviderName() === "s3") {
    const remote = await s3();
    await remote.client.send(new remote.PutObjectCommand({ Bucket: remote.bucket, Key: storageKey, Body: body, ContentType: mimeType }));
    return { storageProvider: "s3", storageKey };
  }
  await putLocal(storageKey, body);
  return { storageProvider: "local", storageKey };
}

export async function readPrivateObject(key: string): Promise<Buffer | null> {
  const storageKey = assertPrivateKey(key);
  if (storageProviderName() === "s3") {
    const remote = await s3();
    const result = await remote.client.send(new remote.GetObjectCommand({ Bucket: remote.bucket, Key: storageKey })) as { Body?: { transformToByteArray?: () => Promise<Uint8Array> } };
    if (!result.Body?.transformToByteArray) return null;
    return Buffer.from(await result.Body.transformToByteArray());
  }
  return getLocal(storageKey);
}

export async function deletePrivateObject(key: string | null | undefined): Promise<void> {
  if (!key) return;
  const storageKey = assertPrivateKey(key);
  if (storageProviderName() === "s3") {
    const remote = await s3();
    await remote.client.send(new remote.DeleteObjectCommand({ Bucket: remote.bucket, Key: storageKey }));
    return;
  }
  await deleteLocal(storageKey);
}

export function objectKey(scope: string, storedName: string): string {
  const cleanScope = scope.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40) || "misc";
  return `documents/${cleanScope}/${storedName}`;
}

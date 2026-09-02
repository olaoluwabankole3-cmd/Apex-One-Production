/**
 * APEX ONE — Durable Object Storage Abstraction for Documents
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { InfrastructureEnvironment } from "../../infrastructure/runtime";
import { resolveInfrastructureConfiguration } from "../../infrastructure/runtime";
import { S3WireClient } from "../../infrastructure/s3/S3WireClient";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export interface ObjectStorageWriteResult {
  uri: string;
  bytes: number;
  checksumSha256: string;
  encryption: "AES-256-GCM" | "none";
}

export interface IObjectStorageService {
  putObject(
    key: string,
    data: Buffer | string,
    mimeType: string
  ): Promise<ObjectStorageWriteResult>;
  getObject(key: string): Promise<{ data: Buffer | string; mimeType: string } | null>;
  deleteObject(key: string): Promise<boolean>;
}

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = Object.freeze({
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
});

const EXTENSIONS_BY_FILE_TYPE: Readonly<Record<string, readonly string[]>> = Object.freeze({
  pdf: ["pdf"],
  doc: ["doc"],
  docx: ["docx"],
  xlsx: ["xlsx"],
  csv: ["csv"],
  json: ["json"],
  image: ["png", "jpg", "jpeg", "webp", "gif"],
});

function sha256(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeObjectData(data: Buffer | string): Buffer {
  const buffer = Buffer.isBuffer(data) ? Buffer.from(data) : Buffer.from(data, "utf8");
  if (buffer.length === 0) throw new TypeError("Document object cannot be empty");
  if (buffer.length > MAX_DOCUMENT_BYTES) {
    throw new TypeError(`Document object exceeds maximum size of ${MAX_DOCUMENT_BYTES} bytes`);
  }
  return buffer;
}

function validateMimeType(mimeType: string): string {
  const normalized = mimeType?.trim().toLowerCase();
  if (!normalized || !Object.values(MIME_BY_EXTENSION).includes(normalized)) {
    throw new TypeError(`Unsupported document MIME type '${String(mimeType)}'`);
  }
  return normalized;
}

function extensionOf(name: string): string {
  const cleanName = name.trim().toLowerCase();
  const index = cleanName.lastIndexOf(".");
  return index >= 0 ? cleanName.slice(index + 1) : "";
}

export function resolveDocumentMimeType(fileName: string, fileType: string): string {
  const extension = extensionOf(fileName);
  const allowedExtensions = EXTENSIONS_BY_FILE_TYPE[fileType];
  if (!allowedExtensions || !allowedExtensions.includes(extension)) {
    throw new TypeError(
      `Document extension '.${extension || "<missing>"}' does not match declared file type '${fileType}'`
    );
  }
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) throw new TypeError(`Unsupported document extension '.${extension}'`);
  return validateMimeType(mimeType);
}

function sanitizeFileName(fileName: string): string {
  const baseName = fileName.trim().split(/[\\/]/).pop() || "document";
  const sanitized = baseName
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
  if (!sanitized || sanitized === "." || sanitized === "..") {
    throw new TypeError("Document file name is not safe for object storage");
  }
  return sanitized;
}

function validateStorageKey(key: string): string {
  const normalized = key?.trim();
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) {
    throw new TypeError("Document storage key is invalid");
  }
  if (normalized.length > 900 || !/^[a-zA-Z0-9/_.,=-]+$/.test(normalized)) {
    throw new TypeError("Document storage key contains unsupported characters");
  }
  return normalized;
}

function tenantScope(organizationId: string): string {
  if (!organizationId || typeof organizationId !== "string") {
    throw new TypeError("organizationId is required for tenant-scoped document storage");
  }
  return sha256(organizationId.trim()).slice(0, 32);
}

export function buildTenantDocumentObjectKey(
  organizationId: string,
  documentId: string,
  fileName: string
): string {
  const safeDocumentId = documentId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
  if (!safeDocumentId) throw new TypeError("Document ID is invalid for object storage");
  return validateStorageKey(
    `tenants/${tenantScope(organizationId)}/documents/${safeDocumentId}/${sanitizeFileName(fileName)}`
  );
}

export function assertTenantDocumentObjectKey(key: string, organizationId: string): string {
  const normalized = validateStorageKey(key);
  const canonicalPrefix = `tenants/${tenantScope(organizationId)}/documents/`;
  const legacyPrefix = `documents/${organizationId.trim()}/`;
  if (!normalized.startsWith(canonicalPrefix) && !normalized.startsWith(legacyPrefix)) {
    throw new TypeError("Document storage key is not owned by the authenticated organization");
  }
  return normalized;
}

interface EncryptedObjectEnvelope {
  version: 1;
  algorithm: "AES-256-GCM";
  iv: string;
  authTag: string;
  ciphertext: string;
  mimeType: string;
  plaintextBytes: number;
  checksumSha256: string;
}

function decodeEncryptionKey(value: string): Buffer {
  const normalized = value?.trim();
  if (!normalized || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new TypeError("DOCUMENT_STORAGE_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64") !== normalized) {
    throw new TypeError("DOCUMENT_STORAGE_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export class InMemoryObjectStorageAdapter implements IObjectStorageService {
  private readonly storage = new Map<
    string,
    { data: Buffer; mimeType: string; bytes: number; checksumSha256: string }
  >();

  public async putObject(
    key: string,
    data: Buffer | string,
    mimeType: string
  ): Promise<ObjectStorageWriteResult> {
    const normalizedKey = validateStorageKey(key);
    const normalizedMimeType = validateMimeType(mimeType);
    const buffer = normalizeObjectData(data);
    const checksumSha256 = sha256(buffer);
    this.storage.set(normalizedKey, {
      data: buffer,
      mimeType: normalizedMimeType,
      bytes: buffer.length,
      checksumSha256,
    });
    return {
      uri: `blob://tenants/${normalizedKey}`,
      bytes: buffer.length,
      checksumSha256,
      encryption: "none",
    };
  }

  public async getObject(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const item = this.storage.get(validateStorageKey(key));
    return item ? { data: Buffer.from(item.data), mimeType: item.mimeType } : null;
  }

  public async deleteObject(key: string): Promise<boolean> {
    this.storage.delete(validateStorageKey(key));
    return true;
  }
}

/**
 * S3-compatible durable object storage with client-side authenticated encryption.
 *
 * S3 receives only an AES-256-GCM envelope. The encryption key is process
 * configuration and is never sent to object storage or persisted in metadata.
 */
export class S3CompatibleObjectStorageService implements IObjectStorageService {
  private readonly client: S3WireClient;
  private readonly encryptionKey: Buffer;
  private readonly bucket: string;

  constructor(config: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    encryptionKey: string;
    endpoint?: string;
  }) {
    this.bucket = config.bucket.trim();
    this.encryptionKey = decodeEncryptionKey(config.encryptionKey);
    this.client = new S3WireClient({
      bucket: config.bucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
    });
  }

  private encrypt(key: string, data: Buffer, mimeType: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey, iv);
    cipher.setAAD(Buffer.from(key, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
    const envelope: EncryptedObjectEnvelope = {
      version: 1,
      algorithm: "AES-256-GCM",
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      mimeType,
      plaintextBytes: data.length,
      checksumSha256: sha256(data),
    };
    return Buffer.from(JSON.stringify(envelope), "utf8");
  }

  private decrypt(key: string, payload: Buffer): { data: Buffer; mimeType: string } {
    let envelope: EncryptedObjectEnvelope;
    try {
      envelope = JSON.parse(payload.toString("utf8")) as EncryptedObjectEnvelope;
    } catch {
      throw new Error("Stored document object is not a valid encrypted envelope");
    }
    if (
      envelope?.version !== 1 ||
      envelope.algorithm !== "AES-256-GCM" ||
      typeof envelope.iv !== "string" ||
      typeof envelope.authTag !== "string" ||
      typeof envelope.ciphertext !== "string" ||
      typeof envelope.mimeType !== "string" ||
      typeof envelope.plaintextBytes !== "number" ||
      typeof envelope.checksumSha256 !== "string"
    ) {
      throw new Error("Stored document object encryption metadata is invalid");
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey,
      Buffer.from(envelope.iv, "base64")
    );
    decipher.setAAD(Buffer.from(key, "utf8"));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const data = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final(),
    ]);
    if (data.length !== envelope.plaintextBytes || sha256(data) !== envelope.checksumSha256) {
      throw new Error("Stored document object failed integrity verification");
    }
    return { data, mimeType: validateMimeType(envelope.mimeType) };
  }

  public async putObject(
    key: string,
    data: Buffer | string,
    mimeType: string
  ): Promise<ObjectStorageWriteResult> {
    const normalizedKey = validateStorageKey(key);
    const normalizedMimeType = validateMimeType(mimeType);
    const buffer = normalizeObjectData(data);
    const checksumSha256 = sha256(buffer);
    const encrypted = this.encrypt(normalizedKey, buffer, normalizedMimeType);
    await this.client.putObject(
      normalizedKey,
      encrypted,
      "application/vnd.apex.encrypted-document+json"
    );
    return {
      uri: `s3://${this.bucket}/${normalizedKey}`,
      bytes: buffer.length,
      checksumSha256,
      encryption: "AES-256-GCM",
    };
  }

  public async getObject(key: string): Promise<{ data: Buffer; mimeType: string } | null> {
    const normalizedKey = validateStorageKey(key);
    const object = await this.client.getObject(normalizedKey);
    return object ? this.decrypt(normalizedKey, object.data) : null;
  }

  public async deleteObject(key: string): Promise<boolean> {
    return this.client.deleteObject(validateStorageKey(key));
  }
}

class UnavailableObjectStorageService implements IObjectStorageService {
  constructor(private readonly message: string) {}
  private fail(): never {
    throw new Error(this.message);
  }
  public async putObject(): Promise<ObjectStorageWriteResult> {
    return this.fail();
  }
  public async getObject(): Promise<{ data: Buffer | string; mimeType: string } | null> {
    return this.fail();
  }
  public async deleteObject(): Promise<boolean> {
    return this.fail();
  }
}

export function createObjectStorageFromEnvironment(
  env: InfrastructureEnvironment = process.env
): IObjectStorageService {
  const configuration = resolveInfrastructureConfiguration(env);
  if (configuration.objectStorage !== "s3") return new InMemoryObjectStorageAdapter();

  const bucket = env.S3_BUCKET?.trim();
  const region = env.S3_REGION?.trim();
  const accessKeyId = env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY?.trim();
  const encryptionKey = env.DOCUMENT_STORAGE_ENCRYPTION_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey || !encryptionKey) {
    return new UnavailableObjectStorageService(
      "S3 object-storage adapter selected but required S3/encryption configuration is incomplete"
    );
  }

  return new S3CompatibleObjectStorageService({
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    encryptionKey,
    endpoint: env.S3_ENDPOINT?.trim() || undefined,
  });
}

export const objectStorageService: IObjectStorageService = createObjectStorageFromEnvironment();

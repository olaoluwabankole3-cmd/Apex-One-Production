import { createHash, createHmac } from "node:crypto";

export interface S3WireClientConfig {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}

export interface S3RawObject {
  data: Buffer;
  contentType?: string;
  etag?: string;
}

export class S3ObjectStorageError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "S3ObjectStorageError";
    this.status = status;
  }
}

function sha256Hex(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodeObjectKey(key: string): string {
  return key.split("/").map(encodePathSegment).join("/");
}

function amzTimestamp(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.slice(0, 8) };
}

function canonicalQuery(url: URL): string {
  const entries = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (leftKey === rightKey) return leftValue.localeCompare(rightValue);
    return leftKey.localeCompare(rightKey);
  });
  return entries
    .map(([key, value]) => `${encodePathSegment(key)}=${encodePathSegment(value)}`)
    .join("&");
}

function validateBucket(bucket: string): string {
  const normalized = bucket?.trim();
  if (!normalized || normalized.length < 3 || normalized.length > 63) {
    throw new TypeError("S3 bucket must contain between 3 and 63 characters");
  }
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(normalized)) {
    throw new TypeError("S3 bucket contains unsupported characters");
  }
  return normalized;
}

function validateCredential(value: string, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new TypeError(`${name} is required for S3-compatible storage`);
  return normalized;
}

/**
 * Minimal S3-compatible SigV4 client.
 *
 * It intentionally implements only the operations APEX ONE document storage
 * requires. No credential is ever placed in a URL, object key, or persisted
 * document record.
 */
export class S3WireClient {
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly endpoint?: URL;

  constructor(config: S3WireClientConfig) {
    this.bucket = validateBucket(config.bucket);
    this.region = validateCredential(config.region, "S3_REGION");
    this.accessKeyId = validateCredential(config.accessKeyId, "S3_ACCESS_KEY_ID");
    this.secretAccessKey = validateCredential(config.secretAccessKey, "S3_SECRET_ACCESS_KEY");

    if (config.endpoint?.trim()) {
      const endpoint = new URL(config.endpoint.trim());
      if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
        throw new TypeError("S3_ENDPOINT must use http:// or https://");
      }
      endpoint.search = "";
      endpoint.hash = "";
      endpoint.pathname = endpoint.pathname.replace(/\/$/, "");
      this.endpoint = endpoint;
    }
  }

  private requestUrl(key?: string): URL {
    if (this.endpoint) {
      const url = new URL(this.endpoint.toString());
      const prefix = url.pathname === "/" ? "" : url.pathname;
      url.pathname = `${prefix}/${encodePathSegment(this.bucket)}${key ? `/${encodeObjectKey(key)}` : ""}`;
      return url;
    }

    const url = new URL(`https://${this.bucket}.s3.${this.region}.amazonaws.com/`);
    if (key) url.pathname = `/${encodeObjectKey(key)}`;
    return url;
  }

  private authorization(
    method: string,
    url: URL,
    payloadHash: string,
    now: Date
  ): { authorization: string; amzDate: string } {
    const { amzDate, dateStamp } = amzTimestamp(now);
    const canonicalHeaders =
      `host:${url.host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      url.pathname || "/",
      canonicalQuery(url),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const dateKey = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const regionKey = hmac(dateKey, this.region);
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

    return {
      amzDate,
      authorization:
        `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    };
  }

  private async request(
    method: "GET" | "PUT" | "DELETE" | "HEAD",
    key?: string,
    body: Buffer = Buffer.alloc(0),
    contentType?: string,
    allowNotFound: boolean = false
  ): Promise<Response | null> {
    const url = this.requestUrl(key);
    const payloadHash = sha256Hex(body);
    const now = new Date();
    const signed = this.authorization(method, url, payloadHash, now);
    const headers = new Headers({
      authorization: signed.authorization,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": signed.amzDate,
    });
    if (contentType) headers.set("content-type", contentType);

    const response = await fetch(url, {
      method,
      headers,
      body: method === "PUT" ? new Uint8Array(body) : undefined,
      cache: "no-store",
    });

    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      const responseText = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 500);
      throw new S3ObjectStorageError(
        `S3 ${method} failed with HTTP ${response.status}${responseText ? `: ${responseText}` : ""}`,
        response.status
      );
    }
    return response;
  }

  public async createBucketForIntegrationTests(): Promise<void> {
    await this.request("PUT", undefined, Buffer.alloc(0));
  }

  public async putObject(key: string, data: Buffer, contentType: string): Promise<{ etag?: string }> {
    const response = await this.request("PUT", key, data, contentType);
    return { etag: response?.headers.get("etag") || undefined };
  }

  public async getObject(key: string): Promise<S3RawObject | null> {
    const response = await this.request("GET", key, Buffer.alloc(0), undefined, true);
    if (!response) return null;
    return {
      data: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || undefined,
      etag: response.headers.get("etag") || undefined,
    };
  }

  public async headObject(key: string): Promise<boolean> {
    const response = await this.request("HEAD", key, Buffer.alloc(0), undefined, true);
    return response !== null;
  }

  /** S3 DELETE is deliberately idempotent. */
  public async deleteObject(key: string): Promise<boolean> {
    await this.request("DELETE", key, Buffer.alloc(0), undefined, true);
    return true;
  }
}
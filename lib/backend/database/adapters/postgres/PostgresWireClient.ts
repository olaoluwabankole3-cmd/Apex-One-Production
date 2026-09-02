import { createHash, createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import net, { type Socket } from "node:net";
import tls, { type TLSSocket } from "node:tls";

export interface PostgresConnectionConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  sslMode: "disable" | "prefer" | "require" | "verify-full";
  applicationName: string;
  connectTimeoutMs: number;
}

export interface PostgresQueryResult {
  rows: Array<Record<string, string | null>>;
  command?: string;
}

export class PostgresConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostgresConnectionError";
  }
}

export class PostgresQueryError extends Error {
  public readonly code?: string;
  public readonly detail?: string;
  public readonly constraint?: string;

  constructor(message: string, fields: Record<string, string> = {}) {
    super(message);
    this.name = "PostgresQueryError";
    this.code = fields.C;
    this.detail = fields.D;
    this.constraint = fields.n;
  }
}

function parseSslMode(value: string | null): PostgresConnectionConfig["sslMode"] {
  switch ((value || "prefer").toLowerCase()) {
    case "disable": return "disable";
    case "require": return "require";
    case "verify-full": return "verify-full";
    case "prefer":
    default: return "prefer";
  }
}

export function parsePostgresConnectionString(connectionString: string): PostgresConnectionConfig {
  if (!connectionString || typeof connectionString !== "string") {
    throw new PostgresConnectionError("DATABASE_URL is required for PostgreSQL persistence");
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new PostgresConnectionError("DATABASE_URL is not a valid PostgreSQL connection URL");
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new PostgresConnectionError("DATABASE_URL must use postgres:// or postgresql://");
  }

  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new PostgresConnectionError("DATABASE_URL contains an invalid PostgreSQL port");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const user = decodeURIComponent(url.username);
  if (!url.hostname || !database || !user) {
    throw new PostgresConnectionError("DATABASE_URL must include host, database, and user");
  }

  const connectTimeoutMs = Number(url.searchParams.get("connect_timeout_ms") || 10_000);
  if (!Number.isFinite(connectTimeoutMs) || connectTimeoutMs <= 0) {
    throw new PostgresConnectionError("DATABASE_URL contains an invalid connect timeout");
  }

  return {
    host: url.hostname,
    port,
    user,
    password: decodeURIComponent(url.password),
    database,
    sslMode: parseSslMode(url.searchParams.get("sslmode")),
    applicationName: url.searchParams.get("application_name") || "apex-one",
    connectTimeoutMs,
  };
}

function int16(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(2);
  buffer.writeInt16BE(value, 0);
  return buffer;
}

function int32(value: number): Buffer {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeInt32BE(value, 0);
  return buffer;
}

function cstring(value: string): Buffer {
  return Buffer.from(`${value}\0`, "utf8");
}

function typedMessage(type: string, body: Buffer): Buffer {
  return Buffer.concat([Buffer.from(type, "ascii"), int32(body.length + 4), body]);
}

class BufferedSocketReader {
  private buffer = Buffer.alloc(0);
  private waiters: Array<() => void> = [];
  private failure: Error | null = null;

  constructor(private readonly socket: Socket | TLSSocket) {
    socket.on("data", (chunk: Buffer) => {
      this.buffer = this.buffer.length === 0 ? chunk : Buffer.concat([this.buffer, chunk]);
      this.flushWaiters();
    });
    socket.on("error", (error) => {
      this.failure = error;
      this.flushWaiters();
    });
    socket.on("end", () => {
      if (!this.failure) this.failure = new PostgresConnectionError("PostgreSQL connection ended unexpectedly");
      this.flushWaiters();
    });
  }

  private flushWaiters(): void {
    for (const resolve of this.waiters.splice(0)) resolve();
  }

  private async waitForData(): Promise<void> {
    if (this.failure) throw this.failure;
    await new Promise<void>((resolve) => this.waiters.push(resolve));
    if (this.failure) throw this.failure;
  }

  public async readBytes(length: number): Promise<Buffer> {
    while (this.buffer.length < length) await this.waitForData();
    const result = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return result;
  }

  public async readMessage(): Promise<{ type: string; payload: Buffer }> {
    const header = await this.readBytes(5);
    const type = header.subarray(0, 1).toString("ascii");
    const length = header.readInt32BE(1);
    if (length < 4 || length > 64 * 1024 * 1024) {
      throw new PostgresConnectionError(`Invalid PostgreSQL message length ${length}`);
    }
    return { type, payload: await this.readBytes(length - 4) };
  }
}

function onceConnected(socket: Socket, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new PostgresConnectionError("Timed out connecting to PostgreSQL"));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function readSingleByte(socket: Socket): Promise<number> {
  return new Promise((resolve, reject) => {
    const onData = (chunk: Buffer) => {
      cleanup();
      if (chunk.length !== 1) {
        reject(new PostgresConnectionError("Unexpected PostgreSQL SSL negotiation response"));
        return;
      }
      resolve(chunk[0]);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      socket.off("data", onData);
      socket.off("error", onError);
    };
    socket.once("data", onData);
    socket.once("error", onError);
  });
}

function escapeScramUsername(value: string): string {
  return value.replace(/=/g, "=3D").replace(/,/g, "=2C");
}

function parseScramAttributes(message: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of message.split(",")) {
    const index = part.indexOf("=");
    if (index > 0) result[part.slice(0, index)] = part.slice(index + 1);
  }
  return result;
}

function xor(left: Buffer, right: Buffer): Buffer {
  if (left.length !== right.length) throw new PostgresConnectionError("SCRAM proof length mismatch");
  const output = Buffer.allocUnsafe(left.length);
  for (let index = 0; index < left.length; index += 1) output[index] = left[index] ^ right[index];
  return output;
}

interface ScramState {
  clientFirstBare: string;
  clientNonce: string;
  expectedServerSignature?: Buffer;
}

function parseErrorFields(payload: Buffer): Record<string, string> {
  const fields: Record<string, string> = {};
  let offset = 0;
  while (offset < payload.length && payload[offset] !== 0) {
    const code = String.fromCharCode(payload[offset]);
    offset += 1;
    const end = payload.indexOf(0, offset);
    if (end < 0) break;
    fields[code] = payload.subarray(offset, end).toString("utf8");
    offset = end + 1;
  }
  return fields;
}

function readCString(payload: Buffer, start: number): { value: string; next: number } {
  const end = payload.indexOf(0, start);
  if (end < 0) throw new PostgresConnectionError("Malformed PostgreSQL C string");
  return { value: payload.subarray(start, end).toString("utf8"), next: end + 1 };
}

export class PostgresWireConnection {
  private socket!: Socket | TLSSocket;
  private reader!: BufferedSocketReader;
  private connected = false;
  private scramState?: ScramState;

  constructor(private readonly config: PostgresConnectionConfig) {}

  public static async connect(connectionString: string): Promise<PostgresWireConnection> {
    const connection = new PostgresWireConnection(parsePostgresConnectionString(connectionString));
    await connection.open();
    return connection;
  }

  private async open(): Promise<void> {
    const plain = net.createConnection({ host: this.config.host, port: this.config.port });
    await onceConnected(plain, this.config.connectTimeoutMs);

    let socket: Socket | TLSSocket = plain;
    if (this.config.sslMode !== "disable") {
      plain.write(Buffer.concat([int32(8), int32(80877103)]));
      const response = await readSingleByte(plain);
      if (response === 0x53) {
        socket = tls.connect({
          socket: plain,
          servername: this.config.host,
          rejectUnauthorized: this.config.sslMode === "verify-full",
        });
        await new Promise<void>((resolve, reject) => {
          (socket as TLSSocket).once("secureConnect", resolve);
          (socket as TLSSocket).once("error", reject);
        });
      } else if (response === 0x4e) {
        if (this.config.sslMode === "require" || this.config.sslMode === "verify-full") {
          plain.destroy();
          throw new PostgresConnectionError("PostgreSQL server refused required TLS");
        }
      } else {
        plain.destroy();
        throw new PostgresConnectionError("PostgreSQL server returned an invalid TLS negotiation response");
      }
    }

    this.socket = socket;
    this.reader = new BufferedSocketReader(socket);
    this.writeStartup();
    await this.completeAuthentication();
    this.connected = true;
  }

  private writeStartup(): void {
    const fields = Buffer.concat([
      cstring("user"), cstring(this.config.user),
      cstring("database"), cstring(this.config.database),
      cstring("client_encoding"), cstring("UTF8"),
      cstring("application_name"), cstring(this.config.applicationName),
      Buffer.from([0]),
    ]);
    const body = Buffer.concat([int32(196608), fields]);
    this.socket.write(Buffer.concat([int32(body.length + 4), body]));
  }

  private sendPassword(value: string): void {
    this.socket.write(typedMessage("p", cstring(value)));
  }

  private sendSaslInitialResponse(mechanism: string, response: string): void {
    const responseBuffer = Buffer.from(response, "utf8");
    this.socket.write(typedMessage("p", Buffer.concat([cstring(mechanism), int32(responseBuffer.length), responseBuffer])));
  }

  private sendSaslResponse(response: string): void {
    this.socket.write(typedMessage("p", Buffer.from(response, "utf8")));
  }

  private handleAuthentication(payload: Buffer): void {
    const authType = payload.readInt32BE(0);
    if (authType === 0) return;
    if (authType === 3) {
      this.sendPassword(this.config.password);
      return;
    }
    if (authType === 5) {
      const salt = payload.subarray(4, 8);
      const first = createHash("md5").update(this.config.password + this.config.user).digest("hex");
      const second = createHash("md5").update(Buffer.concat([Buffer.from(first, "ascii"), salt])).digest("hex");
      this.sendPassword(`md5${second}`);
      return;
    }
    if (authType === 10) {
      const mechanisms = payload.subarray(4).toString("utf8").split("\0").filter(Boolean);
      if (!mechanisms.includes("SCRAM-SHA-256")) {
        throw new PostgresConnectionError("PostgreSQL server does not offer SCRAM-SHA-256 authentication");
      }
      const clientNonce = randomBytes(18).toString("base64");
      const clientFirstBare = `n=${escapeScramUsername(this.config.user)},r=${clientNonce}`;
      this.scramState = { clientFirstBare, clientNonce };
      this.sendSaslInitialResponse("SCRAM-SHA-256", `n,,${clientFirstBare}`);
      return;
    }
    if (authType === 11) {
      if (!this.scramState) throw new PostgresConnectionError("Unexpected SCRAM continuation");
      const serverFirst = payload.subarray(4).toString("utf8");
      const attributes = parseScramAttributes(serverFirst);
      const serverNonce = attributes.r;
      const salt = attributes.s;
      const iterations = Number(attributes.i);
      if (!serverNonce?.startsWith(this.scramState.clientNonce) || !salt || !Number.isInteger(iterations) || iterations <= 0) {
        throw new PostgresConnectionError("Invalid SCRAM server-first message");
      }

      const saltedPassword = pbkdf2Sync(this.config.password, Buffer.from(salt, "base64"), iterations, 32, "sha256");
      const clientKey = createHmac("sha256", saltedPassword).update("Client Key").digest();
      const storedKey = createHash("sha256").update(clientKey).digest();
      const clientFinalWithoutProof = `c=biws,r=${serverNonce}`;
      const authMessage = `${this.scramState.clientFirstBare},${serverFirst},${clientFinalWithoutProof}`;
      const clientSignature = createHmac("sha256", storedKey).update(authMessage).digest();
      const proof = xor(clientKey, clientSignature).toString("base64");
      const serverKey = createHmac("sha256", saltedPassword).update("Server Key").digest();
      this.scramState.expectedServerSignature = createHmac("sha256", serverKey).update(authMessage).digest();
      this.sendSaslResponse(`${clientFinalWithoutProof},p=${proof}`);
      return;
    }
    if (authType === 12) {
      if (!this.scramState?.expectedServerSignature) throw new PostgresConnectionError("Unexpected SCRAM final message");
      const attributes = parseScramAttributes(payload.subarray(4).toString("utf8"));
      if (attributes.e) throw new PostgresConnectionError(`SCRAM authentication failed: ${attributes.e}`);
      if (!attributes.v) throw new PostgresConnectionError("SCRAM server signature is missing");
      const actual = Buffer.from(attributes.v, "base64");
      const expected = this.scramState.expectedServerSignature;
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw new PostgresConnectionError("SCRAM server signature verification failed");
      }
      return;
    }
    throw new PostgresConnectionError(`Unsupported PostgreSQL authentication method ${authType}`);
  }

  private async completeAuthentication(): Promise<void> {
    while (true) {
      const message = await this.reader.readMessage();
      switch (message.type) {
        case "R": this.handleAuthentication(message.payload); break;
        case "E": {
          const fields = parseErrorFields(message.payload);
          throw new PostgresQueryError(fields.M || "PostgreSQL authentication failed", fields);
        }
        case "Z": return;
        case "S":
        case "K":
        case "N": break;
        default: break;
      }
    }
  }

  public async query(sql: string): Promise<PostgresQueryResult> {
    if (!this.connected) throw new PostgresConnectionError("PostgreSQL connection is not open");
    this.socket.write(typedMessage("Q", cstring(sql)));

    let columns: string[] = [];
    const rows: Array<Record<string, string | null>> = [];
    let command: string | undefined;
    let pendingError: PostgresQueryError | undefined;

    while (true) {
      const message = await this.reader.readMessage();
      switch (message.type) {
        case "T": {
          const count = message.payload.readInt16BE(0);
          let offset = 2;
          columns = [];
          for (let index = 0; index < count; index += 1) {
            const parsed = readCString(message.payload, offset);
            columns.push(parsed.value);
            offset = parsed.next + 18;
          }
          break;
        }
        case "D": {
          const count = message.payload.readInt16BE(0);
          let offset = 2;
          const row: Record<string, string | null> = {};
          for (let index = 0; index < count; index += 1) {
            const length = message.payload.readInt32BE(offset);
            offset += 4;
            if (length === -1) {
              row[columns[index] || String(index)] = null;
            } else {
              row[columns[index] || String(index)] = message.payload.subarray(offset, offset + length).toString("utf8");
              offset += length;
            }
          }
          rows.push(row);
          break;
        }
        case "C": command = message.payload.subarray(0, Math.max(0, message.payload.length - 1)).toString("utf8"); break;
        case "E": {
          const fields = parseErrorFields(message.payload);
          pendingError = new PostgresQueryError(fields.M || "PostgreSQL query failed", fields);
          break;
        }
        case "Z":
          if (pendingError) throw pendingError;
          return { rows, command };
        case "N":
        case "S":
        case "I": break;
        default: break;
      }
    }
  }

  public async close(): Promise<void> {
    if (!this.socket || this.socket.destroyed) return;
    try {
      this.socket.write(typedMessage("X", Buffer.alloc(0)));
    } finally {
      this.socket.end();
      this.connected = false;
    }
  }
}

export function quotePostgresLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Cannot encode non-finite number as PostgreSQL literal");
    return String(value);
  }
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString().replace(/'/g, "''")}'`;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

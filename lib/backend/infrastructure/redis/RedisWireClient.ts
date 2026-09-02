import net, { type Socket } from "node:net";
import tls, { type TLSSocket } from "node:tls";

export type RedisReply = string | number | null | RedisReply[];

export interface RedisConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: number;
  tls: boolean;
  connectTimeoutMs: number;
}

export class RedisConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisConnectionError";
  }
}

export class RedisCommandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisCommandError";
  }
}

export function parseRedisConnectionString(connectionString: string): RedisConnectionConfig {
  if (!connectionString || typeof connectionString !== "string") {
    throw new RedisConnectionError("REDIS_URL is required for Redis-backed authentication state");
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new RedisConnectionError("REDIS_URL is not a valid Redis URL");
  }

  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new RedisConnectionError("REDIS_URL must use redis:// or rediss://");
  }

  const port = url.port ? Number(url.port) : url.protocol === "rediss:" ? 6380 : 6379;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new RedisConnectionError("REDIS_URL contains an invalid Redis port");
  }

  const rawDatabase = url.pathname.replace(/^\/+/, "");
  const database = rawDatabase.length > 0 ? Number(rawDatabase) : 0;
  if (!Number.isInteger(database) || database < 0) {
    throw new RedisConnectionError("REDIS_URL contains an invalid Redis database number");
  }

  const connectTimeoutMs = Number(url.searchParams.get("connect_timeout_ms") || 10_000);
  if (!Number.isFinite(connectTimeoutMs) || connectTimeoutMs <= 0) {
    throw new RedisConnectionError("REDIS_URL contains an invalid connect timeout");
  }

  if (!url.hostname) {
    throw new RedisConnectionError("REDIS_URL must include a host");
  }

  return {
    host: url.hostname,
    port,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    database,
    tls: url.protocol === "rediss:",
    connectTimeoutMs,
  };
}

function encodeCommand(parts: readonly (string | number)[]): Buffer {
  const encoded: Buffer[] = [Buffer.from(`*${parts.length}\r\n`, "utf8")];
  for (const part of parts) {
    const value = Buffer.from(String(part), "utf8");
    encoded.push(Buffer.from(`$${value.length}\r\n`, "utf8"), value, Buffer.from("\r\n", "utf8"));
  }
  return Buffer.concat(encoded);
}

class RedisSocketReader {
  private buffer: Buffer<ArrayBufferLike> = Buffer.alloc(0);
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
      if (!this.failure) this.failure = new RedisConnectionError("Redis connection ended unexpectedly");
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

  private async readByte(): Promise<number> {
    while (this.buffer.length < 1) await this.waitForData();
    const value = this.buffer[0];
    this.buffer = this.buffer.subarray(1);
    return value;
  }

  private async readLine(): Promise<string> {
    while (true) {
      const index = this.buffer.indexOf("\r\n");
      if (index >= 0) {
        const line = this.buffer.subarray(0, index).toString("utf8");
        this.buffer = this.buffer.subarray(index + 2);
        return line;
      }
      await this.waitForData();
    }
  }

  private async readBytes(length: number): Promise<Buffer<ArrayBufferLike>> {
    while (this.buffer.length < length) await this.waitForData();
    const result = this.buffer.subarray(0, length);
    this.buffer = this.buffer.subarray(length);
    return result;
  }

  public async readReply(): Promise<RedisReply> {
    const prefix = String.fromCharCode(await this.readByte());
    switch (prefix) {
      case "+":
        return this.readLine();
      case "-":
        throw new RedisCommandError(await this.readLine());
      case ":": {
        const raw = await this.readLine();
        const value = Number(raw);
        if (!Number.isSafeInteger(value)) throw new RedisConnectionError(`Invalid Redis integer reply '${raw}'`);
        return value;
      }
      case "$": {
        const rawLength = await this.readLine();
        const length = Number(rawLength);
        if (!Number.isInteger(length) || length < -1) {
          throw new RedisConnectionError(`Invalid Redis bulk-string length '${rawLength}'`);
        }
        if (length === -1) return null;
        const payload = await this.readBytes(length + 2);
        if (payload[length] !== 13 || payload[length + 1] !== 10) {
          throw new RedisConnectionError("Malformed Redis bulk-string terminator");
        }
        return payload.subarray(0, length).toString("utf8");
      }
      case "*": {
        const rawCount = await this.readLine();
        const count = Number(rawCount);
        if (!Number.isInteger(count) || count < -1) {
          throw new RedisConnectionError(`Invalid Redis array length '${rawCount}'`);
        }
        if (count === -1) return null;
        const values: RedisReply[] = [];
        for (let index = 0; index < count; index += 1) values.push(await this.readReply());
        return values;
      }
      default:
        throw new RedisConnectionError(`Unsupported Redis RESP reply prefix '${prefix}'`);
    }
  }
}

async function connectSocket(config: RedisConnectionConfig): Promise<Socket | TLSSocket> {
  if (config.tls) {
    return new Promise<TLSSocket>((resolve, reject) => {
      const socket = tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        rejectUnauthorized: true,
      });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new RedisConnectionError("Timed out connecting to Redis over TLS"));
      }, config.connectTimeoutMs);
      socket.once("secureConnect", () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      socket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  return new Promise<Socket>((resolve, reject) => {
    const socket = net.createConnection({ host: config.host, port: config.port });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new RedisConnectionError("Timed out connecting to Redis"));
    }, config.connectTimeoutMs);
    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export class RedisWireClient {
  private readonly config: RedisConnectionConfig;

  constructor(connectionString: string) {
    this.config = parseRedisConnectionString(connectionString);
  }

  private async send(
    socket: Socket | TLSSocket,
    reader: RedisSocketReader,
    command: readonly (string | number)[]
  ): Promise<RedisReply> {
    socket.write(encodeCommand(command));
    return reader.readReply();
  }

  public async execute(command: readonly (string | number)[]): Promise<RedisReply> {
    if (!Array.isArray(command) || command.length === 0) {
      throw new RedisCommandError("Redis command must contain at least one part");
    }

    const socket = await connectSocket(this.config);
    const reader = new RedisSocketReader(socket);

    try {
      if (this.config.password) {
        const authCommand = this.config.username
          ? ["AUTH", this.config.username, this.config.password]
          : ["AUTH", this.config.password];
        const authResult = await this.send(socket, reader, authCommand);
        if (authResult !== "OK") throw new RedisConnectionError("Redis authentication did not return OK");
      }

      if (this.config.database !== 0) {
        const selectResult = await this.send(socket, reader, ["SELECT", this.config.database]);
        if (selectResult !== "OK") throw new RedisConnectionError("Redis database selection did not return OK");
      }

      return await this.send(socket, reader, command);
    } finally {
      socket.end();
    }
  }

  public async ping(): Promise<boolean> {
    return (await this.execute(["PING"])) === "PONG";
  }
}

import {
  resolveReleaseIdentity,
  type ReleaseEnvironment,
  type ReleaseIdentity,
} from "../infrastructure/releaseIdentity";

export type TelemetryLevel = "debug" | "info" | "warn" | "error";
export type TelemetryOutcome = "success" | "failure" | "accepted" | "blocked" | "unknown";

export interface TelemetryOptions {
  level?: TelemetryLevel;
  message?: string;
  outcome?: TelemetryOutcome;
  requestId?: string;
  durationMs?: number;
  attributes?: Record<string, unknown>;
  release?: ReleaseIdentity;
}

export interface StructuredTelemetryEvent {
  schemaVersion: 1;
  timestamp: string;
  service: "apex-one";
  event: string;
  level: TelemetryLevel;
  message?: string;
  outcome?: TelemetryOutcome;
  requestId?: string;
  durationMs?: number;
  release: ReleaseIdentity;
  attributes?: Record<string, unknown>;
}

const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|secret|token|credential|api.?key|access.?key|database.?url|redis.?url|endpoint|dsn|uri|url)/i;
const MAX_STRING_LENGTH = 512;
const MAX_ARRAY_ITEMS = 25;
const MAX_DEPTH = 6;

export function normalizeRequestId(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized && REQUEST_ID_PATTERN.test(normalized) ? normalized : undefined;
}

function sanitizeValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH) return "[TRUNCATED]";
  if (value === null || value === undefined || typeof value === "boolean" || typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizeValue(item, depth + 1, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      output[key] = SENSITIVE_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : sanitizeValue(nested, depth + 1, seen);
    }
    return output;
  }
  return String(value);
}

export function redactTelemetryAttributes(
  attributes: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!attributes) return undefined;
  return sanitizeValue(attributes, 0, new WeakSet<object>()) as Record<string, unknown>;
}

export function createTelemetryEvent(
  event: string,
  options: TelemetryOptions = {},
  env: ReleaseEnvironment = process.env
): StructuredTelemetryEvent {
  const normalizedEvent = event.trim();
  if (!normalizedEvent || normalizedEvent.length > 160) {
    throw new TypeError("Telemetry event name must contain between 1 and 160 characters");
  }

  const requestId = normalizeRequestId(options.requestId);
  const durationMs =
    typeof options.durationMs === "number" && Number.isFinite(options.durationMs)
      ? Math.max(0, Math.round(options.durationMs))
      : undefined;

  return {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    service: "apex-one",
    event: normalizedEvent,
    level: options.level || "info",
    ...(options.message ? { message: options.message.slice(0, MAX_STRING_LENGTH) } : {}),
    ...(options.outcome ? { outcome: options.outcome } : {}),
    ...(requestId ? { requestId } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    release: options.release || resolveReleaseIdentity(env),
    ...(options.attributes ? { attributes: redactTelemetryAttributes(options.attributes) } : {}),
  };
}

export function emitTelemetry(
  event: string,
  options: TelemetryOptions = {},
  env: ReleaseEnvironment = process.env
): StructuredTelemetryEvent {
  const record = createTelemetryEvent(event, options, env);
  const serialized = JSON.stringify(record);
  if (record.level === "error") console.error(serialized);
  else if (record.level === "warn") console.warn(serialized);
  else console.log(serialized);
  return record;
}

export async function withTelemetry<T>(
  event: string,
  work: () => Promise<T>,
  options: Omit<TelemetryOptions, "durationMs" | "outcome"> = {},
  env: ReleaseEnvironment = process.env
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await work();
    emitTelemetry(
      event,
      { ...options, outcome: "success", durationMs: Date.now() - startedAt },
      env
    );
    return result;
  } catch (error) {
    emitTelemetry(
      event,
      {
        ...options,
        level: "error",
        outcome: "failure",
        durationMs: Date.now() - startedAt,
        attributes: {
          ...(options.attributes || {}),
          errorType: error instanceof Error ? error.name : typeof error,
        },
      },
      env
    );
    throw error;
  }
}

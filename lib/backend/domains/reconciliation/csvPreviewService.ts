/**
 * CORTEX — bounded, request-only CSV reconciliation preview.
 *
 * The source document hashes are calculated from the request bytes; they are
 * NOT verified, retained, or associated with durable bank source records.
 * No live feed connector, storage, action, fee calculation or loss finding.
 */
import { createHash } from "node:crypto";
import { ValidationError, type TenantContext } from "../../core/errors";
import { requirePermission } from "../../core/security";
import {
  reconcileFinancialSourceLines,
  type FinancialSourceLine,
  type ReconciliationKind,
  type ReconciliationResult,
} from "./settlementExceptionEngine";

const HEADER = ["reference", "currency", "amount_minor", "record_id", "recorded_at"];
const MAX_SOURCE_BYTES = 128 * 1024;
const MAX_ROWS_PER_FEED = 1000;

export interface CsvPreviewFeed {
  feedId: string;
  csv: string;
}

export interface CsvPreviewRequest {
  kind: ReconciliationKind;
  expected: CsvPreviewFeed;
  observed: CsvPreviewFeed;
  toleranceMinorByCurrency?: Readonly<Record<string, string>>;
}

export interface CsvPreviewResult {
  previewOnly: true;
  sourceStored: false;
  sourceIntegrity: "request_digest_only";
  coverageVerified: false;
  feedSummaries: {
    role: "expected" | "observed";
    feedId: string;
    sha256: string;
    rows: number;
  }[];
  reconciliation: ReconciliationResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertKeys(value: Record<string, unknown>, keys: readonly string[], name: string): void {
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) {
      throw new ValidationError(`Unsupported ${name} field`);
    }
  }
}

function readFeed(value: unknown, name: string): CsvPreviewFeed {
  if (!isRecord(value)) throw new ValidationError(`Invalid ${name} feed`);
  assertKeys(value, ["feedId", "csv"], name);
  if (typeof value.feedId !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value.feedId)) {
    throw new ValidationError(`Invalid ${name} feed identifier`);
  }
  if (typeof value.csv !== "string" || !value.csv ||
      Buffer.byteLength(value.csv, "utf8") > MAX_SOURCE_BYTES ||
      value.csv.includes("\u0000")) {
    throw new ValidationError(`Invalid ${name} CSV size or contents`);
  }
  return { feedId: value.feedId, csv: value.csv };
}

function parseCsv(csv: string): string[][] {
  // Strict RFC4180-style five-column reader; fail closed on malformed quoting.
  const text = csv.charCodeAt(0) === 0xfeff ? csv.slice(1) : csv;
  const rows: string[][] = [];
  let fields: string[] = [];
  let field = "";
  let state: "start" | "plain" | "quoted" | "closed" = "start";
  let rowEnded = false;

  const pushField = () => {
    fields.push(field);
    field = "";
    state = "start";
  };
  const pushRow = () => {
    pushField();
    if (rows.length >= MAX_ROWS_PER_FEED + 1) {
      throw new ValidationError("CSV feed exceeds its maximum row count");
    }
    rows.push(fields);
    fields = [];
    rowEnded = true;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\u0000") throw new ValidationError("CSV contains a null byte");
    if (state === "quoted") {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          state = "closed";
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      if (state !== "start") throw new ValidationError("Invalid CSV quoting");
      state = "quoted";
    } else if (char === ",") {
      pushField();
      rowEnded = false;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (state === "closed") throw new ValidationError("Invalid CSV characters after closing quote");
      state = "plain";
      field += char;
    }
    if (field.length > 1024) throw new ValidationError("CSV field exceeds size limit");
    if (fields.length > 5) throw new ValidationError("CSV has too many columns");
    if (char !== "\r" && char !== "\n") rowEnded = false;
  }
  if (state === "quoted") throw new ValidationError("Unclosed CSV quoted field");
  if (!rowEnded || fields.length > 0 || field.length > 0) {
    pushRow();
  }
  if (rows.length < 2 || rows[0].length !== 5 ||
      rows[0].some((field, i) => field !== HEADER[i])) {
    throw new ValidationError("CSV requires the exact five-column financial preview header and at least one record");
  }
  if (rows.slice(1).some((row) => row.length !== 5)) {
    throw new ValidationError("Every CSV row must have exactly five fields");
  }
  return rows;
}

function mapFeed(ctx: TenantContext, kind: ReconciliationKind,
  role: "expected" | "observed", feed: CsvPreviewFeed) {
  const rows = parseCsv(feed.csv);
  const sha256 = createHash("sha256").update(Buffer.from(feed.csv, "utf8")).digest("hex");
  const lines: FinancialSourceLine[] = rows.slice(1).map((row) => ({
    organizationId: ctx.organizationId,
    kind,
    role,
    reference: row[0],
    currency: row[1],
    amountMinor: row[2],
    sourceRecordId: row[3],
    recordedAt: row[4],
    // The digest identifies only request-provided bytes, not verified source evidence.
    sourceDocumentId: `request-${sha256}`,
    sourceSha256: sha256,
  }));
  return { lines, summary: { role, feedId: feed.feedId, sha256, rows: lines.length } };
}

/**
 * Validate a single internal snapshot using the same strict CSV parser,
 * mapped money/reference rules and deterministic reconciliation engine.
 * No source completeness, custody, authentication or monetary outcome is
 * established. Callers must already have an authenticated institutional role.
 */
export function validateFinancialCsvForInternalIntake(
  ctx: TenantContext, kind: ReconciliationKind,
  role: "expected" | "observed", feed: CsvPreviewFeed
): { sha256: string; rows: number } {
  requirePermission(ctx, "financial:read");
  requirePermission(ctx, "financial:write");
  if (kind !== "settlement" && kind !== "fee") throw new ValidationError("Unsupported financial source kind");
  if (role !== "expected" && role !== "observed") throw new ValidationError("Unsupported financial source role");
  const validated = readFeed(feed, "internal intake");
  const result = mapFeed(ctx, kind, role, validated);
  // One feed is deliberately incomplete. Comparison is used ONLY for strict
  // validation of line values; generated candidates are not retained here.
  reconcileFinancialSourceLines(ctx, {
    lines: result.lines,
    declaredCoverage: { expectedFeedComplete: false, observedFeedComplete: false },
  });
  return { sha256: result.summary.sha256, rows: result.summary.rows };
}

/** Strict, non-persistent preview. Only authenticated financial-data writers can submit data. */
export function prepareFinancialCsvPreview(
  ctx: TenantContext, input: unknown
): CsvPreviewResult {
  requirePermission(ctx, "financial:read");
  requirePermission(ctx, "financial:write");
  if (!isRecord(input)) throw new ValidationError("Financial preview body must be an object");
  assertKeys(input, ["kind", "expected", "observed", "toleranceMinorByCurrency"], "preview");
  if (input.kind !== "settlement" && input.kind !== "fee") {
    throw new ValidationError("Unsupported financial preview kind");
  }
  const expected = readFeed(input.expected, "expected");
  const observed = readFeed(input.observed, "observed");
  if (expected.feedId === observed.feedId) {
    throw new ValidationError("Expected and observed feeds must have different identifiers");
  }
  const first = mapFeed(ctx, input.kind, "expected", expected);
  const second = mapFeed(ctx, input.kind, "observed", observed);
  if (first.summary.sha256 === second.summary.sha256) {
    throw new ValidationError("Expected and observed feeds cannot use identical request bytes");
  }
  const mapped = [...first.lines, ...second.lines];
  // Never trust a client to certify that a bank or provider feed is complete.
  const reconciliation = reconcileFinancialSourceLines(ctx, {
    lines: mapped,
    declaredCoverage: {
      expectedFeedComplete: false,
      observedFeedComplete: false,
    },
    ...(input.toleranceMinorByCurrency === undefined ? {} :
      { toleranceMinorByCurrency: input.toleranceMinorByCurrency as Record<string, string> }),
  });
  return {
    previewOnly: true,
    sourceStored: false,
    sourceIntegrity: "request_digest_only",
    coverageVerified: false,
    feedSummaries: [first.summary, second.summary],
    reconciliation,
  };
}

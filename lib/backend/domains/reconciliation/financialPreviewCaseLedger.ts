/**
 * CORTEX — internal, metadata-only, durable financial preview-case triage.
 *
 * This is NOT a banking connector, evidence certification or production case
 * workflow. Do not expose as an HTTP endpoint until encrypted immutable source
 * ingestion, institution consent, rate limits and retention are implemented.
 *
 * No raw CSV bytes, amounts, economic references or financial values persist.
 */
import { createHash } from "node:crypto";
import {
  ConflictError, NotFoundError, ValidationError,
  type TenantContext,
} from "../../core/errors";
import { requirePermission } from "../../core/security";
import {
  PostgresAuditLogRepository, PostgresConnectionManager,
} from "../../database/adapters/postgres/PostgresPersistence";
import {
  PostgresQueryError, quotePostgresLiteral,
  type PostgresWireConnection,
} from "../../database/adapters/postgres/PostgresWireClient";
import { prepareFinancialCsvPreview, type CsvPreviewRequest } from "./csvPreviewService";
import type { ComparisonStatus } from "./settlementExceptionEngine";

export type FinancialPreviewTriageStatus =
  | "unreviewed" | "in_review" | "escalated" | "dismissed";

export type FinancialPreviewReason =
  | "source_gap" | "mapping_error" | "potential_discrepancy" | "duplicate" | "other";

type CandidateStatus = Exclude<ComparisonStatus, "balanced">;

export interface FinancialPreviewCaseRecord {
  caseId: string;
  batchId: string;
  comparisonStatus: CandidateStatus;
  triageStatus: FinancialPreviewTriageStatus;
  version: number;
  reviewerId: string | null;
  reasonCode: FinancialPreviewReason | null;
}

export interface FinancialPreviewBatchRecord {
  batchId: string;
  caseCount: number;
  kind: "settlement" | "fee";
  replayed: boolean;
  verificationState: "unverified";
  sourceStored: false;
  coverageVerified: false;
  financialLossAssessed: false;
}

const HEX = /^[a-f0-9]{64}$/;
const CASE_ID = /^recon-[a-f0-9]{32}$/;
const BATCH_ID = /^fpbatch-[a-f0-9]{40}$/;
const CASE_STATUSES = new Set<CandidateStatus>([
  "amount_discrepancy", "currency_mismatch", "missing_expected",
  "missing_observed", "insufficient_source_coverage", "ambiguous",
]);
const REASONS = new Set<FinancialPreviewReason>([
  "source_gap", "mapping_error", "potential_discrepancy", "duplicate", "other",
]);
const TRANSITIONS: Record<FinancialPreviewTriageStatus, readonly FinancialPreviewTriageStatus[]> = {
  unreviewed: ["in_review"],
  in_review: ["escalated", "dismissed"],
  escalated: [],
  dismissed: [],
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertBatchId(id: string): void {
  if (!BATCH_ID.test(id)) throw new ValidationError("Invalid preview batch identifier");
}

function assertCaseId(id: string): void {
  if (!CASE_ID.test(id)) throw new ValidationError("Invalid preview case identifier");
}

function audit(ctx: TenantContext, action: string, batchId: string,
  metadata: Record<string, unknown>) {
  return {
    organizationId: ctx.organizationId,
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    action,
    resource: "FinancialPreviewCaseLedger",
    resourceId: batchId,
    requestId: ctx.requestId,
    status: "success" as const,
    metadata: {
      previewOnly: true,
      verificationState: "unverified",
      financialLossAssessed: false,
      ...metadata,
    },
    timestamp: new Date().toISOString(),
  };
}

function castStatus(value: string | null): CandidateStatus {
  if (!CASE_STATUSES.has(value as CandidateStatus)) {
    throw new Error("Unsupported stored preview case status");
  }
  return value as CandidateStatus;
}

function castTriage(value: string | null): FinancialPreviewTriageStatus {
  if (value !== "unreviewed" && value !== "in_review" &&
      value !== "escalated" && value !== "dismissed") {
    throw new Error("Unsupported stored case review state");
  }
  return value;
}

function parseCase(row: Record<string, string | null>, batchId: string): FinancialPreviewCaseRecord {
  const reason = row.reason_code;
  if (reason !== null && !REASONS.has(reason as FinancialPreviewReason)) {
    throw new Error("Unsupported stored review reason");
  }
  return {
    caseId: row.case_id!,
    batchId,
    comparisonStatus: castStatus(row.comparison_status),
    triageStatus: castTriage(row.triage_status),
    version: Number(row.version),
    reviewerId: row.reviewer_id,
    reasonCode: reason as FinancialPreviewReason | null,
  };
}

function mapDatabaseConflict(error: unknown): never {
  if (error instanceof PostgresQueryError &&
      (error.code === "40001" || error.code === "40P01")) {
    throw new ConflictError("Concurrent preview review conflict; retry with current version");
  }
  throw error;
}

export class FinancialPreviewCaseLedger {
  private readonly manager: PostgresConnectionManager;
  private readonly audits: PostgresAuditLogRepository;

  constructor(databaseUrl: string) {
    this.manager = new PostgresConnectionManager(databaseUrl);
    this.audits = new PostgresAuditLogRepository(this.manager);
  }

  /**
   * Internally derives every candidate and digest from bounded CSV request data;
   * clients cannot supply case IDs, review status or a claim of source coverage.
   * Identical input digests + policy in one tenant are idempotent.
   */
  public async register(
    ctx: TenantContext, input: CsvPreviewRequest
  ): Promise<FinancialPreviewBatchRecord> {
    requirePermission(ctx, "financial:read");
    requirePermission(ctx, "financial:write");
    const preview = prepareFinancialCsvPreview(ctx, input);
    const [expected, observed] = preview.feedSummaries;
    const tolerances = Object.entries(input.toleranceMinorByCurrency ?? {})
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    const sourcePairFingerprint = hash([expected.sha256, observed.sha256]);
    const requestFingerprint = hash([
      ctx.organizationId, input.kind, sourcePairFingerprint, tolerances,
      "metadata-only-v1",
    ]);
    if (!HEX.test(sourcePairFingerprint) || !HEX.test(requestFingerprint)) {
      throw new Error("Failed to derive source fingerprints");
    }
    const batchId = "fpbatch-" + requestFingerprint.slice(0, 40);
    const candidateCases = preview.reconciliation.cases.filter(
      (item) => item.comparisonStatus !== "balanced"
    );

    const result: FinancialPreviewBatchRecord = {
      batchId,
      kind: input.kind,
      caseCount: candidateCases.length,
      replayed: false,
      verificationState: "unverified",
      sourceStored: false,
      coverageVerified: false,
      financialLossAssessed: false,
    };

    try {
      return await this.manager.runInTransaction(ctx, async (connection) => {
        await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        const inserted = await connection.query(`
          INSERT INTO apex_financial_preview_batches(
            id, organization_id, request_fingerprint, source_pair_fingerprint,
            reconciliation_kind, case_count, created_by
          ) VALUES (
            ${quotePostgresLiteral(batchId)},
            ${quotePostgresLiteral(ctx.organizationId)},
            ${quotePostgresLiteral(requestFingerprint)},
            ${quotePostgresLiteral(sourcePairFingerprint)},
            ${quotePostgresLiteral(input.kind)},
            ${candidateCases.length},
            ${quotePostgresLiteral(ctx.userId)}
          )
          ON CONFLICT (organization_id, request_fingerprint) DO NOTHING
          RETURNING id
        `);
        if (inserted.rows.length === 0) {
          const existing = await connection.query(`
            SELECT id, case_count::text AS case_count, reconciliation_kind
            FROM apex_financial_preview_batches
            WHERE organization_id = ${quotePostgresLiteral(ctx.organizationId)}
              AND request_fingerprint = ${quotePostgresLiteral(requestFingerprint)}
          `);
          if (existing.rows.length !== 1 ||
              existing.rows[0].id !== batchId ||
              existing.rows[0].case_count !== String(candidateCases.length) ||
              existing.rows[0].reconciliation_kind !== input.kind) {
            throw new ConflictError("Existing financial preview batch fingerprint conflicts");
          }
          return { ...result, replayed: true };
        }

        for (const item of candidateCases) {
          assertCaseId(item.caseId);
          if (!CASE_STATUSES.has(item.comparisonStatus as CandidateStatus)) {
            throw new ValidationError("Unsupported financial preview comparison status");
          }
          await connection.query(`
            INSERT INTO apex_financial_preview_cases(
              organization_id, batch_id, case_id, comparison_status
            ) VALUES (
              ${quotePostgresLiteral(ctx.organizationId)},
              ${quotePostgresLiteral(batchId)},
              ${quotePostgresLiteral(item.caseId)},
              ${quotePostgresLiteral(item.comparisonStatus)}
            )
          `);
        }

        await this.audits.record(audit(ctx, "financial_preview_batch_registered", batchId, {
          kind: input.kind,
          caseCount: candidateCases.length,
          sourcePairFingerprint,
        }));
        return result;
      });
    } catch (error) {
      mapDatabaseConflict(error);
    }
  }

  public async getBatch(
    ctx: TenantContext, batchId: string
  ): Promise<{ batch: FinancialPreviewBatchRecord; cases: FinancialPreviewCaseRecord[] }> {
    requirePermission(ctx, "financial:read");
    assertBatchId(batchId);
    return this.manager.withConnection(async (connection) => {
      const header = await connection.query(`
        SELECT id, reconciliation_kind, case_count::text AS case_count
        FROM apex_financial_preview_batches
        WHERE organization_id = ${quotePostgresLiteral(ctx.organizationId)}
          AND id = ${quotePostgresLiteral(batchId)} LIMIT 1
      `);
      if (header.rows.length !== 1) throw new NotFoundError("Financial preview batch");
      const cases = await connection.query(`
        SELECT case_id, comparison_status, triage_status,
               version::text AS version, reviewer_id, reason_code
        FROM apex_financial_preview_cases
        WHERE organization_id = ${quotePostgresLiteral(ctx.organizationId)}
          AND batch_id = ${quotePostgresLiteral(batchId)}
        ORDER BY case_id
      `);
      return {
        batch: {
          batchId,
          kind: header.rows[0].reconciliation_kind as "settlement" | "fee",
          caseCount: Number(header.rows[0].case_count),
          replayed: false,
          verificationState: "unverified" as const,
          sourceStored: false as const,
          coverageVerified: false as const,
          financialLossAssessed: false as const,
        },
        cases: cases.rows.map((row) => parseCase(row, batchId)),
      };
    });
  }

  /** Reviewer-only triage; cannot mark a case resolved, verified or certified. */
  public async review(
    ctx: TenantContext,
    command: {
      batchId: string;
      caseId: string;
      expectedVersion: number;
      to: "in_review" | "escalated" | "dismissed";
      reasonCode: FinancialPreviewReason;
    }
  ): Promise<FinancialPreviewCaseRecord> {
    requirePermission(ctx, "financial:read");
    requirePermission(ctx, "financial:write");
    assertBatchId(command.batchId);
    assertCaseId(command.caseId);
    if (!Number.isSafeInteger(command.expectedVersion) ||
        command.expectedVersion < 1 || command.expectedVersion >= 2147483647 ||
        !REASONS.has(command.reasonCode) ||
        !["in_review", "escalated", "dismissed"].includes(command.to)) {
      throw new ValidationError("Invalid financial case review command");
    }
    try {
      return await this.manager.runInTransaction(ctx, async (connection) => {
        await connection.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
        const current = await connection.query(`
          SELECT case_id, comparison_status, triage_status,
                 version::text AS version, reviewer_id, reason_code
          FROM apex_financial_preview_cases
          WHERE organization_id = ${quotePostgresLiteral(ctx.organizationId)}
            AND batch_id = ${quotePostgresLiteral(command.batchId)}
            AND case_id = ${quotePostgresLiteral(command.caseId)}
          FOR UPDATE
        `);
        if (current.rows.length !== 1) throw new NotFoundError("Financial preview case");
        const before = parseCase(current.rows[0], command.batchId);
        if (before.version !== command.expectedVersion) {
          throw new ConflictError("Preview case version changed; reload before reviewing");
        }
        if (!TRANSITIONS[before.triageStatus].includes(command.to)) {
          throw new ConflictError("Invalid preview case triage transition");
        }
        const updated = await connection.query(`
          UPDATE apex_financial_preview_cases
          SET triage_status = ${quotePostgresLiteral(command.to)},
              reviewer_id = ${quotePostgresLiteral(ctx.userId)},
              reason_code = ${quotePostgresLiteral(command.reasonCode)},
              version = version + 1, updated_at = NOW()
          WHERE organization_id = ${quotePostgresLiteral(ctx.organizationId)}
            AND batch_id = ${quotePostgresLiteral(command.batchId)}
            AND case_id = ${quotePostgresLiteral(command.caseId)}
            AND version = ${command.expectedVersion}
          RETURNING case_id, comparison_status, triage_status,
                    version::text AS version, reviewer_id, reason_code
        `);
        if (updated.rows.length !== 1) {
          throw new ConflictError("Preview case changed during review");
        }
        await this.audits.record(audit(ctx, "financial_preview_case_triaged", command.batchId, {
          candidateFingerprint: command.caseId,
          previousStatus: before.triageStatus,
          nextStatus: command.to,
          version: command.expectedVersion + 1,
          reasonCode: command.reasonCode,
        }));
        return parseCase(updated.rows[0], command.batchId);
      });
    } catch (error) {
      mapDatabaseConflict(error);
    }
  }
}

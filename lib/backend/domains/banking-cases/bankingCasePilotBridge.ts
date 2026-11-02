/**
 * Staging-only bridge from the EXISTING persisted metadata-only financial
 * preview ledger to the general BankingCase workflow.
 *
 * The preview ledger is not an immutable bank-source registry: no raw financial
 * bytes are retained, and it makes no claims of feed completeness or recovery.
 * A manually escalated preview candidate may trigger an INVESTIGATION ONLY.
 */
import { createHash } from "node:crypto";
import { BankingCaseService } from "./bankingCaseService";
import type { BankingCaseRecord, BankingPreviewOrigin } from "../../database/schema";
import type { TenantContext } from "../../core/errors";
import { ConflictError, NotFoundError, ValidationError } from "../../core/errors";
import { requirePermission } from "../../core/security";
import { FinancialPreviewCaseLedger } from "../reconciliation/financialPreviewCaseLedger";

export type PilotPreviewLedger = Pick<FinancialPreviewCaseLedger, "getBatch">;

export class BankingCasePilotBridge {
  constructor(
    private readonly caseService: BankingCaseService,
    private readonly previewLedger: PilotPreviewLedger
  ) {}

  public async createEscalatedCandidate(ctx: TenantContext, input: {
    batchId: string;
    candidateId: string;
  }): Promise<BankingCaseRecord> {
    requirePermission(ctx, "financial:read");
    requirePermission(ctx, "financial:write");
    requirePermission(ctx, "case:create");
    // Fail closed on opaque ids before touching preview storage.
    if (!/^fpbatch-[a-f0-9]{40}$/.test(input.batchId) ||
        !/^recon-[a-f0-9]{32}$/.test(input.candidateId)) {
      throw new ValidationError("Invalid financial preview candidate identifiers");
    }
    const { batch, cases } = await this.previewLedger.getBatch(ctx, input.batchId);
    const candidate = cases.find((record) => record.caseId === input.candidateId);
    if (!candidate) throw new NotFoundError("Financial preview candidate");
    if (candidate.triageStatus !== "escalated") {
      throw new ConflictError("Only explicitly escalated preview candidates can enter investigation");
    }
    if (batch.sourceStored !== false || batch.coverageVerified !== false ||
        batch.financialLossAssessed !== false ||
        batch.verificationState !== "unverified") {
      throw new ValidationError("Unexpected preview ledger verification contract");
    }
    const origin: BankingPreviewOrigin = {
      batchId: batch.batchId,
      candidateId: candidate.caseId,
      comparisonStatus: candidate.comparisonStatus,
      sourceStored: false,
      coverageVerified: false,
      financialLossAssessed: false,
    };
    const caseId = "bcase-" + createHash("sha256")
      .update(JSON.stringify([ctx.organizationId, batch.batchId, candidate.caseId]))
      .digest("hex").slice(0, 40);
    // Stable ID provides a uniqueness guard across concurrent pilot attempts.
    // A duplicate is a conflict, not an unauthorized read of someone else's case.
    return this.caseService.create(ctx, {
      title: `Review ${batch.kind} preview: ${candidate.comparisonStatus.replaceAll("_", " ")}`,
      description: "Escalated metadata-only reconciliation preview. The raw feeds were not retained or authenticated; independently establish source custody and completeness before any financial finding or corrective action.",
      department: "Operations",
      priority: "high",
    }, { id: caseId, previewOrigin: origin });
  }
}

/**
 * CORTEX / cross-department outcome rules — synthetic evaluation model.
 *
 * These requirements are reusable across bank functions, but the proof adapter
 * below accepts ONLY explicitly synthetic fixture receipts. A passing result
 * must NEVER be used to mark a real banking case, payment or loan as verified.
 *
 * Production outcome verification requires bank-approved authoritative feeds,
 * provenance/authenticity validation, durable proof and checker policy, none
 * of which is implemented by this module.
 */
export const COMPLETION_RULES = {
  failed_transfer: {
    label: "Failed transfer or reversal",
    requiredEvent: "posting_confirmed",
    pendingOwner: "Finance / Payments Operations",
    pendingMessage: "The investigation or reversal was approved; posting is not confirmed.",
  },
  loan_disbursement: {
    label: "Loan disbursement",
    requiredEvent: "disbursement_posted",
    pendingOwner: "Credit / Loan Operations",
    pendingMessage: "The facility was approved; disbursement is not confirmed.",
  },
  access_revocation: {
    label: "Employee access removal",
    requiredEvent: "all_access_disabled",
    pendingOwner: "Technology / Information Security",
    pendingMessage: "The offboarding request was processed; access removal is not confirmed.",
  },
  audit_remediation: {
    label: "Internal control remediation",
    requiredEvent: "independent_validation_passed",
    pendingOwner: "Internal Control / Audit",
    pendingMessage: "The remediation was reported; independent validation is still required.",
  },
} as const;

export type CompletionWorkflow = keyof typeof COMPLETION_RULES;
export interface SyntheticCompletionReceipt {
  kind: "synthetic_ci_fixture";
  workflow: CompletionWorkflow;
  caseId: string;
  event: string;
  syntheticSourceId: string;
  confirmed: boolean;
}

export interface SyntheticCompletionAssessment {
  state: "awaiting_confirmation" | "synthetic_confirmation_observed";
  nextOwner: string | null;
  customerSafeMessage: string;
  /** This is never a bank-verified financial or customer outcome. */
  bankOutcomeVerified: false;
  syntheticOnly: true;
}

/**
 * Exercise the 'approved but not delivered' and 'delivery confirmed' branches
 * against deliberately synthetic records. Fails closed on absent, mismatched
 * or incomplete receipts. This cannot certify a real-world result.
 */
export function assessSyntheticCompletion(
  workflow: CompletionWorkflow,
  caseId: string,
  investigationPlanApproved: boolean,
  receipt?: SyntheticCompletionReceipt
): SyntheticCompletionAssessment {
  const rule = COMPLETION_RULES[workflow];
  const observed = investigationPlanApproved && Boolean(
    receipt &&
    receipt.kind === "synthetic_ci_fixture" &&
    receipt.workflow === workflow &&
    receipt.caseId === caseId &&
    receipt.event === rule.requiredEvent &&
    receipt.syntheticSourceId.startsWith("synthetic-") &&
    receipt.confirmed === true
  );
  return {
    state: observed ? "synthetic_confirmation_observed" : "awaiting_confirmation",
    nextOwner: observed ? null : rule.pendingOwner,
    customerSafeMessage: observed
      ? "A simulated outcome was observed in isolated synthetic testing. No real-world banking completion is certified."
      : rule.pendingMessage,
    bankOutcomeVerified: false,
    syntheticOnly: true,
  };
}

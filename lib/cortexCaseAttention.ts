/**
 * CORTEX / Action-first read model.
 *
 * This is a projection of the server-authorized cases already returned by
 * the banking-case API, not a new permission or a bank-wide task registry.
 * In particular, no internal plan approval implies an external outcome.
 */
import type { BankingCaseRecord } from "@/lib/backend/database/schema";

export type CaseAttentionCategory =
  | "needs_evidence"
  | "needs_investigation_plan"
  | "awaiting_independent_checker"
  | "plan_rejected"
  | "outcome_unconfirmed";

export interface CaseAttention {
  category: CaseAttentionCategory;
  heading: string;
  nextAction: string;
  actionOwner: string;
  customerSafeUpdate: string;
  /** Financial/customer outcome is never inferred from internal actions. */
  outcomeVerified: false;
  link: "/work/cases" | "/reviews";
}

export function describeCaseAttention(
  record: BankingCaseRecord,
  viewer: { userId?: string; mayApprove: boolean }
): CaseAttention {
  const ownedByViewer = Boolean(viewer.userId && record.ownerUserId === viewer.userId);
  const owner = ownedByViewer ? "You (case owner)" : "Assigned case owner";
  const pending = record.decision?.state === "pending";
  if (pending) {
    const independent = Boolean(viewer.mayApprove && viewer.userId &&
      record.createdByUserId !== viewer.userId &&
      record.decision?.proposedByUserId !== viewer.userId);
    return {
      category: "awaiting_independent_checker",
      heading: "Independent review pending",
      nextAction: independent ? "Review the proposed internal investigation plan" :
        "Await an eligible independent checker",
      actionOwner: independent ? "You (eligible checker)" : "Independent checker",
      customerSafeUpdate: "An internal investigation plan is awaiting review. The requested outcome is not confirmed.",
      outcomeVerified: false,
      link: independent ? "/reviews" : "/work/cases",
    };
  }
  if (record.decision?.state === "approved") {
    return {
      category: "outcome_unconfirmed",
      heading: "Plan approved · outcome unconfirmed",
      nextAction: "Obtain independent confirmation that the promised result occurred",
      actionOwner: owner,
      customerSafeUpdate: "The internal investigation plan was approved. We have not confirmed the requested outcome.",
      outcomeVerified: false,
      link: "/work/cases",
    };
  }
  if (record.decision?.state === "rejected") {
    return {
      category: "plan_rejected",
      heading: "Plan rejected · follow-up required",
      nextAction: "Coordinate a new investigation approach with the responsible manager",
      actionOwner: owner,
      customerSafeUpdate: "The proposed investigation plan was not approved. The outcome remains unconfirmed.",
      outcomeVerified: false,
      link: "/work/cases",
    };
  }
  if (!record.sourceId && !(record.evidenceLinks?.length) && !record.previewOrigin) {
    return {
      category: "needs_evidence",
      heading: "Evidence required",
      nextAction: "Link an authorized source before requesting independent review",
      actionOwner: owner,
      customerSafeUpdate: "The issue is under investigation. Supporting evidence and the outcome are not yet confirmed.",
      outcomeVerified: false,
      link: "/work/cases",
    };
  }
  return {
    category: "needs_investigation_plan",
    heading: "Investigation plan required",
    nextAction: "Propose the next internal step for independent review",
    actionOwner: owner,
    customerSafeUpdate: "An investigation is in progress. No final customer or financial outcome has been confirmed.",
    outcomeVerified: false,
    link: "/work/cases",
  };
}

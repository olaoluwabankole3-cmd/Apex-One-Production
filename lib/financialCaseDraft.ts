/**
 * UI-only handoff from an ephemeral reconciliation comparison to a NEW
 * independent operational case. Intentionally transfers ONLY two enumerated
 * classifications. No economic reference, amount, CSV bytes, customer ID,
 * bank ownership claim, source hash, or evidence custody is transferred.
 *
 * Draft URL parameters are untrusted user input: decode only exact allowlists.
 * Case creation is still explicit through the standard authorized endpoint.
 */
export type PreviewKind = "settlement" | "fee";
export type InvestigablePreviewStatus =
  | "amount_discrepancy"
  | "currency_mismatch"
  | "missing_expected"
  | "missing_observed"
  | "insufficient_source_coverage"
  | "ambiguous";

export interface CaseDraft {
  title: string;
  description: string;
  department: "Operations";
  priority: "high";
  sourceLinked: false;
  financialLossAssessed: false;
}

const KINDS: readonly PreviewKind[] = ["settlement", "fee"];
const STATUSES: readonly InvestigablePreviewStatus[] = [
  "amount_discrepancy",
  "currency_mismatch",
  "missing_expected",
  "missing_observed",
  "insufficient_source_coverage",
  "ambiguous",
];

const STATUS_LABELS: Record<InvestigablePreviewStatus, string> = {
  amount_discrepancy: "amount difference",
  currency_mismatch: "currency mismatch",
  missing_expected: "source coverage gap",
  missing_observed: "source coverage gap",
  insufficient_source_coverage: "incomplete source coverage",
  ambiguous: "ambiguous reference match",
};

export function caseDraftHref(kind: string, comparisonStatus: string): string | null {
  if (!KINDS.includes(kind as PreviewKind) ||
      !STATUSES.includes(comparisonStatus as InvestigablePreviewStatus)) return null;
  return `/work/cases?draft=${kind}.${comparisonStatus}`;
}

export function readCaseDraft(search: string): CaseDraft | null {
  if (typeof search !== "string" || search.length > 128) return null;
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (Array.from(params.keys()).some(key => key !== "draft") ||
      params.getAll("draft").length !== 1) return null;
  const token = params.get("draft");
  if (!token || token.length > 80) return null;
  const parts = token.split(".");
  if (parts.length !== 2 ||
      !KINDS.includes(parts[0] as PreviewKind) ||
      !STATUSES.includes(parts[1] as InvestigablePreviewStatus)) return null;
  const kind = parts[0] as PreviewKind;
  const status = parts[1] as InvestigablePreviewStatus;
  const type = kind === "fee" ? "fee" : "settlement";
  return {
    title: `Investigate ${type} preview: ${STATUS_LABELS[status]}`,
    description:
      `A request-scoped ${type} comparison displayed ${STATUS_LABELS[status]}. ` +
      "This is a new operational investigation only. The preview source was not retained " +
      "or authenticated, its completeness was not verified, and no monetary loss was assessed. " +
      "Collect independently authorized evidence and review the source before any finding.",
    department: "Operations",
    priority: "high",
    sourceLinked: false,
    financialLossAssessed: false,
  };
}

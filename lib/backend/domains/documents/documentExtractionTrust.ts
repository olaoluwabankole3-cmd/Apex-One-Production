/** CORTEX: stored extraction policy is not an independent evidence certification. */
import type { DocumentRecord } from "../../database/schema";

export const DOCUMENT_EXTRACTION_POLICY_VERSION = "source-grounded-v1" as const;
export const UNASSESSED_DOCUMENT_SUMMARY =
  "Historical extraction unassessed. Reprocess against the source before relying on content-derived terms.";

export function hasSourceGroundedExtraction(doc: Pick<DocumentRecord, "metadata">): boolean {
  return doc.metadata?.extractionPolicyVersion === DOCUMENT_EXTRACTION_POLICY_VERSION;
}

export function safeDocumentProjection(doc: DocumentRecord): DocumentRecord {
  if (hasSourceGroundedExtraction(doc) || (!doc.aiSummary && doc.extractedFields.length === 0)) return doc;
  // Do not modify authoritative PostgreSQL/S3 records during quarantine.
  return { ...doc, aiSummary: UNASSESSED_DOCUMENT_SUMMARY, extractedFields: [] };
}

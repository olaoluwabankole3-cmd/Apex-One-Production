/** Fail closed on unassessed legacy document extraction without rewriting records. */
import { readFileSync } from "node:fs";
import type { DocumentRecord } from "../lib/backend/database/schema";
import {
 DOCUMENT_EXTRACTION_POLICY_VERSION, UNASSESSED_DOCUMENT_SUMMARY,
 hasSourceGroundedExtraction, safeDocumentProjection,
} from "../lib/backend/domains/documents/documentExtractionTrust";

const timestamp = "2026-10-31T00:00:00Z";
const record: DocumentRecord = {
  id: "test-doc", organizationId: "tenant-a", name: "invoice.pdf", fileType: "pdf",
  category: "Invoice", size: "1KB", uploadedBy: "fixture@example.test",
  storageKey: "private/object", status: "indexed",
  metadata: { fileSizeBytes: 12, mimeType: "application/pdf", storageUri: "s3://private" },
  aiSummary: "Invented jurisdiction",
  extractedFields: [{ label: "Payment", value: "Net 30", confidence: 99 }],
  tags: ["invoice"], createdAt: timestamp, updatedAt: timestamp,
};
function assert(ok: unknown, msg: string): asserts ok { if (!ok) throw new Error(msg); }
const safe = safeDocumentProjection(record);
assert(!hasSourceGroundedExtraction(record), "Legacy extraction unexpectedly marked safe");
assert(safe.aiSummary === UNASSESSED_DOCUMENT_SUMMARY && safe.extractedFields.length === 0, "Legacy claims escaped quarantine");
assert(record.extractedFields.length === 1, "Original evidence was destructively modified");
assert(safe.organizationId === record.organizationId && safe.name === record.name, "Document metadata changed");
const stamped: DocumentRecord = { ...record, metadata: { ...record.metadata, extractionPolicyVersion: DOCUMENT_EXTRACTION_POLICY_VERSION } };
assert(hasSourceGroundedExtraction(stamped), "Supported extractor stamp rejected");
assert(safeDocumentProjection(stamped) === stamped, "Source-grounded record hidden");
const ai = readFileSync("lib/backend/domains/ai/aiTrustBoundary.ts", "utf8");
assert(ai.includes("hasSourceGroundedExtraction(record) ? record.aiSummary"), "AI summary trust guard missing");
assert(!ai.includes('fields: ["name", "category", "aiSummary", "tags"]'), "AI still searches unassessed summaries");
const search = readFileSync("lib/backend/domains/documents/documentSearchIndex.ts", "utf8");
assert(search.includes("record->'metadata'->>'extractionPolicyVersion' = 'source-grounded-v1'"), "Search trust marker missing");
console.log("Legacy document extraction quarantine: passed");

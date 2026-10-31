/**
 * Prevent a document's declared category from becoming fictional extracted
 * evidence. These tests require no database or infrastructure credentials.
 */
import type { DocumentRecord } from "../lib/backend/database/schema";
import { RuleBasedDocumentExtractor } from "../lib/backend/domains/documents/documentExtractor";

const extractor = new RuleBasedDocumentExtractor();
const timestamp = "2026-10-01T00:00:00.000Z";
const base: DocumentRecord = {
  id: "doc-truth", organizationId: "tenant-truth",
  name: "sample.pdf", fileType: "pdf", category: "Contract",
  size: "1 KB", uploadedBy: "reviewer@example.test", storageKey: "tenants/redacted/documents/truth/sample.pdf",
  status: "processing", tags: [], extractedFields: [],
  metadata: { fileSizeBytes: 64, mimeType: "application/pdf", storageUri: "s3://test" },
  createdAt: timestamp, updatedAt: timestamp,
};

function assert(value: unknown, msg: string): asserts value {
  if (!value) throw new Error(msg);
}

async function main(): Promise<void> {
  const unsupported = ["Contract", "Invoice", "SLA Agreement", "Audit Report"] as const;
  for (const category of unsupported) {
    const doc: DocumentRecord = { ...base, category };
    const result = await extractor.extractFields(doc,
      "Invented test input: Governing Jurisdiction Nigeria; Net 30; 99.9% monthly SLA");
    assert(result.fields.length === 0, `Unsupported PDF falsely extracted ${category} terms`);
    assert(result.summary.includes("metadata indexed only"), `PDF ${category} missing truthful availability state`);
    assert(!result.summary.includes("Nigeria") && !result.summary.includes("99.9%"),
      `PDF ${category} summary fabricated terms`);
  }

  const jsonDoc: DocumentRecord = { ...base, name: "facts.json", fileType: "json", category: "Invoice" };
  const supported = await extractor.extractFields(jsonDoc,
    JSON.stringify({ currency: "NGN", paymentTerms: "Net 30 days", extra: "must not be extracted" }));
  assert(supported.fields.length === 2, "Expected exactly two explicit JSON fields");
  assert(supported.fields.some(f => f.label === "Currency Code" && f.value === "NGN" && f.sourceLocation === "$.currency"),
    "JSON currency was not extracted with a source location");
  assert(supported.fields.some(f => f.label === "Payment Terms" && f.value === "Net 30 days" && f.sourceLocation === "$.paymentTerms"),
    "JSON terms were not extracted with a source location");
  assert(supported.fields.every(f => f.confidence === 0), "Uncalibrated confidence was assigned to extracted fields");
  assert(!supported.fields.some(f => f.value.includes("must not be extracted")), "Nonallowlisted field was extracted");
  assert(supported.summary.includes("unverified"), "JSON field summary failed to state verification limits");

  for (const bad of ["not-json", "{}", "[]", '{"currency":"NGN", "paymentTerms":22}']) {
    const result = await extractor.extractFields(jsonDoc, bad);
    assert(result.fields.length === 0, "Malformed/unrecognized JSON generated extracted evidence");
  }

  const unsupportedWithJson = await extractor.extractFields(base,
    JSON.stringify({ governingJurisdiction: "Nigeria", paymentTerms: "Net 30" }));
  assert(unsupportedWithJson.fields.length === 0,
    "JSON-shaped bytes in a PDF must not bypass the file-format extraction boundary");

  console.log("Document extraction truthfulness: all assertions passed");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });

process.env.TEST_ENV = "true";

import type { DocumentRecord } from "../lib/backend/database/schema";
import { RuleBasedDocumentExtractor } from "../lib/backend/domains/documents/documentExtractor";

function document(category: DocumentRecord["category"], name: string): DocumentRecord {
  const timestamp = new Date().toISOString();
  return {
    id: `stage9-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    organizationId: "org-stage9-terminology",
    name,
    fileType: "pdf",
    category,
    size: "1 KB",
    uploadedBy: "stage9@example.test",
    storageKey: `tenants/stage9/documents/${name}`,
    status: "processing",
    metadata: {},
    extractedFields: [],
    tags: ["stage9"],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function main(): Promise<void> {
  const extractor = new RuleBasedDocumentExtractor();
  const contract = await extractor.extractFields(document("Contract", "contract.pdf"));
  const sla = await extractor.extractFields(document("SLA Agreement", "sla.pdf"));

  for (const [kind, summary] of [
    ["Contract", contract.summary],
    ["SLA Agreement", sla.summary],
  ] as const) {
    if (/\bverified\b/i.test(summary)) {
      throw new Error(`${kind} extraction must not imply canonical Stage 6 verification`);
    }
  }

  console.log("✅ [PASS] Document extraction uses analysis/indexing terminology, not verification authority");
  console.log("TOTAL: 1 | PASSED: 1 | FAILED: 0");
}

void main().catch((error) => {
  console.error("❌ Stage 9 document evidence terminology test failed:", error);
  process.exit(1);
});

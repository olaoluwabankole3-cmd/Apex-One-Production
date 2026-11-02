import assert from "node:assert/strict";
import type { DocumentItem } from "../lib/types";
import {
  documentCategories,
  documentEvidenceStatus,
  filterDocuments,
} from "../components/documents/documentWorkspaceModel";

const record = (id: string, options: Partial<DocumentItem> = {}): DocumentItem => ({
  id,
  name: "Synthetic policy file " + id,
  fileType: "pdf",
  category: "Contract",
  subsidiary: "Synthetic operations",
  uploadedBy: "Synthetic Auditor",
  date: "Nov 1, 2026",
  size: "1 KB",
  pages: 0,
  status: "processed",
  aiSummary: "",
  extractedFields: [],
  suggestedQuestions: [],
  ...options,
});

const documents = [
  record("001"),
  record("002", { name: "Board compliance review", category: "Compliance Filing", status: "processing", uploadedBy: "Second Auditor" }),
  record("003", { name: "Quarterly report", category: "Financial Statement", uploadedBy: "Analyst" }),
];

const checks: Array<[string, () => void]> = [
  ["all authorized items remain available without search", () => {
    assert.deepEqual(filterDocuments(documents, "", "all").map(x => x.id), ["001", "002", "003"]);
  }],
  ["filter uses only supplied authorized records", () => {
    assert.deepEqual(filterDocuments(documents, "Quarterly", "all").map(x => x.id), ["003"]);
  }],
  ["search is case-insensitive and whitespace tolerant", () => {
    assert.deepEqual(filterDocuments(documents, "  bOard ", "all").map(x => x.id), ["002"]);
  }],
  ["search recognizes uploader without creating cross-organization queries", () => {
    assert.deepEqual(filterDocuments(documents, "Second AUDITOR", "all").map(x => x.id), ["002"]);
  }],
  ["search recognizes category and organization display scope", () => {
    assert.equal(filterDocuments(documents, "operations", "all").length, 3);
    assert.equal(filterDocuments(documents, "compliance", "all").length, 1);
  }],
  ["category filter and query combine", () => {
    assert.deepEqual(filterDocuments(documents, "review", "Compliance Filing").map(x => x.id), ["002"]);
    assert.deepEqual(filterDocuments(documents, "report", "Contract"), []);
  }],
  ["source data is untouched by local filtering", () => {
    const snapshot = JSON.stringify(documents);
    filterDocuments(documents, "policy", "all");
    assert.equal(JSON.stringify(documents), snapshot);
  }],
  ["category choices come from actual authorized data only", () => {
    assert.deepEqual(documentCategories(documents), ["Compliance Filing", "Contract", "Financial Statement"]);
    assert.deepEqual(documentCategories([]), []);
  }],
  ["processed means indexed, not source-verified", () => {
    const status = documentEvidenceStatus(documents[0]);
    assert.equal(status.title, "Indexed");
    assert.equal(status.trust, "unverified");
    assert.match(status.detail, /does not verify/);
  }],
  ["processing makes no claim to verified extraction", () => {
    const status = documentEvidenceStatus(documents[1]);
    assert.equal(status.title, "Processing");
    assert.equal(status.trust, "unverified");
    assert.match(status.detail, /No extraction result should be assumed/);
  }],
  ["empty authorized inventory is not populated with fabricated records", () => {
    assert.deepEqual(filterDocuments([], "anything", "all"), []);
  }],
];

for (const [name, run] of checks) {
  run();
  console.log("PASS:", name);
}
console.log(`CORTEX DOCUMENT WORKSPACE MODEL: ${checks.length}/${checks.length} synthetic checks passed`);

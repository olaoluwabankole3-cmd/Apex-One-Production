import {
  CERTIFICATION_STATES,
  EVIDENCE_SUBJECT_TYPES,
  PROVENANCE_PRODUCER_TYPES,
  PROVENANCE_RELATIONS,
  PROVENANCE_SOURCE_KINDS,
  VERIFICATION_STATES,
  assertCertificationRecordInvariant,
  assertProvenanceRecordInvariant,
  assertVerificationRecordInvariant,
  deriveCertificationState,
  deriveEvidenceStateSnapshot,
  deriveVerificationState,
  type CertificationRecord,
  type ProvenanceRecord,
  type VerificationRecord,
} from "../lib/backend/domains/evidence/model";
import { ConflictError, ValidationError } from "../lib/backend/core/errors";

interface TestCase {
  name: string;
  run: () => void | Promise<void>;
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrows(fn: () => unknown, ctor: new (...args: any[]) => Error): void {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught instanceof ctor, `Expected ${ctor.name}, received ${caught instanceof Error ? caught.constructor.name : String(caught)}`);
}

const now = "2026-09-02T20:00:00.000Z";

function provenance(overrides: Partial<Omit<ProvenanceRecord, "organizationId">> = {}): Omit<ProvenanceRecord, "organizationId"> {
  return {
    id: "prov-1",
    subjectType: "OrganizationalMemory",
    subjectId: "mem-1",
    relation: "supports",
    sources: [{ kind: "document", sourceType: "Document", sourceId: "doc-1" }],
    producerType: "human",
    producerId: "user-1",
    method: "manual_review",
    confidence: 95,
    createdAt: now,
    ...overrides,
  };
}

function verification(overrides: Partial<Omit<VerificationRecord, "organizationId">> = {}): Omit<VerificationRecord, "organizationId"> {
  return {
    id: "verify-1",
    subjectType: "OrganizationalMemory",
    subjectId: "mem-1",
    state: "verified",
    provenanceIds: ["prov-1"],
    verifierType: "human",
    verifierId: "user-2",
    criteria: ["source authenticity", "claim consistency"],
    createdAt: now,
    ...overrides,
  };
}

function certification(overrides: Partial<Omit<CertificationRecord, "organizationId">> = {}): Omit<CertificationRecord, "organizationId"> {
  return {
    id: "cert-1",
    subjectType: "OrganizationalMemory",
    subjectId: "mem-1",
    state: "certified",
    verificationRecordId: "verify-1",
    certifierId: "user-3",
    authority: "Executive Certification",
    createdAt: now,
    ...overrides,
  };
}

const tests: TestCase[] = [
  {
    name: "1. Canonical state and provenance vocabularies are explicit and closed",
    run: () => {
      expect(VERIFICATION_STATES.join(",") === "unverified,pending,verified,rejected,invalidated", "Verification states drifted");
      expect(CERTIFICATION_STATES.join(",") === "uncertified,pending,certified,denied,revoked,expired", "Certification states drifted");
      expect(PROVENANCE_RELATIONS.includes("derived_from"), "Missing derived_from provenance relation");
      expect(PROVENANCE_SOURCE_KINDS.includes("human_attestation"), "Missing human attestation source kind");
      expect(PROVENANCE_PRODUCER_TYPES.includes("ai"), "Missing AI producer provenance type");
      expect(EVIDENCE_SUBJECT_TYPES.includes("AiClaim"), "AI claims must be representable without calling them verified");
    },
  },
  {
    name: "2. No verification history resolves to unverified",
    run: () => expect(deriveVerificationState([]) === "unverified", "Empty verification history must be unverified"),
  },
  {
    name: "3. No certification history resolves to uncertified",
    run: () => expect(deriveCertificationState([]) === "uncertified", "Empty certification history must be uncertified"),
  },
  {
    name: "4. Derived provenance requires a source reference",
    run: () => expectThrows(() => assertProvenanceRecordInvariant(provenance({ sources: [] })), ValidationError),
  },
  {
    name: "5. Origin provenance may be source-less but invalid SHA-256 material is rejected",
    run: () => {
      assertProvenanceRecordInvariant(provenance({ relation: "origin", sources: [] }));
      expectThrows(
        () => assertProvenanceRecordInvariant(provenance({ sources: [{ kind: "document", sourceType: "Document", sourceId: "doc-1", contentHashSha256: "not-a-hash" }] })),
        ValidationError
      );
    },
  },
  {
    name: "6. Verified decisions require concrete provenance and criteria",
    run: () => {
      expectThrows(() => assertVerificationRecordInvariant(verification({ provenanceIds: [] }), "unverified"), ValidationError);
      expectThrows(() => assertVerificationRecordInvariant(verification({ criteria: [] }), "unverified"), ValidationError);
      assertVerificationRecordInvariant(verification(), "unverified");
    },
  },
  {
    name: "7. Verification state machine rejects backward or duplicate state claims",
    run: () => {
      expectThrows(() => assertVerificationRecordInvariant(verification({ state: "verified" }), "verified"), ConflictError);
      expectThrows(() => assertVerificationRecordInvariant(verification({ state: "pending", provenanceIds: [] }), "verified"), ConflictError);
      assertVerificationRecordInvariant(verification({ state: "invalidated", reason: "Source document withdrawn", provenanceIds: [] }), "verified");
    },
  },
  {
    name: "8. Certification cannot begin until the subject is verified",
    run: () => {
      expectThrows(() => assertCertificationRecordInvariant(certification(), "uncertified", "unverified"), ConflictError);
      assertCertificationRecordInvariant(certification(), "uncertified", "verified");
    },
  },
  {
    name: "9. Certified state requires an explicit verification record basis",
    run: () => expectThrows(() => assertCertificationRecordInvariant(certification({ verificationRecordId: undefined }), "uncertified", "verified"), ValidationError),
  },
  {
    name: "10. Certification validity windows are ordered and expiry is derived",
    run: () => {
      expectThrows(
        () => assertCertificationRecordInvariant(certification({ validFrom: "2026-09-03T00:00:00.000Z", validUntil: "2026-09-02T00:00:00.000Z" }), "uncertified", "verified"),
        ValidationError
      );
      const row: CertificationRecord = {
        organizationId: "org-1",
        ...certification({ validUntil: "2026-09-02T20:30:00.000Z" }),
      };
      expect(deriveCertificationState([row], new Date("2026-09-02T21:00:00.000Z")) === "expired", "Expired certification must be derived as expired");
    },
  },
  {
    name: "11. Revocation is only valid from a currently certified state and requires a reason",
    run: () => {
      expectThrows(() => assertCertificationRecordInvariant(certification({ state: "revoked", reason: "Authority withdrew attestation", verificationRecordId: undefined }), "uncertified", "verified"), ConflictError);
      expectThrows(() => assertCertificationRecordInvariant(certification({ state: "revoked", reason: undefined, verificationRecordId: undefined }), "certified", "verified"), ValidationError);
      assertCertificationRecordInvariant(certification({ state: "revoked", reason: "Authority withdrew attestation", verificationRecordId: undefined }), "certified", "verified");
    },
  },
  {
    name: "12. Evidence snapshot derives verification and certification independently from immutable histories",
    run: () => {
      const verificationRows: VerificationRecord[] = [
        { organizationId: "org-1", ...verification({ id: "verify-pending", state: "pending", provenanceIds: [], createdAt: "2026-09-02T19:00:00.000Z" }) },
        { organizationId: "org-1", ...verification({ id: "verify-current", createdAt: "2026-09-02T20:00:00.000Z" }) },
      ];
      const certificationRows: CertificationRecord[] = [
        { organizationId: "org-1", ...certification({ id: "cert-current", createdAt: "2026-09-02T20:10:00.000Z" }) },
      ];
      const snapshot = deriveEvidenceStateSnapshot(
        "OrganizationalMemory",
        "mem-1",
        verificationRows,
        certificationRows,
        new Date("2026-09-02T20:15:00.000Z")
      );
      expect(snapshot.verificationState === "verified", "Expected verified snapshot");
      expect(snapshot.certificationState === "certified", "Expected certified snapshot");
      expect(snapshot.latestVerification?.id === "verify-current", "Wrong latest verification record");
      expect(snapshot.latestCertification?.id === "cert-current", "Wrong latest certification record");
    },
  },
];

async function main() {
  console.log("=".repeat(80));
  console.log("APEX ONE — STAGE 6 EVIDENCE / PROVENANCE MODEL");
  console.log("=".repeat(80));

  let passed = 0;
  for (const test of tests) {
    try {
      await test.run();
      passed += 1;
      console.log(`✅ [PASS] ${test.name}`);
    } catch (error) {
      console.error(`❌ [FAIL] ${test.name}`);
      console.error(error);
    }
  }

  console.log("-".repeat(80));
  console.log(`TOTAL: ${tests.length} | PASSED: ${passed} | FAILED: ${tests.length - passed}`);
  console.log("=".repeat(80));

  if (passed !== tests.length) process.exitCode = 1;
}

void main();

import { ConflictError, ValidationError } from "../../core/errors";

export const EVIDENCE_SUBJECT_TYPES = [
  "Customer",
  "Contract",
  "Transaction",
  "Document",
  "KnowledgeItem",
  "OrganizationalMemory",
  "Signal",
  "ValueOpportunity",
  "ValueCaptured",
  "Action",
  "Workflow",
  "WorkflowRun",
  "DerivedMetric",
  "AiClaim",
] as const;

export type EvidenceSubjectType = (typeof EVIDENCE_SUBJECT_TYPES)[number];

export const VERIFICATION_STATES = [
  "unverified",
  "pending",
  "verified",
  "rejected",
  "invalidated",
] as const;

export type VerificationState = (typeof VERIFICATION_STATES)[number];
export type VerificationDecision = Exclude<VerificationState, "unverified">;

export const CERTIFICATION_STATES = [
  "uncertified",
  "pending",
  "certified",
  "denied",
  "revoked",
  "expired",
] as const;

export type CertificationState = (typeof CERTIFICATION_STATES)[number];
export type CertificationDecision = Exclude<CertificationState, "uncertified" | "expired">;

export const PROVENANCE_RELATIONS = [
  "origin",
  "derived_from",
  "transformed_from",
  "supports",
  "contradicts",
] as const;

export type ProvenanceRelation = (typeof PROVENANCE_RELATIONS)[number];

export const PROVENANCE_SOURCE_KINDS = [
  "record",
  "document",
  "event",
  "calculation",
  "external_source",
  "human_attestation",
] as const;

export type ProvenanceSourceKind = (typeof PROVENANCE_SOURCE_KINDS)[number];

export const PROVENANCE_PRODUCER_TYPES = [
  "human",
  "system",
  "ai",
  "integration",
] as const;

export type ProvenanceProducerType = (typeof PROVENANCE_PRODUCER_TYPES)[number];

export interface ProvenanceSourceReference {
  kind: ProvenanceSourceKind;
  sourceType: string;
  sourceId?: string;
  sourceReference?: string;
  sourceVersion?: string;
  contentHashSha256?: string;
  observedAt?: string;
}

/**
 * Immutable lineage record describing where a subject, claim, or derived result came from.
 * Provenance is descriptive evidence lineage; it is NOT itself a verification or certification.
 */
export interface ProvenanceRecord {
  id: string;
  organizationId: string;
  subjectType: EvidenceSubjectType;
  subjectId: string;
  relation: ProvenanceRelation;
  sources: ProvenanceSourceReference[];
  producerType: ProvenanceProducerType;
  producerId?: string;
  producerLabel?: string;
  method?: string;
  model?: string;
  confidence?: number;
  notes?: string;
  createdAt: string;
}

/**
 * Immutable verification decision event.
 * The authoritative current verification state is derived from the ordered event history.
 */
export interface VerificationRecord {
  id: string;
  organizationId: string;
  subjectType: EvidenceSubjectType;
  subjectId: string;
  state: VerificationDecision;
  provenanceIds: string[];
  verifierType: "human" | "system";
  verifierId: string;
  verifierLabel?: string;
  criteria: string[];
  reason?: string;
  createdAt: string;
}

/**
 * Immutable certification decision event.
 * Certification is a higher-order attestation and must be based on a verified subject.
 */
export interface CertificationRecord {
  id: string;
  organizationId: string;
  subjectType: EvidenceSubjectType;
  subjectId: string;
  state: CertificationDecision;
  verificationRecordId?: string;
  certifierId: string;
  certifierLabel?: string;
  authority: string;
  reason?: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: string;
}

export interface EvidenceStateSnapshot {
  subjectType: EvidenceSubjectType;
  subjectId: string;
  verificationState: VerificationState;
  certificationState: CertificationState;
  latestVerification?: VerificationRecord;
  latestCertification?: CertificationRecord;
}

const VERIFICATION_TRANSITIONS: Readonly<Record<VerificationState, readonly VerificationDecision[]>> = {
  unverified: ["pending", "verified", "rejected"],
  pending: ["verified", "rejected"],
  verified: ["invalidated"],
  rejected: ["pending", "verified"],
  invalidated: ["pending", "verified"],
};

const CERTIFICATION_TRANSITIONS: Readonly<Record<CertificationState, readonly CertificationDecision[]>> = {
  uncertified: ["pending", "certified"],
  pending: ["certified", "denied"],
  certified: ["revoked"],
  denied: ["pending", "certified"],
  revoked: ["pending", "certified"],
  expired: ["pending", "certified"],
};

function parseIsoTimestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ValidationError(`${field} must be a valid ISO-8601 timestamp`);
  }
  return parsed;
}

function latestByCreatedAt<T extends { id: string; createdAt: string }>(records: readonly T[]): T | undefined {
  return [...records].sort((a, b) => {
    const timeDelta = parseIsoTimestamp(b.createdAt, "createdAt") - parseIsoTimestamp(a.createdAt, "createdAt");
    return timeDelta !== 0 ? timeDelta : b.id.localeCompare(a.id);
  })[0];
}

export function assertEvidenceSubject(subjectType: string, subjectId: string): asserts subjectType is EvidenceSubjectType {
  if (!(EVIDENCE_SUBJECT_TYPES as readonly string[]).includes(subjectType)) {
    throw new ValidationError(`Unsupported evidence subject type '${subjectType}'`);
  }
  if (typeof subjectId !== "string" || subjectId.trim().length === 0) {
    throw new ValidationError("Evidence subjectId is required");
  }
}

export function assertProvenanceRecordInvariant(record: Omit<ProvenanceRecord, "organizationId">): void {
  assertEvidenceSubject(record.subjectType, record.subjectId);
  parseIsoTimestamp(record.createdAt, "createdAt");

  if (!PROVENANCE_RELATIONS.includes(record.relation)) {
    throw new ValidationError(`Unsupported provenance relation '${record.relation}'`);
  }
  if (!PROVENANCE_PRODUCER_TYPES.includes(record.producerType)) {
    throw new ValidationError(`Unsupported provenance producer type '${record.producerType}'`);
  }
  if (!Array.isArray(record.sources)) {
    throw new ValidationError("Provenance sources must be an array");
  }
  if (record.relation !== "origin" && record.sources.length === 0) {
    throw new ValidationError(`Provenance relation '${record.relation}' requires at least one source reference`);
  }
  if (record.confidence !== undefined && (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 100)) {
    throw new ValidationError("Provenance confidence must be between 0 and 100");
  }

  for (const [index, source] of record.sources.entries()) {
    if (!PROVENANCE_SOURCE_KINDS.includes(source.kind)) {
      throw new ValidationError(`Unsupported provenance source kind at index ${index}`);
    }
    if (!source.sourceType?.trim()) {
      throw new ValidationError(`Provenance sourceType is required at index ${index}`);
    }
    if (!source.sourceId?.trim() && !source.sourceReference?.trim()) {
      throw new ValidationError(`Provenance source ${index} must identify sourceId or sourceReference`);
    }
    if (source.observedAt !== undefined) parseIsoTimestamp(source.observedAt, `sources[${index}].observedAt`);
    if (source.contentHashSha256 !== undefined && !/^[a-f0-9]{64}$/i.test(source.contentHashSha256)) {
      throw new ValidationError(`sources[${index}].contentHashSha256 must be a 64-character SHA-256 hex digest`);
    }
  }
}

export function deriveVerificationState(records: readonly VerificationRecord[]): VerificationState {
  return latestByCreatedAt(records)?.state ?? "unverified";
}

export function deriveCertificationState(
  records: readonly CertificationRecord[],
  now: Date = new Date()
): CertificationState {
  const latest = latestByCreatedAt(records);
  if (!latest) return "uncertified";
  if (latest.state === "certified" && latest.validUntil) {
    if (parseIsoTimestamp(latest.validUntil, "validUntil") <= now.getTime()) return "expired";
  }
  return latest.state;
}

export function assertVerificationTransition(
  current: VerificationState,
  requested: VerificationDecision
): void {
  const allowed = VERIFICATION_TRANSITIONS[current] ?? [];
  if (!allowed.includes(requested)) {
    throw new ConflictError(
      `Cannot transition verification from '${current}' to '${requested}'`,
      { current, requested, allowed }
    );
  }
}

export function assertVerificationRecordInvariant(
  record: Omit<VerificationRecord, "organizationId">,
  currentState: VerificationState
): void {
  assertEvidenceSubject(record.subjectType, record.subjectId);
  assertVerificationTransition(currentState, record.state);
  parseIsoTimestamp(record.createdAt, "createdAt");

  if (!record.verifierId?.trim()) throw new ValidationError("Verification verifierId is required");
  if (!Array.isArray(record.criteria) || record.criteria.length === 0 || record.criteria.some((item) => !item?.trim())) {
    throw new ValidationError("Verification requires at least one non-empty criterion");
  }
  if (!Array.isArray(record.provenanceIds)) throw new ValidationError("Verification provenanceIds must be an array");
  if (record.state === "verified" && record.provenanceIds.length === 0) {
    throw new ValidationError("A verified decision requires at least one provenance record");
  }
  if ((record.state === "rejected" || record.state === "invalidated") && !record.reason?.trim()) {
    throw new ValidationError(`Verification state '${record.state}' requires a reason`);
  }
}

export function assertCertificationTransition(
  current: CertificationState,
  requested: CertificationDecision,
  verificationState: VerificationState
): void {
  const allowed = CERTIFICATION_TRANSITIONS[current] ?? [];
  if (!allowed.includes(requested)) {
    throw new ConflictError(
      `Cannot transition certification from '${current}' to '${requested}'`,
      { current, requested, allowed }
    );
  }

  if ((requested === "pending" || requested === "certified") && verificationState !== "verified") {
    throw new ConflictError(
      `Certification '${requested}' requires current verification state 'verified'`,
      { verificationState }
    );
  }
}

export function assertCertificationRecordInvariant(
  record: Omit<CertificationRecord, "organizationId">,
  currentCertificationState: CertificationState,
  currentVerificationState: VerificationState
): void {
  assertEvidenceSubject(record.subjectType, record.subjectId);
  assertCertificationTransition(currentCertificationState, record.state, currentVerificationState);
  parseIsoTimestamp(record.createdAt, "createdAt");

  if (!record.certifierId?.trim()) throw new ValidationError("Certification certifierId is required");
  if (!record.authority?.trim()) throw new ValidationError("Certification authority is required");
  if (record.state === "certified" && !record.verificationRecordId?.trim()) {
    throw new ValidationError("Certified state requires verificationRecordId");
  }
  if ((record.state === "denied" || record.state === "revoked") && !record.reason?.trim()) {
    throw new ValidationError(`Certification state '${record.state}' requires a reason`);
  }

  if (record.validFrom) parseIsoTimestamp(record.validFrom, "validFrom");
  if (record.validUntil) parseIsoTimestamp(record.validUntil, "validUntil");
  if (record.validFrom && record.validUntil && Date.parse(record.validUntil) <= Date.parse(record.validFrom)) {
    throw new ValidationError("Certification validUntil must be later than validFrom");
  }
}

export function deriveEvidenceStateSnapshot(
  subjectType: EvidenceSubjectType,
  subjectId: string,
  verificationRecords: readonly VerificationRecord[],
  certificationRecords: readonly CertificationRecord[],
  now: Date = new Date()
): EvidenceStateSnapshot {
  assertEvidenceSubject(subjectType, subjectId);
  const matchingVerifications = verificationRecords.filter(
    (record) => record.subjectType === subjectType && record.subjectId === subjectId
  );
  const matchingCertifications = certificationRecords.filter(
    (record) => record.subjectType === subjectType && record.subjectId === subjectId
  );

  return {
    subjectType,
    subjectId,
    verificationState: deriveVerificationState(matchingVerifications),
    certificationState: deriveCertificationState(matchingCertifications, now),
    latestVerification: latestByCreatedAt(matchingVerifications),
    latestCertification: latestByCreatedAt(matchingCertifications),
  };
}

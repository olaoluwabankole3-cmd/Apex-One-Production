import { createHash } from "node:crypto";
import { ConflictError, ValidationError } from "../../core/errors";
import type { KnowledgeCategory } from "../../database/schema";

/**
 * Stage 9 knowledge consistency model.
 *
 * A revision is an immutable content snapshot. Validation means the snapshot is
 * structurally/source-consistent; it is deliberately NOT Stage 6 canonical
 * verification or certification.
 */
export const KNOWLEDGE_REVISION_STATES = ["draft", "validated", "published", "rejected"] as const;
export type KnowledgeRevisionState = (typeof KNOWLEDGE_REVISION_STATES)[number];

export const KNOWLEDGE_PUBLICATION_SCOPES = ["tenant", "platform"] as const;
export type KnowledgePublicationScope = (typeof KNOWLEDGE_PUBLICATION_SCOPES)[number];

export interface KnowledgeRevisionSnapshot {
  knowledgeItemId: string;
  revision: number;
  title: string;
  category: KnowledgeCategory;
  content: string;
  summary?: string;
  sourceDocId?: string;
  sourceDocumentChecksumSha256?: string;
  tags: string[];
  contentHashSha256: string;
  createdBy: string;
  createdAt: string;
}

export interface KnowledgeRevisionDecision {
  knowledgeItemId: string;
  revision: number;
  state: Exclude<KnowledgeRevisionState, "draft">;
  contentHashSha256: string;
  actorId: string;
  actorEmail: string;
  publicationScope?: KnowledgePublicationScope;
  reason?: string;
  createdAt: string;
}

export interface KnowledgeRevisionView {
  snapshot: KnowledgeRevisionSnapshot;
  state: KnowledgeRevisionState;
  validatedAt?: string;
  publishedAt?: string;
  publicationScope?: KnowledgePublicationScope;
  rejectedAt?: string;
  rejectionReason?: string;
  /** Stage 9 validation is consistency validation, not canonical evidence verification. */
  validationKind: "consistency";
}

export interface KnowledgeRevisionHistory {
  itemId: string;
  revisions: KnowledgeRevisionView[];
  latestRevision: number;
  latestPublishedRevision?: number;
}

function normalizeOptional(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function normalizeKnowledgeTags(tags: string[] | undefined, category: KnowledgeCategory): string[] {
  const values = (tags && tags.length > 0 ? tags : [category])
    .map((tag) => tag.trim())
    .filter(Boolean);
  const unique = Array.from(new Set(values));
  if (unique.length === 0) throw new ValidationError("Knowledge revision must contain at least one tag");
  if (unique.length > 100) throw new ValidationError("Knowledge revision cannot contain more than 100 tags");
  return unique;
}

export function hashKnowledgeRevision(input: {
  knowledgeItemId: string;
  revision: number;
  title: string;
  category: KnowledgeCategory;
  content: string;
  summary?: string;
  sourceDocId?: string;
  sourceDocumentChecksumSha256?: string;
  tags: string[];
}): string {
  const canonical = JSON.stringify({
    knowledgeItemId: input.knowledgeItemId,
    revision: input.revision,
    title: input.title.trim(),
    category: input.category,
    content: input.content.trim(),
    summary: normalizeOptional(input.summary),
    sourceDocId: normalizeOptional(input.sourceDocId),
    sourceDocumentChecksumSha256: normalizeOptional(input.sourceDocumentChecksumSha256),
    tags: input.tags.map((tag) => tag.trim()),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function createKnowledgeRevisionSnapshot(input: Omit<KnowledgeRevisionSnapshot, "contentHashSha256">): KnowledgeRevisionSnapshot {
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) {
    throw new ValidationError("Knowledge revision number must be a positive safe integer");
  }
  if (!input.knowledgeItemId?.trim()) throw new ValidationError("Knowledge item identifier is required");
  if (!input.title?.trim()) throw new ValidationError("Knowledge revision title is required");
  if (!input.content?.trim()) throw new ValidationError("Knowledge revision content is required");
  if (!input.createdBy?.trim()) throw new ValidationError("Knowledge revision creator is required");

  const tags = normalizeKnowledgeTags(input.tags, input.category);
  const snapshot: Omit<KnowledgeRevisionSnapshot, "contentHashSha256"> = {
    ...input,
    knowledgeItemId: input.knowledgeItemId.trim(),
    title: input.title.trim(),
    content: input.content.trim(),
    summary: input.summary?.trim() || undefined,
    sourceDocId: input.sourceDocId?.trim() || undefined,
    sourceDocumentChecksumSha256: input.sourceDocumentChecksumSha256?.trim() || undefined,
    tags,
    createdBy: input.createdBy.trim(),
  };
  return {
    ...snapshot,
    contentHashSha256: hashKnowledgeRevision(snapshot),
  };
}

export function assertKnowledgeRevisionHash(snapshot: KnowledgeRevisionSnapshot): void {
  const expected = hashKnowledgeRevision(snapshot);
  if (expected !== snapshot.contentHashSha256) {
    throw new ConflictError("Knowledge revision content hash does not match its immutable snapshot", {
      knowledgeItemId: snapshot.knowledgeItemId,
      revision: snapshot.revision,
    });
  }
}

export function deriveKnowledgeRevisionView(
  snapshot: KnowledgeRevisionSnapshot,
  decisions: KnowledgeRevisionDecision[]
): KnowledgeRevisionView {
  assertKnowledgeRevisionHash(snapshot);
  const decisionRank: Record<KnowledgeRevisionDecision["state"], number> = {
    validated: 1,
    published: 2,
    rejected: 3,
  };
  const relevant = decisions
    .filter(
      (decision) =>
        decision.knowledgeItemId === snapshot.knowledgeItemId &&
        decision.revision === snapshot.revision &&
        decision.contentHashSha256 === snapshot.contentHashSha256
    )
    .sort((a, b) => {
      const timestampOrder = a.createdAt.localeCompare(b.createdAt);
      return timestampOrder !== 0 ? timestampOrder : decisionRank[a.state] - decisionRank[b.state];
    });

  let state: KnowledgeRevisionState = "draft";
  let validatedAt: string | undefined;
  let publishedAt: string | undefined;
  let rejectedAt: string | undefined;
  let publicationScope: KnowledgePublicationScope | undefined;
  let rejectionReason: string | undefined;

  for (const decision of relevant) {
    if (decision.state === "validated") {
      if (state !== "draft") {
        throw new ConflictError(`Cannot validate knowledge revision from state '${state}'`);
      }
      state = "validated";
      validatedAt = decision.createdAt;
      continue;
    }
    if (decision.state === "published") {
      if (state !== "validated") {
        throw new ConflictError(`Cannot publish knowledge revision from state '${state}'`);
      }
      if (!decision.publicationScope) {
        throw new ValidationError("Published knowledge revision requires an explicit publication scope");
      }
      state = "published";
      publishedAt = decision.createdAt;
      publicationScope = decision.publicationScope;
      continue;
    }
    if (decision.state === "rejected") {
      if (state !== "draft" && state !== "validated") {
        throw new ConflictError(`Cannot reject knowledge revision from state '${state}'`);
      }
      if (!decision.reason?.trim()) {
        throw new ValidationError("Rejected knowledge revision requires a reason");
      }
      state = "rejected";
      rejectedAt = decision.createdAt;
      rejectionReason = decision.reason.trim();
    }
  }

  return {
    snapshot,
    state,
    validatedAt,
    publishedAt,
    publicationScope,
    rejectedAt,
    rejectionReason,
    validationKind: "consistency",
  };
}

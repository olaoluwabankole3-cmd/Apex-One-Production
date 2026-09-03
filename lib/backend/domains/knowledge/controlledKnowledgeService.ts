import type { AuditLogRecord, KnowledgeItemRecord } from "../../database/schema";
import { DatabaseStore } from "../../database/store";
import { collectAllPages } from "../../database/paginationTraversal";
import { MAX_PAGE_SIZE } from "../../database/querySpecification";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { ConflictError, TenantContext, ValidationError } from "../../core/errors";
import { requirePermission } from "../../core/security";
import { KnowledgeService } from "./knowledgeService";
import type { CreateKnowledgeItemDto, UpdateKnowledgeItemDto } from "./knowledgeTypes";
import {
  assertKnowledgeRevisionHash,
  createKnowledgeRevisionSnapshot,
  deriveKnowledgeRevisionView,
  type KnowledgePublicationScope,
  type KnowledgeRevisionDecision,
  type KnowledgeRevisionHistory,
  type KnowledgeRevisionSnapshot,
  type KnowledgeRevisionView,
} from "./knowledgeRevisionModel";

const REVISION_RESOURCE = "KnowledgeRevision";
const REVISION_CREATED = "knowledge_revision:created";
const REVISION_VALIDATED = "knowledge_revision:validated";
const REVISION_PUBLISHED = "knowledge_revision:published";
const REVISION_REJECTED = "knowledge_revision:rejected";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readSnapshot(log: AuditLogRecord): KnowledgeRevisionSnapshot | undefined {
  if (log.action !== REVISION_CREATED || !isRecord(log.metadata) || !isRecord(log.metadata.snapshot)) {
    return undefined;
  }
  const raw = log.metadata.snapshot;
  if (
    typeof raw.knowledgeItemId !== "string" ||
    typeof raw.revision !== "number" ||
    !Number.isSafeInteger(raw.revision) ||
    typeof raw.title !== "string" ||
    typeof raw.category !== "string" ||
    typeof raw.content !== "string" ||
    !Array.isArray(raw.tags) ||
    typeof raw.contentHashSha256 !== "string" ||
    typeof raw.createdBy !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    throw new ValidationError("Stored knowledge revision snapshot is malformed");
  }
  return raw as unknown as KnowledgeRevisionSnapshot;
}

function readDecision(log: AuditLogRecord): KnowledgeRevisionDecision | undefined {
  if (
    log.action !== REVISION_VALIDATED &&
    log.action !== REVISION_PUBLISHED &&
    log.action !== REVISION_REJECTED
  ) {
    return undefined;
  }
  if (!isRecord(log.metadata) || !isRecord(log.metadata.decision)) return undefined;
  const raw = log.metadata.decision;
  if (
    typeof raw.knowledgeItemId !== "string" ||
    typeof raw.revision !== "number" ||
    !Number.isSafeInteger(raw.revision) ||
    (raw.state !== "validated" && raw.state !== "published" && raw.state !== "rejected") ||
    typeof raw.contentHashSha256 !== "string" ||
    typeof raw.actorId !== "string" ||
    typeof raw.actorEmail !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    throw new ValidationError("Stored knowledge revision decision is malformed");
  }
  return raw as unknown as KnowledgeRevisionDecision;
}

function cleanUpdate(dto: UpdateKnowledgeItemDto): UpdateKnowledgeItemDto {
  const result: UpdateKnowledgeItemDto = {};
  if (dto.title !== undefined) result.title = dto.title.trim();
  if (dto.category !== undefined) result.category = dto.category;
  if (dto.content !== undefined) result.content = dto.content.trim();
  if (dto.summary !== undefined) result.summary = dto.summary.trim();
  if (dto.sourceDocId !== undefined) result.sourceDocId = dto.sourceDocId.trim();
  if (dto.tags !== undefined) result.tags = dto.tags.map((tag) => tag.trim()).filter(Boolean);
  return result;
}

export class ControlledKnowledgeService extends KnowledgeService {
  private readonly db: DatabaseStore;

  constructor(database: DatabaseStore = createApplicationInfrastructure().database) {
    super(database);
    this.db = database;
  }

  private async logs(itemId: string, ctx: TenantContext): Promise<AuditLogRecord[]> {
    return collectAllPages((cursor) =>
      this.db.auditLogsRepo.findMany(ctx, {
        where: { resource: { eq: REVISION_RESOURCE }, resourceId: { eq: itemId } },
        limit: MAX_PAGE_SIZE,
        cursor,
      })
    );
  }

  private historyFromLogs(itemId: string, logs: AuditLogRecord[]): KnowledgeRevisionHistory {
    const snapshots = new Map<number, KnowledgeRevisionSnapshot>();
    const decisions: KnowledgeRevisionDecision[] = [];
    for (const log of logs) {
      const snapshot = readSnapshot(log);
      if (snapshot) {
        if (snapshot.knowledgeItemId !== itemId) {
          throw new ValidationError("Knowledge revision is bound to the wrong item");
        }
        assertKnowledgeRevisionHash(snapshot);
        if (snapshots.has(snapshot.revision)) {
          throw new ConflictError("Duplicate immutable knowledge revision snapshot detected", {
            knowledgeItemId: itemId,
            revision: snapshot.revision,
          });
        }
        snapshots.set(snapshot.revision, snapshot);
      }
      const decision = readDecision(log);
      if (decision) decisions.push(decision);
    }
    const revisions = Array.from(snapshots.values())
      .sort((a, b) => a.revision - b.revision)
      .map((snapshot) => deriveKnowledgeRevisionView(snapshot, decisions));
    return {
      itemId,
      revisions,
      latestRevision: revisions.at(-1)?.snapshot.revision || 0,
      latestPublishedRevision: revisions.filter((view) => view.state === "published").at(-1)?.snapshot.revision,
    };
  }

  private async history(itemId: string, ctx: TenantContext): Promise<KnowledgeRevisionHistory> {
    return this.historyFromLogs(itemId, await this.logs(itemId, ctx));
  }

  private async sourceChecksum(
    sourceDocId: string | undefined,
    expectedChecksum: string | undefined,
    ctx: TenantContext
  ): Promise<string | undefined> {
    if (!sourceDocId) return undefined;
    const document = await this.db.documentsRepo.findById(sourceDocId, ctx, "KnowledgeSourceDocument");
    if (document.status !== "indexed") {
      throw new ConflictError("Knowledge revision source document must be indexed", {
        sourceDocId,
        documentStatus: document.status,
      });
    }
    const checksum = document.metadata.checksumSha256?.trim();
    if (!checksum) throw new ConflictError("Knowledge source document is missing a durable checksum", { sourceDocId });
    if (expectedChecksum && expectedChecksum !== checksum) {
      throw new ConflictError("Knowledge source document changed after the revision snapshot", {
        sourceDocId,
        expectedChecksum,
        currentChecksum: checksum,
      });
    }
    return checksum;
  }

  private async snapshot(
    itemId: string,
    revision: number,
    values: Pick<KnowledgeItemRecord, "title" | "category" | "content" | "summary" | "sourceDocId" | "tags">,
    ctx: TenantContext
  ): Promise<KnowledgeRevisionSnapshot> {
    const sourceDocumentChecksumSha256 = await this.sourceChecksum(values.sourceDocId, undefined, ctx);
    return createKnowledgeRevisionSnapshot({
      knowledgeItemId: itemId,
      revision,
      title: values.title,
      category: values.category,
      content: values.content,
      summary: values.summary,
      sourceDocId: values.sourceDocId,
      sourceDocumentChecksumSha256,
      tags: values.tags,
      createdBy: ctx.userId,
      createdAt: new Date().toISOString(),
    });
  }

  private async recordSnapshot(
    snapshot: KnowledgeRevisionSnapshot,
    ctx: TenantContext,
    record: (log: Omit<AuditLogRecord, "id">) => Promise<AuditLogRecord>
  ): Promise<void> {
    await record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action: REVISION_CREATED,
      resource: REVISION_RESOURCE,
      resourceId: snapshot.knowledgeItemId,
      requestId: ctx.requestId,
      status: "success",
      metadata: {
        snapshot,
        revision: snapshot.revision,
        revisionHash: snapshot.contentHashSha256,
        validationKind: "consistency",
        canonicalVerificationState: "unverified",
        canonicalCertificationState: "uncertified",
      },
      timestamp: snapshot.createdAt,
    });
  }

  private async recordDecision(
    decision: KnowledgeRevisionDecision,
    ctx: TenantContext,
    record: (log: Omit<AuditLogRecord, "id">) => Promise<AuditLogRecord>
  ): Promise<void> {
    const action = decision.state === "validated"
      ? REVISION_VALIDATED
      : decision.state === "published"
        ? REVISION_PUBLISHED
        : REVISION_REJECTED;
    await record({
      organizationId: ctx.organizationId,
      actorId: ctx.userId,
      actorEmail: ctx.userEmail,
      action,
      resource: REVISION_RESOURCE,
      resourceId: decision.knowledgeItemId,
      requestId: ctx.requestId,
      status: "success",
      metadata: {
        decision,
        revision: decision.revision,
        revisionHash: decision.contentHashSha256,
        validationKind: "consistency",
        canonicalVerificationState: "unverified",
        canonicalCertificationState: "uncertified",
      },
      timestamp: decision.createdAt,
    });
  }

  private latestView(history: KnowledgeRevisionHistory): KnowledgeRevisionView | undefined {
    return history.revisions.at(-1);
  }

  public override async createKnowledgeItem(dto: CreateKnowledgeItemDto, ctx: TenantContext): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");
    if (dto.isPublicPlatformKnowledge !== undefined) {
      throw new ValidationError(
        "Knowledge cannot publish during creation; create a draft, validate its revision, then publish explicitly"
      );
    }
    if (!dto.title?.trim()) throw new ValidationError("Knowledge item title is required");
    if (!dto.content?.trim()) throw new ValidationError("Knowledge item content is required");

    const id = `know-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    return this.db.runInTransaction(ctx, async (uow) => {
      const revision = await this.snapshot(id, 1, {
        title: dto.title.trim(),
        category: dto.category,
        content: dto.content.trim(),
        summary: dto.summary?.trim() || dto.content.slice(0, 160).trim(),
        sourceDocId: dto.sourceDocId,
        tags: dto.tags || [dto.category],
      }, uow.context);
      const created = await uow.knowledge.create({
        id,
        organizationId: uow.context.organizationId,
        title: revision.title,
        category: revision.category,
        content: revision.content,
        summary: revision.summary,
        author: uow.context.userEmail,
        sourceDocId: revision.sourceDocId,
        tags: revision.tags,
        isPublicPlatformKnowledge: false,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      }, uow.context);
      await this.recordSnapshot(revision, uow.context, (log) => uow.recordAuditLog(log));
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "knowledge:create_draft",
        resource: "KnowledgeItem",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: { revision: 1, revisionHash: revision.contentHashSha256 },
        timestamp,
      });
      return created;
    });
  }

  public override async updateKnowledgeItem(id: string, dto: UpdateKnowledgeItemDto, ctx: TenantContext): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");
    const update = cleanUpdate(dto);
    return this.db.runInTransaction(ctx, async (uow) => {
      const existing = await uow.knowledge.findById(id, uow.context, "KnowledgeItem");
      const history = await this.history(id, uow.context);
      if (history.latestPublishedRevision !== undefined || existing.isPublicPlatformKnowledge === true) {
        throw new ConflictError(
          "Published knowledge is immutable in place; create a revision, validate it, then publish that revision"
        );
      }
      const revisionNumber = Math.max(existing.version, history.latestRevision) + 1;
      const revision = await this.snapshot(id, revisionNumber, {
        title: update.title ?? existing.title,
        category: update.category ?? existing.category,
        content: update.content ?? existing.content,
        summary: update.summary ?? existing.summary,
        sourceDocId: update.sourceDocId ?? existing.sourceDocId,
        tags: update.tags ?? existing.tags,
      }, uow.context);
      const updated = await uow.knowledge.update(id, {
        title: revision.title,
        category: revision.category,
        content: revision.content,
        summary: revision.summary,
        sourceDocId: revision.sourceDocId,
        tags: revision.tags,
        version: revisionNumber,
      }, uow.context, "KnowledgeItem");
      await this.recordSnapshot(revision, uow.context, (log) => uow.recordAuditLog(log));
      return updated;
    });
  }

  public async getRevisionHistory(id: string, ctx: TenantContext): Promise<KnowledgeRevisionHistory> {
    requirePermission(ctx, "knowledge:read");
    await this.db.knowledgeRepo.findById(id, ctx, "KnowledgeItem");
    return this.history(id, ctx);
  }

  public async createRevision(id: string, dto: UpdateKnowledgeItemDto, ctx: TenantContext): Promise<KnowledgeRevisionView> {
    requirePermission(ctx, "knowledge:write");
    const update = cleanUpdate(dto);
    return this.db.runInTransaction(ctx, async (uow) => {
      const existing = await uow.knowledge.findById(id, uow.context, "KnowledgeItem");
      const history = await this.history(id, uow.context);
      const latest = this.latestView(history);
      const hasPublishedBasis = history.latestPublishedRevision !== undefined || existing.isPublicPlatformKnowledge === true;
      if (!hasPublishedBasis) {
        throw new ConflictError("Unpublished knowledge should be edited as its current draft before first publication");
      }
      if (latest && history.latestPublishedRevision !== latest.snapshot.revision && latest.state !== "rejected") {
        throw new ConflictError("A revision is already pending; validate/publish or reject it before creating another");
      }
      const revisionNumber = Math.max(existing.version, history.latestRevision) + 1;
      const revision = await this.snapshot(id, revisionNumber, {
        title: update.title ?? existing.title,
        category: update.category ?? existing.category,
        content: update.content ?? existing.content,
        summary: update.summary ?? existing.summary,
        sourceDocId: update.sourceDocId ?? existing.sourceDocId,
        tags: update.tags ?? existing.tags,
      }, uow.context);

      // `version` is the monotonic latest-revision counter. Published content is
      // not replaced until the explicit publish command below.
      await uow.knowledge.update(id, { version: revisionNumber }, uow.context, "KnowledgeItem");
      await this.recordSnapshot(revision, uow.context, (log) => uow.recordAuditLog(log));
      return deriveKnowledgeRevisionView(revision, []);
    });
  }

  public async validateRevision(id: string, revisionNumber: number, ctx: TenantContext): Promise<KnowledgeRevisionView> {
    requirePermission(ctx, "knowledge:write");
    if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) {
      throw new ValidationError("revision must be a positive safe integer");
    }
    return this.db.runInTransaction(ctx, async (uow) => {
      await uow.knowledge.findById(id, uow.context, "KnowledgeItem");
      const history = await this.history(id, uow.context);
      const view = history.revisions.find((candidate) => candidate.snapshot.revision === revisionNumber);
      if (!view) throw new ConflictError("Knowledge revision does not exist", { id, revision: revisionNumber });
      if (revisionNumber !== history.latestRevision) {
        throw new ConflictError("Only the latest knowledge revision can be validated");
      }
      if (view.state === "validated") return view;
      if (view.state !== "draft") {
        throw new ConflictError(`Knowledge revision cannot be validated from state '${view.state}'`);
      }
      assertKnowledgeRevisionHash(view.snapshot);
      await this.sourceChecksum(view.snapshot.sourceDocId, view.snapshot.sourceDocumentChecksumSha256, uow.context);
      const decision: KnowledgeRevisionDecision = {
        knowledgeItemId: id,
        revision: revisionNumber,
        state: "validated",
        contentHashSha256: view.snapshot.contentHashSha256,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        createdAt: new Date().toISOString(),
      };
      await this.recordDecision(decision, uow.context, (log) => uow.recordAuditLog(log));
      return deriveKnowledgeRevisionView(view.snapshot, [decision]);
    });
  }

  public async publishRevision(
    id: string,
    revisionNumber: number,
    scope: KnowledgePublicationScope,
    ctx: TenantContext
  ): Promise<KnowledgeItemRecord> {
    requirePermission(ctx, "knowledge:write");
    if (scope !== "tenant" && scope !== "platform") {
      throw new ValidationError("Knowledge publication scope must be 'tenant' or 'platform'");
    }
    if (scope === "platform") requirePermission(ctx, "org:admin");

    return this.db.runInTransaction(ctx, async (uow) => {
      const existing = await uow.knowledge.findById(id, uow.context, "KnowledgeItem");
      const history = await this.history(id, uow.context);
      const view = history.revisions.find((candidate) => candidate.snapshot.revision === revisionNumber);
      if (!view) throw new ConflictError("Knowledge revision does not exist", { id, revision: revisionNumber });
      if (revisionNumber !== history.latestRevision || revisionNumber !== existing.version) {
        throw new ConflictError("Only the latest materialized revision counter can be published", {
          requestedRevision: revisionNumber,
          latestRevision: history.latestRevision,
          materializedVersion: existing.version,
        });
      }
      if (view.state === "published") return existing;
      if (view.state !== "validated") {
        throw new ConflictError("Knowledge revision must be consistency-validated before publication", {
          revision: revisionNumber,
          currentState: view.state,
        });
      }
      assertKnowledgeRevisionHash(view.snapshot);
      await this.sourceChecksum(view.snapshot.sourceDocId, view.snapshot.sourceDocumentChecksumSha256, uow.context);

      const updated = await uow.knowledge.update(id, {
        title: view.snapshot.title,
        category: view.snapshot.category,
        content: view.snapshot.content,
        summary: view.snapshot.summary,
        sourceDocId: view.snapshot.sourceDocId,
        tags: view.snapshot.tags,
        isPublicPlatformKnowledge: scope === "platform",
      }, uow.context, "KnowledgeItem");
      const decision: KnowledgeRevisionDecision = {
        knowledgeItemId: id,
        revision: revisionNumber,
        state: "published",
        contentHashSha256: view.snapshot.contentHashSha256,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        publicationScope: scope,
        createdAt: new Date().toISOString(),
      };
      await this.recordDecision(decision, uow.context, (log) => uow.recordAuditLog(log));
      await uow.recordAuditLog({
        organizationId: uow.context.organizationId,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        action: "knowledge:publish_revision",
        resource: "KnowledgeItem",
        resourceId: id,
        requestId: uow.context.requestId,
        status: "success",
        metadata: {
          revision: revisionNumber,
          revisionHash: view.snapshot.contentHashSha256,
          publicationScope: scope,
          validationKind: "consistency",
          canonicalVerificationState: "unverified",
          canonicalCertificationState: "uncertified",
        },
        timestamp: decision.createdAt,
      });
      return updated;
    });
  }

  public async rejectRevision(id: string, revisionNumber: number, reason: string, ctx: TenantContext): Promise<KnowledgeRevisionView> {
    requirePermission(ctx, "knowledge:write");
    const normalizedReason = reason.trim();
    if (!normalizedReason) throw new ValidationError("Revision rejection reason is required");
    return this.db.runInTransaction(ctx, async (uow) => {
      await uow.knowledge.findById(id, uow.context, "KnowledgeItem");
      const history = await this.history(id, uow.context);
      const view = history.revisions.find((candidate) => candidate.snapshot.revision === revisionNumber);
      if (!view) throw new ConflictError("Knowledge revision does not exist", { id, revision: revisionNumber });
      if (revisionNumber !== history.latestRevision) throw new ConflictError("Only the latest revision can be rejected");
      if (view.state !== "draft" && view.state !== "validated") {
        throw new ConflictError(`Knowledge revision cannot be rejected from state '${view.state}'`);
      }
      const decision: KnowledgeRevisionDecision = {
        knowledgeItemId: id,
        revision: revisionNumber,
        state: "rejected",
        contentHashSha256: view.snapshot.contentHashSha256,
        actorId: uow.context.userId,
        actorEmail: uow.context.userEmail,
        reason: normalizedReason,
        createdAt: new Date().toISOString(),
      };
      await this.recordDecision(decision, uow.context, (log) => uow.recordAuditLog(log));
      const prior: KnowledgeRevisionDecision[] = view.state === "validated" && view.validatedAt
        ? [{
            knowledgeItemId: id,
            revision: revisionNumber,
            state: "validated",
            contentHashSha256: view.snapshot.contentHashSha256,
            actorId: "historical",
            actorEmail: "historical",
            createdAt: view.validatedAt,
          }]
        : [];
      return deriveKnowledgeRevisionView(view.snapshot, [...prior, decision]);
    });
  }
}

export const controlledKnowledgeService = new ControlledKnowledgeService();

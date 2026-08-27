/**
 * APEX ONE — Domain Relationship Integrity
 *
 * Enforces that referenced entities exist and belong to the same authenticated
 * organization before a tenant-owned record is persisted.
 */
import { CrossTenantViolationError, NotFoundError, TenantContext } from "../../../core/errors";
import { DatabaseStore } from "../../store";
import {
  ContractRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  TransactionRecord,
  ValueCapturedRecord,
  WorkflowRunRecord,
  ValueOpportunityRecord,
} from "../../schema";

function requireSameTenant<T extends { id: string; organizationId: string }>(
  record: T | undefined,
  resource: string,
  referencedId: string,
  ctx: TenantContext
): T {
  if (!record) throw new NotFoundError(resource);
  if (record.organizationId !== ctx.organizationId) {
    throw new CrossTenantViolationError(record.organizationId, ctx.organizationId);
  }
  return record;
}

export function validateContractRelationship(
  record: ContractRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  requireSameTenant(store.customers.get(record.customerId), "Customer", record.customerId, ctx);
}

export function validateTransactionRelationship(
  record: TransactionRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  requireSameTenant(store.customers.get(record.customerId), "Customer", record.customerId, ctx);
}

export function validateDocumentRelationship(
  record: DocumentRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  if (record.customerId) {
    requireSameTenant(store.customers.get(record.customerId), "Customer", record.customerId, ctx);
  }
  const uploader = store.users.get(record.uploadedBy);
  if (!uploader) throw new NotFoundError("User");
  if (!store.memberships.has(`${record.uploadedBy}:${ctx.organizationId}`)) {
    throw new CrossTenantViolationError(ctx.organizationId, ctx.organizationId);
  }
}

export function validateKnowledgeRelationship(
  record: KnowledgeItemRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  if (record.sourceDocId) {
    requireSameTenant(store.documents.get(record.sourceDocId), "Document", record.sourceDocId, ctx);
  }
}

export function validateWorkflowRunRelationship(
  record: WorkflowRunRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  requireSameTenant(store.workflows.get(record.workflowId), "Workflow", record.workflowId, ctx);
  const actor = store.users.get(record.triggeredBy);
  if (!actor) throw new NotFoundError("User");
  if (!store.memberships.has(`${record.triggeredBy}:${ctx.organizationId}`)) {
    throw new CrossTenantViolationError(ctx.organizationId, ctx.organizationId);
  }
}

export function validateValueCapturedRelationship(
  record: ValueCapturedRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  if (record.opportunityId) {
    requireSameTenant(store.opportunities.get(record.opportunityId), "ValueOpportunity", record.opportunityId, ctx);
  }
}

export function validateValueOpportunityRelationship(
  record: ValueOpportunityRecord,
  ctx: TenantContext,
  store: DatabaseStore
): void {
  if (!record.sourceEntityId || !record.sourceEntityType) return;

  const collections: Record<NonNullable<ValueOpportunityRecord["sourceEntityType"]>, Map<string, { id: string; organizationId: string }>> = {
    Contract: store.contracts,
    Customer: store.customers,
    Signal: store.signals,
    Transaction: store.transactions,
    Operation: store.actions,
  };

  requireSameTenant(
    collections[record.sourceEntityType].get(record.sourceEntityId),
    record.sourceEntityType,
    record.sourceEntityId,
    ctx
  );
}

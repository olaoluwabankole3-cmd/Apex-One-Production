/**
 * APEX ONE — Relationship Integrity Validation Engine
 * 
 * Enforces strict existence and same-organization tenant ownership on all entity
 * foreign keys and polymorphic relationships before persistence.
 */

import {
  CustomerRecord,
  ContractRecord,
  TransactionRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  SignalRecord,
  ValueOpportunityRecord,
  ValueCapturedRecord,
  WorkflowRecord,
  WorkflowRunRecord,
  ActionRecord,
  OrganizationalMemoryRecord,
  AuditLogRecord,
  UserRecord,
  OrganizationMembershipRecord,
} from "./schema";
import {
  TenantContext,
  NotFoundError,
  CrossTenantViolationError,
  ValidationError,
} from "../core/errors";

export interface IEntityLookupStore {
  users?: Map<string, UserRecord>;
  memberships?: Map<string, OrganizationMembershipRecord>;
  customers?: Map<string, CustomerRecord>;
  contracts?: Map<string, ContractRecord>;
  transactions?: Map<string, TransactionRecord>;
  documents?: Map<string, DocumentRecord>;
  knowledge?: Map<string, KnowledgeItemRecord>;
  signals?: Map<string, SignalRecord>;
  opportunities?: Map<string, ValueOpportunityRecord>;
  valueCaptured?: Map<string, ValueCapturedRecord>;
  workflows?: Map<string, WorkflowRecord>;
  workflowRuns?: Map<string, WorkflowRunRecord>;
  actions?: Map<string, ActionRecord>;
  memory?: Map<string, OrganizationalMemoryRecord>;
  recordAuditLog?: (
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ) => Promise<AuditLogRecord> | AuditLogRecord;
}

export const ALLOWED_SOURCE_ENTITY_TYPES = [
  "Contract",
  "Customer",
  "Signal",
  "Transaction",
  "Operation",
] as const;

export type AllowedSourceEntityType = (typeof ALLOWED_SOURCE_ENTITY_TYPES)[number];

export class RelationshipValidator {
  /**
   * Validate that a customer exists and belongs to the authenticated tenant.
   */
  public static validateCustomerBelongsToTenant(
    customerId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (customerId === undefined || customerId === null || customerId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'customerId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof customerId !== "string" || customerId.trim().length === 0) {
      throw new ValidationError("Field 'customerId' must be a non-empty string");
    }

    const trimmedId = customerId.trim();

    if (!store?.customers) {
      return;
    }

    const customer = store.customers.get(trimmedId);
    if (!customer) {
      throw new NotFoundError("Customer");
    }

    if (customer.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "Customer",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: customer.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "customerId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(customer.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a contract exists and belongs to the authenticated tenant.
   */
  public static validateContractBelongsToTenant(
    contractId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (contractId === undefined || contractId === null || contractId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'contractId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof contractId !== "string" || contractId.trim().length === 0) {
      throw new ValidationError("Field 'contractId' must be a non-empty string");
    }

    const trimmedId = contractId.trim();

    if (!store?.contracts) {
      return;
    }

    const contract = store.contracts.get(trimmedId);
    if (!contract) {
      throw new NotFoundError("Contract");
    }

    if (contract.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "Contract",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: contract.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "contractId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(contract.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a transaction exists and belongs to the authenticated tenant.
   */
  public static validateTransactionBelongsToTenant(
    transactionId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (transactionId === undefined || transactionId === null || transactionId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'transactionId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof transactionId !== "string" || transactionId.trim().length === 0) {
      throw new ValidationError("Field 'transactionId' must be a non-empty string");
    }

    const trimmedId = transactionId.trim();

    if (!store?.transactions) {
      return;
    }

    const txn = store.transactions.get(trimmedId);
    if (!txn) {
      throw new NotFoundError("Transaction");
    }

    if (txn.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "Transaction",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: txn.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "transactionId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(txn.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a signal exists and belongs to the authenticated tenant.
   */
  public static validateSignalBelongsToTenant(
    signalId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (signalId === undefined || signalId === null || signalId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'signalId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof signalId !== "string" || signalId.trim().length === 0) {
      throw new ValidationError("Field 'signalId' must be a non-empty string");
    }

    const trimmedId = signalId.trim();

    if (!store?.signals) {
      return;
    }

    const signal = store.signals.get(trimmedId);
    if (!signal) {
      throw new NotFoundError("Signal");
    }

    if (signal.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "Signal",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: signal.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "signalId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(signal.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a document exists and belongs to the authenticated tenant.
   */
  public static validateDocumentBelongsToTenant(
    docId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (docId === undefined || docId === null || docId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'documentId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof docId !== "string" || docId.trim().length === 0) {
      throw new ValidationError("Field 'documentId' must be a non-empty string");
    }

    const trimmedId = docId.trim();

    if (!store?.documents) {
      return;
    }

    const doc = store.documents.get(trimmedId);
    if (!doc) {
      throw new NotFoundError("Document");
    }

    if (doc.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "Document",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: doc.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "sourceDocId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(doc.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a workflow exists and belongs to the authenticated tenant.
   */
  public static validateWorkflowBelongsToTenant(
    workflowId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (workflowId === undefined || workflowId === null || workflowId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'workflowId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof workflowId !== "string" || workflowId.trim().length === 0) {
      throw new ValidationError("Field 'workflowId' must be a non-empty string");
    }

    const trimmedId = workflowId.trim();

    if (!store?.workflows) {
      return;
    }

    const wf = store.workflows.get(trimmedId);
    if (!wf) {
      throw new NotFoundError("Workflow");
    }

    if (wf.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "Workflow",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: wf.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "workflowId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(wf.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a value opportunity exists and belongs to the authenticated tenant.
   */
  public static validateOpportunityBelongsToTenant(
    opportunityId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (opportunityId === undefined || opportunityId === null || opportunityId === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `Field 'opportunityId' is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof opportunityId !== "string" || opportunityId.trim().length === 0) {
      throw new ValidationError("Field 'opportunityId' must be a non-empty string");
    }

    const trimmedId = opportunityId.trim();

    if (!store?.opportunities) {
      return;
    }

    const opp = store.opportunities.get(trimmedId);
    if (!opp) {
      throw new NotFoundError("ValueOpportunity");
    }

    if (opp.organizationId !== ctx.organizationId) {
      if (store.recordAuditLog) {
        store.recordAuditLog({
          organizationId: ctx.organizationId,
          actorId: ctx.userId,
          actorEmail: ctx.userEmail,
          action: "security:cross_tenant_relationship_violation",
          resource: options?.resourceContext || "ValueOpportunity",
          resourceId: trimmedId,
          requestId: ctx.requestId,
          status: "denied",
          metadata: {
            attemptedTargetOrg: opp.organizationId,
            actualOrg: ctx.organizationId,
            relationshipType: "opportunityId",
          },
          timestamp: new Date().toISOString(),
        });
      }
      throw new CrossTenantViolationError(opp.organizationId, ctx.organizationId);
    }
  }

  /**
   * Validate that a user actor belongs to the authenticated tenant via organization membership.
   */
  public static validateUserMembershipBelongsToTenant(
    userIdentifier: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore,
    options?: { optional?: boolean; resourceContext?: string }
  ): void {
    if (userIdentifier === undefined || userIdentifier === null || userIdentifier === "") {
      if (options?.optional) return;
      throw new ValidationError(
        `User actor is required${options?.resourceContext ? ` for ${options.resourceContext}` : ""}`
      );
    }

    if (typeof userIdentifier !== "string" || userIdentifier.trim().length === 0) {
      throw new ValidationError("User actor must be a non-empty string");
    }

    const trimmed = userIdentifier.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    if (
      lowerTrimmed === "system" ||
      lowerTrimmed === "scheduler" ||
      lowerTrimmed === "automated" ||
      lowerTrimmed === "cron"
    ) {
      return; // Automated / system actors
    }

    if (!store?.memberships) {
      return;
    }

    let isMember = false;
    let foundInOtherOrg: string | null = null;

    for (const membership of store.memberships.values()) {
      let matches = membership.userId === trimmed;
      if (!matches && store.users) {
        const u = store.users.get(membership.userId);
        if (
          u &&
          (u.email.toLowerCase() === lowerTrimmed ||
            u.name.toLowerCase() === lowerTrimmed ||
            u.id === trimmed)
        ) {
          matches = true;
        }
      }

      if (matches) {
        if (membership.organizationId === ctx.organizationId) {
          isMember = true;
          break;
        } else {
          foundInOtherOrg = membership.organizationId;
        }
      }
    }

    if (!isMember) {
      if (foundInOtherOrg) {
        if (store.recordAuditLog) {
          store.recordAuditLog({
            organizationId: ctx.organizationId,
            actorId: ctx.userId,
            actorEmail: ctx.userEmail,
            action: "security:cross_tenant_relationship_violation",
            resource: options?.resourceContext || "UserMembership",
            resourceId: trimmed,
            requestId: ctx.requestId,
            status: "denied",
            metadata: {
              attemptedTargetOrg: foundInOtherOrg,
              actualOrg: ctx.organizationId,
              relationshipType: "userMembership",
            },
            timestamp: new Date().toISOString(),
          });
        }
        throw new CrossTenantViolationError(foundInOtherOrg, ctx.organizationId);
      }

      // If the org has configured memberships, verify membership existence
      const orgHasMemberships = Array.from(store.memberships.values()).some(
        (m) => m.organizationId === ctx.organizationId
      );
      if (orgHasMemberships) {
        throw new NotFoundError("UserMembership");
      }
    }
  }

  /**
   * Validate polymorphic source entity on ValueOpportunity.
   */
  public static validatePolymorphicSourceEntity(
    sourceEntityType: unknown,
    sourceEntityId: unknown,
    ctx: TenantContext,
    store?: IEntityLookupStore
  ): void {
    // 1. If sourceEntityType is supplied, validate it against the strict allowlist
    if (sourceEntityType !== undefined && sourceEntityType !== null && sourceEntityType !== "") {
      if (
        typeof sourceEntityType !== "string" ||
        !ALLOWED_SOURCE_ENTITY_TYPES.includes(sourceEntityType as AllowedSourceEntityType)
      ) {
        throw new ValidationError(
          `Invalid sourceEntityType '${String(sourceEntityType)}'. Allowed types: [${ALLOWED_SOURCE_ENTITY_TYPES.join(", ")}]`
        );
      }
    }

    // 2. If sourceEntityId is provided, sourceEntityType must also be provided
    const hasSourceEntityId =
      sourceEntityId !== undefined && sourceEntityId !== null && sourceEntityId !== "";

    if (hasSourceEntityId) {
      if (!sourceEntityType || typeof sourceEntityType !== "string" || sourceEntityType.trim() === "") {
        throw new ValidationError("Field 'sourceEntityType' is required when 'sourceEntityId' is specified");
      }

      const entityType = sourceEntityType as AllowedSourceEntityType;
      const entityId = String(sourceEntityId).trim();

      switch (entityType) {
        case "Contract":
          this.validateContractBelongsToTenant(entityId, ctx, store, {
            optional: false,
            resourceContext: "ValueOpportunity.sourceEntityId",
          });
          break;
        case "Customer":
          this.validateCustomerBelongsToTenant(entityId, ctx, store, {
            optional: false,
            resourceContext: "ValueOpportunity.sourceEntityId",
          });
          break;
        case "Signal":
          this.validateSignalBelongsToTenant(entityId, ctx, store, {
            optional: false,
            resourceContext: "ValueOpportunity.sourceEntityId",
          });
          break;
        case "Transaction":
          this.validateTransactionBelongsToTenant(entityId, ctx, store, {
            optional: false,
            resourceContext: "ValueOpportunity.sourceEntityId",
          });
          break;
        case "Operation":
          // High-level operational telemetry category; valid identifier string
          if (entityId.length === 0) {
            throw new ValidationError("Field 'sourceEntityId' must be a non-empty string");
          }
          break;
        default:
          throw new ValidationError(
            `Unsupported sourceEntityType '${String(entityType)}'`
          );
      }
    }
  }
}

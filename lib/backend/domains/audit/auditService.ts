/**
 * APEX ONE — Audit Domain Service
 *
 * Provides immutable audit logging and retrieval for enterprise compliance.
 */

import { db, DatabaseStore } from "../../database/store";
import { AuditLogRecord } from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";
import { PaginatedResult, PaginationOptions } from "../../database/querySpecification";

export class AuditService {
  constructor(private readonly database: DatabaseStore = db) {}

  /**
   * Fetch immutable audit logs for the authenticated tenant through the canonical cursor contract.
   */
  public async getAuditLogs(
    ctx: TenantContext,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLogRecord>> {
    requirePermission(ctx, "audit:read");
    return this.database.auditLogsRepo.findMany(ctx, options);
  }
}

export const auditService = new AuditService();

/**
 * APEX ONE — Audit Domain Service
 *
 * Provides immutable audit logging and retrieval for enterprise compliance.
 */

import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { AuditLogRecord } from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";
import { PaginatedResult, PaginationOptions } from "../../database/querySpecification";

export class AuditService {
  constructor(private readonly database: DatabaseStore = createApplicationInfrastructure().database) {}

  public async getAuditLogs(
    ctx: TenantContext,
    options?: PaginationOptions
  ): Promise<PaginatedResult<AuditLogRecord>> {
    requirePermission(ctx, "audit:read");
    return this.database.auditLogsRepo.findMany(ctx, options);
  }
}

export const auditService = new AuditService();

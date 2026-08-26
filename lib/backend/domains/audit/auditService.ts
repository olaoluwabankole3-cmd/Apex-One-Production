/**
 * APEX ONE — Audit Domain Service
 * 
 * Provides immutable audit logging and retrieval for enterprise compliance.
 */

import { db } from "../../database/store";
import { AuditLogRecord } from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";

export class AuditService {
  /**
   * Fetch immutable audit logs for the authenticated tenant.
   */
  public async getAuditLogs(ctx: TenantContext, limit: number = 50): Promise<AuditLogRecord[]> {
    requirePermission(ctx, "audit:read");
    return db.auditLogsRepo.findMany(ctx, limit);
  }
}

export const auditService = new AuditService();

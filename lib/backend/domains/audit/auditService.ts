/**
 * APEX ONE — Audit Domain Service
 * 
 * Provides immutable audit logging and retrieval for enterprise compliance.
 */

import { db, DatabaseStore } from "../../database/store";
import { AuditLogRecord } from "../../database/schema";
import { TenantContext, requirePermission } from "../../core/security";

export class AuditService {
  constructor(private readonly database: DatabaseStore = db) {}

  /**
   * Fetch immutable audit logs for the authenticated tenant.
   */
  public async getAuditLogs(ctx: TenantContext, limit: number = 50): Promise<AuditLogRecord[]> {
    requirePermission(ctx, "audit:read");
    return this.database.auditLogsRepo.findMany(ctx, limit);
  }
}

export const auditService = new AuditService();

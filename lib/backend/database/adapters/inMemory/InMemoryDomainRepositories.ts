/**
 * APEX ONE — Concrete In-Memory Domain Repository Adapters
 * 
 * ARCHITECTURAL NOTICE:
 * These in-memory adapters implement the formal domain repository interfaces.
 * They serve as temporary mocks/in-memory data stores for prototyping and unit tests.
 * All implementations enforce tenant boundaries strictly.
 */

import { InMemoryTenantRepository } from "./InMemoryTenantRepository";
import {
  CustomerRecord,
  ContractRecord,
  TransactionRecord,
  SignalRecord,
  ValueOpportunityRecord,
  ValueCapturedRecord,
  OrganizationalMemoryRecord,
  ActionRecord,
  DocumentRecord,
  KnowledgeItemRecord,
  WorkflowRecord,
  WorkflowRunRecord,
  AuditLogRecord,
} from "../../schema";
import {
  ICustomerRepository,
  IContractRepository,
  ITransactionRepository,
  ISignalRepository,
  IValueOpportunityRepository,
  IValueCapturedRepository,
  IOrganizationalMemoryRepository,
  IActionRepository,
  IDocumentRepository,
  IKnowledgeRepository,
  IWorkflowRepository,
  IWorkflowRunRepository,
  IAuditLogRepository,
} from "../../repository";
import { TenantContext } from "../../../core/errors";

export class InMemoryCustomerRepository
  extends InMemoryTenantRepository<CustomerRecord>
  implements ICustomerRepository
{
  public async findByEmail(email: string, ctx: TenantContext): Promise<CustomerRecord | undefined> {
    const list = await this.findMany(ctx, (c) => c.contactEmail.toLowerCase() === email.toLowerCase());
    return list[0];
  }

  public async findAtRisk(ctx: TenantContext): Promise<CustomerRecord[]> {
    return this.findMany(ctx, (c) => c.status === "at-risk" || c.healthScore < 70);
  }
}

export class InMemoryContractRepository
  extends InMemoryTenantRepository<ContractRecord>
  implements IContractRepository
{
  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<ContractRecord[]> {
    return this.findMany(ctx, (c) => c.customerId === customerId);
  }

  public async findExpiringSoon(daysThreshold: number, ctx: TenantContext): Promise<ContractRecord[]> {
    return this.findMany(ctx, (c) => c.renewalDaysRemaining <= daysThreshold && c.status === "active");
  }
}

export class InMemoryTransactionRepository
  extends InMemoryTenantRepository<TransactionRecord>
  implements ITransactionRepository
{
  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<TransactionRecord[]> {
    return this.findMany(ctx, (t) => t.customerId === customerId);
  }

  public async calculateFinancialTotals(ctx: TenantContext): Promise<{ totalRevenue: number; totalCosts: number }> {
    const records = await this.findMany(ctx);
    let totalRevenue = 0;
    let totalCosts = 0;
    for (const rec of records) {
      if (rec.type === "revenue" && rec.status === "cleared") {
        totalRevenue += rec.amount;
      } else if (rec.type === "cost" && rec.status === "cleared") {
        totalCosts += rec.amount;
      }
    }
    return { totalRevenue, totalCosts };
  }
}

export class InMemorySignalRepository
  extends InMemoryTenantRepository<SignalRecord>
  implements ISignalRepository
{
  public async findActiveByCategory(category: string, ctx: TenantContext): Promise<SignalRecord[]> {
    return this.findMany(ctx, (s) => s.status === "active" && (category === "all" || s.category === category));
  }
}

export class InMemoryValueOpportunityRepository
  extends InMemoryTenantRepository<ValueOpportunityRecord>
  implements IValueOpportunityRepository
{
  public async findByCategory(category: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]> {
    return this.findMany(ctx, (o) => category === "all" || o.category === category);
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<ValueOpportunityRecord[]> {
    return this.findMany(ctx, (o) => status === "all" || o.status === status);
  }
}

export class InMemoryValueCapturedRepository
  extends InMemoryTenantRepository<ValueCapturedRecord>
  implements IValueCapturedRepository
{
  public async calculateTotalCaptured(ctx: TenantContext): Promise<number> {
    const list = await this.findMany(ctx);
    return list.reduce((sum, item) => sum + item.capturedValue, 0);
  }
}

export class InMemoryOrganizationalMemoryRepository
  extends InMemoryTenantRepository<OrganizationalMemoryRecord>
  implements IOrganizationalMemoryRepository
{
  public async searchKeywords(keywords: string[], ctx: TenantContext): Promise<OrganizationalMemoryRecord[]> {
    const lowerKeys = keywords.map((k) => k.toLowerCase());
    return this.findMany(ctx, (m) => {
      const target = `${m.title} ${m.content} ${m.source}`.toLowerCase();
      return lowerKeys.some((k) => target.includes(k));
    });
  }
}

export class InMemoryActionRepository
  extends InMemoryTenantRepository<ActionRecord>
  implements IActionRepository
{
  public async findByStatus(status: string, ctx: TenantContext): Promise<ActionRecord[]> {
    return this.findMany(ctx, (a) => status === "all" || a.status === status);
  }
}

export class InMemoryDocumentRepository
  extends InMemoryTenantRepository<DocumentRecord>
  implements IDocumentRepository
{
  public async findByCategory(category: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, (d) => category === "all" || d.category === category);
  }

  public async findByCustomer(customerId: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, (d) => d.customerId === customerId);
  }

  public async findByStatus(status: string, ctx: TenantContext): Promise<DocumentRecord[]> {
    return this.findMany(ctx, (d) => status === "all" || d.status === status);
  }
}

export class InMemoryKnowledgeRepository
  extends InMemoryTenantRepository<KnowledgeItemRecord>
  implements IKnowledgeRepository
{
  public async findByCategory(category: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    return this.findMany(ctx, (k) => category === "all" || k.category === category);
  }

  public async findByTags(tags: string[], ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    return this.findMany(ctx, (k) => tags.some((t) => k.tags.includes(t)));
  }

  public async searchContent(query: string, ctx: TenantContext): Promise<KnowledgeItemRecord[]> {
    const q = query.toLowerCase().trim();
    return this.findMany(ctx, (k) => {
      return (
        k.title.toLowerCase().includes(q) ||
        k.content.toLowerCase().includes(q) ||
        (k.summary && k.summary.toLowerCase().includes(q)) ||
        k.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }
}

export class InMemoryWorkflowRepository
  extends InMemoryTenantRepository<WorkflowRecord>
  implements IWorkflowRepository
{
  public async findActive(ctx: TenantContext): Promise<WorkflowRecord[]> {
    return this.findMany(ctx, (w) => w.status === "active");
  }
}

export class InMemoryWorkflowRunRepository
  extends InMemoryTenantRepository<WorkflowRunRecord>
  implements IWorkflowRunRepository
{
  public async findByWorkflow(workflowId: string, ctx: TenantContext): Promise<WorkflowRunRecord[]> {
    return this.findMany(ctx, (r) => r.workflowId === workflowId);
  }

  public async findActiveRuns(ctx: TenantContext): Promise<WorkflowRunRecord[]> {
    return this.findMany(ctx, (r) => r.status === "running" || r.status === "waiting_approval");
  }
}

export class InMemoryAuditLogRepository implements IAuditLogRepository {
  private logs: AuditLogRecord[] = [];

  public async record(
    log: Omit<AuditLogRecord, "id"> | (Omit<AuditLogRecord, "id" | "timestamp"> & { timestamp?: string })
  ): Promise<AuditLogRecord> {
    const fullLog: AuditLogRecord = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: log.timestamp || new Date().toISOString(),
    };
    this.logs.unshift(fullLog);
    return fullLog;
  }

  public async findMany(ctx: TenantContext, limit: number = 50): Promise<AuditLogRecord[]> {
    return this.logs
      .filter((log) => log.organizationId === ctx.organizationId)
      .slice(0, limit);
  }
}

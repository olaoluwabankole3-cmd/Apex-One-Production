import { ConflictError, type TenantContext } from "../../core/errors";
import { requirePermission } from "../../core/security";
import { DatabaseStore } from "../../database/store";
import { createApplicationInfrastructure } from "../../infrastructure/composition";
import { ControlledKnowledgeService } from "./controlledKnowledgeService";

/**
 * Canonical item-level CRUD facade for Stage 9.
 *
 * Published knowledge cannot be removed through generic CRUD. Publication is an
 * explicit lifecycle decision, so retraction/removal must also be modeled as an
 * explicit lifecycle command rather than silently deleting the materialized row.
 */
export class PublicationSafeKnowledgeService extends ControlledKnowledgeService {
  constructor(database: DatabaseStore = createApplicationInfrastructure().database) {
    super(database);
  }

  public override async deleteKnowledgeItem(id: string, ctx: TenantContext): Promise<boolean> {
    requirePermission(ctx, "knowledge:write");
    const item = await this.getKnowledgeItemById(id, ctx);
    const history = await this.getRevisionHistory(id, ctx);

    if (history.latestPublishedRevision !== undefined || item.isPublicPlatformKnowledge === true) {
      throw new ConflictError(
        "Published knowledge cannot be deleted through generic CRUD; use an explicit retraction lifecycle"
      );
    }

    return super.deleteKnowledgeItem(id, ctx);
  }
}

export const publicationSafeKnowledgeService = new PublicationSafeKnowledgeService();

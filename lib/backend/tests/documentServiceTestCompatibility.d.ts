import type { TenantContext } from "../core/errors";
import type { DocumentFileType, DocumentRecord } from "../database/schema";

type LegacyDocumentUploadFixture = {
  name: string;
  fileType: DocumentFileType;
  category:
    | "Contract"
    | "Invoice"
    | "SLA Agreement"
    | "Audit Report"
    | "Board Paper"
    | "Compliance Document"
    | "Other";
  content: string;
  size?: string;
  customerId?: string;
  tags?: string[];
};

/**
 * Stage 3G test-only bridge for the historical tenant-isolation fixture.
 *
 * The production HTTP contract and UploadDocumentDto remain strict:
 * callers must use `size` and `contentBuffer`. This overload exists only so
 * the legacy test fixture can compile without widening the runtime contract.
 * Remove when tenantIsolation.test.ts can be line-patched to the canonical DTO.
 */
declare module "../domains/documents/documentService" {
  interface DocumentService {
    uploadDocument(
      dto: LegacyDocumentUploadFixture,
      ctx: TenantContext
    ): Promise<DocumentRecord>;
  }
}

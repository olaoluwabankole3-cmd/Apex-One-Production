/**
 * APEX ONE — Document Domain Types & DTOs
 */

import { DocumentFileType, DocumentProcessingStatus, DocumentExtractionField, DocumentMetadata, DocumentRecord } from "../../database/schema";

export interface UploadDocumentDto {
  name: string;
  fileType: DocumentFileType;
  category: "Contract" | "Invoice" | "SLA Agreement" | "Audit Report" | "Board Paper" | "Compliance Document" | "Other";
  size: string;
  customerId?: string;
  tags?: string[];
  contentBuffer?: string; // Base64 or text representation for prototype extraction
}

export interface DocumentFilterDto {
  category?: string;
  status?: string;
  customerId?: string;
  query?: string;
}

export interface DocumentSummaryDto {
  totalDocuments: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  totalStorageBytes: number;
}

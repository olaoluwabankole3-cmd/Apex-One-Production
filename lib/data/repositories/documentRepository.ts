import { DocumentItem } from "@/lib/types";
import { IntelDocument } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { DocumentRecord } from "@/lib/backend/database/schema";
import { collectAllCollectionData, isApiNotFound } from "./httpCollection";

export interface DocumentRepository {
  getDocuments(organizationId?: string): Promise<DocumentItem[]>;
  getIntelDocuments(organizationId?: string): Promise<IntelDocument[]>;
  getDocument(id: string): Promise<IntelDocument | undefined>;
  getDocumentAnswer(question: string, doc: DocumentItem | IntelDocument): Promise<string>;
  createDocument(data: Partial<DocumentRecord>): Promise<DocumentItem>;
  deleteDocument(id: string): Promise<boolean>;
}

function mapRecordToIntelDocument(d: DocumentRecord): IntelDocument {
  const fileTypeMap: Record<string, "pdf" | "doc" | "xlsx"> = {
    pdf: "pdf",
    doc: "doc",
    docx: "doc",
    xlsx: "xlsx",
    csv: "xlsx",
    image: "pdf",
    json: "doc",
  };

  const categoryMap: Record<string, any> = {
    Contract: "Contract",
    Policy: "Policy",
    "Financial Document": "Financial Document",
    Report: "Report",
    "Compliance Document": "Compliance Document",
    "SLA Agreement": "Contract",
    "Audit Report": "Report",
    "Board Paper": "Report",
    Other: "Report",
  };

  const exposure =
    d.extractedFields?.find((field) =>
      /exposure|amount/i.test(field.label)
    )?.value || "Not available";
  const action =
    d.extractedFields?.find((field) => /action/i.test(field.label))?.value ||
    "Not available";

  return {
    id: d.id,
    name: d.name,
    fileType: fileTypeMap[d.fileType] || "pdf",
    category: categoryMap[d.category] || "Report",
    businessUnit: "Unassigned",
    uploadedBy: d.uploadedBy,
    date: new Date(d.createdAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    size: d.size,
    pages: d.metadata?.pageCount || 0,
    status: d.status === "indexed" ? "processed" : "processing",
    usefulSummary: {
      keyFinding: d.aiSummary || "",
      obligations: [],
      risksDetail: [],
      datesDetail: [
        {
          event: "Record Created",
          date: new Date(d.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        },
      ],
      financialExposure: exposure,
      recommendedAction: action,
    },
    entities: {
      customers: d.tags || [],
      contracts: [],
      financialValues: d.extractedFields?.map((field) => field.value) || [],
      risks: [],
      importantDates: [],
      actions: [],
      relatedDocs: [],
    },
    relationships: {
      relatedCustomer: {
        name: d.customerId || "Not linked",
        id: d.customerId || "none",
      },
      relatedContract: "Not linked",
      relatedWorkflow: "Not linked",
      relatedEmployee: d.uploadedBy || "Not recorded",
      relatedTransaction: "Not linked",
      relatedDecision: "Not linked",
    },
  };
}

function mapRecordToDocumentItem(d: DocumentRecord): DocumentItem {
  const intel = mapRecordToIntelDocument(d);
  return {
    id: d.id,
    name: d.name,
    fileType: intel.fileType,
    category: d.category as any,
    subsidiary: intel.businessUnit,
    uploadedBy: d.uploadedBy,
    date: intel.date,
    size: d.size,
    pages: intel.pages,
    status: intel.status,
    aiSummary: d.aiSummary || "",
    extractedFields: d.extractedFields || [],
    suggestedQuestions: [],
  };
}

export class ApiDocumentRepository implements DocumentRepository {
  async getDocuments(_organizationId?: string): Promise<DocumentItem[]> {
    const records = await collectAllCollectionData<DocumentRecord>("/api/v1/documents");
    return records.map(mapRecordToDocumentItem);
  }

  async getIntelDocuments(_organizationId?: string): Promise<IntelDocument[]> {
    const records = await collectAllCollectionData<DocumentRecord>("/api/v1/documents");
    return records.map(mapRecordToIntelDocument);
  }

  async getDocument(id: string): Promise<IntelDocument | undefined> {
    try {
      const record = await apiClient.getData<DocumentRecord>(`/api/v1/documents/${id}`);
      return mapRecordToIntelDocument(record);
    } catch (error: unknown) {
      if (isApiNotFound(error)) return undefined;
      throw error;
    }
  }

  async getDocumentAnswer(
    question: string,
    doc: DocumentItem | IntelDocument
  ): Promise<string> {
    const q = question.toLowerCase();
    const extractedFields = (doc as any).extractedFields as
      | Array<{ label: string; value: string }>
      | undefined;
    const match = extractedFields?.find((field) =>
      q.includes(field.label.toLowerCase().split(" ")[0])
    );
    if (match) return `${match.label}: ${match.value}.`;

    const storedSummary =
      (doc as any).aiSummary || (doc as any).usefulSummary?.keyFinding;
    if ((q.includes("summar") || q.includes("about") || q.includes("key")) && storedSummary) {
      return storedSummary;
    }

    return "No authoritative extracted answer is available for this question.";
  }

  async createDocument(data: Partial<DocumentRecord>): Promise<DocumentItem> {
    const record = await apiClient.postData<DocumentRecord>("/api/v1/documents", data);
    return mapRecordToDocumentItem(record);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await apiClient.deleteData<{ deleted: boolean; id: string }>(
      `/api/v1/documents/${id}`
    );
    return result.deleted === true && result.id === id;
  }
}

export const documentRepository = new ApiDocumentRepository();

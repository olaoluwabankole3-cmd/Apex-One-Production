import { DocumentItem } from "@/lib/types";
import { IntelDocument } from "@/lib/data/demo";
import { apiClient } from "@/lib/apiClient";
import { DocumentRecord } from "@/lib/backend/database/schema";

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

  return {
    id: d.id,
    name: d.name,
    fileType: fileTypeMap[d.fileType] || "pdf",
    category: categoryMap[d.category] || "Report",
    businessUnit: "Strategic Accounts",
    uploadedBy: d.uploadedBy,
    date: new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    size: d.size,
    pages: d.metadata?.pageCount || 1,
    status: d.status === "indexed" ? "processed" : "processing",
    usefulSummary: {
      keyFinding: d.aiSummary || "",
      obligations: [],
      risksDetail: [],
      datesDetail: [
        { event: "Record Created", date: new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }
      ],
      financialExposure: d.extractedFields?.find(f => f.label.toLowerCase().includes("exposure") || f.label.toLowerCase().includes("amount"))?.value || "Not available",
      recommendedAction: d.extractedFields?.find(f => f.label.toLowerCase().includes("action"))?.value || "Not available"
    },
    entities: {
      customers: d.tags || [],
      contracts: [],
      financialValues: d.extractedFields?.map(f => f.value) || [],
      risks: [],
      importantDates: [new Date(d.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })],
      actions: [],
      relatedDocs: [d.name]
    },
    relationships: {
      relatedCustomer: {
        name: d.tags?.[0] || d.customerId || "Unassigned",
        id: d.customerId || "none",
      },
      relatedContract: "None",
      relatedWorkflow: "None",
      relatedEmployee: d.uploadedBy || "System",
      relatedTransaction: "None",
      relatedDecision: "None",
    }
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
    aiSummary: intel.usefulSummary.keyFinding,
    extractedFields: [
      { label: "Financial Exposure", value: intel.usefulSummary.financialExposure },
      { label: "Recommended Action", value: intel.usefulSummary.recommendedAction }
    ],
    suggestedQuestions: [
      `What are the key obligations in ${d.name}?`,
      `What financial risks are outlined in this document?`,
      `When is the next renewal or audit date?`
    ]
  };
}

export class ApiDocumentRepository implements DocumentRepository {
  async getDocuments(organizationId?: string): Promise<DocumentItem[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: DocumentRecord[] }>("/api/v1/documents");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToDocumentItem);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch documents from API:", err);
      return [];
    }
  }

  async getIntelDocuments(organizationId?: string): Promise<IntelDocument[]> {
    try {
      const res = await apiClient.get<{ success: boolean; data: DocumentRecord[] }>("/api/v1/documents");
      if (res && Array.isArray(res.data)) {
        return res.data.map(mapRecordToIntelDocument);
      }
      return [];
    } catch (err) {
      console.error("Failed to fetch intel documents from API:", err);
      return [];
    }
  }

  async getDocument(id: string): Promise<IntelDocument | undefined> {
    try {
      const res = await apiClient.get<{ success: boolean; data: DocumentRecord }>(`/api/v1/documents/${id}`);
      if (res && res.data) {
        return mapRecordToIntelDocument(res.data);
      }
      return undefined;
    } catch (err) {
      console.error(`Failed to fetch document ${id} from API:`, err);
      const list = await this.getIntelDocuments();
      return list.find(d => d.id === id);
    }
  }

  async getDocumentAnswer(question: string, doc: DocumentItem | IntelDocument): Promise<string> {
    const q = question.toLowerCase();
    const extractedFields = (doc as any).extractedFields;
    const match = extractedFields?.find((f: any) => q.includes(f.label.toLowerCase().split(" ")[0]));
    if (match) {
      return `${match.label}: ${match.value}.`;
    }

    const aiSummary = (doc as any).aiSummary || (doc as any).usefulSummary?.keyFinding;

    if (q.includes("summar") || q.includes("about") || q.includes("key")) {
      return aiSummary || "This document outlines strategic operational benchmarks and obligations.";
    }

    if (q.includes("exposure") || q.includes("financial") || q.includes("risk")) {
      const exposure = (doc as any).usefulSummary?.financialExposure || extractedFields?.find((f: any) => f.label.toLowerCase().includes("exposure") || f.label.toLowerCase().includes("risk"))?.value;
      if (exposure) return `Financial Exposure: ${exposure}.`;
    }

    if (q.includes("action") || q.includes("recommend")) {
      const action = (doc as any).usefulSummary?.recommendedAction || extractedFields?.find((f: any) => f.label.toLowerCase().includes("action"))?.value;
      if (action) return `Recommended Action: ${action}.`;
    }

    return `Based on ${doc.name}, ${aiSummary || "this record contains operational verification and governance terms."}`;
  }

  async createDocument(data: Partial<DocumentRecord>): Promise<DocumentItem> {
    const res = await apiClient.post<{ success: boolean; data: DocumentRecord }>("/api/v1/documents", data);
    return mapRecordToDocumentItem(res.data);
  }

  async deleteDocument(id: string): Promise<boolean> {
    const res = await apiClient.delete<{ success: boolean }>(`/api/v1/documents/${id}`);
    return !!res?.success;
  }
}

export const documentRepository = new ApiDocumentRepository();


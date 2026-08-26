import { DocumentItem } from "@/lib/types";
import { demoDocuments, IntelDocument } from "@/lib/data/demo";

export interface DocumentRepository {
  getDocuments(organizationId?: string): Promise<DocumentItem[]>;
  getIntelDocuments(organizationId?: string): Promise<IntelDocument[]>;
  getDocument(id: string): Promise<IntelDocument | undefined>;
  getDocumentAnswer(question: string, doc: DocumentItem): Promise<string>;
}

export class MockDocumentRepository implements DocumentRepository {
  async getDocuments(_organizationId?: string): Promise<DocumentItem[]> {
    return demoDocuments.map(d => ({
      id: d.id,
      name: d.name,
      fileType: d.fileType,
      category: d.category as any,
      subsidiary: d.businessUnit,
      uploadedBy: d.uploadedBy,
      date: d.date,
      size: d.size,
      pages: d.pages,
      status: d.status,
      aiSummary: d.usefulSummary.keyFinding,
      extractedFields: [
        { label: "Financial Exposure", value: d.usefulSummary.financialExposure },
        { label: "Recommended Action", value: d.usefulSummary.recommendedAction }
      ],
      suggestedQuestions: [
        `What are the key obligations in ${d.name}?`,
        `What financial risks are outlined in this document?`,
        `When is the next renewal or audit date?`
      ]
    }));
  }

  async getIntelDocuments(_organizationId?: string): Promise<IntelDocument[]> {
    return demoDocuments;
  }

  async getDocument(id: string): Promise<IntelDocument | undefined> {
    return demoDocuments.find(d => d.id === id);
  }

  async getDocumentAnswer(question: string, doc: DocumentItem): Promise<string> {
    const q = question.toLowerCase();
    const match = doc.extractedFields?.find((f) => q.includes(f.label.toLowerCase().split(" ")[0]));
    if (match) {
      return `${match.label}: ${match.value}.`;
    }

    if (q.includes("summar") || q.includes("about") || q.includes("key")) {
      return doc.aiSummary || "This document outlines strategic operational benchmarks and obligations.";
    }

    if (q.includes("exposure") || q.includes("financial") || q.includes("risk")) {
      const field = doc.extractedFields?.find((f) => f.label.toLowerCase().includes("exposure") || f.label.toLowerCase().includes("risk"));
      if (field) return `${field.label}: ${field.value}.`;
    }

    if (q.includes("action") || q.includes("recommend")) {
      const field = doc.extractedFields?.find((f) => f.label.toLowerCase().includes("action"));
      if (field) return `${field.label}: ${field.value}.`;
    }

    return `Based on ${doc.name}, ${doc.aiSummary || "this record contains operational verification and governance terms."}`;
  }
}

export const documentRepository = new MockDocumentRepository();

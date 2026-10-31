/**
 * CORTEX — fail-closed document metadata and structured-field extraction.
 *
 * File category is not evidence of contractual, financial, or compliance
 * terms. Until a supported format-specific parser exists, binary document
 * content is never interpreted and no fields are fabricated.
 */
import type { DocumentExtractionField, DocumentRecord } from "../../database/schema";

export interface IDocumentExtractor {
  extractFields(doc: DocumentRecord, content?: string): Promise<{
    summary: string;
    fields: DocumentExtractionField[];
  }>;
}

const EXPLICIT_JSON_FIELDS = [
  { key: "currency", label: "Currency Code" },
  { key: "paymentTerms", label: "Payment Terms" },
  { key: "governingJurisdiction", label: "Governing Jurisdiction" },
  { key: "uptimeTarget", label: "Target Uptime SLA" },
  { key: "incidentResponse", label: "Critical Incident Response" },
] as const;

/**
 * Only allowlisted, explicitly supplied top-level JSON values are extracted.
 * They are source-derived but not independently verified. The 0 confidence
 * sentinel means "unassessed", never 0% probability of correctness.
 */
export class RuleBasedDocumentExtractor implements IDocumentExtractor {
  public async extractFields(doc: DocumentRecord, content?: string): Promise<{
    summary: string;
    fields: DocumentExtractionField[];
  }> {
    const unavailable = {
      summary: "Document metadata indexed only. No document-content terms were extracted or verified; contractual, financial and compliance assertions are unavailable.",
      fields: [] as DocumentExtractionField[],
    };

    // PDF, Office, image and CSV require real format parsers and source spans.
    // In particular, document category must never generate synthetic terms.
    if (doc.fileType !== "json" || !content) return unavailable;

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return unavailable;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return unavailable;
    const data = parsed as Record<string, unknown>;
    const fields: DocumentExtractionField[] = [];

    for (const { key, label } of EXPLICIT_JSON_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      const raw = data[key];
      if (typeof raw !== "string") continue;
      const value = raw.trim();
      if (!value || value.length > 200 || /[\x00-\x1f]/.test(value)) continue;
      if (key === "currency" && !/^[A-Z]{3}$/.test(value)) continue;

      fields.push({
        label,
        value,
        confidence: 0,
        sourceLocation: `$.${key}`,
      });
    }

    if (fields.length === 0) return unavailable;

    return {
      summary: `Extracted ${fields.length} explicitly supplied JSON field(s) with source paths. Values are unverified; no contractual, financial or compliance conclusion has been inferred.`,
      fields,
    };
  }
}

export const documentExtractor: IDocumentExtractor = new RuleBasedDocumentExtractor();

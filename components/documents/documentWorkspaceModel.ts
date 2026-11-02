import type { DocumentItem } from "@/lib/types";

/**
 * Read-only presentation helpers. These operate only on the documents already
 * returned by the authenticated, organization-scoped API.
 */
export type DocumentFilter = "all" | string;

export function documentEvidenceStatus(document: Pick<DocumentItem, "status">): {
  title: string;
  detail: string;
  trust: "unverified";
} {
  return document.status === "processed"
    ? {
        title: "Indexed",
        detail: "Stored information is available for inspection. Indexing does not verify the original source or the extracted content.",
        trust: "unverified",
      }
    : {
        title: "Processing",
        detail: "The service has not finished indexing this record. No extraction result should be assumed.",
        trust: "unverified",
      };
}

export function filterDocuments(
  documents: readonly DocumentItem[],
  query: string,
  category: DocumentFilter
): DocumentItem[] {
  const term = query.trim().toLocaleLowerCase();
  return documents.filter((document) => {
    if (category !== "all" && document.category !== category) return false;
    if (!term) return true;
    return [document.name, document.category, document.uploadedBy, document.subsidiary]
      .some((field) => typeof field === "string" && field.toLocaleLowerCase().includes(term));
  });
}

export function documentCategories(documents: readonly DocumentItem[]): string[] {
  return [...new Set(documents.map((document) => document.category).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

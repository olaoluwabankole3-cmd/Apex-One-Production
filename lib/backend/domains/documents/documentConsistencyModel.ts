import { ConflictError, ValidationError } from "../../core/errors";

export const DOCUMENT_CONSISTENCY_OPERATION_TYPES = [
  "process_document",
  "delete_search_index",
  "upload_cleanup",
  "delete_blob",
] as const;

export type DocumentConsistencyOperationType =
  (typeof DOCUMENT_CONSISTENCY_OPERATION_TYPES)[number];

export const DOCUMENT_CONSISTENCY_STATES = [
  "pending",
  "retry_required",
  "completed",
] as const;

export type DocumentConsistencyState =
  (typeof DOCUMENT_CONSISTENCY_STATES)[number];

export interface DocumentConsistencyOperation {
  id: string;
  documentId: string;
  operationType: DocumentConsistencyOperationType;
  state: DocumentConsistencyState;
  attempts: number;
  storageKey?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export function assertDocumentConsistencyTransition(
  current: DocumentConsistencyState,
  next: DocumentConsistencyState
): void {
  if (current === next) return;
  const allowed: Record<DocumentConsistencyState, readonly DocumentConsistencyState[]> = {
    pending: ["retry_required", "completed"],
    retry_required: ["retry_required", "completed"],
    completed: [],
  };
  if (!allowed[current].includes(next)) {
    throw new ConflictError(
      `Invalid document consistency transition '${current}' -> '${next}'`,
      { current, next }
    );
  }
}

export function normalizeDocumentConsistencyAttempts(attempts: unknown): number {
  if (attempts === undefined || attempts === null) return 0;
  if (!Number.isSafeInteger(attempts) || Number(attempts) < 0) {
    throw new ValidationError("Document consistency attempts must be a non-negative safe integer");
  }
  return Number(attempts);
}

export function nextDocumentConsistencyAttempt(current: number): number {
  const normalized = normalizeDocumentConsistencyAttempts(current);
  if (normalized >= Number.MAX_SAFE_INTEGER) {
    throw new ConflictError("Document consistency attempt counter is exhausted");
  }
  return normalized + 1;
}

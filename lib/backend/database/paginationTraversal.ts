/**
 * APEX ONE — Internal Cursor Traversal Helper
 *
 * This is NOT a second public pagination model. It is an internal service-layer
 * utility for calculations that genuinely require the complete tenant dataset.
 * Public collection APIs remain cursor-paginated.
 *
 * Safety rules:
 * - follows only canonical nextCursor values
 * - detects repeated cursors
 * - throws rather than silently truncating if a traversal bound is exceeded
 */

import type { PaginatedResult } from "./repository";
import { ValidationError } from "../core/errors";

export interface CollectAllPagesOptions {
  maxPages?: number;
}

export async function collectAllPages<T>(
  fetchPage: (cursor: string | null) => Promise<PaginatedResult<T>>,
  options: CollectAllPagesOptions = {}
): Promise<T[]> {
  const maxPages = options.maxPages ?? 10_000;
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new ValidationError("maxPages must be a positive integer");
  }

  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
    const page = await fetchPage(cursor);
    items.push(...page.items);

    if (!page.hasMore) {
      if (page.nextCursor !== null) {
        throw new ValidationError("Pagination contract violation: exhausted page exposed a next cursor");
      }
      return items;
    }

    if (!page.nextCursor) {
      throw new ValidationError("Pagination contract violation: hasMore=true without a next cursor");
    }
    if (seenCursors.has(page.nextCursor)) {
      throw new ValidationError("Pagination contract violation: repeated cursor detected");
    }

    seenCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  throw new ValidationError("Pagination traversal exceeded the configured page safety bound");
}

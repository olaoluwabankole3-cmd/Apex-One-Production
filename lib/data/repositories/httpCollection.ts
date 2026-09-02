import {
  ApiClientContractError,
  ApiClientError,
  apiClient,
} from "@/lib/apiClient";
import { MAX_PAGE_SIZE } from "@/lib/contracts/http";

const MAX_FRONTEND_PAGE_TRAVERSAL = 1000;

function buildPageEndpoint(endpoint: string, cursor: string | null): string {
  const [pathname, rawQuery = ""] = endpoint.split("?", 2);
  const params = new URLSearchParams(rawQuery);
  params.set("limit", String(MAX_PAGE_SIZE));

  if (cursor) {
    params.set("cursor", cursor);
  } else {
    params.delete("cursor");
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Traverse a canonical cursor collection for UI projections that intentionally
 * require the complete tenant dataset (for example dashboard aggregates).
 *
 * Public paginated screens should use apiClient.getCollection() directly
 * rather than calling this helper.
 */
export async function collectAllCollectionData<T>(endpoint: string): Promise<T[]> {
  const items: T[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let pageIndex = 0; pageIndex < MAX_FRONTEND_PAGE_TRAVERSAL; pageIndex += 1) {
    const pageEndpoint = buildPageEndpoint(endpoint, cursor);
    const page = await apiClient.getCollection<T>(pageEndpoint);
    items.push(...page.data);

    if (!page.pagination.hasMore) {
      return items;
    }

    const nextCursor = page.pagination.nextCursor;
    if (!nextCursor) {
      throw new ApiClientContractError(
        "Collection response reported hasMore=true without nextCursor",
        pageEndpoint,
        "GET",
        page.requestId
      );
    }

    if (seenCursors.has(nextCursor)) {
      throw new ApiClientContractError(
        "Collection response repeated a cursor during traversal",
        pageEndpoint,
        "GET",
        page.requestId
      );
    }

    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw new ApiClientContractError(
    "Collection traversal exceeded the maximum safe page count",
    endpoint,
    "GET"
  );
}

export function isApiNotFound(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 404 || error.code === "NOT_FOUND")
  );
}

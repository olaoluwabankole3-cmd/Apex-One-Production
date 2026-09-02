/**
 * APEX ONE — Frontend API Client
 *
 * Centralized same-origin HTTP client for the canonical Stage 3 contract.
 *
 * Rules:
 * - Browser-managed HttpOnly cookies remain the only authentication transport.
 * - 401 responses notify authenticated-session listeners but are never retried.
 * - Canonical backend error metadata is preserved in ApiClientError.
 * - Raw request helpers remain available for compatibility during Stage 3F.
 * - Typed data/collection helpers validate canonical success envelopes before
 *   exposing them to frontend consumers.
 */

import type {
  ApiCollectionResponse,
  ApiErrorBody,
  ApiErrorResponse,
  ApiSuccessResponse,
  PaginationMetadata,
} from "./contracts/http";
import { publishFrontendApiFailure } from "./frontendApiFailure";

type UnauthorizedListener = () => void;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPaginationMetadata(value: unknown): value is PaginationMetadata {
  if (!isRecord(value)) return false;

  const nextCursorValid =
    value.nextCursor === null || typeof value.nextCursor === "string";
  const hasMoreValid = typeof value.hasMore === "boolean";
  const countValid =
    typeof value.count === "number" &&
    Number.isSafeInteger(value.count) &&
    value.count >= 0;
  const totalCountValid =
    value.totalCount === undefined ||
    (typeof value.totalCount === "number" &&
      Number.isSafeInteger(value.totalCount) &&
      value.totalCount >= 0);

  return nextCursorValid && hasMoreValid && countValid && totalCountValid;
}

function isCanonicalErrorBody(value: unknown): value is ApiErrorBody {
  if (!isRecord(value)) return false;

  return (
    typeof value.code === "string" &&
    value.code.length > 0 &&
    typeof value.message === "string" &&
    value.message.length > 0 &&
    typeof value.status === "number" &&
    Number.isSafeInteger(value.status) &&
    value.status >= 400 &&
    value.status <= 599 &&
    (value.requestId === undefined || typeof value.requestId === "string")
  );
}

function isCanonicalErrorResponse(value: unknown): value is ApiErrorResponse {
  return (
    isRecord(value) &&
    value.success === false &&
    isCanonicalErrorBody(value.error)
  );
}

function isCanonicalSuccessResponse<T>(value: unknown): value is ApiSuccessResponse<T> {
  return (
    isRecord(value) &&
    value.success === true &&
    Object.prototype.hasOwnProperty.call(value, "data") &&
    (value.requestId === undefined || typeof value.requestId === "string")
  );
}

function isCanonicalCollectionResponse<T>(
  value: unknown
): value is ApiCollectionResponse<T> {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.data) &&
    isPaginationMetadata(value.pagination) &&
    (value.requestId === undefined || typeof value.requestId === "string")
  );
}

function extractFallbackMessage(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;

  if (typeof value.error === "string" && value.error.trim().length > 0) {
    return value.error;
  }

  if (typeof value.message === "string" && value.message.trim().length > 0) {
    return value.message;
  }

  return undefined;
}

export class ApiClientError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;
  public readonly requestId?: string;
  public readonly endpoint: string;
  public readonly method: string;

  constructor(
    error: ApiErrorBody,
    endpoint: string,
    method: string
  ) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
    this.requestId = error.requestId;
    this.endpoint = endpoint;
    this.method = method;
  }
}

export class ApiClientContractError extends Error {
  public readonly code = "INVALID_RESPONSE_CONTRACT";
  public readonly endpoint: string;
  public readonly method: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    endpoint: string,
    method: string,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiClientContractError";
    this.endpoint = endpoint;
    this.method = method;
    this.requestId = requestId;
  }
}

export class ApiClient {
  private unauthorizedListeners: Set<UnauthorizedListener> = new Set();

  /**
   * Subscribe to 401 Unauthorized events from backend requests.
   */
  public onUnauthorized(listener: UnauthorizedListener): () => void {
    this.unauthorizedListeners.add(listener);
    return () => {
      this.unauthorizedListeners.delete(listener);
    };
  }

  private notifyUnauthorized(): void {
    for (const listener of this.unauthorizedListeners) {
      try {
        listener();
      } catch (error) {
        console.error("Error in unauthorized listener:", error);
      }
    }
  }

  private publishFailure(error: ApiClientError | ApiClientContractError): void {
    if (
      error instanceof ApiClientError &&
      (error.status === 401 || (error.status === 404 && error.method === "GET"))
    ) {
      return;
    }

    publishFrontendApiFailure({
      code: error.code,
      message: error.message,
      ...(error instanceof ApiClientError ? { status: error.status } : {}),
      ...(error.requestId ? { requestId: error.requestId } : {}),
      endpoint: error.endpoint,
      method: error.method,
    });
  }

  private async readResponseBody(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.toLowerCase().includes("application/json")) {
      const text = await response.text().catch(() => "");
      return text.length > 0 ? { message: text } : undefined;
    }

    return response.json().catch(() => undefined);
  }

  private buildHttpError(
    response: Response,
    body: unknown,
    endpoint: string,
    method: string
  ): ApiClientError {
    if (isCanonicalErrorResponse(body)) {
      return new ApiClientError(body.error, endpoint, method);
    }

    const message =
      extractFallbackMessage(body) ||
      `Request failed with status ${response.status}`;

    return new ApiClientError(
      {
        code: `HTTP_${response.status}`,
        message,
        status: response.status,
      },
      endpoint,
      method
    );
  }

  /**
   * Perform an API request with same-origin credentials (HttpOnly cookie).
   *
   * This is the compatibility/raw transport primitive. It preserves the
   * response body shape on success while converting failed HTTP responses into
   * ApiClientError without discarding canonical backend metadata.
   */
  public async request<TResponse = unknown>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<TResponse> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");

    if (
      init.body &&
      typeof init.body === "string" &&
      !headers.has("Content-Type")
    ) {
      headers.set("Content-Type", "application/json");
    }

    const method = (init.method || "GET").toUpperCase();
    const response = await fetch(endpoint, {
      ...init,
      headers,
      credentials: "same-origin",
    });
    const body = await this.readResponseBody(response);

    if (response.status === 401) {
      this.notifyUnauthorized();
    }

    if (!response.ok) {
      const error = this.buildHttpError(response, body, endpoint, method);
      this.publishFailure(error);
      throw error;
    }

    return body as TResponse;
  }

  /**
   * Require the canonical entity/single-result success envelope and return data.
   */
  public async requestData<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const method = (init.method || "GET").toUpperCase();
    const payload = await this.request<unknown>(endpoint, init);

    if (!isCanonicalSuccessResponse<T>(payload)) {
      const requestId =
        isRecord(payload) && typeof payload.requestId === "string"
          ? payload.requestId
          : undefined;
      const error = new ApiClientContractError(
        "API server returned an invalid canonical success response",
        endpoint,
        method,
        requestId
      );
      this.publishFailure(error);
      throw error;
    }

    return payload.data;
  }

  /**
   * Require the canonical collection envelope and preserve pagination metadata.
   */
  public async requestCollection<T>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<ApiCollectionResponse<T>> {
    const method = (init.method || "GET").toUpperCase();
    const payload = await this.request<unknown>(endpoint, init);

    if (!isCanonicalCollectionResponse<T>(payload)) {
      const requestId =
        isRecord(payload) && typeof payload.requestId === "string"
          ? payload.requestId
          : undefined;
      const error = new ApiClientContractError(
        "API server returned an invalid canonical collection response",
        endpoint,
        method,
        requestId
      );
      this.publishFailure(error);
      throw error;
    }

    return payload;
  }

  public async get<TResponse = unknown>(
    endpoint: string,
    headers?: HeadersInit
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { method: "GET", headers });
  }

  public async post<TResponse = unknown>(
    endpoint: string,
    body?: unknown,
    headers?: HeadersInit
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public async put<TResponse = unknown>(
    endpoint: string,
    body?: unknown,
    headers?: HeadersInit
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public async delete<TResponse = unknown>(
    endpoint: string,
    headers?: HeadersInit
  ): Promise<TResponse> {
    return this.request<TResponse>(endpoint, { method: "DELETE", headers });
  }

  public async getData<T>(endpoint: string, headers?: HeadersInit): Promise<T> {
    return this.requestData<T>(endpoint, { method: "GET", headers });
  }

  public async postData<T>(
    endpoint: string,
    body?: unknown,
    headers?: HeadersInit
  ): Promise<T> {
    return this.requestData<T>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public async putData<T>(
    endpoint: string,
    body?: unknown,
    headers?: HeadersInit
  ): Promise<T> {
    return this.requestData<T>(endpoint, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public async deleteData<T>(
    endpoint: string,
    headers?: HeadersInit
  ): Promise<T> {
    return this.requestData<T>(endpoint, { method: "DELETE", headers });
  }

  public async getCollection<T>(
    endpoint: string,
    headers?: HeadersInit
  ): Promise<ApiCollectionResponse<T>> {
    return this.requestCollection<T>(endpoint, { method: "GET", headers });
  }
}

export const apiClient = new ApiClient();

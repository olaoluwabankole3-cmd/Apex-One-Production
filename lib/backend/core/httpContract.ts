/**
 * APEX ONE — Canonical HTTP Response Serialization
 *
 * Pure response helpers. Next.js routes adapt these values into NextResponse;
 * clients consume the same shared contract types from lib/contracts/http.ts.
 */

import type {
  ApiErrorResponse,
  ApiSuccessResponse,
} from "../../contracts/http";
import { BackendError } from "./errors";

export interface SerializedApiError {
  status: number;
  body: ApiErrorResponse;
}

export function toApiSuccessResponse<T>(
  data: T,
  requestId?: string
): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    ...(requestId ? { requestId } : {}),
  };
}

export function serializeApiError(
  error: unknown,
  requestId?: string
): SerializedApiError {
  if (error instanceof BackendError) {
    return {
      status: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          status: error.statusCode,
          ...(error.details !== undefined ? { details: error.details } : {}),
          ...(requestId ? { requestId } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected server error occurred",
        status: 500,
        ...(requestId ? { requestId } : {}),
      },
    },
  };
}

export const FRONTEND_API_FAILURE_EVENT = "apex:api-failure";

export interface FrontendApiFailureDetail {
  code: string;
  message: string;
  status?: number;
  requestId?: string;
  endpoint: string;
  method: string;
}

export function publishFrontendApiFailure(detail: FrontendApiFailureDetail): void {
  if (typeof window === "undefined" || typeof CustomEvent === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<FrontendApiFailureDetail>(FRONTEND_API_FAILURE_EVENT, {
      detail,
    })
  );
}

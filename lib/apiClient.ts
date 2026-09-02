/**
 * APEX ONE — Frontend API Client
 *
 * Centralized HTTP client ensuring same-origin cookie propagation
 * and automatic 401 unauthenticated session handling.
 */

type UnauthorizedListener = () => void;

class ApiClient {
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

  private notifyUnauthorized() {
    for (const listener of this.unauthorizedListeners) {
      try {
        listener();
      } catch (err) {
        console.error("Error in unauthorized listener:", err);
      }
    }
  }

  /**
   * Perform an API request with same-origin credentials (HttpOnly cookie).
   */
  public async request<T = any>(
    endpoint: string,
    init: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...((init.headers as Record<string, string>) || {}),
    };

    if (init.body && typeof init.body === "string" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(endpoint, {
      ...init,
      headers,
      credentials: "same-origin",
    });

    if (response.status === 401) {
      this.notifyUnauthorized();
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Authentication required: Session expired or invalid");
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  public async get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "GET", headers });
  }

  public async post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public async put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  public async delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: "DELETE", headers });
  }
}

export const apiClient = new ApiClient();

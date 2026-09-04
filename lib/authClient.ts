/**
 * APEX ONE — Frontend Authentication Client
 *
 * Secure HttpOnly-cookie session compatibility.
 * The browser never stores, reads, or parses the session credential.
 */

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface SafeOrganization {
  id: string;
  name: string;
}

export interface AuthSessionMetadata {
  success: true;
  user: SafeUser;
  organization: SafeOrganization;
  availableOrganizations: SafeOrganization[];
  expiresAt: string | null;
  requiresPasswordChange: boolean;
}

export interface LoginCredentials {
  identifier: string;
  password: string;
  organizationId?: string;
}

export class AuthClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AuthClientError";
  }
}

function buildAuthError(
  data: any,
  status: number,
  fallback: string
): AuthClientError {
  const message =
    typeof data?.error === "string" && data.error.trim().length > 0
      ? data.error
      : fallback;
  const code =
    typeof data?.code === "string" && data.code.trim().length > 0
      ? data.code
      : undefined;
  return new AuthClientError(message, status, code);
}

export class AuthClient {
  private parseSessionMetadata(data: any): AuthSessionMetadata | null {
    if (
      !data ||
      data.success !== true ||
      !data.user ||
      typeof data.user.id !== "string" ||
      typeof data.user.email !== "string" ||
      typeof data.user.name !== "string" ||
      typeof data.user.role !== "string" ||
      !Array.isArray(data.user.permissions) ||
      !data.user.permissions.every(
        (permission: unknown) => typeof permission === "string"
      ) ||
      !data.organization ||
      typeof data.organization.id !== "string" ||
      typeof data.organization.name !== "string" ||
      !Array.isArray(data.availableOrganizations)
    ) {
      return null;
    }

    const availableOrganizations: SafeOrganization[] = [];
    const seen = new Set<string>();

    for (const organization of data.availableOrganizations) {
      if (
        !organization ||
        typeof organization.id !== "string" ||
        typeof organization.name !== "string"
      ) {
        return null;
      }

      const id = organization.id.trim();
      const name = organization.name.trim();
      if (!id || !name) return null;
      if (seen.has(id)) continue;
      seen.add(id);
      availableOrganizations.push({ id, name });
    }

    const activeOrganization: SafeOrganization = {
      id: data.organization.id.trim(),
      name: data.organization.name.trim(),
    };

    if (!activeOrganization.id || !activeOrganization.name) {
      return null;
    }

    if (!seen.has(activeOrganization.id)) {
      availableOrganizations.push(activeOrganization);
    }

    const expiresAt =
      typeof data.expiresAt === "string" && data.expiresAt.trim().length > 0
        ? data.expiresAt
        : null;

    return {
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        role: data.user.role,
        permissions: [...data.user.permissions],
      },
      organization: activeOrganization,
      availableOrganizations,
      expiresAt,
      requiresPasswordChange: data.requiresPasswordChange === true,
    };
  }

  public async login(
    credentials: LoginCredentials
  ): Promise<AuthSessionMetadata> {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        identifier: credentials.identifier.trim(),
        password: credentials.password,
        organizationId: credentials.organizationId,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildAuthError(
        data,
        response.status,
        `Login failed with status ${response.status}`
      );
    }

    const session = this.parseSessionMetadata(data);
    if (!session) {
      throw new AuthClientError(
        "Authentication server returned an invalid session contract",
        502,
        "INVALID_SESSION_CONTRACT"
      );
    }
    return session;
  }

  public async getCurrentSession(): Promise<AuthSessionMetadata | null> {
    const response = await fetch("/api/v1/auth/me", {
      method: "GET",
      credentials: "same-origin",
    });

    if (response.status === 401 || response.status === 403) {
      return null;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildAuthError(
        data,
        response.status,
        `Session verification failed (${response.status})`
      );
    }

    const session = this.parseSessionMetadata(data);
    if (!session) {
      throw new AuthClientError(
        "Authentication server returned an invalid session contract",
        502,
        "INVALID_SESSION_CONTRACT"
      );
    }
    return session;
  }

  public async switchOrganization(
    targetOrganizationId: string
  ): Promise<AuthSessionMetadata> {
    const response = await fetch("/api/v1/auth/switch-organization", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ targetOrganizationId }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildAuthError(
        data,
        response.status,
        `Failed to switch organization (${response.status})`
      );
    }

    const session = this.parseSessionMetadata(data);
    if (!session) {
      throw new AuthClientError(
        "Authentication server returned an invalid session contract",
        502,
        "INVALID_SESSION_CONTRACT"
      );
    }
    return session;
  }

  public async logout(): Promise<boolean> {
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw buildAuthError(
        data,
        response.status,
        `Failed to change password (${response.status})`
      );
    }

    return {
      success: true,
      message:
        typeof data.message === "string" && data.message.trim().length > 0
          ? data.message
          : "Password updated successfully",
    };
  }
}

export const authClient = new AuthClient();

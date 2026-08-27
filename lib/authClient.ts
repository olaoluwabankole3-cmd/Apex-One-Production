/**
 * APEX ONE — Frontend Authentication Client
 *
 * Implements secure HttpOnly cookie-based session compatibility.
 * 
 * Rules:
 * 1. The frontend NEVER stores session tokens in localStorage, sessionStorage, or JavaScript variables.
 * 2. The frontend NEVER attempts to read or parse the `apex_session` HttpOnly cookie.
 * 3. All session state is maintained and validated server-side.
 * 4. API requests rely entirely on browser-managed same-origin cookies.
 * 5. Frontend state contains ONLY safe non-sensitive metadata (user info, roles, UI permission hints).
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
  success: boolean;
  user: SafeUser;
  organization: SafeOrganization;
  availableOrganizations?: SafeOrganization[];
  expiresAt: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  organizationId?: string;
}

export class AuthClient {
  /**
   * Authenticate user with credentials.
   * Backend sets the secure HttpOnly `apex_session` cookie.
   * Response contains ONLY sanitized metadata — NO raw session tokens.
   */
  public async login(credentials: LoginCredentials): Promise<AuthSessionMetadata> {
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
        organizationId: credentials.organizationId,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Login failed with status ${response.status}`);
    }

    return {
      success: true,
      user: data.user,
      organization: data.organization,
      availableOrganizations: data.availableOrganizations || [],
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Retrieve current authenticated session metadata from the server-managed cookie.
   * Returns null if unauthenticated or session is expired/invalid.
   */
  public async getCurrentSession(): Promise<AuthSessionMetadata | null> {
    try {
      const response = await fetch("/api/v1/auth/me", {
        method: "GET",
        credentials: "same-origin",
      });

      if (response.status === 401 || response.status === 403) {
        return null;
      }

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data || !data.user) {
        return null;
      }

      return {
        success: true,
        user: data.user,
        organization: data.organization,
        availableOrganizations: data.availableOrganizations || [],
        expiresAt: data.expiresAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Switch active organization for the current authenticated user.
   * Backend verifies membership, issues a new tenant-scoped session, and updates the cookie.
   */
  public async switchOrganization(targetOrganizationId: string): Promise<AuthSessionMetadata> {
    const response = await fetch("/api/v1/auth/switch-organization", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        targetOrganizationId,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Failed to switch organization (${response.status})`);
    }

    return {
      success: true,
      user: data.user,
      organization: data.organization,
      availableOrganizations: data.availableOrganizations || [],
      expiresAt: data.expiresAt,
    };
  }

  /**
   * Log out the current session.
   * Backend revokes session in store and clears the HttpOnly cookie.
   */
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

  /**
   * Change user password.
   * Backend verifies current password, updates hash, and revokes other active sessions.
   */
  public async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch("/api/v1/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || `Failed to change password (${response.status})`);
    }

    return {
      success: true,
      message: data.message || "Password updated successfully",
    };
  }
}

export const authClient = new AuthClient();

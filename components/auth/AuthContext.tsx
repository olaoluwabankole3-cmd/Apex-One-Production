"use client";

/**
 * APEX ONE — Authentication Context Provider
 *
 * Provides safe frontend authentication state to UI components.
 *
 * Guarantees:
 * - NO raw session tokens stored or manipulated in JavaScript.
 * - Authenticated state hydrated via server /api/v1/auth/me using HttpOnly cookies.
 * - Automatic state reset on 401 Unauthorized responses.
 * - Login, refresh, organization switch, logout, password change, and expiry converge on one session shape.
 * - Permissions are UX rendering hints only; backend remains the security boundary.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  authClient,
  AuthSessionMetadata,
  SafeUser,
  SafeOrganization,
  LoginCredentials,
} from "@/lib/authClient";
import { apiClient } from "@/lib/apiClient";

interface AuthContextValue {
  user: SafeUser | null;
  organization: SafeOrganization | null;
  availableOrganizations: SafeOrganization[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string>;
  switchOrganization: (targetOrgId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [organization, setOrganization] = useState<SafeOrganization | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<
    SafeOrganization[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const clearSessionState = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setAvailableOrganizations([]);
  }, []);

  const applySessionState = useCallback((session: AuthSessionMetadata) => {
    setUser(session.user);
    setOrganization(session.organization);
    setAvailableOrganizations(session.availableOrganizations);
  }, []);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await authClient.getCurrentSession();

      if (session) {
        applySessionState(session);
      } else {
        clearSessionState();
      }
    } catch (err: any) {
      clearSessionState();
      setError(err?.message || "Unable to verify authenticated session");
    } finally {
      setIsLoading(false);
    }
  }, [applySessionState, clearSessionState]);

  useEffect(() => {
    refreshSession();

    const unsubscribe = apiClient.onUnauthorized(() => {
      clearSessionState();
      setError(null);
      setIsLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [clearSessionState, refreshSession]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await authClient.login(credentials);
      applySessionState(session);
    } catch (err: any) {
      clearSessionState();
      setError(err.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const confirmed = await authClient.logout();
      if (!confirmed) {
        setError("Logout could not be confirmed by the server");
      }
    } finally {
      clearSessionState();
      setIsLoading(false);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<string> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.changePassword(currentPassword, newPassword);

      // This context exposes the self-service password-change flow only. A
      // successful change revokes this user's backend sessions and clears the
      // HttpOnly cookie, so frontend identity must be cleared immediately too.
      clearSessionState();
      return result.message;
    } catch (err: any) {
      // A request can fail ambiguously after the server has already committed
      // the password change. Re-read /auth/me so the UI converges on the actual
      // browser cookie/session state rather than keeping stale authenticated data.
      try {
        const currentSession = await authClient.getCurrentSession();
        if (currentSession) {
          applySessionState(currentSession);
        } else {
          clearSessionState();
        }
      } catch {
        clearSessionState();
      }

      setError(err?.message || "Failed to change password");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const switchOrganization = async (targetOrgId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const session = await authClient.switchOrganization(targetOrgId);
      applySessionState(session);
    } catch (err: any) {
      setError(err.message || "Failed to switch organization");

      try {
        const currentSession = await authClient.getCurrentSession();
        if (currentSession) {
          applySessionState(currentSession);
        } else {
          clearSessionState();
        }
      } catch {
        clearSessionState();
      }

      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!user || !user.permissions) return false;
    return user.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        organization,
        availableOrganizations,
        isAuthenticated: !!user && !!organization,
        isLoading,
        error,
        login,
        logout,
        changePassword,
        switchOrganization,
        refreshSession,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

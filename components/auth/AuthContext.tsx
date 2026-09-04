"use client";

/**
 * APEX ONE — Authentication Context
 *
 * Security authority remains server-side. This provider only projects safe
 * session metadata and drives UX state around the HttpOnly-cookie session.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  authClient,
  type AuthSessionMetadata,
  type SafeUser,
  type SafeOrganization,
  type LoginCredentials,
} from "@/lib/authClient";
import { apiClient } from "@/lib/apiClient";

export type AuthNotice =
  | "session_expired"
  | "signed_out"
  | "password_changed"
  | null;

interface AuthContextValue {
  user: SafeUser | null;
  organization: SafeOrganization | null;
  availableOrganizations: SafeOrganization[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  requiresPasswordChange: boolean;
  organizationSelectionRequired: boolean;
  notice: AuthNotice;
  login: (credentials: LoginCredentials) => Promise<AuthSessionMetadata>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<string>;
  switchOrganization: (
    targetOrgId: string
  ) => Promise<AuthSessionMetadata>;
  confirmOrganizationSelection: () => void;
  refreshSession: () => Promise<void>;
  dismissNotice: () => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [organization, setOrganization] =
    useState<SafeOrganization | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<
    SafeOrganization[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);
  const [organizationSelectionRequired, setOrganizationSelectionRequired] =
    useState(false);
  const [notice, setNotice] = useState<AuthNotice>(null);
  const authenticatedRef = useRef(false);

  useEffect(() => {
    authenticatedRef.current = Boolean(user && organization);
  }, [user, organization]);

  const clearSessionState = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setAvailableOrganizations([]);
    setRequiresPasswordChange(false);
    setOrganizationSelectionRequired(false);
  }, []);

  const applySessionState = useCallback(
    (
      session: AuthSessionMetadata,
      options?: { requireOrganizationSelection?: boolean }
    ) => {
      setUser(session.user);
      setOrganization(session.organization);
      setAvailableOrganizations(session.availableOrganizations);
      setRequiresPasswordChange(session.requiresPasswordChange);
      setOrganizationSelectionRequired(
        options?.requireOrganizationSelection === true &&
          session.availableOrganizations.length > 1
      );
    },
    []
  );

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
      const hadAuthenticatedSession = authenticatedRef.current;
      clearSessionState();
      setError(null);
      setIsLoading(false);
      if (hadAuthenticatedSession) {
        setNotice("session_expired");
      }
    });

    return () => unsubscribe();
  }, [clearSessionState, refreshSession]);

  const login = async (
    credentials: LoginCredentials
  ): Promise<AuthSessionMetadata> => {
    setIsLoading(true);
    setError(null);
    setNotice(null);
    try {
      const session = await authClient.login(credentials);
      applySessionState(session, { requireOrganizationSelection: true });
      return session;
    } catch (err: any) {
      clearSessionState();
      setError(err?.message || "Login failed");
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
      setNotice("signed_out");
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
      const result = await authClient.changePassword(
        currentPassword,
        newPassword
      );
      clearSessionState();
      setNotice("password_changed");
      return result.message;
    } catch (err: any) {
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

  const switchOrganization = async (
    targetOrgId: string
  ): Promise<AuthSessionMetadata> => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await authClient.switchOrganization(targetOrgId);
      applySessionState(session);
      setOrganizationSelectionRequired(false);
      return session;
    } catch (err: any) {
      setError(err?.message || "Failed to switch organization");
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

  const confirmOrganizationSelection = () => {
    setOrganizationSelectionRequired(false);
  };

  const dismissNotice = () => setNotice(null);

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
        isAuthenticated: Boolean(user && organization),
        isLoading,
        error,
        requiresPasswordChange,
        organizationSelectionRequired,
        notice,
        login,
        logout,
        changePassword,
        switchOrganization,
        confirmOrganizationSelection,
        refreshSession,
        dismissNotice,
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

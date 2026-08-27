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
 * - Permissions used strictly as UX rendering hints; backend remains the sole security boundary.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authClient, SafeUser, SafeOrganization, LoginCredentials } from "@/lib/authClient";
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
  switchOrganization: (targetOrgId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [organization, setOrganization] = useState<SafeOrganization | null>(null);
  const [availableOrganizations, setAvailableOrganizations] = useState<SafeOrganization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Hydrate session from server HttpOnly cookie on initial mount
  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const session = await authClient.getCurrentSession();
      if (session && session.user) {
        setUser(session.user);
        setOrganization(session.organization);
        setAvailableOrganizations(session.availableOrganizations || []);
      } else {
        setUser(null);
        setOrganization(null);
        setAvailableOrganizations([]);
      }
    } catch (err: any) {
      setUser(null);
      setOrganization(null);
      setAvailableOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();

    // Subscribe to global 401 Unauthorized events from apiClient
    const unsubscribe = apiClient.onUnauthorized(() => {
      setUser(null);
      setOrganization(null);
      setAvailableOrganizations([]);
    });

    return () => {
      unsubscribe();
    };
  }, [refreshSession]);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authClient.login(credentials);
      setUser(result.user);
      setOrganization(result.organization);
      setAvailableOrganizations(result.availableOrganizations || []);
    } catch (err: any) {
      setError(err.message || "Login failed");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authClient.logout();
    } finally {
      setUser(null);
      setOrganization(null);
      setAvailableOrganizations([]);
      setIsLoading(false);
    }
  };

  const switchOrganization = async (targetOrgId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await authClient.switchOrganization(targetOrgId);
      setUser(result.user);
      setOrganization(result.organization);
      setAvailableOrganizations(result.availableOrganizations || []);
    } catch (err: any) {
      setError(err.message || "Failed to switch organization");
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Helper to inspect if current safe user has a UI capability hint.
   * NOTE: This is strictly for rendering UX (e.g. disabling buttons).
   * Backend remains the sole security and authorization boundary.
   */
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
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        logout,
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

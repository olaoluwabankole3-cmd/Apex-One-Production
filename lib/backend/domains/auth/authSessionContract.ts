/**
 * APEX ONE — Canonical Authenticated Session Metadata Contract
 *
 * This DTO is the ONLY safe frontend representation of an authenticated session.
 * Raw tokens, password material, and per-organization role claims are deliberately
 * excluded from the payload.
 */

import type { AuthSession } from "../../core/security";

export interface SafeAuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface SafeAuthOrganization {
  id: string;
  name: string;
}

export interface AuthSessionMetadataDto {
  user: SafeAuthUser;
  organization: SafeAuthOrganization;
  availableOrganizations: SafeAuthOrganization[];
  expiresAt: string | null;
  requiresPasswordChange: boolean;
}

export function sanitizeAvailableOrganizations(
  organizations: ReadonlyArray<{ id: string; name: string }>
): SafeAuthOrganization[] {
  const seen = new Set<string>();
  const result: SafeAuthOrganization[] = [];

  for (const organization of organizations) {
    if (
      !organization ||
      typeof organization.id !== "string" ||
      organization.id.trim().length === 0 ||
      typeof organization.name !== "string" ||
      organization.name.trim().length === 0
    ) {
      continue;
    }

    const id = organization.id.trim();
    if (seen.has(id)) continue;
    seen.add(id);

    result.push({
      id,
      name: organization.name.trim(),
    });
  }

  return result;
}

export function buildAuthSessionMetadata(
  session: AuthSession,
  availableOrganizations: ReadonlyArray<{ id: string; name: string }>,
  requiresPasswordChange: boolean = false
): AuthSessionMetadataDto {
  const organizations = sanitizeAvailableOrganizations([
    ...availableOrganizations,
    {
      id: session.organizationId,
      name: session.organizationName,
    },
  ]);

  return {
    user: {
      id: session.userId,
      email: session.userEmail,
      name: session.userName,
      role: session.role,
      permissions: [...session.permissions],
    },
    organization: {
      id: session.organizationId,
      name: session.organizationName,
    },
    availableOrganizations: organizations,
    expiresAt: session.expiresAt || null,
    requiresPasswordChange,
  };
}

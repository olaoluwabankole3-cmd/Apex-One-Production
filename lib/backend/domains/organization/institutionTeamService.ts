import type { DatabaseStore } from "../../database/store";
import type { TenantContext } from "../../core/errors";
import {
  ForbiddenError,
  getPermissionsForRole,
  isApplicationRole,
  requirePermission,
} from "../../core/security";

/**
 * Admin-only safe directory data. No password hashes, credentials, session
 * tokens, cross-tenant memberships, or private identity fields are returned.
 */
export interface InstitutionTeamMember {
  name: string;
  email: string;
  role: string;
  status: "active" | "suspended" | "disabled" | "pending";
}

export interface InstitutionTeamSnapshot {
  members: InstitutionTeamMember[];
  hasMore: boolean;
}

type InstitutionTeamReadStore = Pick<
  DatabaseStore,
  "findUserMembership" | "findMembershipsForOrganization" | "findUserById"
>;

export async function listInstitutionTeam(
  ctx: TenantContext,
  database: InstitutionTeamReadStore
): Promise<InstitutionTeamSnapshot> {
  requirePermission(ctx, "org:admin");

  // Recheck the current membership rather than relying solely on a session
  // that could have been issued before an administrator was demoted.
  const activeMembership = await database.findUserMembership(
    ctx.userId, ctx.organizationId
  );
  if (
    !activeMembership ||
    !isApplicationRole(activeMembership.role) ||
    !getPermissionsForRole(activeMembership.role).includes("org:admin")
  ) {
    throw new ForbiddenError("Institution administration access is no longer available");
  }

  const currentUser = await database.findUserById(ctx.userId);
  if (!currentUser || currentUser.status !== "active") {
    throw new ForbiddenError("Institution administrator account is no longer active");
  }

  const memberships = await database.findMembershipsForOrganization(ctx.organizationId);
  const scoped = memberships
    .filter((membership) => membership.organizationId === ctx.organizationId)
    .slice(0, 101);

  const members = await Promise.all(scoped.slice(0, 100).map(async (membership) => {
    const user = await database.findUserById(membership.userId);
    if (!user) return null;
    return {
      name: user.name || user.email,
      email: user.email,
      role: membership.role,
      status: user.status,
    } satisfies InstitutionTeamMember;
  }));

  return {
    members: members.filter((member): member is InstitutionTeamMember => member !== null),
    hasMore: scoped.length > 100,
  };
}

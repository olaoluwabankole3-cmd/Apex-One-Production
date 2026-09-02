import { ConflictError, InvalidStateTransitionError, ValidationError } from "../core/errors";

export const IMMUTABLE_PERSISTENCE_FIELDS = [
  "id",
  "organizationId",
  "createdAt",
  "detectedAt",
  "startedAt",
  "updatedAt",
] as const;

export function throwUniquenessConflict(resource: string, constraint?: string): never {
  throw new ConflictError(`${resource} violates a uniqueness constraint`, {
    resource,
    ...(constraint ? { constraint } : {}),
  });
}

export function assertNoImmutableFieldMutation(
  updates: Record<string, unknown>,
  resource: string,
  extraImmutableFields: readonly string[] = []
): void {
  const immutable = new Set<string>([
    ...IMMUTABLE_PERSISTENCE_FIELDS,
    ...extraImmutableFields,
  ]);
  const attempted = Object.keys(updates).filter(
    (field) => immutable.has(field) && updates[field] !== undefined
  );

  if (attempted.length > 0) {
    throw new ValidationError(
      `Cannot mutate immutable ${resource} fields: ${attempted.join(", ")}`,
      { resource, fields: attempted }
    );
  }
}

export function assertForwardStateTransition<T extends string>(
  resource: string,
  current: T,
  requested: T | undefined,
  allowedTransitions: Readonly<Record<T, readonly T[]>>
): void {
  if (requested === undefined || requested === current) return;
  const allowed = allowedTransitions[current] || [];
  if (!allowed.includes(requested)) {
    throw new InvalidStateTransitionError(resource, current, requested, allowed);
  }
}

export function assertNextIntegerValue(
  resource: string,
  field: string,
  current: number,
  requested: number | undefined
): void {
  if (requested === undefined) return;
  if (!Number.isSafeInteger(requested) || requested !== current + 1) {
    throw new ConflictError(
      `${resource} ${field} update is stale or non-monotonic`,
      { resource, field, current, requested, expected: current + 1 }
    );
  }
}

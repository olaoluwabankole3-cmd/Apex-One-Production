import { randomUUID } from "node:crypto";
import { getProductionTopology } from "./deploymentTopology";
import { isCommitSha, isImmutableImageDigest } from "./releaseIdentity";

export type ReleaseAction = "promote" | "rollback";
export type ReleaseEnvironmentName = "staging" | "production";
export type ReleaseSourceEnvironment = "candidate" | "staging";

export interface ReleasePlanInput {
  action: ReleaseAction;
  environment: ReleaseEnvironmentName;
  commitSha: string;
  imageDigest?: string;
  rollbackToDigest?: string;
  sourceEnvironment?: ReleaseSourceEnvironment;
  releaseId?: string;
  now?: Date;
}

export interface ReleasePlan {
  schemaVersion: 1;
  action: ReleaseAction;
  environment: ReleaseEnvironmentName;
  sourceEnvironment: ReleaseSourceEnvironment;
  releaseId: string;
  commitSha: string;
  targetImageDigest: string;
  createdAt: string;
  topologySchemaVersion: number;
}

export interface DeploymentControlOptions {
  controlUrl: string;
  token: string;
  fetchImpl?: typeof fetch;
  allowInsecureLoopbackForTesting?: boolean;
}

export interface DeploymentReceipt {
  deploymentId: string;
  status: "succeeded";
  environment: ReleaseEnvironmentName;
  activeImageDigest: string;
  completedAt: string;
}

const RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim();
  return result ? result : undefined;
}

function requireDigest(value: string | undefined, label: string): string {
  const digest = normalized(value);
  if (!digest || !isImmutableImageDigest(digest)) {
    throw new Error(`${label} must be an immutable sha256 image digest`);
  }
  return digest;
}

export function createReleasePlan(input: ReleasePlanInput): ReleasePlan {
  const topology = getProductionTopology();
  const commitSha = normalized(input.commitSha);
  if (!commitSha || !isCommitSha(commitSha)) {
    throw new Error("Release commit must be a full 40-character Git SHA");
  }
  if (input.environment !== "staging" && input.environment !== "production") {
    throw new Error("Release environment must be staging or production");
  }

  const sourceEnvironment = input.sourceEnvironment || "candidate";
  if (sourceEnvironment !== "candidate" && sourceEnvironment !== "staging") {
    throw new Error("Release source environment must be candidate or staging");
  }

  if (
    input.action === "promote" &&
    input.environment === "production" &&
    topology.release.productionRequiresStagingSource &&
    sourceEnvironment !== "staging"
  ) {
    throw new Error("Production promotion requires a staging source release");
  }

  let targetImageDigest: string;
  if (input.action === "promote") {
    targetImageDigest = requireDigest(input.imageDigest, "Promotion image digest");
    if (normalized(input.rollbackToDigest)) {
      throw new Error("Promotion may not also specify a rollback target");
    }
  } else if (input.action === "rollback") {
    targetImageDigest = requireDigest(input.rollbackToDigest, "Rollback target digest");
    if (normalized(input.imageDigest) && normalized(input.imageDigest) === targetImageDigest) {
      throw new Error("Rollback target must differ from the currently supplied image digest");
    }
  } else {
    throw new Error("Unsupported release action");
  }

  const now = input.now || new Date();
  const releaseId =
    normalized(input.releaseId) ||
    `${input.environment}-${commitSha.slice(0, 12)}-${now.getTime()}-${randomUUID().slice(0, 8)}`;
  if (!RELEASE_ID_PATTERN.test(releaseId)) {
    throw new Error("Release ID contains unsupported characters or length");
  }

  return {
    schemaVersion: 1,
    action: input.action,
    environment: input.environment,
    sourceEnvironment,
    releaseId,
    commitSha,
    targetImageDigest,
    createdAt: now.toISOString(),
    topologySchemaVersion: topology.schemaVersion,
  };
}

function validateControlUrl(rawUrl: string, allowInsecureLoopbackForTesting: boolean): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Deployment control URL must be a valid URL");
  }

  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (url.protocol !== "https:" && !(allowInsecureLoopbackForTesting && loopback)) {
    throw new Error("Deployment control URL must use HTTPS");
  }
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url;
}

export async function executeReleasePlan(
  plan: ReleasePlan,
  options: DeploymentControlOptions
): Promise<DeploymentReceipt> {
  const token = normalized(options.token);
  if (!token) throw new Error("Deployment control token is required");
  const baseUrl = validateControlUrl(
    options.controlUrl,
    options.allowInsecureLoopbackForTesting === true
  );
  const endpoint = new URL(`/v1/releases/${plan.action}`, baseUrl);
  const fetchImpl = options.fetchImpl || fetch;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    cache: "no-store",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "idempotency-key": plan.releaseId,
    },
    body: JSON.stringify(plan),
  });

  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Deployment controller returned non-JSON HTTP ${response.status}`);
  }

  if (!response.ok) {
    throw new Error(`Deployment controller rejected release with HTTP ${response.status}`);
  }
  if (body.status !== "succeeded") {
    throw new Error("Deployment controller did not confirm a completed release");
  }
  if (body.activeImageDigest !== plan.targetImageDigest) {
    throw new Error("Deployment controller active image digest does not match the release plan");
  }
  if (typeof body.deploymentId !== "string" || body.deploymentId.trim().length === 0) {
    throw new Error("Deployment controller did not return a deployment identifier");
  }

  return {
    deploymentId: body.deploymentId,
    status: "succeeded",
    environment: plan.environment,
    activeImageDigest: plan.targetImageDigest,
    completedAt:
      typeof body.completedAt === "string" && body.completedAt.trim()
        ? body.completedAt
        : new Date().toISOString(),
  };
}

export interface ReleaseEnvironment {
  APP_ENV?: string;
  APEX_DEPLOYMENT_ENVIRONMENT?: string;
  APEX_RELEASE_ID?: string;
  APEX_COMMIT_SHA?: string;
  APEX_IMAGE_DIGEST?: string;
  [key: string]: string | undefined;
}

export interface ReleaseIdentity {
  releaseId: string;
  commitSha: string;
  imageDigest: string;
  deploymentEnvironment: string;
  complete: boolean;
}

const RELEASE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/i;
const IMAGE_DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/i;
const DEPLOYMENT_ENVIRONMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;

function normalized(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function isImmutableImageDigest(value: string | undefined): boolean {
  return Boolean(value && IMAGE_DIGEST_PATTERN.test(value));
}

export function isCommitSha(value: string | undefined): boolean {
  return Boolean(value && COMMIT_SHA_PATTERN.test(value));
}

export function resolveReleaseIdentity(
  env: ReleaseEnvironment = process.env
): ReleaseIdentity {
  const releaseId = normalized(env.APEX_RELEASE_ID) || "unreleased";
  const commitSha = normalized(env.APEX_COMMIT_SHA) || "unknown";
  const imageDigest = normalized(env.APEX_IMAGE_DIGEST) || "unknown";
  const deploymentEnvironment =
    normalized(env.APEX_DEPLOYMENT_ENVIRONMENT) || normalized(env.APP_ENV) || "development";

  const complete =
    RELEASE_ID_PATTERN.test(releaseId) &&
    COMMIT_SHA_PATTERN.test(commitSha) &&
    IMAGE_DIGEST_PATTERN.test(imageDigest) &&
    DEPLOYMENT_ENVIRONMENT_PATTERN.test(deploymentEnvironment);

  return {
    releaseId,
    commitSha,
    imageDigest,
    deploymentEnvironment,
    complete,
  };
}

export function getProductionReleaseIdentityIssues(
  env: ReleaseEnvironment = process.env
): string[] {
  const issues: string[] = [];
  const releaseId = normalized(env.APEX_RELEASE_ID);
  const commitSha = normalized(env.APEX_COMMIT_SHA);
  const imageDigest = normalized(env.APEX_IMAGE_DIGEST);
  const deploymentEnvironment = normalized(env.APEX_DEPLOYMENT_ENVIRONMENT);

  if (!releaseId || !RELEASE_ID_PATTERN.test(releaseId)) {
    issues.push("APEX_RELEASE_ID must identify the immutable production release");
  }
  if (!commitSha || !COMMIT_SHA_PATTERN.test(commitSha)) {
    issues.push("APEX_COMMIT_SHA must be a full 40-character Git commit SHA");
  }
  if (!imageDigest || !IMAGE_DIGEST_PATTERN.test(imageDigest)) {
    issues.push("APEX_IMAGE_DIGEST must be an immutable sha256 image digest");
  }
  if (
    !deploymentEnvironment ||
    (deploymentEnvironment !== "staging" && deploymentEnvironment !== "production")
  ) {
    issues.push("APEX_DEPLOYMENT_ENVIRONMENT must be staging or production");
  }

  return issues;
}

/**
 * CORTEX staging-only, read-only HTTP gate.
 * Verifies that the *running* immutable release matches the operator-approved
 * source and ECR digest. Never logs HTTP bodies, URLs or credentials.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HEALTH_CHECKS = [
  ['/api/v1/health', 'healthy'],
  ['/api/v1/health/startup', 'started'],
  ['/api/v1/health/ready', 'ready'],
];
const AUTHORITIES = ['database', 'audit', 'session', 'rateLimit', 'objectStorage', 'searchIndex'];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateOptions({ baseUrl, expectedCommit, expectedDigest, expectedReleaseId }) {
  requireCondition(typeof baseUrl === 'string' && baseUrl.trim(), 'CORTEX_STAGING_URL is required');
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('CORTEX_STAGING_URL is invalid');
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  requireCondition(
    url.protocol === 'https:' || (url.protocol === 'http:' && loopback),
    'Staging URL must use HTTPS except on loopback'
  );
  requireCondition(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/',
    'Staging URL cannot contain credentials, query, fragment or a path');
  requireCondition(/^[a-f0-9]{40}$/.test(expectedCommit ?? ''), 'Expected full 40-character commit SHA is required');
  requireCondition(/^sha256:[a-f0-9]{64}$/.test(expectedDigest ?? ''), 'Expected immutable sha256 image digest is required');
  if (expectedReleaseId !== undefined) {
    requireCondition(typeof expectedReleaseId === 'string' && /^[a-zA-Z0-9_.:-]{1,128}$/.test(expectedReleaseId),
      'Expected release ID has an invalid format');
  }
  return url;
}

async function getProbeJson(url, path, request) {
  let response;
  try {
    response = await request(new URL(path, url), {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`Staging probe unavailable: ${path}`);
  }
  requireCondition(response.status === 200, `Staging probe did not return HTTP 200: ${path}`);
  try {
    return await response.json();
  } catch {
    throw new Error(`Staging probe did not return valid JSON: ${path}`);
  }
}

/** Read-only; no authentication token or deployment credentials are accepted. */
export async function verifyStagingHttp({ baseUrl, expectedCommit, expectedDigest, expectedReleaseId, request = fetch }) {
  const url = validateOptions({ baseUrl, expectedCommit, expectedDigest, expectedReleaseId });
  let ready;
  for (const [path, expectedStatus] of HEALTH_CHECKS) {
    const body = await getProbeJson(url, path, request);
    requireCondition(body?.status === expectedStatus, `Unexpected staging probe state: ${path}`);
    if (expectedStatus === 'ready') ready = body;
  }

  requireCondition(ready?.production === true, 'Staging must enforce production-mode safety controls');
  requireCondition(ready?.configurationIssueCount === 0, 'Staging has configuration issues');
  requireCondition(Array.isArray(ready?.unavailableAuthorities) && ready.unavailableAuthorities.length === 0,
    'Staging has unavailable dependencies');
  requireCondition(Array.isArray(ready?.checks), 'Staging readiness checks are missing');
  for (const authority of AUTHORITIES) {
    requireCondition(ready.checks.some((check) => check.authority === authority && check.state === 'ready'),
      `Staging durable authority is not ready: ${authority}`);
  }

  requireCondition(ready?.release?.complete === true, 'Staging release identity is incomplete');
  requireCondition(ready.release.deploymentEnvironment === 'staging', 'Target is not a staging deployment');
  requireCondition(ready.release.commitSha === expectedCommit, 'Running staging commit does not match approved source');
  requireCondition(ready.release.imageDigest === expectedDigest, 'Running staging image digest does not match ECR');
  if (expectedReleaseId !== undefined) {
    requireCondition(ready.release.releaseId === expectedReleaseId, 'Running staging release ID does not match');
  }

  return {
    status: 'passed',
    probes: HEALTH_CHECKS.length,
    durableAuthorities: AUTHORITIES.length,
    commitSha: expectedCommit,
    imageDigest: expectedDigest,
    releaseId: ready.release.releaseId,
  };
}

async function main() {
  try {
    const result = await verifyStagingHttp({
      baseUrl: process.env.CORTEX_STAGING_URL,
      expectedCommit: process.env.CORTEX_EXPECTED_COMMIT_SHA,
      expectedDigest: process.env.CORTEX_EXPECTED_IMAGE_DIGEST,
      expectedReleaseId: process.env.CORTEX_EXPECTED_RELEASE_ID || undefined,
    });
    console.log(JSON.stringify(result));
  } catch (error) {
    // Only messages from static invariant checks; never print response bodies or URLs.
    console.error(`CORTEX staging verification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

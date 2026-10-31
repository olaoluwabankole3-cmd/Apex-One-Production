import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { verifyStagingHttp } from './verifyStagingHttp.mjs';

const SHA = 'f'.repeat(40);
const DIGEST = `sha256:${'a'.repeat(64)}`;
const checks = ['database', 'audit', 'session', 'rateLimit', 'objectStorage', 'searchIndex']
  .map((authority) => ({ authority, state: 'ready', durationMs: 1 }));
const baseReady = {
  status: 'ready', production: true, configurationIssueCount: 0,
  unavailableAuthorities: [], checks,
  release: { complete: true, deploymentEnvironment: 'staging', commitSha: SHA,
    imageDigest: DIGEST, releaseId: 'cortex-staging-test' },
};
let server;
let baseUrl;
let override = {};

before(async () => {
  server = createServer((req, res) => {
    const items = {
      '/api/v1/health': { status: 'healthy' },
      '/api/v1/health/startup': { status: 'started' },
      '/api/v1/health/ready': baseReady,
      ...override,
    };
    if (!(req.url in items)) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(items[req.url]));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((done) => server.close(done));
});

const options = () => ({ baseUrl, expectedCommit: SHA, expectedDigest: DIGEST,
  expectedReleaseId: 'cortex-staging-test' });

test('accepts all three probes and exactly matching immutable staging release', async () => {
  override = {};
  const result = await verifyStagingHttp(options());
  assert.deepEqual([result.status, result.probes, result.durableAuthorities], ['passed', 3, 6]);
});

test('rejects unavailable PostgreSQL even if HTTP readiness status says ready', async () => {
  override = { '/api/v1/health/ready': { ...baseReady,
    checks: checks.map((c) => c.authority === 'database' ? { ...c, state: 'unavailable' } : c) } };
  await assert.rejects(verifyStagingHttp(options()), /database/);
  override = {};
});

test('rejects wrong release digest and commit', async () => {
  override = {};
  await assert.rejects(verifyStagingHttp({ ...options(), expectedDigest: `sha256:${'b'.repeat(64)}` }), /digest/);
  await assert.rejects(verifyStagingHttp({ ...options(), expectedCommit: 'e'.repeat(40) }), /commit/);
});

test('rejects a non-staging deployment', async () => {
  override = { '/api/v1/health/ready': { ...baseReady,
    release: { ...baseReady.release, deploymentEnvironment: 'production' } } };
  await assert.rejects(verifyStagingHttp(options()), /not a staging/);
  override = {};
});

test('rejects incomplete or insecure operator inputs before fetching', async () => {
  override = {};
  await assert.rejects(verifyStagingHttp({ ...options(), expectedCommit: 'f' }), /40-character/);
  await assert.rejects(verifyStagingHttp({ ...options(), baseUrl: 'http://example.com/' }), /HTTPS/);
  await assert.rejects(verifyStagingHttp({ ...options(), baseUrl: 'https://example.com/?token=secret' }), /cannot contain/);
});

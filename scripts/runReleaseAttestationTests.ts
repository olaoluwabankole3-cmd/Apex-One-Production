process.env.TEST_ENV = "true";

import {
  assertProductionTopology,
  getProductionTopology,
  type DeploymentTopology,
} from "../lib/backend/infrastructure/deploymentTopology";
import {
  createReleasePlan,
  executeReleasePlan,
} from "../lib/backend/infrastructure/releaseControl";

function digest(character: string): string {
  return `sha256:${character.repeat(64)}`;
}

function expectThrow(work: () => unknown, label: string): void {
  let rejected = false;
  try {
    work();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`${label} did not fail closed`);
}

async function expectAsyncThrow(work: () => Promise<unknown>, label: string): Promise<void> {
  let rejected = false;
  try {
    await work();
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error(`${label} did not fail closed`);
}

async function main(): Promise<void> {
  const plan = createReleasePlan({
    action: "promote",
    environment: "production",
    sourceEnvironment: "staging",
    commitSha: "6".repeat(40),
    imageDigest: digest("7"),
    releaseId: "stage11-production-attestation",
  });

  let capturedBody = "";
  let capturedAuthorization = "";
  const receipt = await executeReleasePlan(plan, {
    controlUrl: "http://127.0.0.1:9999",
    token: "stage11-controller-secret",
    allowInsecureLoopbackForTesting: true,
    fetchImpl: async (_input, init) => {
      capturedBody = String(init?.body || "");
      const headers = new Headers(init?.headers);
      capturedAuthorization = headers.get("authorization") || "";
      return new Response(
        JSON.stringify({
          deploymentId: "deployment-stage11-attested",
          status: "succeeded",
          activeImageDigest: plan.targetImageDigest,
          verifiedCommitSha: plan.commitSha,
          verifiedSourceEnvironment: "staging",
          verifiedSourceImageDigest: plan.targetImageDigest,
          completedAt: "2026-09-03T00:01:00.000Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    },
  });

  if (!capturedAuthorization.includes("stage11-controller-secret")) {
    throw new Error("Controller authentication header was not sent");
  }
  if (capturedBody.includes("stage11-controller-secret") || capturedBody.includes("127.0.0.1")) {
    throw new Error("Controller credential or endpoint leaked into the release payload");
  }
  if (
    receipt.verifiedCommitSha !== plan.commitSha ||
    receipt.verifiedSourceEnvironment !== "staging" ||
    receipt.verifiedSourceImageDigest !== plan.targetImageDigest
  ) {
    throw new Error("Production promotion lost authoritative commit/staging attestation");
  }

  await expectAsyncThrow(
    () => executeReleasePlan(plan, {
      controlUrl: "http://127.0.0.1:9999",
      token: "test-token",
      allowInsecureLoopbackForTesting: true,
      fetchImpl: async () => new Response(JSON.stringify({
        deploymentId: "deployment-without-source-proof",
        status: "succeeded",
        activeImageDigest: plan.targetImageDigest,
        verifiedCommitSha: plan.commitSha,
      }), { status: 200, headers: { "content-type": "application/json" } }),
    }),
    "Production promotion without staging attestation"
  );

  await expectAsyncThrow(
    () => executeReleasePlan(plan, {
      controlUrl: "http://127.0.0.1:9999",
      token: "test-token",
      allowInsecureLoopbackForTesting: true,
      fetchImpl: async () => new Response(JSON.stringify({
        deploymentId: "deployment-with-wrong-source-digest",
        status: "succeeded",
        activeImageDigest: plan.targetImageDigest,
        verifiedCommitSha: plan.commitSha,
        verifiedSourceEnvironment: "staging",
        verifiedSourceImageDigest: digest("8"),
      }), { status: 200, headers: { "content-type": "application/json" } }),
    }),
    "Production promotion with mismatched staging digest"
  );

  await expectAsyncThrow(
    () => executeReleasePlan(plan, {
      controlUrl: "http://127.0.0.1:9999",
      token: "test-token",
      allowInsecureLoopbackForTesting: true,
      fetchImpl: async () => new Response(JSON.stringify({
        deploymentId: "deployment-with-wrong-commit",
        status: "succeeded",
        activeImageDigest: plan.targetImageDigest,
        verifiedCommitSha: "9".repeat(40),
        verifiedSourceEnvironment: "staging",
        verifiedSourceImageDigest: plan.targetImageDigest,
      }), { status: 200, headers: { "content-type": "application/json" } }),
    }),
    "Production promotion with mismatched image commit"
  );

  const duplicateAuthority = structuredClone(getProductionTopology()) as DeploymentTopology;
  duplicateAuthority.authorities[5] = { ...duplicateAuthority.authorities[0] };
  expectThrow(() => assertProductionTopology(duplicateAuthority), "Duplicate topology authority");

  const providerMismatch = structuredClone(getProductionTopology()) as DeploymentTopology;
  const objectStorage = providerMismatch.authorities.find((authority) => authority.name === "objectStorage");
  if (!objectStorage) throw new Error("Object-storage topology authority is missing");
  objectStorage.provider = "postgres";
  expectThrow(() => assertProductionTopology(providerMismatch), "Topology provider mismatch");

  const zeroSurge = structuredClone(getProductionTopology()) as DeploymentTopology;
  zeroSurge.runtime.rollout.maxSurge = 0;
  expectThrow(() => assertProductionTopology(zeroSurge), "Zero-surge rolling rollout");

  console.log("================================================================================");
  console.log("APEX ONE — STAGE 11 RELEASE ATTESTATION / TOPOLOGY REGRESSION");
  console.log("================================================================================");
  console.log("✅ Promoted image digest is bound to the exact frozen Git commit");
  console.log("✅ Production promotion requires controller-attested staging source");
  console.log("✅ Production promotion requires the exact same staging image digest");
  console.log("✅ Controller credentials remain outside release payloads");
  console.log("✅ Deployment topology rejects duplicate authorities/provider drift/zero surge");
  console.log("================================================================================");
}

void main().catch((error) => {
  console.error("❌ Stage 11 release attestation regression failed:", error);
  process.exit(1);
});
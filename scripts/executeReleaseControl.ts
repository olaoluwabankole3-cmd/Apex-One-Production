import * as fs from "node:fs";
import * as path from "node:path";
import {
  createReleasePlan,
  executeReleasePlan,
  type ReleaseAction,
  type ReleaseEnvironmentName,
  type ReleaseSourceEnvironment,
} from "../lib/backend/infrastructure/releaseControl";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function required(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

async function main(): Promise<void> {
  const action = required(arg("action"), "--action") as ReleaseAction;
  const environment = required(arg("environment"), "--environment") as ReleaseEnvironmentName;
  const commitSha = required(
    arg("commit-sha") || process.env.APEX_COMMIT_SHA || process.env.GITHUB_SHA,
    "--commit-sha"
  );
  const sourceEnvironment = (arg("source-environment") || "candidate") as ReleaseSourceEnvironment;

  const plan = createReleasePlan({
    action,
    environment,
    commitSha,
    imageDigest: arg("image-digest"),
    rollbackToDigest: arg("rollback-to"),
    sourceEnvironment,
    releaseId: arg("release-id"),
  });

  const planOutput = path.resolve(arg("plan-output") || "release-plan.json");
  fs.writeFileSync(planOutput, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  console.log(`Release plan written: ${path.basename(planOutput)}`);
  console.log(`Release ID: ${plan.releaseId}`);
  console.log(`Action: ${plan.action}`);
  console.log(`Environment: ${plan.environment}`);
  console.log(`Target image: ${plan.targetImageDigest}`);

  if (!hasFlag("execute")) return;

  const controlUrl = required(process.env.APEX_DEPLOYMENT_CONTROL_URL, "APEX_DEPLOYMENT_CONTROL_URL");
  const token = required(process.env.APEX_DEPLOYMENT_CONTROL_TOKEN, "APEX_DEPLOYMENT_CONTROL_TOKEN");
  const receipt = await executeReleasePlan(plan, { controlUrl, token });
  const receiptOutput = path.resolve(arg("receipt-output") || "release-receipt.json");
  fs.writeFileSync(receiptOutput, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  console.log(`Deployment succeeded: ${receipt.deploymentId}`);
  console.log(`Active image: ${receipt.activeImageDigest}`);
}

void main().catch((error) => {
  console.error(`Release control failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

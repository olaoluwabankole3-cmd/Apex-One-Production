import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";

function runWorker(
  mode: "write" | "verify",
  env: NodeJS.ProcessEnv
): string {
  const tsxCli = path.join(
    process.cwd(),
    "node_modules",
    "tsx",
    "dist",
    "cli.mjs"
  );
  const worker = path.join(
    process.cwd(),
    "scripts",
    "infrastructureRestartWorker.ts"
  );

  const result = spawnSync(
    process.execPath,
    [tsxCli, worker, mode],
    {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    }
  );

  if (result.status !== 0) {
    throw new Error(
      `Restart persistence ${mode} process failed: ${(
        result.stderr || result.stdout || "unknown error"
      )
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 500)}`
    );
  }

  return result.stdout.trim();
}

function main(): void {
  if (process.env.TEST_ENV !== "true") {
    throw new Error(
      "TEST_ENV=true is required for the disposable restart persistence test"
    );
  }

  const marker = randomUUID().replace(/-/g, "").slice(0, 24);
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    APEX_RESTART_PERSISTENCE_MARKER: marker,
  };

  const writeOutput = runWorker("write", baseEnv);
  const state = JSON.parse(writeOutput);

  const verifyOutput = runWorker("verify", {
    ...baseEnv,
    APEX_RESTART_PERSISTENCE_STATE: JSON.stringify(state),
  });
  const verification = JSON.parse(verifyOutput);

  if (verification.status !== "passed") {
    throw new Error("Restart persistence verification returned a non-pass state");
  }

  console.log("APEX ONE — PHASE 3 RESTART PERSISTENCE PASSED");
  console.log(
    "✅ Fresh application process recovered PostgreSQL organization/user/membership state"
  );
  console.log("✅ Fresh application process recovered Redis session state");
  console.log("✅ Fresh application process recovered encrypted S3 document state");
}

try {
  main();
} catch (error) {
  console.error(
    "APEX ONE — PHASE 3 RESTART PERSISTENCE FAILED:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}

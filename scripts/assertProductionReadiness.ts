export {};

const baseUrl = (process.env.ASSURANCE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const expected = process.argv[2];
if (expected !== "ready" && expected !== "not_ready") {
  throw new Error("Usage: tsx scripts/assertProductionReadiness.ts <ready|not_ready>");
}

async function main(): Promise<void> {
  const deadline = Date.now() + 30_000;
  let lastStatus = 0;
  let lastBody: any;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/health/ready`, { cache: "no-store" });
      lastStatus = response.status;
      lastBody = await response.json().catch(() => undefined);
      const matches = expected === "ready"
        ? response.status === 200 && lastBody?.status === "ready"
        : response.status === 503 && lastBody?.status === "not_ready";
      if (matches) {
        console.log(
          `✅ Readiness converged to ${expected}; unavailable authorities: ${JSON.stringify(lastBody?.unavailableAuthorities || [])}`
        );
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  console.error("❌ Readiness did not converge", {
    expected,
    lastStatus,
    lastBody,
    lastError: lastError instanceof Error ? lastError.message : String(lastError || ""),
  });
  process.exitCode = 1;
}

void main().catch((error) => {
  console.error("❌ Readiness assertion crashed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

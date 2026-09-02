import fs from "node:fs";
import path from "node:path";

type Check = {
  name: string;
  run: () => void;
};

const root = process.cwd();
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const ai = read("lib/backend/domains/ai/aiOrchestratorService.ts");
const value = read("lib/backend/domains/value/valueService.ts");
const memory = read("lib/backend/domains/memory/memoryService.ts");
const valueContext = read("components/value-engine/ValueEngineContext.tsx");
const valueRepository = read("lib/data/repositories/valueRepository.ts");
const capturedPage = read("app/value-intelligence/captured/page.tsx");

function requireIncludes(source: string, expected: string, message: string) {
  if (!source.includes(expected)) throw new Error(message);
}

function requireExcludes(source: string, forbidden: string, message: string) {
  if (source.includes(forbidden)) throw new Error(message);
}

const checks: Check[] = [
  {
    name: "AI response distinguishes grounded records from canonical verification",
    run: () => {
      requireIncludes(ai, 'status: "grounded_records"', "AI response must expose grounded_records status");
      requireExcludes(ai, 'status: "verified_evidence"', "AI response must not claim verified_evidence from source grounding");
    },
  },
  {
    name: "AI generated claims default to unverified and uncertified",
    run: () => {
      requireIncludes(ai, 'verificationState: "unverified"', "AI claims must default to unverified");
      requireIncludes(ai, 'certificationState: "uncertified"', "AI claims must default to uncertified");
    },
  },
  {
    name: "AI prompt forbids unsupported verification or certification language",
    run: () => {
      requireIncludes(
        ai,
        "Do not describe a record, aggregate, inference, or AI-generated claim as verified or certified unless the context explicitly supplies that canonical evidence state.",
        "AI system instruction must preserve the canonical evidence terminology boundary"
      );
    },
  },
  {
    name: "Value summary separates recorded, verified, and certified captured value",
    run: () => {
      requireIncludes(value, "recordedValueCaptured", "Value summary must expose recorded captured value separately");
      requireIncludes(value, "verifiedValueCaptured", "Value summary must expose verified captured value separately");
      requireIncludes(value, "certifiedValueCaptured", "Value summary must expose certified captured value separately");
    },
  },
  {
    name: "Value verification and certification totals use canonical evidence states",
    run: () => {
      requireIncludes(value, 'snapshot.verificationState === "verified"', "Verified value must depend on canonical verification state");
      requireIncludes(value, 'snapshot.certificationState === "certified"', "Certified value must depend on canonical certification state");
    },
  },
  {
    name: "Captured-value client state contains no fabricated verifier authority",
    run: () => {
      requireExcludes(valueContext, "verifiedBy:", "Captured ledger entries must not carry a fabricated verifiedBy authority");
      requireExcludes(valueContext, "Yusuf Alao (CFO Office)", "Captured ledger must not hardcode a human verifier");
      requireExcludes(valueContext, "APEX AI Smart Validator", "AI automation must not self-assert verification authority");
    },
  },
  {
    name: "Value repository does not reinterpret legacy certification attribution",
    run: () => {
      requireExcludes(valueRepository, "verifiedBy:", "Value repository must not project a verifiedBy field");
      requireExcludes(valueRepository, "recordedBy: c.certifiedBy", "Legacy certifiedBy must not be reinterpreted as ordinary or verification attribution");
    },
  },
  {
    name: "Captured-value UI contains no unsupported verified or certified badges",
    run: () => {
      const forbidden = [
        "Verified Value Captured",
        "CERTIFIED CAPTURE EVIDENCE RECORDS",
        "Ledger Code: verified-capture",
        "Secure Ledger Node: Active and Certified",
        "verified 8.8-to-1",
      ];
      for (const phrase of forbidden) {
        requireExcludes(capturedPage, phrase, `Captured-value UI still contains unsupported phrase: ${phrase}`);
      }
    },
  },
  {
    name: "Captured-value UI explicitly labels demo totals as recorded or modeled",
    run: () => {
      requireIncludes(capturedPage, "Recorded Value Captured", "Captured-value hero must use recorded terminology");
      requireIncludes(capturedPage, "MODELED RETURN:", "Demo ROI ratio must be labeled modeled");
      requireIncludes(capturedPage, "not a canonical verification or certification decision", "Demo ROI must disclaim canonical verification/certification");
    },
  },
  {
    name: "Organizational memory cannot self-verify through the legacy boolean",
    run: () => {
      requireExcludes(memory, "dto.verified ?? true", "Memory creation must not default legacy verification to true");
      requireIncludes(memory, "verified: false", "New memory records must keep the legacy compatibility boolean non-authoritative");
      requireIncludes(memory, "canonicalVerificationRequired: true", "Memory audit metadata must signal canonical verification requirement");
    },
  },
];

console.log("=".repeat(80));
console.log("APEX ONE — STAGE 6 EVIDENCE TERMINOLOGY BOUNDARY");
console.log("=".repeat(80));

let passed = 0;
for (const [index, check] of checks.entries()) {
  try {
    check.run();
    passed += 1;
    console.log(`✅ [PASS] ${index + 1}. ${check.name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ [FAIL] ${index + 1}. ${check.name}: ${message}`);
  }
}

const failed = checks.length - passed;
console.log("-".repeat(80));
console.log(`TOTAL: ${checks.length} | PASSED: ${passed} | FAILED: ${failed}`);
console.log("=".repeat(80));

if (failed > 0) process.exit(1);

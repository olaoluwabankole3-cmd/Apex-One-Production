import {
  S3ObjectStorageError,
  S3WireClient,
} from "../lib/backend/infrastructure/s3/S3WireClient";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Stage 10 object-storage recovery`);
  return value;
}

async function main(): Promise<void> {
  const s3 = new S3WireClient({
    bucket: required("S3_BUCKET"),
    region: required("S3_REGION"),
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    endpoint: process.env.S3_ENDPOINT?.trim() || undefined,
  });

  try {
    await s3.createBucketForIntegrationTests();
  } catch (error) {
    if (!(error instanceof S3ObjectStorageError) || error.status !== 409) throw error;
  }

  console.log("✅ Stage 10 object-storage recovery authority restored");
}

void main().catch((error) => {
  console.error(
    "❌ Stage 10 object-storage recovery bootstrap failed:",
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
});

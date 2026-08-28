/**
 * APEX ONE — Cryptography & Security Primitives
 *
 * Standardized security utilities for:
 * 1. Password policy validation
 * 2. Salted PBKDF2-HMAC-SHA512 password hashing
 * 3. Constant-time password verification
 * 4. Cryptographically secure session-token generation
 * 5. Cryptographically secure request correlation identifiers
 *
 * SECURITY NOTES:
 * - Production password hashing uses PBKDF2-HMAC-SHA512 with a strong
 *   production work factor.
 * - Test environments intentionally use a reduced work factor so the
 *   security test suite remains practical.
 * - Password hashes and salts are never logged or returned in plaintext.
 * - Session tokens contain 256 bits of cryptographically secure randomness.
 */

import crypto from "crypto";

const IS_TEST_ENVIRONMENT =
  process.env.NODE_ENV === "test" ||
  process.env.TEST_ENV === "true";

/**
 * PBKDF2-HMAC-SHA512 work factor.
 *
 * Production:
 *   210,000 iterations.
 *
 * Test:
 *   1,000 iterations to keep automated tests fast.
 *
 * IMPORTANT:
 * This iteration count is currently not encoded into the existing
 * passwordHash/passwordSalt database fields. Therefore, once persistent
 * password records exist, changing this value requires an explicit password
 * hash migration/versioning strategy.
 */
const PBKDF2_ITERATIONS = IS_TEST_ENVIRONMENT ? 1_000 : 210_000;

const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";

/**
 * 16 random bytes = 128 bits of salt.
 */
const SALT_BYTES = 16;

/**
 * PBKDF2-SHA512 with a 64-byte derived key produces 128 hexadecimal
 * characters.
 */
const EXPECTED_HASH_HEX_LENGTH = PBKDF2_KEYLEN * 2;

/**
 * APEX ONE minimum password length.
 */
export const MIN_PASSWORD_LENGTH = 8;

export interface PasswordHashResult {
  hash: string;
  salt: string;
}

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a password against the APEX ONE password policy.
 *
 * The function accepts unknown input deliberately so API boundaries can
 * validate untrusted values without first asserting a string type.
 */
export function validatePasswordPolicy(
  password: unknown
): PasswordValidationResult {
  if (typeof password !== "string") {
    return {
      valid: false,
      error: "Password must be a valid string",
    };
  }

  if (password.length === 0) {
    return {
      valid: false,
      error: "Password cannot be empty",
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters in length`,
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate a caller-supplied salt.
 *
 * Internally generated salts are always cryptographically secure.
 * Existing salts are accepted only when they are non-empty and contain
 * enough entropy material for the expected 16-byte salt representation.
 *
 * The canonical format produced by this module is 32 hexadecimal characters.
 */
function isValidSalt(salt: unknown): salt is string {
  if (typeof salt !== "string") {
    return false;
  }

  return /^[a-f0-9]{32}$/i.test(salt);
}

/**
 * Validate a stored PBKDF2 hash representation.
 */
function isValidStoredHash(hash: unknown): hash is string {
  if (typeof hash !== "string") {
    return false;
  }

  if (hash.length !== EXPECTED_HASH_HEX_LENGTH) {
    return false;
  }

  return /^[a-f0-9]+$/i.test(hash);
}

/**
 * Hash a plaintext password with a cryptographically secure random salt
 * using PBKDF2-HMAC-SHA512.
 *
 * The password policy is enforced at this primitive boundary so callers
 * cannot accidentally create credentials weaker than the application's
 * declared policy.
 */
export function hashPassword(
  password: string,
  existingSalt?: string
): PasswordHashResult {
  const policy = validatePasswordPolicy(password);

  if (!policy.valid) {
    throw new Error(
      policy.error || "Password does not satisfy the security policy"
    );
  }

  let salt: string;

  if (existingSalt !== undefined) {
    if (!isValidSalt(existingSalt)) {
      throw new Error(
        "Existing password salt must be a 16-byte salt represented as 32 hexadecimal characters"
      );
    }

    salt = existingSalt;
  } else {
    salt = crypto.randomBytes(SALT_BYTES).toString("hex");
  }

  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );

  return {
    hash: derivedKey.toString("hex"),
    salt,
  };
}

/**
 * Pre-computed dummy credentials used to normalize password-verification
 * work for nonexistent, inactive, or otherwise invalid accounts.
 *
 * The dummy values contain no real user credential information.
 */
const DUMMY_SALT = "0123456789abcdef0123456789abcdef";

const DUMMY_PASSWORD = "ApexOneDummyPasswordNormalizationSalt";

const DUMMY_HASH = crypto
  .pbkdf2Sync(
    DUMMY_PASSWORD,
    DUMMY_SALT,
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  )
  .toString("hex");

/**
 * Perform a dummy PBKDF2 operation for authentication timing normalization.
 *
 * Always returns false because this credential can never authenticate a user.
 */
export function dummyPasswordVerification(
  password: unknown
): boolean {
  const candidate =
    typeof password === "string" && password.length > 0
      ? password
      : "dummy_fallback_input";

  verifyPassword(candidate, DUMMY_HASH, DUMMY_SALT);

  return false;
}

/**
 * Constant-time verification of a password against a stored PBKDF2 hash
 * and salt.
 *
 * Returns false for all malformed or missing credential material.
 *
 * The comparison uses crypto.timingSafeEqual() after validating that the
 * derived and stored buffers have identical lengths.
 */
export function verifyPassword(
  password: unknown,
  storedHash?: unknown,
  storedSalt?: unknown
): boolean {
  if (
    typeof password !== "string" ||
    password.length === 0 ||
    !isValidStoredHash(storedHash) ||
    !isValidSalt(storedSalt)
  ) {
    return false;
  }

  try {
    const computed = crypto.pbkdf2Sync(
      password,
      storedSalt,
      PBKDF2_ITERATIONS,
      PBKDF2_KEYLEN,
      PBKDF2_DIGEST
    );

    const storedBuffer = Buffer.from(storedHash, "hex");

    if (computed.length !== storedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computed, storedBuffer);
  } catch {
    /**
     * Credential corruption or cryptographic-library errors must not escape
     * through the password-verification boundary.
     */
    return false;
  }
}

/**
 * Generate a cryptographically secure random session token.
 *
 * 32 random bytes provide 256 bits of entropy.
 */
export function generateSecureToken(
  prefix: string = "apex_tok"
): string {
  if (
    typeof prefix !== "string" ||
    prefix.length === 0 ||
    !/^[A-Za-z0-9_-]+$/.test(prefix)
  ) {
    throw new Error("Token prefix must contain only letters, numbers, '_' or '-'");
  }

  const randomBytes = crypto.randomBytes(32).toString("base64url");

  return `${prefix}_${randomBytes}`;
}

/**
 * Generate a cryptographically secure request correlation ID.
 */
export function generateSecureRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

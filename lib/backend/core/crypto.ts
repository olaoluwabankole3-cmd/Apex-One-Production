/**
 * APEX ONE — Cryptography & Security Primitives
 * 
 * Standardized security utilities for:
 * 1. Constant-time password hashing and verification using PBKDF2 with unique salts
 * 2. Cryptographically secure random token generation (crypto.randomBytes)
 * 3. Unique request correlation identifiers
 */

import crypto from "crypto";

const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = "sha512";
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
 * Validate password against enterprise security policy.
 * Requires minimum 8 characters and non-empty string.
 */
export function validatePasswordPolicy(password: unknown): PasswordValidationResult {
  if (typeof password !== "string") {
    return { valid: false, error: "Password must be a valid string" };
  }
  if (password.length === 0) {
    return { valid: false, error: "Password cannot be empty" };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters in length`,
    };
  }
  return { valid: true };
}

/**
 * Hash a plaintext password with a cryptographically secure random salt using PBKDF2.
 * Never stores or returns plaintext passwords.
 */
export function hashPassword(password: string, existingSalt?: string): PasswordHashResult {
  if (!password || typeof password !== "string") {
    throw new Error("Password must be a non-empty string to generate a secure hash");
  }
  const salt = existingSalt || crypto.randomBytes(16).toString("hex");
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
 * Pre-computed dummy salt and hash used to normalize execution time
 * for non-existent or invalid accounts, eliminating user enumeration timing side channels.
 */
const DUMMY_SALT = "0123456789abcdef0123456789abcdef";
const DUMMY_HASH = crypto
  .pbkdf2Sync("ApexOneDummyPasswordNormalizationSalt", DUMMY_SALT, PBKDF2_ITERATIONS, PBKDF2_KEYLEN, PBKDF2_DIGEST)
  .toString("hex");

export function dummyPasswordVerification(password: string): boolean {
  verifyPassword(password || "dummy_fallback_input", DUMMY_HASH, DUMMY_SALT);
  return false;
}

/**
 * Constant-time verification of a password against a stored salt and hash.
 * Prevents timing-attack side channels.
 * Returns false on missing, empty, or invalid inputs.
 */
export function verifyPassword(password: unknown, storedHash?: unknown, storedSalt?: unknown): boolean {
  if (
    typeof password !== "string" ||
    typeof storedHash !== "string" ||
    typeof storedSalt !== "string" ||
    !password ||
    !storedHash ||
    !storedSalt
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
    return false;
  }
}

/**
 * Generate a cryptographically secure random session token.
 */
export function generateSecureToken(prefix: string = "apex_tok"): string {
  const randomBytes = crypto.randomBytes(32).toString("base64url");
  return `${prefix}_${randomBytes}`;
}

/**
 * Generate a cryptographically secure request correlation ID.
 */
export function generateSecureRequestId(): string {
  return `req_${crypto.randomUUID()}`;
}

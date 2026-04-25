import crypto from "crypto";

/**
 * Generate a cryptographically secure session token.
 * The raw value is given to the client; only its hash is persisted.
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a session token for storage / lookup.
 *
 * SHA-256 is appropriate here because the input has 256 bits of entropy —
 * brute-forcing or rainbow tables are infeasible. We keep this fast so
 * every authenticated request stays cheap.
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

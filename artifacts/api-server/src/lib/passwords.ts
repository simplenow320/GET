import crypto from "crypto";
import { promisify } from "util";

const scryptAsync = promisify<string | Buffer, Buffer, number, Buffer>(
  crypto.scrypt as never,
);

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

/**
 * Hash a password using scrypt.
 * Format: scrypt$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

/**
 * Verify a password against either a modern scrypt hash or a legacy SHA-256 hash.
 *
 * Legacy format: 64-char lowercase hex (output of `sha256(password + SESSION_SECRET)`).
 * If a legacy hash matches, callers should rehash and persist the upgraded value.
 *
 * Always uses constant-time comparison.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return { ok: false, needsRehash: false };
    const salt = Buffer.from(parts[1], "hex");
    const expected = Buffer.from(parts[2], "hex");
    const derived = await scryptAsync(password, salt, expected.length);
    if (derived.length !== expected.length) return { ok: false, needsRehash: false };
    const ok = crypto.timingSafeEqual(derived, expected);
    return { ok, needsRehash: false };
  }

  // Legacy SHA-256 + SESSION_SECRET pepper
  if (/^[0-9a-f]{64}$/.test(stored)) {
    const secret = process.env.SESSION_SECRET ?? "";
    const candidate = crypto
      .createHash("sha256")
      .update(password + secret)
      .digest();
    const expected = Buffer.from(stored, "hex");
    if (candidate.length !== expected.length) return { ok: false, needsRehash: false };
    const ok = crypto.timingSafeEqual(candidate, expected);
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}

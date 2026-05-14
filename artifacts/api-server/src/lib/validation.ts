import { z } from "zod";

/**
 * Stricter validation primitives that wrap the loose auto-generated API schemas.
 * Use these in route handlers to enforce real-world constraints the OpenAPI
 * spec leaves implicit.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTNAME_RE =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const Email = z
  .string()
  .min(3, "Email is too short")
  .max(254, "Email is too long")
  .transform((s) => s.toLowerCase().trim())
  .refine((v) => EMAIL_RE.test(v), "Invalid email format");

export const Password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(200, "Password is too long");

export const PersonName = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "Name is required").max(80, "Name is too long"));

export const ProjectName = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "Name is required").max(120, "Name is too long"));

export const ProjectDescription = z
  .string()
  .max(500, "Description is too long")
  .optional()
  .nullable();

export const FieldLabel = z
  .string()
  .transform((s) => s.trim())
  .pipe(z.string().min(1, "Label is required").max(120, "Label is too long"));

export const ContentValue = z
  .string()
  .max(10_000, "Content is too long");

export const SelectorString = z
  .string()
  .max(200, "Selector is too long")
  .optional()
  .nullable();

export const InviteRole = z.enum(["editor", "viewer"]);
export const ManageableRole = z.enum(["admin", "editor", "viewer"]);

const RESERVED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "broadcasthost",
  "ip6-localhost",
  "ip6-loopback",
]);

// Anything that looks like a numeric IPv4 literal — even in non-loopback ranges
// (e.g. 10.0.0.1, 169.254.169.254, 8.8.8.8) — must be rejected. Hostnames may
// later be used to verify ownership or fetch metadata, so allowing IP literals
// would create an SSRF foothold.
const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

export const Hostname = z
  .string()
  .max(253, "Hostname is too long")
  .transform((s) => s.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0])
  .refine(
    (v) =>
      HOSTNAME_RE.test(v) &&
      !IPV4_RE.test(v) &&
      // Defense-in-depth: reject anything containing colons (IPv6 / port) or
      // brackets, even though HOSTNAME_RE already excludes those characters.
      !/[:\[\]]/.test(v) &&
      !RESERVED_HOSTNAMES.has(v),
    "Enter a valid public hostname (e.g. app.example.com) — IP addresses are not allowed",
  );

export const KeyName = z
  .string()
  .transform((s) => (s ?? "").trim().slice(0, 64))
  .pipe(z.string().min(1, "Name is required").max(64, "Name is too long"));

/**
 * Parse a positive integer route param. Returns null on anything bogus.
 *
 * Express 5 widened `req.params[k]` to `string | string[] | undefined` to
 * support repeated query-style segments. We never use repeated params for
 * IDs, so any non-string here is rejected up front rather than silently
 * picking the first/last array element.
 */
export function parseIdParam(raw: string | string[] | undefined): number | null {
  if (typeof raw !== "string") return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

/**
 * Coerce an Express 5 route param to a plain string (or undefined). Mirrors
 * `parseIdParam`'s defensive stance toward repeated-segment arrays — if the
 * router ever produces one, treat it as missing rather than guessing which
 * element to use.
 */
export function paramStr(raw: string | string[] | undefined): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

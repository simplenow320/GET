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
  "0.0.0.0",
  "127.0.0.1",
  "::1",
]);

export const Hostname = z
  .string()
  .max(253, "Hostname is too long")
  .transform((s) => s.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0])
  .refine(
    (v) => HOSTNAME_RE.test(v) && !RESERVED_HOSTNAMES.has(v),
    "Enter a valid public hostname (e.g. app.example.com)",
  );

export const KeyName = z
  .string()
  .transform((s) => (s ?? "").trim().slice(0, 64))
  .pipe(z.string().min(1, "Name is required").max(64, "Name is too long"));

/**
 * Parse a positive integer route param. Returns null on anything bogus.
 */
export function parseIdParam(raw: string | undefined): number | null {
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}

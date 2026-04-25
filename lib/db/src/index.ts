import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// Prefer SUPABASE_DATABASE_URL when set (managed Postgres), fall back to the
// classic DATABASE_URL (Replit-managed dev DB). This is the LIGHT migration:
// only the database host moves; every other backend control (cookie auth,
// Drizzle schema, RBAC, audit log) stays in Express where it always was.
//
// To roll back: unset SUPABASE_DATABASE_URL (or set it to empty) — the next
// process restart transparently falls back to DATABASE_URL.
const pickEnv = (...names: string[]) => {
  for (const n of names) {
    const raw = process.env[n];
    if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
  }
  return undefined;
};

const connectionString = pickEnv("SUPABASE_DATABASE_URL", "DATABASE_URL");

if (!connectionString) {
  throw new Error(
    "Database connection string is missing. Set SUPABASE_DATABASE_URL (preferred) or DATABASE_URL.",
  );
}

const usingSupabase = connectionString === pickEnv("SUPABASE_DATABASE_URL");

// Supabase mandates TLS. Its pooler endpoint presents a chain that isn't in
// the default Node.js trust store, so we accept the cert without strict
// verification. Encryption is still on (sslmode=require equivalent); only
// CA validation is relaxed. This matches Supabase's own client examples and
// is an explicit, documented trade-off for the LIGHT migration.
export const pool = new Pool({
  connectionString,
  ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";

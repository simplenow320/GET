import { defineConfig } from "drizzle-kit";
import path from "path";

// Mirror the runtime: prefer SUPABASE_DATABASE_URL, fall back to DATABASE_URL.
// `drizzle-kit push` will operate on whichever is set — so a `pnpm push` after
// pointing this at Supabase migrates the schema there, and unsetting (or
// blanking) the Supabase var sends migrations back to the original DB.
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

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    // See lib/db/src/index.ts for the TLS-trust rationale.
    ssl: usingSupabase ? { rejectUnauthorized: false } : undefined,
  },
});

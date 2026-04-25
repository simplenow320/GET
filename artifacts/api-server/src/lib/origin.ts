/**
 * Trusted origin resolution for outbound links (password reset, invites).
 *
 * NEVER derive these from `req.headers.origin` / `req.get("host")` — both are
 * attacker-controlled. A forged Origin header would let someone trigger a real
 * password-reset email containing a real token but pointing at attacker.com.
 *
 * Resolution order:
 *   1. APP_BASE_URL env var (e.g. "https://get.example.com") — production.
 *   2. REPLIT_DEV_DOMAIN env var → "https://<that domain>" — Replit workspace.
 *   3. Throws — emails containing untrusted links must NOT be sent.
 */

let cached: string | null | undefined;

export function getAppBaseUrl(): string {
  if (cached !== undefined) {
    if (cached === null) throw new Error("App base URL is not configured");
    return cached;
  }

  const fromEnv = process.env.APP_BASE_URL?.trim();
  if (fromEnv) {
    cached = fromEnv.replace(/\/+$/, "");
    return cached;
  }

  const replitDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
  if (replitDomain) {
    cached = `https://${replitDomain.replace(/\/+$/, "")}`;
    return cached;
  }

  cached = null;
  throw new Error(
    "App base URL is not configured. Set APP_BASE_URL or REPLIT_DEV_DOMAIN.",
  );
}

/** Build an absolute URL inside the app from a relative path. */
export function buildAppUrl(path: string): string {
  const base = getAppBaseUrl();
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

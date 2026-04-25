/**
 * Google OAuth 2.0 helpers — authorization-code flow with OpenID Connect.
 *
 * We don't pull in `google-auth-library` because the only thing we need is
 * (a) a URL builder for the authorize endpoint, (b) a `fetch` against the
 * token endpoint, and (c) a `fetch` against the userinfo endpoint. Google's
 * surface for this is small and stable; the dep would only add weight.
 *
 * The state parameter is signed with the shared SESSION_SECRET so the
 * callback can verify it came from us — we never trust an unsigned state.
 */
import crypto from "node:crypto";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const OAUTH_STATE_COOKIE = "gs_oauth_state";
/** State cookie TTL — long enough for a slow user, short enough to cap replay. */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** HMAC key — we reuse SESSION_SECRET. */
  secret: string;
}

export function loadGoogleOAuthConfig(redirectUri: string): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const secret = process.env.SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !secret) return null;
  return { clientId, clientSecret, redirectUri, secret };
}

/**
 * Build a signed state value of the form `<random>.<next>.<hmac>`. `next` is
 * the post-login redirect path (already validated to be a same-origin path).
 * The HMAC binds the random nonce + the next path so neither can be tampered
 * with independently.
 */
export function mintState(secret: string, next: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const safeNext = encodeURIComponent(next);
  const payload = `${nonce}.${safeNext}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export interface ParsedState {
  nonce: string;
  next: string;
}

/** Constant-time verify and parse. Returns null on any tampering. */
export function verifyState(secret: string, state: string): ParsedState | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [nonce, encodedNext, sig] = parts;
  if (!nonce || !encodedNext || !sig) return null;
  const payload = `${nonce}.${encodedNext}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  // Length check first — timingSafeEqual throws on mismatched lengths.
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) {
    return null;
  }
  let next: string;
  try {
    next = decodeURIComponent(encodedNext);
  } catch {
    return null;
  }
  // Defense-in-depth: reject anything that doesn't look like a same-origin
  // path. The frontend already validates this before sending, but the cookie
  // round-trips through the user's browser.
  if (!next.startsWith("/") || next.startsWith("//")) next = "/app/dashboard";
  return { nonce, next };
}

export function buildAuthorizeUrl(cfg: GoogleOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    include_granted_scopes: "true",
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/**
 * Exchange the authorization code for an access token, then call userinfo to
 * fetch the OIDC profile. Throws on any failure — callers should handle by
 * redirecting the user back to /login with a generic error param.
 */
export async function exchangeCodeForProfile(
  cfg: GoogleOAuthConfig,
  code: string,
): Promise<GoogleProfile> {
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => "");
    throw new Error(`token exchange failed: ${tokenRes.status} ${body.slice(0, 200)}`);
  }
  const tok = (await tokenRes.json()) as { access_token?: string };
  if (!tok.access_token) throw new Error("token response missing access_token");

  const uiRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${tok.access_token}` },
  });
  if (!uiRes.ok) {
    const body = await uiRes.text().catch(() => "");
    throw new Error(`userinfo failed: ${uiRes.status} ${body.slice(0, 200)}`);
  }
  const ui = (await uiRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    given_name?: string;
  };
  if (!ui.sub || !ui.email) throw new Error("userinfo missing sub or email");
  return {
    sub: ui.sub,
    email: ui.email.toLowerCase().trim(),
    emailVerified: ui.email_verified === true,
    name: ui.name?.trim() || ui.given_name?.trim() || null,
  };
}

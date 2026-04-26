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

// ── PKCE (RFC 7636) ───────────────────────────────────────────────────────
// We use S256 PKCE in addition to the signed-state CSRF protection as
// defense-in-depth. Even though we're a confidential client (we send
// client_secret), PKCE binds the authorization code to *this specific browser
// session* — an attacker who somehow captures the redirected `code` cannot
// redeem it without the verifier, which never leaves the user's cookie.
//
// Wire-up:
//   - At authorize-start: generate a verifier, send sha256(verifier) as
//     code_challenge with method=S256. Store the verifier in the state cookie
//     alongside the state value.
//   - At callback: read verifier from the cookie, send it as code_verifier on
//     the token exchange. Google rejects a mismatch with HTTP 400.

/** Base64URL of sha256(verifier) — RFC 7636 §4.2. */
function s256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/** Generate a high-entropy 43-character base64url verifier. */
export function generatePkceVerifier(): string {
  // 32 random bytes → 43 base64url chars (no padding). Within the 43–128
  // range required by RFC 7636 §4.1.
  return crypto.randomBytes(32).toString("base64url");
}

/** Encode { state, verifier } into a single cookie value safely. */
export function packStateCookie(state: string, verifier: string): string {
  // The state already uses '.' as a delimiter; verifier is base64url-safe and
  // contains no colon, so a single ':' works as a clean delimiter we can split
  // on without risk of confusion with the state's payload.
  return `${state}:${verifier}`;
}

/** Reverse of packStateCookie. Returns null if malformed. */
export function unpackStateCookie(
  cookie: string,
): { state: string; verifier: string } | null {
  const idx = cookie.lastIndexOf(":");
  if (idx <= 0 || idx === cookie.length - 1) return null;
  const state = cookie.slice(0, idx);
  const verifier = cookie.slice(idx + 1);
  // Verifier sanity: base64url, RFC-permitted length range.
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(verifier)) return null;
  return { state, verifier };
}

export function buildAuthorizeUrl(
  cfg: GoogleOAuthConfig,
  state: string,
  codeVerifier: string,
): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
    include_granted_scopes: "true",
    code_challenge: s256(codeVerifier),
    code_challenge_method: "S256",
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
  codeVerifier: string,
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
      // PKCE: Google rejects the exchange (HTTP 400) if this verifier doesn't
      // sha256 to the code_challenge sent at /authorize. That binds the code
      // to this specific browser session, even if it's intercepted in transit.
      code_verifier: codeVerifier,
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

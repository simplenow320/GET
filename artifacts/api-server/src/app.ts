import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./middlewares/rate-limit";

const app: Express = express();

// Behind Replit's proxy — required so rate limits and req.ip are accurate
app.set("trust proxy", 1);

app.disable("x-powered-by");

// Conservative security headers. CSP is omitted because this is a JSON API
// surface — the consuming web app sets its own CSP.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "same-site" },
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Permissive CORS for public read endpoints — these are designed to be called
// from any customer's frontend or backend, so any origin is allowed.
const publicCors = cors({
  origin: true,
  methods: ["GET", "HEAD", "POST", "OPTIONS"],
  credentials: false,
});
app.use("/api/public", publicCors);

// Restrictive CORS for the admin dashboard. Because we now use cookie sessions
// (`credentials: true`), the allowlist must be EXPLICIT — never a wildcard
// over shared hosting domains. A wildcard like `*.replit.dev` would let any
// other Replit project on the same shared domain make credentialed requests
// against this API on behalf of a logged-in user.
//
// Allowed:
//   - Same-origin requests (no Origin header sent by the browser)
//   - The current Replit dev domain ($REPLIT_DEV_DOMAIN, exact match)
//   - APP_BASE_URL env var (production frontend, exact match)
//   - localhost / 127.0.0.1 on any port (local dev)
const explicitOrigins = new Set<string>();
const replitDomain = process.env.REPLIT_DEV_DOMAIN?.trim();
if (replitDomain) explicitOrigins.add(`https://${replitDomain}`);
const appBase = process.env.APP_BASE_URL?.trim();
if (appBase) explicitOrigins.add(appBase.replace(/\/+$/, ""));

const restrictiveCors = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (explicitOrigins.has(origin)) return cb(null, true);
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return cb(null, true);
    }
    // Reject by simply not echoing CORS headers — the browser will block
    // the response from being read. The Origin-check middleware below
    // returns a clean 403 for mutating requests; we deliberately avoid
    // throwing here so the global error handler doesn't see a noisy 500.
    cb(null, false);
  },
  credentials: true,
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api/public/")) return next();
  return restrictiveCors(req, res, next);
});

// Parse cookies so the auth middleware can read the httpOnly session cookie.
app.use(cookieParser());

// CSRF defense via Origin header.
//
// We set the session cookie with SameSite=Lax, which (when honored by the
// browser) is on its own enough to block cross-site state-changing requests.
// HOWEVER: when the API is served behind certain reverse proxies (notably
// Replit's edge), the Set-Cookie's SameSite attribute can be silently
// rewritten to `None` to support iframe / preview contexts. A cookie with
// SameSite=None;Secure WILL be sent on cross-site POST/PATCH/DELETE — which
// re-opens the CSRF surface that SameSite=Lax was supposed to close.
//
// To be robust regardless of what any intermediary does to the cookie, we
// add an explicit Origin-header check on mutating requests:
//   - GET/HEAD/OPTIONS                 → allowed (no state change at the
//                                        request boundary; any per-route
//                                        side effects must require a Bearer
//                                        token, not a cookie)
//   - /api/public/*                    → allowed (intentionally cross-origin)
//   - request whose Origin is in the   → allowed
//     same allowlist used by CORS
//   - request with no Origin AND no    → allowed (curl / server-to-server /
//     session cookie                     Bearer-only API client)
//   - everything else                  → 403
//
// Note we deliberately reject mutating cookie-auth requests that lack an
// Origin header. Browsers reliably send Origin on cross-site POST/fetch, so
// a cookie-bearing mutator with no Origin is suspicious; non-browser clients
// that legitimately omit Origin should authenticate with a Bearer token or
// project key, not the session cookie.
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
app.use((req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (req.path.startsWith("/api/public/")) return next();
  const origin = req.headers.origin;
  if (origin) {
    if (explicitOrigins.has(origin)) return next();
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return next();
    return res.status(403).json({ error: "Bad origin" });
  }
  // No Origin header. Allow only when not relying on cookie auth — i.e. no
  // session cookie present. Bearer / project-key clients are unaffected.
  const hasSessionCookie = Boolean(
    (req as Request & { cookies?: Record<string, string> }).cookies?.["gs"],
  );
  if (hasSessionCookie) {
    return res.status(403).json({ error: "Bad origin" });
  }
  return next();
});

// Request size limits — protect against large payload attacks
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Global rate limit (120 req/min per IP)
app.use("/api", apiLimiter);

app.use("/api", router);

// Catch-all error handler. Logs the real error server-side, returns a generic
// message to the client so we never leak internals or stack traces.
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "unhandled error");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

export default app;

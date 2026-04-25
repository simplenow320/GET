import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
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
  methods: ["GET", "HEAD", "OPTIONS"],
  credentials: false,
});
app.use("/api/public", publicCors);

// Restrictive CORS for the admin dashboard — Replit/repl domains and
// localhost only. We explicitly skip /api/public/* so the permissive CORS
// above is not overwritten by this restrictive one for cross-origin
// customer requests.
const restrictiveCors = cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const allowed =
      /^https?:\/\/.*\.(replit\.dev|repl\.co|replit\.app)(:\d+)?$/.test(origin) ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    cb(null, allowed ? true : new Error("Not allowed by CORS"));
  },
  credentials: true,
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api/public/")) return next();
  return restrictiveCors(req, res, next);
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

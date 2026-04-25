import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiLimiter } from "./middlewares/rate-limit";

const app: Express = express();

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

// Restrict CORS — in production this should be the exact domain list
app.use(
  cors({
    origin: (origin, cb) => {
      // Allow requests with no origin (server-to-server, curl, mobile)
      // and any replit.dev / repl.co domain during development
      if (!origin) return cb(null, true);
      const allowed =
        /^https?:\/\/.*\.(replit\.dev|repl\.co|replit\.app)(:\d+)?$/.test(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(null, allowed ? true : new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Request size limits — protect against large payload attacks
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Global rate limit (120 req/min per IP)
app.use("/api", apiLimiter);

app.use("/api", router);

export default app;

import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { and, eq } from "drizzle-orm";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { db, uploadedObjectsTable, projectUsersTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth, resolveSessionUser, type AuthRequest } from "../middlewares/auth";
import { logger } from "../lib/logger";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Hard cap to prevent storage-cost abuse via the signed-PUT URL we mint.
// Editor image fields are the only consumer right now; a 10 MiB ceiling is
// generous for hero images / logos but small enough to bound damage.
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_PREFIXES = ["image/"];

/** Roles allowed to mint upload URLs against a project. Viewers are read-only
 *  by definition and shouldn't be able to push new bytes into the bucket. */
const UPLOADER_ROLES = new Set(["owner", "admin", "editor"]);

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType, projectId) — NOT
 * the file. Then uploads directly to the returned presigned URL.
 *
 * Auth-gated AND project-scoped: the signed PUT URL is essentially a write
 * capability against shared GCS storage, so we require a logged-in user who
 * is an editor or higher in the named project. Anonymous or cross-tenant
 * minting would let any visitor (or any unrelated paying user) burn through
 * bucket quota and pollute another tenant's storage namespace.
 *
 * We record an `uploaded_objects` row at mint time so reads can later
 * enforce per-project ACLs (see GET /storage/objects/* below).
 */
router.post(
  "/storage/uploads/request-url",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    const { name, size, contentType, projectId } = parsed.data;

    if (typeof size === "number" && size > MAX_UPLOAD_BYTES) {
      res.status(413).json({ error: "File is too large (max 10 MB)" });
      return;
    }
    if (
      typeof contentType === "string" &&
      !ALLOWED_UPLOAD_PREFIXES.some((p) => contentType.startsWith(p))
    ) {
      res.status(415).json({ error: "Unsupported file type" });
      return;
    }

    // Project membership check. Identical 403 for "no project" and "no
    // access" so we never leak project existence to an outsider.
    const memberships = await db
      .select()
      .from(projectUsersTable)
      .where(
        and(
          eq(projectUsersTable.projectId, projectId),
          eq(projectUsersTable.userId, req.userId!),
        ),
      );
    const role = memberships[0]?.role;
    if (!role || !UPLOADER_ROLES.has(role)) {
      res.status(403).json({ error: "You can't upload to this project" });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      // Best-effort ownership row. If the insert fails (e.g. the object path
      // somehow already exists from a retried request), we still let the
      // upload proceed — the read path treats missing rows as legacy/public.
      try {
        await db.insert(uploadedObjectsTable).values({
          objectPath,
          projectId,
          uploadedByUserId: req.userId!,
          isPublic: true,
          contentType: typeof contentType === "string" ? contentType : null,
          sizeBytes: typeof size === "number" ? size : null,
        });
      } catch (err) {
        req.log.warn({ err, objectPath, projectId }, "uploaded_objects insert failed");
      }

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType, projectId },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities uploaded through `/storage/uploads/request-url`.
 *
 * ACL model:
 *   - Look up the `uploaded_objects` row for this path.
 *   - If it's flagged `isPublic: true` (the current default for editor
 *     image uploads — they MUST be embeddable from any customer site as
 *     `<img src="...">`), serve openly. Object IDs are unguessable UUIDs,
 *     so this matches the implicit S3-presigned-public model in use today.
 *   - If it's flagged `isPublic: false`, require an authenticated user who
 *     is a member of the owning project.
 *   - If no row exists at all, treat as legacy public (so existing image
 *     references in content fields don't suddenly 404 after this rollout).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    // ACL check — done before we touch GCS so a forbidden read costs nothing.
    const rows = await db
      .select()
      .from(uploadedObjectsTable)
      .where(eq(uploadedObjectsTable.objectPath, objectPath));
    const owner = rows[0];

    if (owner && !owner.isPublic) {
      const user = await resolveSessionUser(req);
      if (!user) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      const membership = await db
        .select()
        .from(projectUsersTable)
        .where(
          and(
            eq(projectUsersTable.projectId, owner.projectId),
            eq(projectUsersTable.userId, user.id),
          ),
        );
      if (membership.length === 0) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      logger.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;

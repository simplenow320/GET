import { pgTable, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

/**
 * Tracks every object uploaded through /api/storage/uploads/request-url so we
 * can:
 *   1. Bind each upload to a project (so a user can only mint upload URLs
 *      for projects they're a member of — closes the "any logged-in user
 *      can drain the bucket / pollute another tenant" surface from the
 *      audit's High #2).
 *   2. Decide at READ time whether to serve the object publicly (the
 *      default — content images embedded on customer sites must be
 *      readable without auth) or to require project membership (for
 *      future "private" uploads such as customer documents).
 *
 * Rows are best-effort: if the insert fails after the upload URL is minted,
 * the resulting object falls back to "no row" handling at read time
 * (treated as public+legacy so we never break image embedding). The
 * UNIQUE constraint on objectPath prevents a duplicate row from causing
 * ownership ambiguity if a request is retried.
 */
export const uploadedObjectsTable = pgTable(
  "uploaded_objects",
  {
    objectPath: text("object_path").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    isPublic: boolean("is_public").notNull().default(true),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProject: index("uploaded_objects_project_idx").on(t.projectId),
  }),
);

export type UploadedObject = typeof uploadedObjectsTable.$inferSelect;

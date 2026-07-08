import { pgTable, serial, integer, timestamp, text, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";

export const contentSnapshotsTable = pgTable(
  "content_snapshots",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    // Non-nullable ("" for unknown page) so the composite unique index below
    // actually dedupes — Postgres treats every NULL as distinct, which would
    // let unknown-page snapshots pile up as separate rows forever.
    pageUrl: text("page_url").notNull().default(""),
    sections: jsonb("sections").notNull(),
  },
  (t) => ({
    // One row per (project, page) — previously this was unique on projectId
    // alone, so scanning page B silently overwrote page A's snapshot.
    projectPageUnique: uniqueIndex("content_snapshots_project_page_idx").on(t.projectId, t.pageUrl),
  }),
);

export type ContentSnapshot = typeof contentSnapshotsTable.$inferSelect;

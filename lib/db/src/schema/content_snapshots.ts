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
    pageUrl: text("page_url"),
    sections: jsonb("sections").notNull(),
  },
  (t) => ({
    projectUnique: uniqueIndex("content_snapshots_project_id_idx").on(t.projectId),
  }),
);

export type ContentSnapshot = typeof contentSnapshotsTable.$inferSelect;

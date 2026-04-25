import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { contentFieldsTable } from "./content_fields";

export const draftsTable = pgTable("drafts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  fieldId: integer("field_id")
    .notNull()
    .references(() => contentFieldsTable.id, { onDelete: "cascade" }),
  fieldLabel: text("field_label").notNull(),
  value: text("value").notNull(),
  status: text("status", { enum: ["pending", "published", "rejected"] }).notNull().default("pending"),
  authorName: text("author_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
});

export const insertDraftSchema = createInsertSchema(draftsTable).omit({ id: true, createdAt: true });
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof draftsTable.$inferSelect;

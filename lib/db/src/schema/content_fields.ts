import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const contentFieldsTable = pgTable("content_fields", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  type: text("type", { enum: ["text", "richtext", "image", "url", "number", "boolean"] }).notNull().default("text"),
  selector: text("selector"),
  // Ordered list of CSS selectors captured at click-to-tag time, tried in order
  // by the scanner's resolveTags() pass before applyContent. First unique match
  // wins. Layered (#id → [data-testid] → structural path) so ordinary frontend
  // churn doesn't detach a tag. Optional — pre-existing rows use `selector`.
  selectors: jsonb("selectors").$type<string[] | null>(),
  // FNV-1a hash of the element's visible text at tag time. Last-resort anchor
  // when no selector resolves — scanner walks visible text nodes and picks the
  // element whose text hashes to this value. Optional.
  textFp: text("text_fp"),
  value: text("value"),
  draftValue: text("draft_value"),
  isLocked: boolean("is_locked").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContentFieldSchema = createInsertSchema(contentFieldsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentField = z.infer<typeof insertContentFieldSchema>;
export type ContentField = typeof contentFieldsTable.$inferSelect;

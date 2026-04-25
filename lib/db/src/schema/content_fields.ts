import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contentFieldsTable = pgTable("content_fields", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  label: text("label").notNull(),
  type: text("type", { enum: ["text", "richtext", "image", "url", "number", "boolean"] }).notNull().default("text"),
  selector: text("selector"),
  value: text("value"),
  draftValue: text("draft_value"),
  isLocked: boolean("is_locked").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertContentFieldSchema = createInsertSchema(contentFieldsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentField = z.infer<typeof insertContentFieldSchema>;
export type ContentField = typeof contentFieldsTable.$inferSelect;

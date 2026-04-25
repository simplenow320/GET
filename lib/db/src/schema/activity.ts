import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  action: text("action").notNull(),
  fieldLabel: text("field_label"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActivitySchema = createInsertSchema(activityTable).omit({ id: true, createdAt: true });
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activityTable.$inferSelect;

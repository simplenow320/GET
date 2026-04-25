import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

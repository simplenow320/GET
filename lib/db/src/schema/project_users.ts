import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectUsersTable = pgTable("project_users", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role", { enum: ["owner", "admin", "editor", "viewer"] }).notNull().default("editor"),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectUserSchema = createInsertSchema(projectUsersTable).omit({ id: true, joinedAt: true });
export type InsertProjectUser = z.infer<typeof insertProjectUserSchema>;
export type ProjectUser = typeof projectUsersTable.$inferSelect;

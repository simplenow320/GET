import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invitesTable = pgTable("invites", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  email: text("email").notNull(),
  role: text("role", { enum: ["editor", "viewer"] }).notNull().default("editor"),
  status: text("status", { enum: ["pending", "accepted", "expired"] }).notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInviteSchema = createInsertSchema(invitesTable).omit({ id: true, createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invitesTable.$inferSelect;

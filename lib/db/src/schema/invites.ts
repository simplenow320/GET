import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const invitesTable = pgTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    email: text("email").notNull(),
    role: text("role", { enum: ["editor", "viewer"] }).notNull().default("editor"),
    status: text("status", { enum: ["pending", "accepted", "expired", "revoked"] }).notNull().default("pending"),
    // No default: every insert MUST supply a unique token (see invites.ts POST).
    // A `default("")` would let multiple rows silently collide on the unique index.
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("invites_token_idx").on(t.token),
  }),
);

export const insertInviteSchema = createInsertSchema(invitesTable).omit({ id: true, createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invitesTable.$inferSelect;

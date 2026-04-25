import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const invitesTable = pgTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["editor", "viewer"] }).notNull().default("editor"),
    status: text("status", { enum: ["pending", "accepted", "expired", "revoked"] }).notNull().default("pending"),
    // Stores the SHA-256 hash of the raw invite token, never the raw token
    // itself. The plaintext token is shown to the admin once at create time
    // and embedded in the outbound email link — after that, only the hash
    // exists at rest. This means a leaked DB never yields working invite
    // links. The DB column name stays `token` for migration safety; only
    // the JS field name is updated.
    tokenHash: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex("invites_token_idx").on(t.tokenHash),
  }),
);

export const insertInviteSchema = createInsertSchema(invitesTable).omit({ id: true, createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invitesTable.$inferSelect;

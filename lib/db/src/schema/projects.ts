import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  // RESTRICT on user delete: projects must always have an owner. There is no
  // user-delete endpoint today, so this contract is never exercised destructively.
  ownerId: integer("owner_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: ["draft", "active", "archived"] }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
  // Updated whenever the script tag on the customer's site fetches public
  // content or posts a snapshot. Powers the dashboard "Last seen" badge so
  // owners can tell whether their install actually loaded recently.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastSeenOrigin: text("last_seen_origin"),
  // When TRUE (the default), client edits go live immediately on save — no
  // owner approval required. The vibe coder can flip this off in Settings to
  // get the older "submit draft → owner publishes" workflow back. Owners and
  // admins always auto-publish regardless of this flag.
  autoPublish: boolean("auto_publish").notNull().default(true),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

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
  // Opt-in lock for security-conscious owners. When TRUE, MCP requests
  // that arrive with NO Origin/Referer header (i.e. non-browser clients
  // like Claude Desktop, Cursor, cron, curl) are rejected if the project
  // also has at least one domain in the allowlist. Default FALSE so
  // existing MCP integrations (which the spec encourages NOT to send
  // Origin) keep working out of the box. Owners who only ever use the
  // MCP from a browser-based client, or who don't use MCP at all, can
  // flip this on for stricter defense-in-depth.
  mcpRequireOrigin: boolean("mcp_require_origin").notNull().default(false),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { projectKeysTable } from "./project_keys";

export const mcpCallLogTable = pgTable(
  "mcp_call_log",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    projectKeyId: integer("project_key_id")
      .notNull()
      .references(() => projectKeysTable.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    toolName: text("tool_name"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    ok: boolean("ok").notNull(),
    errorCode: integer("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byProjectCreated: index("mcp_call_log_project_created_idx").on(t.projectId, t.createdAt),
    byKeyCreated: index("mcp_call_log_key_created_idx").on(t.projectKeyId, t.createdAt),
  }),
);

export type McpCallLog = typeof mcpCallLogTable.$inferSelect;

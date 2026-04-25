import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

// PRODUCT NOTE — audit retention on project delete.
// `activity.project_id` is `ON DELETE CASCADE`, which means deleting a
// project also wipes its activity history. This is a conscious tradeoff:
// (a) the activity log is only ever read from inside that same project
//     (Project → Activity tab), so once the project is gone there is no
//     reachable surface that displays the rows;
// (b) keeping orphan activity around forever creates data debt;
// (c) the user-side action of deleting a project is itself logged at the
//     application layer (audit log of admins) before the cascade fires.
// If a future requirement adds an org-level audit feed that must outlive
// project deletion, switch this to ON DELETE SET NULL with denormalized
// project metadata (project_name, project_id_snapshot) and migrate the
// existing rows.
export const activityTable = pgTable("activity", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  // RESTRICT on user delete: audit history must outlive a user delete by
  // virtue of the denormalized `userName` field. Since there is no
  // user-delete endpoint today, this contract is never exercised.
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "restrict" }),
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

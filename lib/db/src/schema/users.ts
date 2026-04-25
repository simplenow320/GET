import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Nullable: users who signed up via Google OAuth have no password.
  // They can later set one via the /forgot-password flow if they wish.
  passwordHash: text("password_hash"),
  // Stable Google account identifier (the OIDC `sub` claim). Unique when
  // present; null for password-only accounts. We link by `sub` rather than
  // by email because users can change their primary Google email.
  googleSub: text("google_sub").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

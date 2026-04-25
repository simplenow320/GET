import { db, activityTable } from "@workspace/db";
import { logger } from "./logger";

const MAX_VALUE_LEN = 2_000;

function clip(value: string | null | undefined): string | null {
  if (value == null) return null;
  if (value.length <= MAX_VALUE_LEN) return value;
  return value.slice(0, MAX_VALUE_LEN) + "…";
}

export interface AuditEntry {
  projectId: number;
  userId: number;
  userName: string;
  action: string;
  fieldLabel?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
}

/**
 * Persist an audit/activity record. Also writes a structured server log so
 * security-relevant actions are visible in operator logs.
 *
 * Failures never throw — auditing must not break the user-facing request.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const row = {
    projectId: entry.projectId,
    userId: entry.userId,
    userName: entry.userName,
    action: entry.action,
    fieldLabel: entry.fieldLabel ?? null,
    oldValue: clip(entry.oldValue ?? null),
    newValue: clip(entry.newValue ?? null),
  };

  try {
    await db.insert(activityTable).values(row);
    logger.info(
      {
        audit: true,
        projectId: row.projectId,
        userId: row.userId,
        action: row.action,
        fieldLabel: row.fieldLabel,
      },
      "audit",
    );
  } catch (err) {
    logger.warn({ err, action: row.action, projectId: row.projectId }, "audit write failed");
  }
}

import { Router } from "express";
import { db, projectsTable, contentFieldsTable, projectUsersTable, activityTable } from "@workspace/db";
import { eq, and, gte, inArray, sql } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";
import { ProjectName, ProjectDescription } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router();

const StrictCreateProject = z.object({
  name: ProjectName,
  description: ProjectDescription,
});
const StrictUpdateProject = z.object({
  name: ProjectName.optional(),
  description: ProjectDescription,
  status: z.enum(["draft", "active", "archived"]).optional(),
});

function projectToResponse(p: typeof projectsTable.$inferSelect, fieldCount = 0, clientCount = 0) {
  return {
    id: String(p.id),
    name: p.name,
    description: p.description,
    status: p.status,
    fieldCount,
    clientCount,
    lastActivityAt: p.lastActivityAt?.toISOString(),
    createdAt: p.createdAt.toISOString(),
  };
}

// GET /stats — aggregate stats across the user's owned projects
router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const owned = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, userId));
  const projectIds = owned.map((p) => p.id);

  if (projectIds.length === 0) {
    return res.json({ totalProjects: 0, activeProjects: 0, totalClients: 0, totalFields: 0, recentEdits: 0 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [clients, fields, recent] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectUsersTable)
      .where(inArray(projectUsersTable.projectId, projectIds)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentFieldsTable)
      .where(inArray(contentFieldsTable.projectId, projectIds)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityTable)
      .where(
        and(
          inArray(activityTable.projectId, projectIds),
          gte(activityTable.createdAt, sevenDaysAgo),
        ),
      ),
  ]);

  res.json({
    totalProjects: owned.length,
    activeProjects: owned.filter((p) => p.status === "active").length,
    totalClients: clients[0]?.count ?? 0,
    totalFields: fields[0]?.count ?? 0,
    recentEdits: recent[0]?.count ?? 0,
  });
});

// GET / — list all projects the user is a member of
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const memberships = await db
    .select({ projectId: projectUsersTable.projectId, role: projectUsersTable.role })
    .from(projectUsersTable)
    .where(eq(projectUsersTable.userId, userId));

  if (memberships.length === 0) return res.json([]);

  const ids = memberships.map((m) => m.projectId);
  const projects = await db.select().from(projectsTable).where(inArray(projectsTable.id, ids));
  const fieldCounts = await db
    .select({ projectId: contentFieldsTable.projectId, count: sql<number>`count(*)::int` })
    .from(contentFieldsTable)
    .where(inArray(contentFieldsTable.projectId, ids))
    .groupBy(contentFieldsTable.projectId);
  const clientCounts = await db
    .select({ projectId: projectUsersTable.projectId, count: sql<number>`count(*)::int` })
    .from(projectUsersTable)
    .where(inArray(projectUsersTable.projectId, ids))
    .groupBy(projectUsersTable.projectId);

  const fieldMap = new Map(fieldCounts.map((f) => [f.projectId, f.count]));
  const clientMap = new Map(clientCounts.map((c) => [c.projectId, c.count]));
  const roleMap = new Map(memberships.map((m) => [m.projectId, m.role]));

  const result = projects.map((p) => ({
    ...projectToResponse(p, fieldMap.get(p.id) ?? 0, clientMap.get(p.id) ?? 0),
    myRole: roleMap.get(p.id),
  }));

  res.json(result);
});

// POST / — create a new project
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const shape = CreateProjectBody.safeParse(req.body);
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });
  const parsed = StrictCreateProject.safeParse(shape.data);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const userId = req.userId!;
  const [project] = await db
    .insert(projectsTable)
    .values({ ownerId: userId, name: parsed.data.name, description: parsed.data.description ?? null })
    .returning();

  await db.insert(projectUsersTable).values({ projectId: project.id, userId, role: "owner" });

  await logAudit({
    projectId: project.id,
    userId,
    userName: req.userName!,
    action: "created project",
  });

  res.status(201).json(projectToResponse(project, 0, 1));
});

// GET /:projectId — single project (any member)
router.get(
  "/:projectId",
  requireAuth,
  requireProjectAccess("viewer"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.projectId);
    const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    const project = projects[0];
    if (!project) return res.status(404).json({ error: "Not found" });

    const [fields, clients] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentFieldsTable)
        .where(eq(contentFieldsTable.projectId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectUsersTable)
        .where(eq(projectUsersTable.projectId, id)),
    ]);

    res.json({
      ...projectToResponse(project, fields[0]?.count ?? 0, clients[0]?.count ?? 0),
      myRole: req.projectRole,
    });
  },
);

// PATCH /:projectId — admin+
router.patch(
  "/:projectId",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.projectId);

    const shape = UpdateProjectBody.safeParse(req.body);
    if (!shape.success) return res.status(400).json({ error: "Validation failed" });
    const parsed = StrictUpdateProject.safeParse(shape.data);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
    }

    const [updated] = await db
      .update(projectsTable)
      .set(parsed.data)
      .where(eq(projectsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });

    await logAudit({
      projectId: id,
      userId: req.userId!,
      userName: req.userName!,
      action: "updated project",
    });

    const [fields, clients] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentFieldsTable)
        .where(eq(contentFieldsTable.projectId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectUsersTable)
        .where(eq(projectUsersTable.projectId, id)),
    ]);

    res.json(projectToResponse(updated, fields[0]?.count ?? 0, clients[0]?.count ?? 0));
  },
);

// DELETE /:projectId — owner only
router.delete(
  "/:projectId",
  requireAuth,
  requireProjectAccess("owner"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.projectId);
    await logAudit({
      projectId: id,
      userId: req.userId!,
      userName: req.userName!,
      action: "deleted project",
    });
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.status(204).send();
  },
);

export default router;

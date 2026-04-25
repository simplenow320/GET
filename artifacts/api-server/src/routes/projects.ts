import { Router } from "express";
import { db, projectsTable, contentFieldsTable, projectUsersTable, activityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";

const router = Router();

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

// GET /stats — aggregate stats for the current user's owned projects
router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const owned = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, userId));
  const projectIds = owned.map(p => p.id);

  let totalClients = 0;
  let totalFields = 0;

  for (const pid of projectIds) {
    const [clients, fields] = await Promise.all([
      db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, pid)),
      db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, pid)),
    ]);
    totalClients += clients.length;
    totalFields += fields.length;
  }

  // recentEdits: activity in last 7 days across owned projects
  const recentEdits = 0; // placeholder — activity table doesn't have an index on createdAt yet

  res.json({
    totalProjects: owned.length,
    activeProjects: owned.filter(p => p.status === "active").length,
    totalClients,
    totalFields,
    recentEdits,
  });
});

// GET / — list all projects the user is a member of (not just owner)
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  // Get all projects user is a member of
  const memberships = await db
    .select({ projectId: projectUsersTable.projectId, role: projectUsersTable.role })
    .from(projectUsersTable)
    .where(eq(projectUsersTable.userId, userId));

  const result = await Promise.all(
    memberships.map(async ({ projectId, role }) => {
      const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      const project = projects[0];
      if (!project) return null;
      const [fields, clients] = await Promise.all([
        db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, projectId)),
        db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, projectId)),
      ]);
      return { ...projectToResponse(project, fields.length, clients.length), myRole: role };
    })
  );

  res.json(result.filter(Boolean));
});

// POST / — create a new project
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const userId = req.userId!;
  const [project] = await db
    .insert(projectsTable)
    .values({ ownerId: userId, name: parsed.data.name.trim(), description: parsed.data.description })
    .returning();

  // Add creator as owner
  await db.insert(projectUsersTable).values({ projectId: project.id, userId, role: "owner" });

  // Log activity
  await db.insert(activityTable).values({
    projectId: project.id,
    userId,
    userName: req.userName!,
    action: "created project",
    fieldLabel: null,
    newValue: null,
  });

  res.status(201).json(projectToResponse(project, 0, 1));
});

// GET /:projectId — get a single project (membership required)
router.get("/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.projectId);
  const userId = req.userId!;

  // Check membership
  const membership = await db
    .select()
    .from(projectUsersTable)
    .where(and(eq(projectUsersTable.projectId, id), eq(projectUsersTable.userId, userId)));
  if (!membership.length) return res.status(403).json({ error: "Access denied" });

  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  const project = projects[0];
  if (!project) return res.status(404).json({ error: "Not found" });

  const [fields, clients] = await Promise.all([
    db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, id)),
    db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, id)),
  ]);

  res.json({ ...projectToResponse(project, fields.length, clients.length), myRole: membership[0].role });
});

// PATCH /:projectId — update (admin+ only, enforced by checking role)
router.patch("/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.projectId);
  const userId = req.userId!;

  const membership = await db
    .select()
    .from(projectUsersTable)
    .where(and(eq(projectUsersTable.projectId, id), eq(projectUsersTable.userId, userId)));
  const role = membership[0]?.role;
  if (!role || !["owner", "admin"].includes(role)) {
    return res.status(403).json({ error: "Requires admin access or higher" });
  }

  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const [updated] = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });

  const [fields, clients] = await Promise.all([
    db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, id)),
    db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, id)),
  ]);

  res.json(projectToResponse(updated, fields.length, clients.length));
});

// DELETE /:projectId — owner only
router.delete("/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.projectId);
  const userId = req.userId!;

  const membership = await db
    .select()
    .from(projectUsersTable)
    .where(and(eq(projectUsersTable.projectId, id), eq(projectUsersTable.userId, userId)));
  if (membership[0]?.role !== "owner") {
    return res.status(403).json({ error: "Only the project owner can delete this project" });
  }

  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

export default router;

import { Router } from "express";
import { db, projectsTable, contentFieldsTable, projectUsersTable, invitesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";

const router = Router();

router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const owned = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, userId));
  const totalProjects = owned.length;
  const activeProjects = owned.filter(p => p.status === "active").length;
  const projectIds = owned.map(p => p.id);

  let totalClients = 0;
  let totalFields = 0;
  let recentEdits = 0;

  for (const pid of projectIds) {
    const clients = await db.select().from(projectUsersTable).where(eq(projectUsersTable.projectId, pid));
    totalClients += clients.length;
    const fields = await db.select().from(contentFieldsTable).where(eq(contentFieldsTable.projectId, pid));
    totalFields += fields.length;
  }

  res.json({ totalProjects, activeProjects, totalClients, totalFields, recentEdits });
});

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, userId));
  const result = await Promise.all(projects.map(async (p) => {
    const fields = await db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, p.id));
    const clients = await db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, p.id));
    return {
      id: String(p.id),
      name: p.name,
      description: p.description,
      status: p.status,
      fieldCount: fields.length,
      clientCount: clients.length,
      lastActivityAt: p.lastActivityAt?.toISOString(),
      createdAt: p.createdAt.toISOString()
    };
  }));
  res.json(result);
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const userId = req.userId!;
  const [project] = await db.insert(projectsTable)
    .values({ ownerId: userId, name: parsed.data.name, description: parsed.data.description })
    .returning();
  await db.insert(projectUsersTable).values({ projectId: project.id, userId, role: "owner" });
  res.status(201).json({
    id: String(project.id), name: project.name, description: project.description,
    status: project.status, fieldCount: 0, clientCount: 0, createdAt: project.createdAt.toISOString()
  });
});

router.get("/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.projectId);
  const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
  const project = projects[0];
  if (!project) return res.status(404).json({ error: "Not found" });
  const fields = await db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, id));
  const clients = await db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, id));
  res.json({
    id: String(project.id), name: project.name, description: project.description,
    status: project.status, fieldCount: fields.length, clientCount: clients.length,
    lastActivityAt: project.lastActivityAt?.toISOString(), createdAt: project.createdAt.toISOString()
  });
});

router.patch("/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.projectId);
  const parsed = UpdateProjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const [updated] = await db.update(projectsTable).set(parsed.data).where(eq(projectsTable.id, id)).returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  const fields = await db.select({ id: contentFieldsTable.id }).from(contentFieldsTable).where(eq(contentFieldsTable.projectId, id));
  const clients = await db.select({ id: projectUsersTable.id }).from(projectUsersTable).where(eq(projectUsersTable.projectId, id));
  res.json({
    id: String(updated.id), name: updated.name, description: updated.description,
    status: updated.status, fieldCount: fields.length, clientCount: clients.length,
    lastActivityAt: updated.lastActivityAt?.toISOString(), createdAt: updated.createdAt.toISOString()
  });
});

router.delete("/:projectId", requireAuth, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.projectId);
  await db.delete(projectsTable).where(eq(projectsTable.id, id));
  res.status(204).send();
});

export default router;

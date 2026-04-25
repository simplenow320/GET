import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import projectsRouter from "./projects";
import contentRouter from "./content";
import invitesRouter from "./invites";
import domainsRouter from "./domains";
import projectUsersRouter from "./project-users";
import activityRouter from "./activity";
import draftsRouter from "./drafts";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/projects", projectsRouter);
router.use("/projects/:projectId/content", contentRouter);
router.use("/projects/:projectId/invites", invitesRouter);
router.use("/projects/:projectId/domains", domainsRouter);
router.use("/projects/:projectId/users", projectUsersRouter);
router.use("/projects/:projectId/activity", activityRouter);
router.use("/projects/:projectId/drafts", draftsRouter);

export default router;

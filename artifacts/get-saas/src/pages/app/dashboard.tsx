import { Link } from "wouter";
import { format } from "date-fns";
import { useGetProjectStats, useListProjects } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, ArrowRight, FolderOpen,
  LayoutGrid, Users, Type as TypeIcon, Activity,
} from "lucide-react";
import {
  BRAND, tone, line, type, ease,
  PageHeader, SectionTitle, Card, EmptyState, PrimaryButton, IconTile,
} from "@/lib/ui";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const recentProjects = projects?.slice(0, 5) || [];

  return (
    <AppLayout>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "44px clamp(20px, 4vw, 40px) 80px" }}>
        <PageHeader
          title="Overview"
          subtitle="Your projects at a glance."
          action={
            <Link href="/app/projects">
              <PrimaryButton>
                <Plus style={{ width: 14, height: 14 }} />
                New project
              </PrimaryButton>
            </Link>
          }
        />

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
            marginBottom: 44,
          }}
        >
          {[
            { label: "Projects",     value: stats?.totalProjects, icon: LayoutGrid },
            { label: "Clients",      value: stats?.totalClients,  icon: Users },
            { label: "Fields",       value: stats?.totalFields,   icon: TypeIcon },
            { label: "Recent edits", value: stats?.recentEdits,   icon: Activity },
          ].map((s) => (
            <Card key={s.label} padded style={{ padding: "18px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <IconTile icon={s.icon} variant="soft" size={28} />
                <p style={{ fontSize: type.xs, color: tone[500], fontWeight: 500 }}>
                  {s.label}
                </p>
              </div>
              {statsLoading ? (
                <Skeleton style={{ height: 26, width: 56, borderRadius: 6, background: tone[100] }} />
              ) : (
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                    color: BRAND.ink,
                  }}
                >
                  {s.value ?? 0}
                </span>
              )}
            </Card>
          ))}
        </div>

        {/* Recent projects */}
        <SectionTitle
          action={
            <Link href="/app/projects">
              <span
                style={{
                  fontSize: type.sm,
                  color: tone[500],
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontWeight: 500,
                }}
              >
                View all <ArrowRight style={{ width: 13, height: 13 }} />
              </span>
            </Link>
          }
        >
          Recent projects
        </SectionTitle>

        <Card style={{ overflow: "hidden" }}>
          {projectsLoading ? (
            <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} style={{ height: 52, borderRadius: 10, background: tone[100] }} />
              ))}
            </div>
          ) : recentProjects.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No projects yet"
              description="Create your first project to start giving clients safe editing access."
              action={
                <Link href="/app/projects">
                  <PrimaryButton>Create project</PrimaryButton>
                </Link>
              }
            />
          ) : (
            recentProjects.map((project, idx) => (
              <Link key={project.id} href={`/app/projects/${project.id}`}>
                <div
                  style={{
                    padding: "18px 22px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    borderTop: idx > 0 ? `1px solid ${line.faint}` : "none",
                    cursor: "pointer",
                    transition: `background 0.15s ${ease}`,
                    gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = tone[50];
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: type.base, fontWeight: 600, marginBottom: 2 }}>
                      {project.name}
                    </p>
                    <p style={{ fontSize: type.xs, color: tone[500] }}>
                      {format(new Date(project.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 22,
                      color: tone[500],
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ textAlign: "right", minWidth: 44 }}>
                      <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink }}>
                        {project.fieldCount}
                      </p>
                      <p style={{ fontSize: 11, color: tone[500] }}>fields</p>
                    </div>
                    <div style={{ textAlign: "right", minWidth: 44 }}>
                      <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink }}>
                        {project.clientCount}
                      </p>
                      <p style={{ fontSize: 11, color: tone[500] }}>clients</p>
                    </div>
                    <ArrowRight style={{ width: 14, height: 14, color: tone[300] }} />
                  </div>
                </div>
              </Link>
            ))
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

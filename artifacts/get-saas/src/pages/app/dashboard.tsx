import { Link } from "wouter";
import { format } from "date-fns";
import { useGetProjectStats, useListProjects } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight, FolderOpen } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const recentProjects = projects?.slice(0, 5) || [];

  return (
    <AppLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 32px" }}>

        <div style={{ marginBottom: 52, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>Overview</h1>
            <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)" }}>Your projects at a glance.</p>
          </div>
          <Link href="/app/projects">
            <Button
              style={{
                background: "#1a1a2e",
                color: "#fff",
                borderRadius: 10,
                height: 40,
                padding: "0 18px",
                fontSize: 13.5,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: "none",
                cursor: "pointer",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              New project
            </Button>
          </Link>
        </div>

        {/* Stat row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 16, marginBottom: 52 }}>
          {[
            { label: "Projects", value: stats?.totalProjects },
            { label: "Clients", value: stats?.totalClients },
            { label: "Fields", value: stats?.totalFields },
            { label: "Recent edits", value: stats?.recentEdits },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "#fff",
                border: "1px solid rgba(0,0,0,0.05)",
                borderRadius: 16,
                padding: "24px 24px 22px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              }}
            >
              <p style={{ fontSize: 12, color: "rgba(26,26,46,0.45)", marginBottom: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</p>
              {statsLoading ? (
                <Skeleton style={{ height: 32, width: 64, borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
              ) : (
                <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em" }}>{s.value ?? 0}</span>
              )}
            </div>
          ))}
        </div>

        {/* Recent projects */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Recent projects</h2>
            <Link href="/app/projects">
              <span style={{ fontSize: 13, color: "rgba(26,26,46,0.45)", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                View all <ArrowRight style={{ width: 13, height: 13 }} />
              </span>
            </Link>
          </div>

          <div
            style={{
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.05)",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
            }}
          >
            {projectsLoading ? (
              <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} style={{ height: 56, borderRadius: 10, background: "rgba(0,0,0,0.04)" }} />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div style={{ padding: "64px 24px", textAlign: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <FolderOpen style={{ width: 22, height: 22, color: "rgba(26,26,46,0.3)" }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}>No projects yet</p>
                <p style={{ fontSize: 13.5, color: "rgba(26,26,46,0.5)", marginBottom: 24, maxWidth: 320, margin: "0 auto 24px" }}>
                  Create your first project to start giving clients safe editing access.
                </p>
                <Link href="/app/projects">
                  <Button style={{ background: "#1a1a2e", color: "#fff", borderRadius: 10, height: 40, padding: "0 18px", fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer" }}>
                    Create project
                  </Button>
                </Link>
              </div>
            ) : (
              recentProjects.map((project, idx) => (
                <Link key={project.id} href={`/app/projects/${project.id}`}>
                  <div
                    style={{
                      padding: "18px 24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: idx > 0 ? "1px solid rgba(0,0,0,0.04)" : "none",
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.01)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 3 }}>{project.name}</p>
                      <p style={{ fontSize: 12.5, color: "rgba(26,26,46,0.45)" }}>
                        {format(new Date(project.createdAt), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 28, color: "rgba(26,26,46,0.45)" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{project.fieldCount}</p>
                        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Fields</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{project.clientCount}</p>
                        <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Clients</p>
                      </div>
                      <ArrowRight style={{ width: 14, height: 14, color: "rgba(26,26,46,0.2)" }} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
}

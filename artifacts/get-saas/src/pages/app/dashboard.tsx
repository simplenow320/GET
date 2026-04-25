import { Link } from "wouter";
import { format } from "date-fns";
import { useGetProjectStats, useListProjects } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ArrowRight, FolderKanban, Users, Database, Activity } from "lucide-react";

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetProjectStats();
  const { data: projects, isLoading: projectsLoading } = useListProjects();

  const recentProjects = projects?.slice(0, 5) || [];

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Overview</h1>
            <p className="text-black/60 mt-1">Here's what's happening across your projects.</p>
          </div>
          <Link href="/app/projects">
            <Button className="bg-black hover:bg-black/90 text-white rounded-xl shadow-sm h-11 px-6">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Projects"
            value={stats?.totalProjects}
            loading={statsLoading}
            icon={<FolderKanban className="w-4 h-4 text-black/40" />}
          />
          <StatCard
            title="Active Clients"
            value={stats?.totalClients}
            loading={statsLoading}
            icon={<Users className="w-4 h-4 text-black/40" />}
          />
          <StatCard
            title="Content Fields"
            value={stats?.totalFields}
            loading={statsLoading}
            icon={<Database className="w-4 h-4 text-black/40" />}
          />
          <StatCard
            title="Recent Edits"
            value={stats?.recentEdits}
            loading={statsLoading}
            icon={<Activity className="w-4 h-4 text-black/40" />}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Projects</h2>
            <Link href="/app/projects" className="text-sm font-medium text-black/60 hover:text-black flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="bg-white border border-black/[0.04] shadow-sm shadow-black/[0.02] rounded-2xl overflow-hidden">
            {projectsLoading ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-16 w-full rounded-xl bg-black/5" />
                <Skeleton className="h-16 w-full rounded-xl bg-black/5" />
                <Skeleton className="h-16 w-full rounded-xl bg-black/5" />
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FolderKanban className="w-6 h-6 text-black/40" />
                </div>
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-black/60 mb-6 max-w-sm mx-auto">Create your first project to start giving clients safe editing access to your apps.</p>
                <Link href="/app/projects">
                  <Button className="bg-black text-white hover:bg-black/90 rounded-xl h-11 px-6">
                    Create Project
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.04]">
                {recentProjects.map((project) => (
                  <Link key={project.id} href={`/app/projects/${project.id}`}>
                    <div className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-black/[0.01] transition-colors cursor-pointer group">
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-black/80 transition-colors">{project.name}</h3>
                        <p className="text-sm text-black/50 mt-1">
                          Created {format(new Date(project.createdAt), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-6 text-sm text-black/60">
                        <div className="flex flex-col sm:items-end">
                          <span className="font-medium text-black">{project.fieldCount}</span>
                          <span className="text-xs">Fields</span>
                        </div>
                        <div className="flex flex-col sm:items-end">
                          <span className="font-medium text-black">{project.clientCount}</span>
                          <span className="text-xs">Clients</span>
                        </div>
                        <div className="hidden sm:block">
                          <ArrowRight className="w-5 h-5 text-black/20 group-hover:text-black/60 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, loading, icon }: { title: string; value?: number; loading: boolean; icon: React.ReactNode }) {
  return (
    <Card className="bg-white border-black/[0.04] shadow-sm shadow-black/[0.02] rounded-2xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-6 px-6">
        <CardTitle className="text-sm font-medium text-black/60">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {loading ? (
          <Skeleton className="h-8 w-24 bg-black/5" />
        ) : (
          <div className="text-3xl font-bold tracking-tight">{value || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}

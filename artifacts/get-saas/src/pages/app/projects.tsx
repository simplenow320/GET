import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, FolderOpen, Users, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
});

const statusColors: Record<string, { bg: string; text: string }> = {
  active:   { bg: "#ecfdf5", text: "#059669" },
  draft:    { bg: "#fffbeb", text: "#b45309" },
  archived: { bg: "#f4f4f5", text: "#71717a" },
};

export default function Projects() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: projects, isLoading, refetch } = useListProjects();
  const createMutation = useCreateProject();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof createProjectSchema>>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = (values: z.infer<typeof createProjectSchema>) => {
    createMutation.mutate({ data: values }, {
      onSuccess: (project) => {
        setIsDialogOpen(false);
        form.reset();
        refetch();
        setLocation(`/app/setup/${project.id}`);
      },
      onError: (error) => {
        toast({ variant: "destructive", title: "Failed to create project", description: error.message });
      },
    });
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 32px" }}>

        <div style={{ marginBottom: 40, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>Projects</h1>
            <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)" }}>Manage your apps and client access.</p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
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
            </DialogTrigger>
            <DialogContent className="sm:max-w-[440px]" style={{ borderRadius: 20 }}>
              <DialogHeader>
                <DialogTitle style={{ fontSize: 18, fontWeight: 600 }}>Create a new project</DialogTitle>
                <DialogDescription style={{ fontSize: 13.5, color: "rgba(26,26,46,0.5)" }}>
                  Give it a name. You'll map fields and invite clients next.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel style={{ fontSize: 13, fontWeight: 500 }}>Project name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Acme Corp Website" style={{ borderRadius: 10, height: 42 }} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel style={{ fontSize: 13, fontWeight: 500 }}>Description <span style={{ color: "rgba(26,26,46,0.4)", fontWeight: 400 }}>(optional)</span></FormLabel>
                        <FormControl>
                          <Textarea placeholder="A short description" style={{ borderRadius: 10, resize: "none" }} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter style={{ paddingTop: 8 }}>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      style={{
                        width: "100%",
                        background: "#1a1a2e",
                        color: "#fff",
                        borderRadius: 10,
                        height: 42,
                        fontSize: 14,
                        fontWeight: 500,
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {createMutation.isPending ? "Creating…" : "Create project"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {isLoading
            ? Array(6).fill(0).map((_, i) => (
                <div key={i} style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 18, padding: 24 }}>
                  <Skeleton style={{ height: 18, width: "55%", borderRadius: 6, background: "rgba(0,0,0,0.05)", marginBottom: 12 }} />
                  <Skeleton style={{ height: 14, width: "80%", borderRadius: 6, background: "rgba(0,0,0,0.05)", marginBottom: 24 }} />
                  <Skeleton style={{ height: 12, width: "40%", borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
                </div>
              ))
            : projects?.length === 0
            ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: "#fff",
                    border: "1px solid rgba(0,0,0,0.05)",
                    borderRadius: 20,
                    padding: "72px 24px",
                    textAlign: "center",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                    <FolderOpen style={{ width: 24, height: 24, color: "rgba(26,26,46,0.3)" }} />
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>No projects yet</p>
                  <p style={{ fontSize: 13.5, color: "rgba(26,26,46,0.5)", maxWidth: 300, margin: "0 auto 28px" }}>
                    Create your first project and give clients safe access to edit content.
                  </p>
                  <Button
                    onClick={() => setIsDialogOpen(true)}
                    style={{ background: "#1a1a2e", color: "#fff", borderRadius: 10, height: 40, padding: "0 20px", fontSize: 13.5, fontWeight: 500, border: "none", cursor: "pointer" }}
                  >
                    Create project
                  </Button>
                </div>
              )
            : projects?.map((project) => {
                const sc = statusColors[project.status] || statusColors.archived;
                return (
                  <Link key={project.id} href={`/app/projects/${project.id}`}>
                    <div
                      style={{
                        background: "#fff",
                        border: "1px solid rgba(0,0,0,0.05)",
                        borderRadius: 18,
                        padding: "24px 24px 20px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.07)";
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.09)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.03)";
                        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,0,0,0.05)";
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3, flex: 1, marginRight: 12 }}>{project.name}</p>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 20, background: sc.bg, color: sc.text, textTransform: "capitalize", whiteSpace: "nowrap" }}>
                          {project.status}
                        </span>
                      </div>

                      <p style={{ fontSize: 13, color: "rgba(26,26,46,0.5)", lineHeight: 1.5, flex: 1, marginBottom: 20 }}>
                        {project.description || "No description."}
                      </p>

                      <div style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.04)", color: "rgba(26,26,46,0.45)", fontSize: 12.5 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Database style={{ width: 13, height: 13 }} />
                          {project.fieldCount} fields
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <Users style={{ width: 13, height: 13 }} />
                          {project.clientCount} clients
                        </span>
                        <span style={{ marginLeft: "auto" }}>{format(new Date(project.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </AppLayout>
  );
}

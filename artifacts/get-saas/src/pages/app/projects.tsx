import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { useListProjects, useCreateProject } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, FolderOpen, Users, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BRAND, tone, line, type, ease, r,
  PageHeader, EmptyState, Card, PrimaryButton, Pill,
  inputStyle, labelStyle,
} from "@/lib/ui";

const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
});

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
    createMutation.mutate(
      { data: values },
      {
        onSuccess: (project) => {
          setIsDialogOpen(false);
          form.reset();
          refetch();
          setLocation(`/app/setup/${project.id}`);
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Failed to create project",
            description: error.message,
          });
        },
      }
    );
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "44px clamp(20px, 4vw, 40px) 80px" }}>
        <PageHeader
          title="Projects"
          subtitle="Manage your apps and client access."
          action={
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <PrimaryButton>
                  <Plus style={{ width: 14, height: 14 }} />
                  New project
                </PrimaryButton>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[440px]" style={{ borderRadius: 18 }}>
                <DialogHeader>
                  <DialogTitle style={{ fontSize: type.lg, fontWeight: 600, letterSpacing: "-0.015em" }}>
                    Create a project
                  </DialogTitle>
                  <DialogDescription style={{ fontSize: type.sm, color: tone[500], marginTop: 4 }}>
                    Name it now — you'll connect your app and add fields next.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      paddingTop: 8,
                    }}
                  >
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={labelStyle}>Project name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Acme Corp Website"
                              style={inputStyle}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage style={{ fontSize: type.xs }} />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel style={labelStyle}>
                            Description{" "}
                            <span style={{ color: tone[400], fontWeight: 400 }}>
                              (optional)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="A short description"
                              style={{ borderRadius: r.md, resize: "none", fontSize: type.base }}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage style={{ fontSize: type.xs }} />
                        </FormItem>
                      )}
                    />
                    <DialogFooter style={{ paddingTop: 4 }}>
                      <PrimaryButton
                        type="submit"
                        size="lg"
                        block
                        loading={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Creating…" : "Create project"}
                      </PrimaryButton>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          }
        />

        {/* Project grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
            gap: 16,
          }}
        >
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <Card key={i} padded>
                <Skeleton style={{ height: 18, width: "55%", borderRadius: 6, background: tone[100], marginBottom: 12 }} />
                <Skeleton style={{ height: 14, width: "80%", borderRadius: 6, background: tone[100], marginBottom: 24 }} />
                <Skeleton style={{ height: 12, width: "40%", borderRadius: 6, background: tone[100] }} />
              </Card>
            ))
          ) : projects?.length === 0 ? (
            <Card style={{ gridColumn: "1 / -1" }}>
              <EmptyState
                icon={FolderOpen}
                title="No projects yet"
                description="Create your first project and give clients safe access to edit content."
                action={
                  <PrimaryButton onClick={() => setIsDialogOpen(true)}>
                    Create project
                  </PrimaryButton>
                }
              />
            </Card>
          ) : (
            projects?.map((project) => (
              <Link key={project.id} href={`/app/projects/${project.id}`}>
                <Card
                  style={{
                    padding: "22px 22px 18px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    transition: `box-shadow 0.18s ${ease}, border-color 0.18s ${ease}, transform 0.18s ${ease}`,
                  }}
                  as="div"
                >
                  <div
                    onMouseEnter={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.boxShadow =
                        "0 6px 20px rgba(0,0,0,0.05)";
                      (e.currentTarget.parentElement as HTMLElement).style.borderColor = tone[200];
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget.parentElement as HTMLElement).style.boxShadow =
                        "0 1px 2px rgba(0,0,0,0.02)";
                      (e.currentTarget.parentElement as HTMLElement).style.borderColor = line.faint;
                    }}
                    style={{ display: "flex", flexDirection: "column", height: "100%" }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 10,
                        gap: 10,
                      }}
                    >
                      <p
                        style={{
                          fontSize: type.md,
                          fontWeight: 600,
                          lineHeight: 1.3,
                          flex: 1,
                          letterSpacing: "-0.01em",
                        }}
                      >
                        {project.name}
                      </p>
                      <Pill variant={(project.status as any) || "archived"}>
                        {project.status}
                      </Pill>
                    </div>

                    <p
                      style={{
                        fontSize: type.sm,
                        color: tone[500],
                        lineHeight: 1.55,
                        flex: 1,
                        marginBottom: 18,
                      }}
                    >
                      {project.description || "No description."}
                    </p>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        paddingTop: 14,
                        borderTop: `1px solid ${line.faint}`,
                        color: tone[500],
                        fontSize: type.xs,
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Database style={{ width: 12, height: 12 }} />
                        {project.fieldCount}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Users style={{ width: 12, height: 12 }} />
                        {project.clientCount}
                      </span>
                      <span style={{ marginLeft: "auto" }}>
                        {format(new Date(project.createdAt), "MMM d")}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}

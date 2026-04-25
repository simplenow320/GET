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
import { Plus, FolderKanban, ArrowRight, Activity, Users, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

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
    defaultValues: {
      name: "",
      description: "",
    },
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
        toast({
          variant: "destructive",
          title: "Failed to create project",
          description: error.message,
        });
      }
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "draft": return "bg-amber-50 text-amber-700 border-amber-200";
      case "archived": return "bg-gray-100 text-gray-700 border-gray-200";
      default: return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="text-black/60 mt-1">Manage your applications and client access.</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-black hover:bg-black/90 text-white rounded-xl shadow-sm h-11 px-6">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] rounded-2xl">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Give your project a name. You'll be able to invite clients and map fields next.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Acme Corp Website" className="rounded-xl h-11" {...field} />
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
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="A brief description of this project" className="resize-none rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter className="pt-4">
                    <Button type="submit" className="w-full rounded-xl h-11 bg-black text-white hover:bg-black/90" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Project"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white border border-black/[0.04] shadow-sm shadow-black/[0.02] rounded-2xl p-6 space-y-4">
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-1/2 bg-black/5" />
                  <Skeleton className="h-6 w-16 rounded-full bg-black/5" />
                </div>
                <Skeleton className="h-4 w-full bg-black/5" />
                <div className="flex gap-4 pt-4">
                  <Skeleton className="h-8 w-16 bg-black/5" />
                  <Skeleton className="h-8 w-16 bg-black/5" />
                </div>
              </div>
            ))
          ) : projects?.length === 0 ? (
            <div className="col-span-full bg-white border border-black/[0.04] shadow-sm rounded-2xl p-12 text-center flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mb-4">
                <FolderKanban className="w-8 h-8 text-black/40" />
              </div>
              <h3 className="text-xl font-medium mb-2">No projects yet</h3>
              <p className="text-black/60 max-w-sm mb-6">Create your first project to start giving clients safe editing access to your apps.</p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-black text-white hover:bg-black/90 rounded-xl h-11 px-6">
                Create Project
              </Button>
            </div>
          ) : (
            projects?.map((project) => (
              <Link key={project.id} href={`/app/projects/${project.id}`}>
                <div className="group bg-white border border-black/[0.04] shadow-sm shadow-black/[0.02] rounded-2xl p-6 hover:shadow-md hover:border-black/[0.08] transition-all cursor-pointer flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-black/80 transition-colors" title={project.name}>{project.name}</h3>
                    <Badge variant="outline" className={`capitalize rounded-full font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-black/60 line-clamp-2 mb-6 flex-1">
                    {project.description || "No description provided."}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-black/50 pt-4 border-t border-black/[0.04]">
                    <div className="flex items-center gap-1.5" title="Content Fields">
                      <Database className="w-4 h-4" />
                      <span>{project.fieldCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5" title="Clients">
                      <Users className="w-4 h-4" />
                      <span>{project.clientCount}</span>
                    </div>
                    <div className="ml-auto text-xs">
                      {format(new Date(project.createdAt), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
}

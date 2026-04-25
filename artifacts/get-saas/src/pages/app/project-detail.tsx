import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { format } from "date-fns";
import {
  useGetProject,
  useUpdateProject,
  useDeleteProject,
  useListContentFields,
  useCreateContentField,
  useUpdateContentField,
  useDeleteContentField,
  useListInvites,
  useCreateInvite,
  useRevokeInvite,
  useListDomains,
  useAddDomain,
  useRemoveDomain,
  useListProjectUsers,
  useUpdateUserRole,
  useListActivity,
  useListDrafts,
  usePublishDraft,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Loader2, Globe, Users, Database, FileEdit, Settings, Trash2, 
  Lock, Unlock, Plus, Activity as ActivityIcon, ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useGetProject(projectId, { 
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } 
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 md:p-10 max-w-6xl mx-auto">
          <Skeleton className="h-10 w-1/3 mb-8 bg-black/5" />
          <Skeleton className="h-96 w-full rounded-2xl bg-black/5" />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div className="p-6 md:p-10 max-w-6xl mx-auto text-center py-20">
          <h2 className="text-2xl font-semibold mb-2">Project not found</h2>
          <Link href="/app/projects">
            <Button className="bg-black text-white hover:bg-black/90 rounded-xl">Back to Projects</Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <Link href="/app/projects">
            <Button variant="ghost" size="icon" className="text-black/60 hover:text-black hover:bg-black/5 rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
              {project.name}
              <Badge variant="outline" className="capitalize text-xs font-medium rounded-full bg-black/5 border-transparent text-black/70">
                {project.status}
              </Badge>
            </h1>
            <p className="text-black/60 mt-1">{project.description || "No description"}</p>
          </div>
        </div>

        <Tabs defaultValue="content" className="w-full">
          <TabsList className="w-full sm:w-auto h-auto p-1 bg-black/5 rounded-xl flex flex-wrap sm:flex-nowrap gap-1">
            <TabsTrigger value="content" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm px-4 py-2">
              <Database className="w-4 h-4 mr-2" /> Content Map
            </TabsTrigger>
            <TabsTrigger value="clients" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm px-4 py-2">
              <Users className="w-4 h-4 mr-2" /> Clients
            </TabsTrigger>
            <TabsTrigger value="domains" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm px-4 py-2">
              <Globe className="w-4 h-4 mr-2" /> Domains
            </TabsTrigger>
            <TabsTrigger value="drafts" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm px-4 py-2">
              <FileEdit className="w-4 h-4 mr-2" /> Drafts
            </TabsTrigger>
            <TabsTrigger value="activity" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm px-4 py-2">
              <ActivityIcon className="w-4 h-4 mr-2" /> Activity
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-black data-[state=active]:shadow-sm px-4 py-2">
              <Settings className="w-4 h-4 mr-2" /> Settings
            </TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="content">
              <ContentMapTab projectId={project.id} />
            </TabsContent>
            
            <TabsContent value="clients">
              <ClientsTab projectId={project.id} />
            </TabsContent>
            
            <TabsContent value="domains">
              <DomainsTab projectId={project.id} />
            </TabsContent>
            
            <TabsContent value="drafts">
              <DraftsTab projectId={project.id} />
            </TabsContent>
            
            <TabsContent value="activity">
              <ActivityTab projectId={project.id} />
            </TabsContent>
            
            <TabsContent value="settings">
              <SettingsTab project={project} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// --- Tabs Components ---

function ContentMapTab({ projectId }: { projectId: string }) {
  const { data: fields, isLoading, refetch } = useListContentFields(projectId);
  const createMutation = useCreateContentField();
  const updateMutation = useUpdateContentField();
  const deleteMutation = useDeleteContentField();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<any>("text");

  const handleAdd = () => {
    createMutation.mutate({
      projectId,
      data: { label: newLabel, type: newType }
    }, {
      onSuccess: () => {
        setIsAdding(false);
        setNewLabel("");
        setNewType("text");
        refetch();
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const handleToggleLock = (fieldId: string, currentLocked: boolean) => {
    updateMutation.mutate({
      projectId,
      fieldId,
      data: { isLocked: !currentLocked }
    }, {
      onSuccess: () => refetch(),
    });
  };

  const handleDelete = (fieldId: string) => {
    deleteMutation.mutate({ projectId, fieldId }, {
      onSuccess: () => refetch(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Content Fields</h2>
          <p className="text-black/60 text-sm mt-1">Map out the fields your clients can edit.</p>
        </div>
        <Button onClick={() => setIsAdding(true)} className="bg-black text-white hover:bg-black/90 rounded-xl h-10 px-4">
          <Plus className="w-4 h-4 mr-2" /> Add Field
        </Button>
      </div>

      {isAdding && (
        <Card className="rounded-2xl border-black/[0.04] shadow-sm shadow-black/[0.02]">
          <CardContent className="pt-6 flex items-end gap-4">
            <div className="grid flex-1 gap-2">
              <Label>Field Label</Label>
              <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Hero Headline" className="rounded-xl h-10" />
            </div>
            <div className="grid flex-1 gap-2">
              <Label>Field Type</Label>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text (Single Line)</SelectItem>
                  <SelectItem value="richtext">Rich Text (Multi-line)</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="url">URL / Link</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Toggle (Yes/No)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsAdding(false)} className="rounded-xl h-10">Cancel</Button>
              <Button onClick={handleAdd} className="bg-black text-white hover:bg-black/90 rounded-xl h-10" disabled={!newLabel || createMutation.isPending}>
                {createMutation.isPending ? "Adding..." : "Save"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="bg-white border border-black/[0.04] shadow-sm shadow-black/[0.02] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
        {isLoading ? (
          <div className="p-6"><Skeleton className="h-12 w-full bg-black/5" /></div>
        ) : fields?.length === 0 ? (
          <div className="p-12 text-center text-black/60">No content fields mapped yet.</div>
        ) : (
          fields?.map((field) => (
            <div key={field.id} className="p-4 sm:p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center">
                  <Database className="w-5 h-5 text-black/60" />
                </div>
                <div>
                  <h4 className="font-medium text-black">{field.label}</h4>
                  <p className="text-xs text-black/50 uppercase tracking-wider font-semibold mt-0.5">{field.type}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleToggleLock(field.id, field.isLocked)}
                  className={`rounded-lg ${field.isLocked ? 'text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-black/60 hover:bg-black/5 hover:text-black'}`}
                >
                  {field.isLocked ? <Lock className="w-4 h-4 mr-2" /> : <Unlock className="w-4 h-4 mr-2" />}
                  {field.isLocked ? "Locked" : "Unlocked"}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(field.id)} className="text-black/40 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ClientsTab({ projectId }: { projectId: string }) {
  const { data: users, refetch: refetchUsers } = useListProjectUsers(projectId);
  const { data: invites, refetch: refetchInvites } = useListInvites(projectId);
  const inviteMutation = useCreateInvite();
  const revokeMutation = useRevokeInvite();
  const roleMutation = useUpdateUserRole();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<any>("editor");

  const handleInvite = () => {
    inviteMutation.mutate({
      projectId,
      data: { email, role }
    }, {
      onSuccess: () => {
        setEmail("");
        refetchInvites();
        toast({ title: "Invite sent" });
      }
    });
  };

  return (
    <div className="space-y-8">
      <Card className="rounded-2xl border-black/[0.04] shadow-sm shadow-black/[0.02]">
        <CardHeader>
          <CardTitle>Invite Client</CardTitle>
          <CardDescription>Send an invitation to edit this project.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
          <div className="grid flex-1 gap-2">
            <Label>Email Address</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@example.com" className="rounded-xl h-10" />
          </div>
          <div className="grid w-48 gap-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="rounded-xl h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleInvite} className="bg-black text-white hover:bg-black/90 rounded-xl h-10" disabled={!email || inviteMutation.isPending}>
            {inviteMutation.isPending ? "Sending..." : "Send Invite"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Active Clients</h3>
        <div className="bg-white border border-black/[0.04] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
          {users?.length === 0 ? (
            <div className="p-8 text-center text-black/60">No clients yet.</div>
          ) : (
            users?.map(u => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center font-medium text-black/70">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-sm text-black/60">{u.email}</div>
                  </div>
                </div>
                <Select value={u.role} onValueChange={(r) => roleMutation.mutate({ projectId, userId: u.id, data: { role: r as any } }, { onSuccess: () => refetchUsers() })}>
                  <SelectTrigger className="w-32 rounded-xl h-9 bg-transparent border-black/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner" disabled>Owner</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </div>
      </div>

      {invites && invites.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Pending Invites</h3>
          <div className="bg-white border border-black/[0.04] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
            {invites.map(inv => (
              <div key={inv.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-black/60 flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px] uppercase bg-black/5 text-black/60">{inv.role}</Badge>
                    <span>{inv.status}</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg" 
                  onClick={() => revokeMutation.mutate({ projectId, inviteId: inv.id }, { onSuccess: () => refetchInvites() })}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DomainsTab({ projectId }: { projectId: string }) {
  const { data: domains, refetch } = useListDomains(projectId);
  const addMutation = useAddDomain();
  const removeMutation = useRemoveDomain();
  const [hostname, setHostname] = useState("");

  const handleAdd = () => {
    addMutation.mutate({ projectId, data: { hostname } }, {
      onSuccess: () => {
        setHostname("");
        refetch();
      }
    });
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-black/[0.04] shadow-sm">
        <CardHeader>
          <CardTitle>Allowed Domains</CardTitle>
          <CardDescription>Where this editor can be embedded via iframe.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="e.g. yoursite.com" className="rounded-xl h-10" />
          <Button onClick={handleAdd} disabled={!hostname || addMutation.isPending} className="bg-black text-white hover:bg-black/90 rounded-xl h-10">
            Add Domain
          </Button>
        </CardContent>
      </Card>

      <div className="bg-white border border-black/[0.04] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
        {domains?.length === 0 ? (
          <div className="p-8 text-center text-black/60">No domains added. Default Replit domains are allowed.</div>
        ) : (
          domains?.map(d => (
            <div key={d.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-black/40" />
                <span className="font-medium">{d.hostname}</span>
                {d.verified && <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">Verified</Badge>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeMutation.mutate({ projectId, domainId: d.id }, { onSuccess: () => refetch() })} className="text-black/40 hover:text-red-600 hover:bg-red-50 rounded-lg">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DraftsTab({ projectId }: { projectId: string }) {
  const { data: drafts, refetch } = useListDrafts(projectId);
  const publishMutation = usePublishDraft();

  const handlePublish = (draftId: string) => {
    publishMutation.mutate({ projectId, draftId }, {
      onSuccess: () => refetch()
    });
  };

  const pendingDrafts = drafts?.filter(d => d.status === "pending") || [];
  const pastDrafts = drafts?.filter(d => d.status !== "pending") || [];

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Pending Reviews</h3>
        <div className="bg-white border border-black/[0.04] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
          {pendingDrafts.length === 0 ? (
            <div className="p-8 text-center text-black/60">No pending drafts to review.</div>
          ) : (
            pendingDrafts.map(d => (
              <div key={d.id} className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium">{d.fieldLabel}</div>
                    <div className="text-sm text-black/60 mt-0.5">Proposed by {d.authorName} on {format(new Date(d.createdAt), "MMM d, h:mm a")}</div>
                  </div>
                  <Button onClick={() => handlePublish(d.id)} disabled={publishMutation.isPending} className="bg-black text-white hover:bg-black/90 rounded-xl h-9 text-sm">
                    Publish Change
                  </Button>
                </div>
                <div className="bg-black/[0.02] p-4 rounded-xl text-sm font-mono border border-black/[0.04] break-all">
                  {d.value}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Past Drafts</h3>
        <div className="bg-white border border-black/[0.04] rounded-2xl overflow-hidden divide-y divide-black/[0.04]">
          {pastDrafts.length === 0 ? (
            <div className="p-8 text-center text-black/60">No past drafts.</div>
          ) : (
            pastDrafts.map(d => (
              <div key={d.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium mr-2">{d.fieldLabel}</span>
                  <span className="text-black/60">by {d.authorName}</span>
                </div>
                <Badge variant="outline" className={d.status === "published" ? "bg-emerald-50 text-emerald-700" : ""}>
                  {d.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ projectId }: { projectId: string }) {
  const { data: activity } = useListActivity(projectId);

  return (
    <div className="space-y-4">
      <div className="bg-white border border-black/[0.04] rounded-2xl p-6">
        {activity?.length === 0 ? (
          <div className="text-center text-black/60 py-8">No activity yet.</div>
        ) : (
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-black/5">
            {activity?.map(a => (
              <div key={a.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-black/5 text-black/40 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 shadow-sm">
                  <ActivityIcon className="w-4 h-4" />
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-black/[0.04] shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-medium text-sm">{a.userName}</div>
                    <div className="text-xs text-black/50">{format(new Date(a.createdAt), "MMM d, h:mm a")}</div>
                  </div>
                  <div className="text-sm text-black/70">
                    <span className="font-medium text-black">{a.action}</span>
                    {a.fieldLabel && <span> on field <span className="font-medium text-black">"{a.fieldLabel}"</span></span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ project }: { project: any }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description || "");

  const handleSave = () => {
    updateMutation.mutate({ projectId: project.id, data: { name, description: desc } }, {
      onSuccess: () => toast({ title: "Project updated" })
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure? This cannot be undone.")) {
      deleteMutation.mutate({ projectId: project.id }, {
        onSuccess: () => setLocation("/app/projects")
      });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="rounded-2xl border-black/[0.04] shadow-sm">
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Project Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} className="rounded-xl h-10" />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} className="rounded-xl resize-none" />
          </div>
          <Button onClick={handleSave} disabled={updateMutation.isPending} className="bg-black text-white hover:bg-black/90 rounded-xl h-10">
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-red-100 shadow-sm bg-red-50/50">
        <CardHeader>
          <CardTitle className="text-red-600">Danger Zone</CardTitle>
          <CardDescription>Permanently delete this project and all its data.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete} className="rounded-xl h-10">
            Delete Project
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe, Users, Database, FileEdit, Settings, Trash2,
  Lock, Unlock, Plus, Activity as ActivityIcon, ArrowLeft, Loader2,
  KeyRound, Eye, EyeOff, Copy, Check, RefreshCw, ShieldCheck, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("auth_token") ?? "";
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers ?? {}) },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

const S = {
  card: {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.05)",
    borderRadius: 18,
    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 16,
    color: "#1a1a2e",
  } as React.CSSProperties,
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderTop: "1px solid rgba(0,0,0,0.04)",
  } as React.CSSProperties,
  emptyState: {
    padding: "52px 24px",
    textAlign: "center",
    color: "rgba(26,26,46,0.45)",
    fontSize: 13.5,
  } as React.CSSProperties,
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 32px" }}>
          <Skeleton style={{ height: 28, width: "35%", borderRadius: 8, background: "rgba(0,0,0,0.05)", marginBottom: 32 }} />
          <Skeleton style={{ height: 400, borderRadius: 18, background: "rgba(0,0,0,0.04)" }} />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 32px", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 20 }}>Project not found</p>
          <Link href="/app/projects">
            <Button style={{ background: "#1a1a2e", color: "#fff", borderRadius: 10, height: 40, padding: "0 18px", border: "none", cursor: "pointer", fontSize: 13.5 }}>
              Back to projects
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const statusBg: Record<string, string> = { active: "#ecfdf5", draft: "#fffbeb", archived: "#f4f4f5" };
  const statusColor: Record<string, string> = { active: "#059669", draft: "#b45309", archived: "#71717a" };

  return (
    <AppLayout>
      <div style={{ maxWidth: 820, margin: "0 auto", padding: "52px 32px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 40 }}>
          <Link href="/app/projects">
            <button style={{ width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(26,26,46,0.5)", flexShrink: 0, marginTop: 2 }}>
              <ArrowLeft style={{ width: 15, height: 15 }} />
            </button>
          </Link>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em" }}>{project.name}</h1>
              <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 20, background: statusBg[project.status] || "#f4f4f5", color: statusColor[project.status] || "#71717a", textTransform: "capitalize" }}>
                {project.status}
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: "rgba(26,26,46,0.45)" }}>{project.description || "No description"}</p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="content">
          <TabsList
            style={{
              background: "rgba(0,0,0,0.04)",
              padding: 4,
              borderRadius: 12,
              height: "auto",
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              width: "fit-content",
            }}
          >
            {[
              { value: "content", icon: Database, label: "Content" },
              { value: "clients", icon: Users, label: "Clients" },
              { value: "domains", icon: Globe, label: "Domains" },
              { value: "drafts", icon: FileEdit, label: "Drafts" },
              { value: "keys", icon: KeyRound, label: "API Keys" },
              { value: "activity", icon: ActivityIcon, label: "Activity" },
              { value: "settings", icon: Settings, label: "Settings" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                style={{ borderRadius: 9, padding: "7px 14px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1a1a2e] text-[rgba(26,26,46,0.5)]"
              >
                <tab.icon style={{ width: 13, height: 13 }} />
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div style={{ marginTop: 32 }}>
            <TabsContent value="content"><ContentMapTab projectId={project.id} /></TabsContent>
            <TabsContent value="clients"><ClientsTab projectId={project.id} /></TabsContent>
            <TabsContent value="domains"><DomainsTab projectId={project.id} /></TabsContent>
            <TabsContent value="drafts"><DraftsTab projectId={project.id} /></TabsContent>
            <TabsContent value="keys"><KeysTab projectId={project.id} /></TabsContent>
            <TabsContent value="activity"><ActivityTab projectId={project.id} /></TabsContent>
            <TabsContent value="settings"><SettingsTab project={project} /></TabsContent>
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ── Content Map ─────────────────────────────────────────────────────────────

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
    createMutation.mutate({ projectId, data: { label: newLabel, type: newType } }, {
      onSuccess: () => { setIsAdding(false); setNewLabel(""); setNewType("text"); refetch(); },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={S.sectionTitle}>Content fields</p>
          <p style={{ fontSize: 13, color: "rgba(26,26,46,0.45)", marginTop: -12 }}>What your clients can edit.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, padding: "8px 14px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", cursor: "pointer" }}
        >
          <Plus style={{ width: 13, height: 13 }} /> Add field
        </button>
      </div>

      {isAdding && (
        <div style={{ ...S.card, padding: 20, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
            <Label style={{ fontSize: 12.5, fontWeight: 500 }}>Label</Label>
            <Input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. Hero Headline" style={{ height: 40, borderRadius: 9, fontSize: 13.5 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
            <Label style={{ fontSize: 12.5, fontWeight: 500 }}>Type</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger style={{ height: 40, borderRadius: 9, fontSize: 13.5 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="richtext">Rich text</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Toggle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setIsAdding(false)} style={{ height: 40, padding: "0 14px", borderRadius: 9, border: "1px solid rgba(0,0,0,0.12)", background: "transparent", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAdd} disabled={!newLabel || createMutation.isPending} style={{ height: 40, padding: "0 14px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      <div style={S.card}>
        {isLoading ? (
          <div style={{ padding: 20 }}><Skeleton style={{ height: 48, borderRadius: 8, background: "rgba(0,0,0,0.04)" }} /></div>
        ) : !fields?.length ? (
          <div style={S.emptyState}>No content fields yet. Add one above.</div>
        ) : (
          fields.map((field, idx) => (
            <div key={field.id} style={{ ...S.row, borderTop: idx === 0 ? "none" : S.row.borderTop }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Database style={{ width: 15, height: 15, color: "rgba(26,26,46,0.4)" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{field.label}</p>
                  <p style={{ fontSize: 11.5, color: "rgba(26,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginTop: 2 }}>{field.type}</p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  onClick={() => updateMutation.mutate({ projectId, fieldId: field.id, data: { isLocked: !field.isLocked } }, { onSuccess: () => refetch() })}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 500, padding: "5px 12px", borderRadius: 8, cursor: "pointer", border: "none",
                    background: field.isLocked ? "#fffbeb" : "rgba(0,0,0,0.05)",
                    color: field.isLocked ? "#b45309" : "rgba(26,26,46,0.55)",
                  }}
                >
                  {field.isLocked ? <Lock style={{ width: 12, height: 12 }} /> : <Unlock style={{ width: 12, height: 12 }} />}
                  {field.isLocked ? "Locked" : "Unlocked"}
                </button>
                <button onClick={() => deleteMutation.mutate({ projectId, fieldId: field.id }, { onSuccess: () => refetch() })}
                  style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(26,26,46,0.3)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(26,26,46,0.3)"; }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Clients ─────────────────────────────────────────────────────────────────

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
    inviteMutation.mutate({ projectId, data: { email, role } }, {
      onSuccess: () => { setEmail(""); refetchInvites(); toast({ title: "Invite sent" }); },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Invite form */}
      <div style={{ ...S.card, padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Invite a client</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 2, minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
            <Label style={{ fontSize: 12.5, fontWeight: 500 }}>Email address</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" style={{ height: 40, borderRadius: 9, fontSize: 13.5 }} />
          </div>
          <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 6 }}>
            <Label style={{ fontSize: 12.5, fontWeight: 500 }}>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger style={{ height: 40, borderRadius: 9, fontSize: 13.5 }}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <button
            onClick={handleInvite}
            disabled={!email || inviteMutation.isPending}
            style={{ height: 40, padding: "0 16px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            {inviteMutation.isPending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>

      {/* Active clients */}
      <div>
        <p style={S.sectionTitle}>Active clients</p>
        <div style={S.card}>
          {!users?.length ? (
            <div style={S.emptyState}>No clients yet.</div>
          ) : (
            users.map((u, idx) => (
              <div key={u.id} style={{ ...S.row, borderTop: idx === 0 ? "none" : S.row.borderTop }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "rgba(0,0,0,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14.5, color: "#1a1a2e" }}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{u.name}</p>
                    <p style={{ fontSize: 12.5, color: "rgba(26,26,46,0.45)" }}>{u.email}</p>
                  </div>
                </div>
                <Select value={u.role} onValueChange={r => roleMutation.mutate({ projectId, userId: u.id, data: { role: r as any } }, { onSuccess: () => refetchUsers() })}>
                  <SelectTrigger style={{ width: 120, height: 36, borderRadius: 9, fontSize: 13, border: "1px solid rgba(0,0,0,0.1)", background: "transparent" }}><SelectValue /></SelectTrigger>
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

      {/* Pending invites */}
      {!!invites?.length && (
        <div>
          <p style={S.sectionTitle}>Pending invites</p>
          <div style={S.card}>
            {invites.map((inv, idx) => (
              <div key={inv.id} style={{ ...S.row, borderTop: idx === 0 ? "none" : S.row.borderTop }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>{inv.email}</p>
                  <p style={{ fontSize: 12, color: "rgba(26,26,46,0.45)", marginTop: 2, textTransform: "capitalize" }}>{inv.role} · {inv.status}</p>
                </div>
                <button
                  onClick={() => revokeMutation.mutate({ projectId, inviteId: inv.id }, { onSuccess: () => refetchInvites() })}
                  style={{ fontSize: 12.5, padding: "5px 12px", borderRadius: 8, border: "none", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontWeight: 500 }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Domains ──────────────────────────────────────────────────────────────────

function DomainsTab({ projectId }: { projectId: string }) {
  const { data: domains, refetch } = useListDomains(projectId);
  const addMutation = useAddDomain();
  const removeMutation = useRemoveDomain();
  const [hostname, setHostname] = useState("");

  const handleAdd = () => {
    addMutation.mutate({ projectId, data: { hostname } }, {
      onSuccess: () => { setHostname(""); refetch(); }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...S.card, padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Add a domain</p>
        <p style={{ fontSize: 13, color: "rgba(26,26,46,0.5)", marginBottom: 16 }}>Restrict where this editor can be embedded via iframe.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <Input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="e.g. yoursite.com" style={{ flex: 1, height: 40, borderRadius: 9, fontSize: 13.5 }} />
          <button
            onClick={handleAdd}
            disabled={!hostname || addMutation.isPending}
            style={{ height: 40, padding: "0 16px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}
          >
            Add domain
          </button>
        </div>
      </div>

      <div style={S.card}>
        {!domains?.length ? (
          <div style={S.emptyState}>No domains added. Default Replit domains are allowed.</div>
        ) : (
          domains.map((d, idx) => (
            <div key={d.id} style={{ ...S.row, borderTop: idx === 0 ? "none" : S.row.borderTop }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Globe style={{ width: 14, height: 14, color: "rgba(26,26,46,0.35)" }} />
                <span style={{ fontSize: 14, fontWeight: 500 }}>{d.hostname}</span>
                {d.verified && (
                  <span style={{ fontSize: 11, fontWeight: 500, background: "#ecfdf5", color: "#059669", padding: "2px 8px", borderRadius: 6 }}>Verified</span>
                )}
              </div>
              <button
                onClick={() => removeMutation.mutate({ projectId, domainId: d.id }, { onSuccess: () => refetch() })}
                style={{ width: 32, height: 32, borderRadius: 8, border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(26,26,46,0.3)" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fef2f2"; (e.currentTarget as HTMLElement).style.color = "#dc2626"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(26,26,46,0.3)"; }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Drafts ───────────────────────────────────────────────────────────────────

function DraftsTab({ projectId }: { projectId: string }) {
  const { data: drafts, refetch } = useListDrafts(projectId);
  const publishMutation = usePublishDraft();
  const { toast } = useToast();

  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const handleReject = async (draftId: string) => {
    setRejectingId(draftId);
    try {
      await apiFetch(`/api/projects/${projectId}/drafts/${draftId}/reject`, { method: "POST" });
      refetch();
      toast({ title: "Draft rejected" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setRejectingId(null);
    }
  };

  const pendingDrafts = drafts?.filter(d => d.status === "pending") || [];
  const pastDrafts = drafts?.filter(d => d.status !== "pending") || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <p style={S.sectionTitle}>Pending review</p>
        <div style={S.card}>
          {!pendingDrafts.length ? (
            <div style={S.emptyState}>No drafts waiting for review.</div>
          ) : (
            pendingDrafts.map((d, idx) => (
              <div key={d.id} style={{ padding: "20px 22px", borderTop: idx > 0 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{d.fieldLabel}</p>
                    <p style={{ fontSize: 12.5, color: "rgba(26,26,46,0.45)", marginTop: 3 }}>
                      By {d.authorName} · {format(new Date(d.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => handleReject(d.id)}
                      disabled={rejectingId === d.id}
                      style={{ height: 36, padding: "0 14px", borderRadius: 9, background: "#fef2f2", color: "#dc2626", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                    >
                      {rejectingId === d.id ? "…" : "Reject"}
                    </button>
                    <button
                      onClick={() => publishMutation.mutate({ projectId, draftId: d.id }, { onSuccess: () => refetch() })}
                      disabled={publishMutation.isPending}
                      style={{ height: 36, padding: "0 16px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
                    >
                      Publish
                    </button>
                  </div>
                </div>
                <div style={{ background: "rgba(0,0,0,0.02)", border: "1px solid rgba(0,0,0,0.05)", borderRadius: 10, padding: "12px 14px", fontSize: 13, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.6 }}>
                  {d.value}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {!!pastDrafts.length && (
        <div>
          <p style={S.sectionTitle}>History</p>
          <div style={S.card}>
            {pastDrafts.map((d, idx) => (
              <div key={d.id} style={{ ...S.row, borderTop: idx === 0 ? "none" : S.row.borderTop }}>
                <div>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{d.fieldLabel}</span>
                  <span style={{ fontSize: 13, color: "rgba(26,26,46,0.45)", marginLeft: 8 }}>by {d.authorName}</span>
                </div>
                <span style={{
                  fontSize: 11.5, fontWeight: 500, padding: "3px 9px", borderRadius: 6,
                  background: d.status === "published" ? "#ecfdf5" : "rgba(0,0,0,0.05)",
                  color: d.status === "published" ? "#059669" : "rgba(26,26,46,0.5)",
                  textTransform: "capitalize",
                }}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────

function ActivityTab({ projectId }: { projectId: string }) {
  const { data: activity } = useListActivity(projectId);

  return (
    <div style={S.card}>
      {!activity?.length ? (
        <div style={S.emptyState}>No activity yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activity.map((a, idx) => (
            <div key={a.id} style={{ display: "flex", gap: 14, padding: "18px 22px", borderTop: idx > 0 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                <ActivityIcon style={{ width: 13, height: 13, color: "rgba(26,26,46,0.4)" }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <p style={{ fontSize: 13.5, color: "#1a1a2e", lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 600 }}>{a.userName}</span>
                    {" "}
                    <span style={{ color: "rgba(26,26,46,0.6)" }}>{a.action}</span>
                    {a.fieldLabel && <>{" "}<span style={{ fontWeight: 500 }}>"{a.fieldLabel}"</span></>}
                  </p>
                  <span style={{ fontSize: 11.5, color: "rgba(26,26,46,0.4)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {format(new Date(a.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsTab({ project }: { project: any }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description || "");

  const handleSave = () => {
    updateMutation.mutate({ projectId: project.id, data: { name, description: desc } }, {
      onSuccess: () => toast({ title: "Project updated" }),
    });
  };

  const handleDelete = () => {
    if (confirm("Are you sure? This cannot be undone.")) {
      deleteMutation.mutate({ projectId: project.id }, {
        onSuccess: () => setLocation("/app/projects"),
      });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 520 }}>

      <div style={{ ...S.card, padding: 28 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 20 }}>Project details</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label style={{ fontSize: 12.5, fontWeight: 500 }}>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} style={{ height: 42, borderRadius: 10, fontSize: 14 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Label style={{ fontSize: 12.5, fontWeight: 500 }}>Description</Label>
            <Textarea value={desc} onChange={e => setDesc(e.target.value)} style={{ borderRadius: 10, resize: "none", fontSize: 14, minHeight: 90 }} />
          </div>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            style={{ alignSelf: "flex-start", height: 40, padding: "0 18px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      <div style={{ ...S.card, padding: 28, border: "1px solid rgba(220,38,38,0.15)", background: "#fef2f2" }}>
        <p style={{ fontSize: 14, fontWeight: 600, color: "#dc2626", marginBottom: 6 }}>Danger zone</p>
        <p style={{ fontSize: 13, color: "rgba(220,38,38,0.7)", marginBottom: 20 }}>Permanently delete this project and all its data.</p>
        <button
          onClick={handleDelete}
          style={{ height: 38, padding: "0 16px", borderRadius: 9, background: "#dc2626", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}
        >
          Delete project
        </button>
      </div>
    </div>
  );
}

// ── API Keys ──────────────────────────────────────────────────────────────────

interface ProjectKey {
  id: string;
  projectId: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revoked: boolean;
  rawKey?: string;
}

function KeysTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: keys = [], isLoading } = useQuery<ProjectKey[]>({
    queryKey: ["project-keys", projectId],
    queryFn: () => apiFetch(`/api/projects/${projectId}/keys`),
  });

  const handleGenerate = async () => {
    if (!newKeyName.trim()) return;
    setIsGenerating(true);
    try {
      const result: ProjectKey = await apiFetch(`/api/projects/${projectId}/keys`, {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      setGeneratedKey(result.rawKey ?? null);
      setNewKeyName("");
      qc.invalidateQueries({ queryKey: ["project-keys", projectId] });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this key? Apps using it will stop working immediately.")) return;
    setRevokingId(keyId);
    try {
      await apiFetch(`/api/projects/${projectId}/keys/${keyId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["project-keys", projectId] });
      toast({ title: "Key revoked" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async () => {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 620 }}>

      {/* One-time key reveal */}
      {generatedKey && (
        <div style={{ ...S.card, padding: 24, border: "1px solid rgba(16,185,129,0.2)", background: "#f0fdf4" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <ShieldCheck style={{ width: 16, height: 16, color: "#059669" }} />
            <p style={{ fontSize: 14, fontWeight: 600, color: "#059669" }}>Key generated — copy it now</p>
          </div>
          <p style={{ fontSize: 13, color: "rgba(26,46,26,0.6)", marginBottom: 14, lineHeight: 1.6 }}>
            This key will only be shown once. Store it in your environment variables — never expose it in client-side code.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{
              flex: 1, background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 10,
              padding: "10px 14px", fontSize: 13, fontFamily: "monospace", wordBreak: "break-all",
              color: "#1a1a2e", userSelect: "all",
            }}>
              {generatedKey}
            </div>
            <button
              onClick={handleCopy}
              style={{ height: 40, padding: "0 14px", borderRadius: 9, background: copied ? "#059669" : "#1a1a2e", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, transition: "background 0.2s" }}
            >
              {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setGeneratedKey(null)}
            style={{ marginTop: 12, fontSize: 12.5, color: "rgba(26,26,46,0.45)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      {/* Generate new key */}
      <div style={{ ...S.card, padding: 24 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Generate a new key</p>
        <p style={{ fontSize: 13, color: "rgba(26,26,46,0.5)", marginBottom: 18, lineHeight: 1.6 }}>
          Project keys authenticate your app's SDK calls to this project. Each key is shown only once.
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <Input
            value={newKeyName}
            onChange={e => setNewKeyName(e.target.value)}
            placeholder="Key name, e.g. Production"
            style={{ flex: 1, height: 40, borderRadius: 9, fontSize: 13.5 }}
            onKeyDown={e => e.key === "Enter" && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={!newKeyName.trim() || isGenerating}
            style={{ height: 40, padding: "0 16px", borderRadius: 9, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 13.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}
          >
            {isGenerating ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <KeyRound style={{ width: 13, height: 13 }} />}
            Generate
          </button>
        </div>
      </div>

      {/* Existing keys */}
      <div>
        <p style={S.sectionTitle}>Active keys</p>
        <div style={S.card}>
          {isLoading ? (
            <div style={{ padding: 20 }}>
              <Skeleton style={{ height: 48, borderRadius: 8, background: "rgba(0,0,0,0.04)" }} />
            </div>
          ) : !keys.length ? (
            <div style={S.emptyState}>No keys yet. Generate one above to connect your SDK.</div>
          ) : (
            keys.map((k, idx) => (
              <div key={k.id} style={{ ...S.row, borderTop: idx === 0 ? "none" : S.row.borderTop }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <KeyRound style={{ width: 15, height: 15, color: "rgba(26,26,46,0.4)" }} />
                  </div>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 500 }}>{k.name}</p>
                    <p style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(26,26,46,0.4)", marginTop: 2 }}>
                      {k.keyPrefix}••••••••••••••••
                      <span style={{ fontFamily: "inherit", marginLeft: 10 }}>
                        Created {format(new Date(k.createdAt), "MMM d, yyyy")}
                      </span>
                      {k.lastUsedAt && (
                        <span style={{ marginLeft: 10 }}>· Last used {format(new Date(k.lastUsedAt), "MMM d")}</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  disabled={revokingId === k.id}
                  style={{ fontSize: 12.5, padding: "5px 12px", borderRadius: 8, border: "none", background: "#fef2f2", color: "#dc2626", cursor: "pointer", fontWeight: 500, whiteSpace: "nowrap" }}
                >
                  {revokingId === k.id ? "Revoking…" : "Revoke"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ ...S.card, padding: 20, background: "#fafaf9", border: "1px solid rgba(0,0,0,0.05)" }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: "#1a1a2e" }}>How to use</p>
        <p style={{ fontSize: 12.5, color: "rgba(26,26,46,0.55)", lineHeight: 1.7 }}>
          Store your key as an environment variable (<code style={{ fontFamily: "monospace", background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 4 }}>GET_PROJECT_KEY</code>) on your server.
          Never include it in frontend JavaScript or commit it to source control.
          Use it to sign SDK requests to authenticate as this project.
        </p>
      </div>

    </div>
  );
}

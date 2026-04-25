import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe, Users, Database, FileEdit, Settings, Trash2,
  Lock, Unlock, Plus, Activity as ActivityIcon, ArrowLeft, Loader2,
  KeyRound, Copy, Check, ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BRAND, tone, line, type, ease, r,
  cardStyle, inputStyle, labelStyle,
  PrimaryButton, SecondaryButton, GhostButton, DangerButton,
  Card, SectionTitle, EmptyState, Pill, Field,
} from "@/lib/ui";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("auth_token") ?? "";
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${r.status}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderTop: `1px solid ${line.faint}`,
  gap: 12,
};

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "44px clamp(20px, 4vw, 40px) 80px" }}>
          <Skeleton style={{ height: 32, width: "35%", borderRadius: 8, background: tone[100], marginBottom: 32 }} />
          <Skeleton style={{ height: 400, borderRadius: 18, background: tone[100] }} />
        </div>
      </AppLayout>
    );
  }

  if (!project) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "60px clamp(20px, 4vw, 40px)", textAlign: "center" }}>
          <p style={{ fontSize: type.md, fontWeight: 600, marginBottom: 18 }}>Project not found</p>
          <Link href="/app/projects">
            <PrimaryButton>Back to projects</PrimaryButton>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tabs = [
    { value: "content",  icon: Database,    label: "Content"  },
    { value: "clients",  icon: Users,       label: "Clients"  },
    { value: "domains",  icon: Globe,       label: "Domains"  },
    { value: "drafts",   icon: FileEdit,    label: "Drafts"   },
    { value: "keys",     icon: KeyRound,    label: "API keys" },
    { value: "activity", icon: ActivityIcon,label: "Activity" },
    { value: "settings", icon: Settings,    label: "Settings" },
  ];

  return (
    <AppLayout>
      <div style={{ maxWidth: 880, margin: "0 auto", padding: "44px clamp(20px, 4vw, 40px) 80px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 32 }}>
          <Link href="/app/projects">
            <button
              aria-label="Back to projects"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                border: `1px solid ${line.base}`,
                background: "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: tone[600],
                flexShrink: 0,
                marginTop: 2,
                transition: `background 0.15s ${ease}`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = tone[50];
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
            </button>
          </Link>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
              <h1
                style={{
                  fontSize: type.display,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.15,
                  margin: 0,
                }}
              >
                {project.name}
              </h1>
              <Pill variant={(project.status as any) || "archived"}>{project.status}</Pill>
            </div>
            <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.55 }}>
              {project.description || "No description"}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="content">
          <div className="no-scrollbar" style={{ overflowX: "auto", marginRight: -16, paddingRight: 16 }}>
            <TabsList
              style={{
                background: tone[100],
                padding: 4,
                borderRadius: 12,
                height: "auto",
                display: "inline-flex",
                gap: 2,
                width: "max-content",
              }}
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  style={{
                    borderRadius: 9,
                    padding: "8px 14px",
                    fontSize: type.sm,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    fontWeight: 500,
                  }}
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1a1a2e] text-[rgba(26,26,46,0.55)] whitespace-nowrap"
                >
                  <tab.icon style={{ width: 14, height: 14 }} />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div style={{ marginTop: 28 }}>
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
    createMutation.mutate(
      { projectId, data: { label: newLabel, type: newType } },
      {
        onSuccess: () => {
          setIsAdding(false);
          setNewLabel("");
          setNewType("text");
          refetch();
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't add field", description: err.message }),
      }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionTitle
        description="What your clients can edit."
        action={
          !isAdding ? (
            <PrimaryButton onClick={() => setIsAdding(true)}>
              <Plus style={{ width: 14, height: 14 }} />
              Add field
            </PrimaryButton>
          ) : null
        }
      >
        Content fields
      </SectionTitle>

      {isAdding && (
        <Card padded style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Field label="Label">
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Hero Headline"
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <Field label="Type">
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger style={{ height: 44, borderRadius: r.md, fontSize: type.base }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="richtext">Rich text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Toggle</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryButton onClick={() => setIsAdding(false)}>Cancel</SecondaryButton>
            <PrimaryButton
              onClick={handleAdd}
              disabled={!newLabel}
              loading={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      <Card>
        {isLoading ? (
          <div style={{ padding: 22 }}>
            <Skeleton style={{ height: 48, borderRadius: 8, background: tone[100] }} />
          </div>
        ) : !fields?.length ? (
          <EmptyState
            icon={Database}
            compact
            title="No content fields yet"
            description="Add a field to give your clients something to edit."
          />
        ) : (
          fields.map((field, idx) => (
            <div
              key={field.id}
              style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: tone[50],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Database style={{ width: 15, height: 15, color: tone[400] }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: type.base, fontWeight: 600 }}>{field.label}</p>
                  <p style={{ fontSize: type.xs, color: tone[500], marginTop: 2 }}>
                    {prettyType(field.type)}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <button
                  onClick={() =>
                    updateMutation.mutate(
                      { projectId, fieldId: field.id, data: { isLocked: !field.isLocked } },
                      { onSuccess: () => refetch() }
                    )
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    fontSize: type.xs,
                    fontWeight: 600,
                    padding: "6px 11px",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: "none",
                    background: field.isLocked ? "#fffbeb" : tone[100],
                    color: field.isLocked ? "#b45309" : tone[600],
                    transition: `background 0.18s ${ease}`,
                  }}
                >
                  {field.isLocked ? (
                    <Lock style={{ width: 12, height: 12 }} />
                  ) : (
                    <Unlock style={{ width: 12, height: 12 }} />
                  )}
                  {field.isLocked ? "Locked" : "Open"}
                </button>
                <IconDeleteButton
                  onClick={() =>
                    deleteMutation.mutate(
                      { projectId, fieldId: field.id },
                      { onSuccess: () => refetch() }
                    )
                  }
                />
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function prettyType(t: string) {
  return ({
    text: "Short text",
    richtext: "Rich text",
    image: "Image",
    url: "Link",
    number: "Number",
    boolean: "Toggle",
  } as Record<string, string>)[t] ?? t;
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
    inviteMutation.mutate(
      { projectId, data: { email, role } },
      {
        onSuccess: () => {
          setEmail("");
          refetchInvites();
          toast({ title: "Invite sent" });
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Invite failed", description: err.message }),
      }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <Card padded>
        <SectionTitle description="Send a private editor link to your client.">
          Invite a client
        </SectionTitle>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
          <div style={{ flex: 2, minWidth: 200 }}>
            <Field label="Email">
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                style={inputStyle}
              />
            </Field>
          </div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <Field label="Role">
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger style={{ height: 44, borderRadius: r.md, fontSize: type.base }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <PrimaryButton
            onClick={handleInvite}
            disabled={!email || inviteMutation.isPending}
            loading={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? "Sending…" : "Send invite"}
          </PrimaryButton>
        </div>
      </Card>

      <div>
        <SectionTitle>Active clients</SectionTitle>
        <Card>
          {!users?.length ? (
            <EmptyState
              icon={Users}
              compact
              title="No clients yet"
              description="Invite a client above to give them editor access."
            />
          ) : (
            users.map((u, idx) => (
              <div
                key={u.id}
                style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: tone[100],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: type.base,
                      color: BRAND.ink,
                      flexShrink: 0,
                    }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: type.base, fontWeight: 600 }}>{u.name}</p>
                    <p
                      style={{
                        fontSize: type.xs,
                        color: tone[500],
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {u.email}
                    </p>
                  </div>
                </div>
                <Select
                  value={u.role}
                  onValueChange={(role) =>
                    roleMutation.mutate(
                      { projectId, userId: u.id, data: { role: role as any } },
                      { onSuccess: () => refetchUsers() }
                    )
                  }
                >
                  <SelectTrigger
                    style={{
                      width: 124,
                      height: 36,
                      borderRadius: 9,
                      fontSize: type.sm,
                      border: `1px solid ${line.base}`,
                      background: "transparent",
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner" disabled>
                      Owner
                    </SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))
          )}
        </Card>
      </div>

      {!!invites?.length && (
        <div>
          <SectionTitle>Pending invites</SectionTitle>
          <Card>
            {invites.map((inv, idx) => (
              <div
                key={inv.id}
                style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: type.base, fontWeight: 600 }}>{inv.email}</p>
                  <p style={{ fontSize: type.xs, color: tone[500], marginTop: 2 }}>
                    {inv.role} · {inv.status}
                  </p>
                </div>
                <DangerButton
                  size="sm"
                  onClick={() =>
                    revokeMutation.mutate(
                      { projectId, inviteId: inv.id },
                      { onSuccess: () => refetchInvites() }
                    )
                  }
                >
                  Revoke
                </DangerButton>
              </div>
            ))}
          </Card>
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
  const { toast } = useToast();
  const [hostname, setHostname] = useState("");

  const handleAdd = () => {
    addMutation.mutate(
      { projectId, data: { hostname } },
      {
        onSuccess: () => {
          setHostname("");
          refetch();
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't add domain", description: err.message }),
      }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <Card padded>
        <SectionTitle description="Add the domains where your app lives. Your client's editor will only load content for those domains.">
          Allowed domains
        </SectionTitle>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Input
            value={hostname}
            onChange={(e) => setHostname(e.target.value)}
            placeholder="e.g. yoursite.com"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
          />
          <PrimaryButton
            onClick={handleAdd}
            disabled={!hostname || addMutation.isPending}
            loading={addMutation.isPending}
          >
            Add domain
          </PrimaryButton>
        </div>
      </Card>

      <Card>
        {!domains?.length ? (
          <EmptyState
            icon={Globe}
            compact
            title="No domains added"
            description="Default Replit domains are allowed automatically."
          />
        ) : (
          domains.map((d, idx) => (
            <div
              key={d.id}
              style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <Globe style={{ width: 14, height: 14, color: tone[400], flexShrink: 0 }} />
                <span
                  style={{
                    fontSize: type.base,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {d.hostname}
                </span>
                {d.verified && <Pill variant="active">Verified</Pill>}
              </div>
              <IconDeleteButton
                onClick={() =>
                  removeMutation.mutate(
                    { projectId, domainId: d.id },
                    { onSuccess: () => refetch() }
                  )
                }
              />
            </div>
          ))
        )}
      </Card>
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
      toast({ variant: "destructive", title: "Couldn't reject", description: e.message });
    } finally {
      setRejectingId(null);
    }
  };

  const pendingDrafts = drafts?.filter((d) => d.status === "pending") || [];
  const pastDrafts = drafts?.filter((d) => d.status !== "pending") || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <SectionTitle description="Your client's edits land here. Publish to push them live — they appear in your app within seconds via the public content endpoint.">
          Pending review
        </SectionTitle>
        <Card>
          {!pendingDrafts.length ? (
            <EmptyState
              icon={FileEdit}
              compact
              title="No drafts waiting"
              description="When clients save edits, they'll appear here for review."
            />
          ) : (
            pendingDrafts.map((d, idx) => (
              <div
                key={d.id}
                style={{
                  padding: "20px 22px",
                  borderTop: idx > 0 ? `1px solid ${line.faint}` : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: type.base, fontWeight: 600 }}>{d.fieldLabel}</p>
                    <p style={{ fontSize: type.xs, color: tone[500], marginTop: 3 }}>
                      By {d.authorName} · {format(new Date(d.createdAt), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <DangerButton
                      onClick={() => handleReject(d.id)}
                      disabled={rejectingId === d.id}
                    >
                      {rejectingId === d.id ? "…" : "Reject"}
                    </DangerButton>
                    <PrimaryButton
                      onClick={() =>
                        publishMutation.mutate(
                          { projectId, draftId: d.id },
                          { onSuccess: () => refetch() }
                        )
                      }
                      disabled={publishMutation.isPending}
                    >
                      Publish
                    </PrimaryButton>
                  </div>
                </div>
                <div
                  style={{
                    background: tone[50],
                    border: `1px solid ${line.faint}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: type.sm,
                    fontFamily: "monospace",
                    wordBreak: "break-all",
                    lineHeight: 1.6,
                  }}
                >
                  {d.value}
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {!!pastDrafts.length && (
        <div>
          <SectionTitle>History</SectionTitle>
          <Card>
            {pastDrafts.map((d, idx) => (
              <div
                key={d.id}
                style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: type.base, fontWeight: 600 }}>{d.fieldLabel}</span>
                  <span style={{ fontSize: type.sm, color: tone[500], marginLeft: 8 }}>
                    by {d.authorName}
                  </span>
                </div>
                <Pill variant={d.status === "published" ? "published" : "rejected"}>
                  {d.status}
                </Pill>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Activity ─────────────────────────────────────────────────────────────────

function ActivityTab({ projectId }: { projectId: string }) {
  const { data: activity } = useListActivity(projectId);

  return (
    <Card>
      {!activity?.length ? (
        <EmptyState
          icon={ActivityIcon}
          compact
          title="No activity yet"
          description="Edits, invites, and publishes will appear here."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {activity.map((a, idx) => (
            <div
              key={a.id}
              style={{
                display: "flex",
                gap: 14,
                padding: "18px 22px",
                borderTop: idx > 0 ? `1px solid ${line.faint}` : "none",
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: tone[50],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <ActivityIcon style={{ width: 13, height: 13, color: tone[400] }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <p style={{ fontSize: type.sm, color: BRAND.ink, lineHeight: 1.55 }}>
                    <span style={{ fontWeight: 600 }}>{a.userName}</span>{" "}
                    <span style={{ color: tone[600] }}>{a.action}</span>
                    {a.fieldLabel && (
                      <>
                        {" "}
                        <span style={{ fontWeight: 500 }}>"{a.fieldLabel}"</span>
                      </>
                    )}
                  </p>
                  <span
                    style={{
                      fontSize: type.xs,
                      color: tone[400],
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    {format(new Date(a.createdAt), "MMM d, h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
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
    updateMutation.mutate(
      { projectId: project.id, data: { name, description: desc } },
      {
        onSuccess: () => toast({ title: "Project updated" }),
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't update", description: err.message }),
      }
    );
  };

  const handleDelete = () => {
    if (confirm("Delete this project? This cannot be undone.")) {
      deleteMutation.mutate(
        { projectId: project.id },
        { onSuccess: () => setLocation("/app/projects") }
      );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 540 }}>
      <Card padded style={{ padding: 28 }}>
        <SectionTitle description="Update the basics for this project.">
          Project details
        </SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label="Description" optional>
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              style={{
                borderRadius: r.md,
                resize: "none",
                fontSize: type.base,
                minHeight: 92,
                border: `1px solid ${line.base}`,
                background: BRAND.surface,
              }}
            />
          </Field>
          <PrimaryButton
            onClick={handleSave}
            disabled={updateMutation.isPending}
            loading={updateMutation.isPending}
            style={{ alignSelf: "flex-start" }}
          >
            {updateMutation.isPending ? "Saving…" : "Save changes"}
          </PrimaryButton>
        </div>
      </Card>

      <Card
        padded
        style={{
          padding: 24,
          border: `1px solid ${line.base}`,
        }}
      >
        <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink, marginBottom: 4 }}>
          Delete this project
        </p>
        <p style={{ fontSize: type.sm, color: tone[500], marginBottom: 18, lineHeight: 1.55 }}>
          This permanently removes the project, fields, drafts, and revokes all keys.
        </p>
        <DangerButton onClick={handleDelete} disabled={deleteMutation.isPending}>
          <Trash2 style={{ width: 13, height: 13 }} />
          Delete project
        </DangerButton>
      </Card>
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
      toast({ variant: "destructive", title: "Couldn't generate key", description: e.message });
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
      toast({ variant: "destructive", title: "Couldn't revoke", description: e.message });
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
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
      {generatedKey && (
        <Card
          padded
          style={{
            padding: 22,
            border: "1px solid rgba(16,185,129,0.25)",
            background: "#f0fdf4",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <ShieldCheck style={{ width: 16, height: 16, color: "#059669" }} />
            <p style={{ fontSize: type.base, fontWeight: 600, color: "#059669" }}>
              Key generated — copy it now
            </p>
          </div>
          <p style={{ fontSize: type.sm, color: "rgba(26,46,26,0.65)", marginBottom: 14, lineHeight: 1.55 }}>
            This key is shown only once. Store it as a server environment variable.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                flex: 1,
                background: BRAND.surface,
                border: `1px solid ${line.base}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: type.sm,
                fontFamily: "monospace",
                wordBreak: "break-all",
                color: BRAND.ink,
                userSelect: "all",
              }}
            >
              {generatedKey}
            </div>
            <PrimaryButton
              onClick={handleCopy}
              style={{
                background: copied ? "#059669" : BRAND.ink,
              }}
            >
              {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
              {copied ? "Copied" : "Copy"}
            </PrimaryButton>
          </div>
          <button
            onClick={() => setGeneratedKey(null)}
            style={{
              marginTop: 12,
              fontSize: type.xs,
              color: tone[500],
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            I've saved it — dismiss
          </button>
        </Card>
      )}

      <Card padded>
        <SectionTitle description="A project key lets your app read live content from this project. Treat it like a password.">
          Generate a new key
        </SectionTitle>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Input
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name, e.g. Production"
            style={{ ...inputStyle, flex: 1, minWidth: 200 }}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          />
          <PrimaryButton
            onClick={handleGenerate}
            disabled={!newKeyName.trim() || isGenerating}
            loading={isGenerating}
          >
            {isGenerating ? (
              <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} />
            ) : (
              <KeyRound style={{ width: 13, height: 13 }} />
            )}
            Generate
          </PrimaryButton>
        </div>
      </Card>

      <div>
        <SectionTitle>Active keys</SectionTitle>
        <Card>
          {isLoading ? (
            <div style={{ padding: 22 }}>
              <Skeleton style={{ height: 48, borderRadius: 8, background: tone[100] }} />
            </div>
          ) : !keys.length ? (
            <EmptyState
              icon={KeyRound}
              compact
              title="No keys yet"
              description="Generate one above to connect your app."
            />
          ) : (
            keys.map((k, idx) => (
              <div
                key={k.id}
                style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: tone[50],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <KeyRound style={{ width: 15, height: 15, color: tone[400] }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: type.base, fontWeight: 600 }}>{k.name}</p>
                    <p
                      style={{
                        fontSize: type.xs,
                        fontFamily: "monospace",
                        color: tone[500],
                        marginTop: 2,
                      }}
                    >
                      {k.keyPrefix}••••••••••••
                      <span style={{ fontFamily: "inherit", marginLeft: 10 }}>
                        Created {format(new Date(k.createdAt), "MMM d, yyyy")}
                      </span>
                      {k.lastUsedAt && (
                        <span style={{ marginLeft: 10 }}>
                          · Last used {format(new Date(k.lastUsedAt), "MMM d")}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <DangerButton
                  size="sm"
                  onClick={() => handleRevoke(k.id)}
                  disabled={revokingId === k.id}
                >
                  {revokingId === k.id ? "Revoking…" : "Revoke"}
                </DangerButton>
              </div>
            ))
          )}
        </Card>
      </div>

      <Card style={{ padding: 18, background: tone[50], border: `1px solid ${line.faint}` }}>
        <p style={{ fontSize: type.sm, fontWeight: 600, marginBottom: 8, color: BRAND.ink }}>
          How to use it in your app
        </p>
        <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.65, marginBottom: 12 }}>
          Save the key as a server-side environment variable, then fetch your published content from anywhere:
        </p>
        <pre
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12.5,
            lineHeight: 1.6,
            background: BRAND.ink,
            color: "#f5f5f7",
            padding: "14px 16px",
            borderRadius: 10,
            overflowX: "auto",
            margin: 0,
          }}
        >
{`const res = await fetch(
  "${typeof window !== "undefined" ? window.location.origin : "https://your-get-host"}/api/public/content",
  { headers: { Authorization: \`Bearer \${process.env.GET_PROJECT_KEY}\` } }
);
const { content } = await res.json();
// content["Hero Headline"]?.value`}
        </pre>
        <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.65, marginTop: 10 }}>
          Server-side only — never paste this key into code that ships to browsers.
        </p>
      </Card>
    </div>
  );
}

// ── Shared icon button ───────────────────────────────────────────────────────

function IconDeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Delete"
      style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tone[400],
        transition: `background 0.15s ${ease}, color 0.15s ${ease}`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "#fef2f2";
        (e.currentTarget as HTMLElement).style.color = "#dc2626";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = tone[400];
      }}
    >
      <Trash2 style={{ width: 14, height: 14 }} />
    </button>
  );
}

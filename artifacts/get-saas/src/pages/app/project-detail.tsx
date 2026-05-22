import { useState } from "react";
import { useLocation, useParams, useSearch, Link } from "wouter";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe, Users, Database, FileEdit, Settings, Trash2,
  Lock, Unlock, Plus, Activity as ActivityIcon, ArrowLeft, Loader2,
  KeyRound, Copy, Check, ShieldCheck, RefreshCw, ArrowRight, Info,
  Radio, X as XIcon, Download,
} from "lucide-react";
import { LastSeenBadge } from "@/components/last-seen-badge";
import { useToast } from "@/hooks/use-toast";
import {
  BRAND, tone, line, type, ease, r,
  cardStyle, inputStyle, labelStyle,
  PrimaryButton, SecondaryButton, GhostButton, DangerButton,
  Card, SectionTitle, EmptyState, Pill, Field, ConfirmDialog,
} from "@/lib/ui";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
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

// ──────────────────────────────────────────────────────────────────────────
// Check Setup — diagnostic button + modal
// ──────────────────────────────────────────────────────────────────────────
//
// Why this exists:
//   When a client saves a field and "nothing happens" on their site, the
//   real cause is almost always one of: scanner script not installed, wrong
//   data-key, or the field's data-get-key tag is missing. Until now there
//   was no way to see this without manually viewing the site source.
//
// This button calls POST /api/projects/:id/install-check which fetches the
// site server-side and reports each field's wiring status in plain English.
// The modal renders a colored row per field plus an explicit copy-paste
// snippet for any field that's missing its tag.

type InstallCheckResult = {
  siteUrl: string | null;
  fetched: boolean;
  status: number;
  scannerFound: boolean;
  scannerKeyMatches: boolean;
  tagsFound: string[];
  fieldStatuses: Array<{ label: string; status: "wired" | "missing" }>;
  message?: string;
};

function CheckSetupButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InstallCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch(`/api/projects/${projectId}/install-check`, {
        method: "POST",
        body: "{}",
      });
      setResult(data as InstallCheckResult);
    } catch (e) {
      setError((e as Error).message ?? "Check failed");
    } finally {
      setLoading(false);
    }
  }

  function handleClick() {
    setOpen(true);
    void run();
  }

  return (
    <>
      <button
        data-testid="button-check-setup"
        onClick={handleClick}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 14px",
          background: "transparent",
          color: BRAND.ink,
          border: `1px solid ${line.base}`,
          borderRadius: 10,
          fontSize: type.sm,
          fontWeight: 600,
          cursor: "pointer",
          transition: `background 0.15s ${ease}`,
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = tone[100]; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
      >
        Check setup
      </button>

      {open && (
        <div
          data-testid="modal-check-setup"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: 14,
              maxWidth: 640,
              width: "100%",
              maxHeight: "80vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${line.faint}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Setup check</h2>
                  <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.5 }}>
                    We loaded your live site and checked what we found.
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: tone[500], lineHeight: 1 }}
                  aria-label="Close"
                >×</button>
              </div>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {loading && <div style={{ color: tone[500], fontSize: type.sm }}>Checking your site…</div>}

              {!loading && error && (
                <div style={{ color: "#b91c1c", fontSize: type.sm }}>{error}</div>
              )}

              {!loading && result && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {!result.siteUrl && (
                    <div style={{ background: "#fef3c7", padding: 12, borderRadius: 8, fontSize: type.sm, color: "#854d0e" }}>
                      We don't know your site URL yet. Install the scanner script and load your site once — then come back here.
                    </div>
                  )}

                  {result.siteUrl && (
                    <>
                      <div style={{ fontSize: type.xs, color: tone[500] }}>
                        Checked: <a href={result.siteUrl} target="_blank" rel="noreferrer" style={{ color: BRAND.ink, textDecoration: "underline" }}>{result.siteUrl}</a>
                      </div>

                      <SetupRow
                        ok={result.fetched}
                        title={result.fetched ? "Site is reachable" : "Couldn't reach your site"}
                        detail={result.fetched ? `Loaded with status ${result.status}` : "We tried but got no response. Is the URL right?"}
                      />
                      <SetupRow
                        ok={result.scannerFound}
                        title={result.scannerFound ? "Scanner script is installed" : "Scanner script is missing"}
                        detail={result.scannerFound
                          ? (result.scannerKeyMatches ? "Key matches this project." : "Script found, but the key doesn't look right.")
                          : "Add the install snippet from the Connect tab to your site's <head>."}
                      />
                    </>
                  )}

                  {/* Field rows render regardless of siteUrl so a fresh
                      project (no scanner load yet) still sees its field
                      list — every row labeled "missing" until the scanner
                      runs at least once. */}
                  {result.fieldStatuses.length > 0 && (
                    <div>
                        <div style={{ fontSize: type.sm, fontWeight: 600, marginBottom: 8 }}>
                          Field tags ({result.fieldStatuses.filter(f => f.status === "wired").length}/{result.fieldStatuses.length} wired)
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {result.fieldStatuses.length === 0 && (
                            <div style={{ fontSize: type.sm, color: tone[500] }}>No fields configured yet.</div>
                          )}
                          {result.fieldStatuses.map((f) => (
                            <div
                              key={f.label}
                              data-testid={`setup-field-${f.label}`}
                              data-status={f.status}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "8px 10px",
                                borderRadius: 8,
                                background: f.status === "wired" ? "#f0fdf4" : "#fffbeb",
                                fontSize: type.sm,
                              }}
                            >
                              <span style={{
                                width: 8, height: 8, borderRadius: "50%",
                                background: f.status === "wired" ? "#22c55e" : "#f59e0b",
                                flexShrink: 0,
                              }} />
                              <span style={{ fontWeight: 600, flex: "0 0 auto" }}>{f.label}</span>
                              <span style={{ color: tone[500], fontSize: type.xs, marginLeft: "auto" }}>
                                {f.status === "wired" ? "wired up" : "tag not found on page"}
                              </span>
                            </div>
                          ))}
                        </div>
                    </div>
                  )}

                  {result.fieldStatuses.some(f => f.status === "missing") && (
                    <div style={{ background: tone[100], padding: 12, borderRadius: 8, fontSize: type.xs, color: tone[600], lineHeight: 1.6 }}>
                      <strong>Fix:</strong> on your site, add <code style={{ background: "white", padding: "1px 5px", borderRadius: 4 }}>data-get-key="Field Name"</code> to the element you want to update. Example:
                      <pre style={{ marginTop: 8, background: "white", padding: 10, borderRadius: 6, overflowX: "auto", fontSize: 12 }}>
{`<h1 data-get-key="${result.fieldStatuses.find(f => f.status === "missing")?.label ?? "Hero Title"}">Default text</h1>`}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 24px", borderTop: `1px solid ${line.faint}`, display: "flex", justifyContent: "space-between", gap: 10 }}>
              <button
                onClick={() => void run()}
                disabled={loading}
                style={{
                  padding: "8px 14px",
                  background: "transparent",
                  color: BRAND.ink,
                  border: `1px solid ${line.base}`,
                  borderRadius: 8,
                  fontSize: type.sm,
                  fontWeight: 600,
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >Re-check</button>
              <button
                onClick={() => setOpen(false)}
                style={{
                  padding: "8px 14px",
                  background: BRAND.ink,
                  color: BRAND.paper,
                  border: "none",
                  borderRadius: 8,
                  fontSize: type.sm,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SetupRow({ ok, title, detail }: { ok: boolean; title: string; detail: string }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{
        width: 10, height: 10, borderRadius: "50%",
        background: ok ? "#22c55e" : "#ef4444",
        flexShrink: 0, marginTop: 5,
      }} />
      <div>
        <div style={{ fontSize: type.sm, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: type.xs, color: tone[500] }}>{detail}</div>
      </div>
    </div>
  );
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
  // Hooks must be called BEFORE any early-return guards. wouter's
  // useSearch installs a subscription, so calling it conditionally
  // produces "Rendered more hooks than during the previous render".
  // We capture the raw ?tab= here and validate it against the tabs
  // list further down (after `isOwner` is known).
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");

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

  // ── Frontend RBAC ──
  // Single source of truth for what the current user can do on this project.
  // The server still enforces every mutation, but driving the UI from this
  // map is what stops viewers/editors from seeing destructive controls and
  // getting "permission denied" toasts after the fact.
  const myRole = (project.myRole ?? "viewer") as "owner" | "admin" | "editor" | "viewer";
  const isOwner = myRole === "owner";
  const isAdmin = isOwner || myRole === "admin";

  const tabs = [
    { value: "content",  icon: Database,    label: "Content"  },
    { value: "clients",  icon: Users,       label: "Clients"  },
    { value: "domains",  icon: Globe,       label: "Domains"  },
    { value: "drafts",   icon: FileEdit,    label: "Drafts"   },
    { value: "keys",     icon: KeyRound,    label: "Connect"  },
    { value: "activity", icon: ActivityIcon,label: "Activity" },
    // Settings holds rename + delete; owners only.
    ...(isOwner ? [{ value: "settings", icon: Settings, label: "Settings" }] : []),
  ];

  // Resolve the ?tab= deep link captured at the top of the component
  // against the now-known tabs list. Falls back to "content" for any
  // unknown / missing value (e.g. ?tab=settings on a non-owner role).
  const initialTab = tabs.some((t) => t.value === requestedTab) ? requestedTab! : "content";

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
              <LastSeenBadge at={(project as any).lastSeenAt} />
              {/* Read-only badge for non-managers so they understand why the
                  destructive controls are missing instead of thinking the UI
                  is broken. */}
              {!isAdmin && (
                <span
                  style={{
                    fontSize: type.xs,
                    fontWeight: 600,
                    color: tone[600],
                    background: tone[100],
                    padding: "3px 9px",
                    borderRadius: 999,
                    textTransform: "capitalize",
                    letterSpacing: "0.02em",
                  }}
                >
                  {myRole}
                </span>
              )}
            </div>
            <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.55 }}>
              {project.description || "No description"}
            </p>
          </div>
          {/* Primary CTA — opens the side-by-side live editor for this project.
              Available to every role, including viewers (the editor itself
              gates write actions by myRole). */}
          <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 2 }}>
            {/* Check setup hits an editor+ endpoint — hide the button for
                viewers so they don't get a 403 toast on click. */}
            {myRole !== "viewer" && <CheckSetupButton projectId={projectId} />}
            <Link href={`/app/editor/${projectId}`}>
              <button
                data-testid="button-open-editor"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: BRAND.ink,
                  color: BRAND.paper,
                  border: "none",
                  borderRadius: 10,
                  fontSize: type.sm,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: `opacity 0.15s ${ease}`,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
              >
                <FileEdit style={{ width: 15, height: 15 }} />
                Open editor
              </button>
            </Link>
          </div>
        </div>

        {/* Tabs — defaultValue can be set via ?tab= so deep links from
            the MCP install snippet (which sends users to ?tab=keys) land
            on the right tab instead of always showing Content. */}
        <Tabs defaultValue={initialTab}>
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
                  className="data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-[#1a1a2e] whitespace-nowrap text-[color:var(--tone-tab,rgba(26,26,46,0.55))]"
                >
                  <tab.icon style={{ width: 14, height: 14 }} />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div style={{ marginTop: 28 }}>
            <TabsContent value="content"><ContentMapTab projectId={project.id} canManage={isAdmin} /></TabsContent>
            <TabsContent value="clients"><ClientsTab projectId={project.id} canManage={isAdmin} /></TabsContent>
            <TabsContent value="domains"><DomainsTab projectId={project.id} canManage={isAdmin} /></TabsContent>
            <TabsContent value="drafts"><DraftsTab projectId={project.id} canManage={isAdmin} autoPublish={(project as any).autoPublish ?? true} /></TabsContent>
            <TabsContent value="keys"><KeysTab projectId={project.id} canManage={isAdmin} /></TabsContent>
            <TabsContent value="activity"><ActivityTab projectId={project.id} /></TabsContent>
            {isOwner && (
              <TabsContent value="settings"><SettingsTab project={project} /></TabsContent>
            )}
          </div>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ── Content Map ─────────────────────────────────────────────────────────────

type SiteField = { label: string; type: string; value: string };
type SiteSection = { name: string; fields: SiteField[] };

interface ProjectKeyBasic { id: string; name: string; keyPrefix: string; }


/**
 * Install + verify panel. Replaces the older "agent prompt only" card.
 * Honest scope: this is NOT a marketplace install — Replit's marketplace is
 * platform-side and the user has to put the script tag in themselves. What
 * we can do is make that as painless as possible and confirm it's working.
 */
function ScannerSetupCard({
  projectId,
  onDismiss,
}: {
  projectId: string;
  onDismiss?: () => void;
}) {
  const [openSection, setOpenSection] = useState<"selfhost" | "ai" | "manual" | null>("selfhost");
  const [copied, setCopied] = useState<"snippet" | "prompt" | null>(null);
  const [selfHostKey, setSelfHostKey] = useState("");

  const { data: keys = [], isLoading: keysLoading } = useQuery<ProjectKeyBasic[]>({
    queryKey: ["project-keys-scanner", projectId],
    queryFn: async () => apiFetch(`/api/projects/${projectId}/keys`),
  });

  const { data: fields = [] } = useListContentFields(projectId);

  const firstKey = keys[0];
  const scannerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${BASE}/api/public/scanner.js`;
  const snippet = `<!-- Paste just before </body> in your main HTML file -->\n<script\n  src="${scannerUrl}"\n  data-key="YOUR_PROJECT_KEY"\n  defer\n></script>`;

  const fieldLines = fields.length > 0
    ? fields.map(f => {
        const elementHint =
          f.type === "image" ? "img element" :
          f.type === "richtext" ? "rich text / HTML block element" :
          "text element (heading or paragraph)";
        return `  - "${f.label}" → find the ${elementHint} for this content → add: data-get-key="${f.label}"`;
      }).join("\n")
    : "  (No fields yet — add fields in the Fields tab first, then come back for the full prompt.)";

  const replitPrompt = firstKey
    ? `Set up the get CMS in my Replit app. Be surgical — only add exactly what is listed. Do not change anything else.\n\n` +

      `STEP 1 — PLAN FIRST (do not touch any files yet)\n` +
      `Find:\n` +
      `  a) My main HTML file (usually index.html or a template that wraps every page)\n` +
      `  b) The element for each content area listed in Step 3\n\n` +
      `Show me your plan as a numbered list before making any changes:\n` +
      `  1. File: [name], around line [n] — will insert script tag before </body>\n` +
      `  2. File: [name], around line [n] — will add data-get-key="..." to <element>\n` +
      `  (one line per change)\n\n` +
      `Do not edit anything until the plan is shown.\n\n` +

      `STEP 2 — Add the scanner script\n` +
      `Insert this exact block on a new line just before </body>. Do not add extra blank lines. Do not reformat surrounding code.\n\n` +
      `<script\n  src="${scannerUrl}"\n  data-key="INSERT_KEY_HERE"\n  defer\n></script>\n\n` +
      `For INSERT_KEY_HERE:\n` +
      `- Server-rendered app (Express + EJS, Handlebars, etc.) → use process.env.GET_PROJECT_KEY\n` +
      `- Static HTML → paste the value of GET_PROJECT_KEY from Replit Secrets directly (it starts with "${firstKey.keyPrefix}")\n\n` +

      `STEP 3 — Tag the content areas\n` +
      `For each item below, add ONLY the data-get-key attribute to the matching element. Do not change the element's text, tag name, class, id, style, or any other existing attribute.\n\n` +
      fieldLines + `\n\n` +
      `The value must match exactly — same spelling, same capitals.\n` +
      `If you are unsure which element matches, stop and ask. Do not guess.\n\n` +

      `STEP 4 — Verify your own work\n` +
      `After every single change:\n` +
      `  a) Read back the changed line with 2 lines of context above and below it\n` +
      `  b) Confirm the tag or attribute is present and spelled correctly\n\n` +
      `When fully done, report exactly:\n` +
      `  "Done. Changed [N] lines across [M] file(s): [list each file and what was added]"\n\n` +

      `STRICT RULES — never break these:\n` +
      `- Do not reformat, re-indent, or add whitespace anywhere outside the new lines\n` +
      `- Do not rename, move, or delete any file\n` +
      `- Do not modify any element's existing attributes, text, or styles\n` +
      `- Do not install packages or run any commands\n` +
      `- Do not change any logic, routes, or server code`
    : null;

  const copy = async (which: "snippet" | "prompt", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  // Verify install: poll the project's lastSeenAt, looking for it to advance
  // past the baseline we captured when the user clicked Verify. We try for
  // ~10s to keep the UI snappy and to keep accidental clicks cheap.
  type FieldCheckResult = { label: string; found: boolean };
  type VerifyState =
    | { kind: "idle" }
    | { kind: "polling"; baselineMs: number; attempts: number }
    | { kind: "ok"; at: string; fieldResults: FieldCheckResult[] | null }
    | { kind: "fail"; lastSeen?: string | null };
  const [verify, setVerify] = useState<VerifyState>({ kind: "idle" });

  const handleVerify = async () => {
    // Capture the current lastSeenAt as the baseline. If it advances we know
    // the script just talked to us.
    let baselineAt: string | null = null;
    try {
      const fresh = await apiFetch(`/api/projects/${projectId}`) as any;
      baselineAt = fresh?.lastSeenAt ?? null;
    } catch { /* network issue — just use 0 baseline */ }
    const baselineMs = baselineAt ? new Date(baselineAt).getTime() : 0;
    setVerify({ kind: "polling", baselineMs, attempts: 0 });

    // Poll up to ~10s.
    const startedAt = Date.now();
    const tick = async () => {
      try {
        const proj = await apiFetch(`/api/projects/${projectId}`) as any;
        const at = proj?.lastSeenAt as string | null | undefined;
        const atMs = at ? new Date(at).getTime() : 0;
        if (at && atMs > baselineMs) {
          // Script is alive — now check which fields the scanner actually found.
          // The snapshot stores exactly what data-get-key labels were on the page.
          let fieldResults: FieldCheckResult[] | null = null;
          try {
            const snap = await apiFetch(
              `/api/projects/${projectId}/content/pull-from-site`,
              { method: "POST" }
            ) as any;
            const foundLabels = new Set<string>(
              (snap?.sections ?? []).flatMap((s: any) =>
                (s.fields ?? []).map((f: any) => f.label as string)
              )
            );
            if (fields.length > 0) {
              fieldResults = fields.map(f => ({
                label: f.label,
                found: foundLabels.has(f.label),
              }));
            }
          } catch { /* no snapshot yet — skip field check */ }
          setVerify({ kind: "ok", at, fieldResults });
          return;
        }
        if (Date.now() - startedAt >= 10_000) {
          setVerify({ kind: "fail", lastSeen: at ?? null });
          return;
        }
        setTimeout(tick, 1200);
      } catch (err: any) {
        setVerify({ kind: "fail", lastSeen: null });
      }
    };
    setTimeout(tick, 1200);
  };

  // Shared code block + copy button used in both accordions
  const CodeBlock = ({ text, which }: { text: string; which: "snippet" | "prompt" }) => (
    <div style={{ position: "relative" }} data-testid={which === "snippet" ? "install-snippet" : "install-prompt"}>
      <pre style={{
        margin: 0,
        padding: "16px 52px 16px 18px",
        borderRadius: r.lg,
        background: "#0f1419",
        color: "#e5e7eb",
        fontSize: 12.5,
        lineHeight: 1.65,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: 340,
      }}>
        {text}
      </pre>
      <button
        onClick={() => copy(which, text)}
        data-testid={`install-copy-${which}`}
        style={{
          position: "absolute", top: 10, right: 10,
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "6px 10px", borderRadius: 8,
          background: copied === which ? "#10b981" : "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.15)",
          cursor: "pointer", fontSize: type.xs, fontWeight: 600, color: "#f9fafb",
          transition: `background 0.15s ${ease}`,
        }}
      >
        {copied === which
          ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
          : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
      </button>
    </div>
  );

  const AccordionHeader = ({
    id, label, badge, open, onToggle,
  }: { id: "selfhost" | "ai" | "manual"; label: string; badge?: string; open: boolean; onToggle: () => void }) => (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, padding: "14px 16px",
        background: open ? tone[50] : BRAND.paper,
        border: `1px solid ${open ? line.base : line.faint}`,
        borderRadius: open ? `${r.md}px ${r.md}px 0 0` : r.md,
        cursor: "pointer", textAlign: "left" as const,
        transition: `background 0.15s ${ease}`,
      }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: type.sm, fontWeight: 700, color: BRAND.ink }}>{label}</span>
        {badge && <span style={{ fontSize: type.xs, color: tone[500] }}>{badge}</span>}
      </span>
      <span style={{
        width: 22, height: 22, borderRadius: "50%",
        background: tone[100], display: "inline-flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, color: tone[500],
        transform: open ? "rotate(180deg)" : "rotate(0deg)",
        transition: `transform 0.2s ${ease}`,
      }}>
        ▾
      </span>
    </button>
  );

  const AccordionBody = ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    open ? (
      <div style={{
        padding: "18px 16px",
        border: `1px solid ${line.base}`, borderTop: "none",
        borderRadius: `0 0 ${r.md}px ${r.md}px`,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {children}
      </div>
    ) : null
  );

  const noKeyBanner = (
    <div style={{ padding: "12px 14px", borderRadius: r.md, background: tone[50], border: `1px solid ${line.base}` }}>
      <p style={{ fontSize: type.sm, color: tone[600], margin: 0 }}>
        You need a project key first. Go to the <strong>Connect</strong> tab, create one, then come back here.
      </p>
    </div>
  );

  return (
    <Card padded>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: type.base, fontWeight: 700, marginBottom: 4 }}>
              Connect your site
            </p>
            <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.6 }}>
              Three ways to install — pick whichever fits your setup.
            </p>
          </div>
          {onDismiss && (
            <button
              aria-label="Dismiss"
              onClick={onDismiss}
              style={{
                width: 28, height: 28, borderRadius: 8,
                background: "transparent", border: `1px solid ${line.base}`,
                cursor: "pointer", color: tone[500],
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <XIcon style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        {/* ── Self-host accordion (recommended for agent-built apps) ──── */}
        <div>
          <AccordionHeader
            id="selfhost"
            label="Self-host (recommended for Replit & AI builders)"
            badge="Download one file, paste one line — agents won't block it"
            open={openSection === "selfhost"}
            onToggle={() => setOpenSection(s => s === "selfhost" ? null : "selfhost")}
          />
          <AccordionBody open={openSection === "selfhost"}>
            {keysLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 style={{ width: 14, height: 14, color: tone[400] }} className="animate-spin" />
                <span style={{ fontSize: type.sm, color: tone[500] }}>Loading…</span>
              </div>
            ) : !firstKey ? noKeyBanner : (
              <>
                {/* Why this exists */}
                <div style={{
                  padding: "10px 14px", borderRadius: r.md,
                  background: tone[50], border: `1px solid ${line.faint}`,
                }}>
                  <p style={{ fontSize: type.xs, color: tone[600], lineHeight: 1.6, margin: 0 }}>
                    AI builders like Replit Agent often refuse to add <code style={{ background: "white", padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>&lt;script src="https://..."&gt;</code> tags from services they don't recognize. With this option you download a small file into your own project — your agent sees a local file you chose to add, not an outside dependency, so it won't push back.
                  </p>
                </div>

                {/* Step 1 — paste key + download */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: type.sm, fontWeight: 700, margin: 0 }}>
                    Step 1 — Download <code style={{ background: tone[100], padding: "1px 6px", borderRadius: 4, fontFamily: "monospace", fontWeight: 600 }}>get-scanner.js</code>
                  </p>
                  <p style={{ fontSize: type.xs, color: tone[500], margin: 0, lineHeight: 1.55 }}>
                    Paste your full project key (it starts with <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>{firstKey.keyPrefix}</code>) — we'll bake it into the file so you don't have to set it anywhere else.
                  </p>
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" as const }}>
                    <input
                      type="text"
                      value={selfHostKey}
                      onChange={e => setSelfHostKey(e.target.value.trim())}
                      placeholder={`${firstKey.keyPrefix}…`}
                      data-testid="selfhost-key-input"
                      spellCheck={false}
                      autoComplete="off"
                      style={{
                        ...inputStyle,
                        flex: 1,
                        minWidth: 220,
                        fontFamily: "ui-monospace, Menlo, monospace",
                        fontSize: 12.5,
                      }}
                    />
                    <a
                      href={selfHostKey.startsWith("pk_") && selfHostKey.length >= 12
                        ? `${BASE}/api/public/scanner-download?key=${encodeURIComponent(selfHostKey)}`
                        : undefined}
                      onClick={e => {
                        if (!selfHostKey.startsWith("pk_") || selfHostKey.length < 12) e.preventDefault();
                      }}
                      data-testid="selfhost-download"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        padding: "10px 16px", borderRadius: r.md,
                        background: selfHostKey.startsWith("pk_") && selfHostKey.length >= 12 ? BRAND.ink : tone[200],
                        color: selfHostKey.startsWith("pk_") && selfHostKey.length >= 12 ? "white" : tone[500],
                        fontSize: type.sm, fontWeight: 600,
                        textDecoration: "none",
                        cursor: selfHostKey.startsWith("pk_") && selfHostKey.length >= 12 ? "pointer" : "not-allowed",
                        flexShrink: 0,
                      }}
                      download="get-scanner.js"
                    >
                      <Download style={{ width: 14, height: 14 }} />
                      Download file
                    </a>
                  </div>
                </div>

                {/* Step 2 — drop in repo */}
                <div style={{ borderTop: `1px solid ${line.faint}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: type.sm, fontWeight: 700, margin: 0 }}>
                    Step 2 — Drop the file into your project
                  </p>
                  <p style={{ fontSize: type.xs, color: tone[500], margin: 0, lineHeight: 1.6 }}>
                    Put <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>get-scanner.js</code> in the folder your site serves static files from. Common spots: <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>public/</code>, <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>static/</code>, or right next to <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>index.html</code>.
                  </p>
                </div>

                {/* Step 3 — paste one line */}
                <div style={{ borderTop: `1px solid ${line.faint}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: type.sm, fontWeight: 700, margin: 0 }}>
                    Step 3 — Paste this one line into your <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>&lt;head&gt;</code>
                  </p>
                  <CodeBlock text={`<script src="/get-scanner.js" defer></script>`} which="snippet" />
                  <p style={{ fontSize: 11.5, color: tone[500], margin: 0, lineHeight: 1.55 }}>
                    That's it — no key in the HTML, no external URL, no agent objections. Reload your site and the scanner will start syncing content.
                  </p>
                </div>

                {/* Heads-up about updates */}
                <div style={{
                  padding: "10px 14px", borderRadius: r.md,
                  background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.3)",
                  display: "flex", gap: 8,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>ℹ️</span>
                  <p style={{ fontSize: type.xs, color: "#78350f", lineHeight: 1.6, margin: 0 }}>
                    <strong>Heads-up:</strong> because the file lives in your project, you won't get scanner updates automatically. If we ship an improvement we'll let you know — just come back here and download a fresh copy.
                  </p>
                </div>
              </>
            )}
          </AccordionBody>
        </div>

        {/* ── AI Connect accordion ─────────────────────────────────────── */}
        <div>
          <AccordionHeader
            id="ai"
            label="AI Connect"
            badge="Paste one prompt — the AI handles the rest"
            open={openSection === "ai"}
            onToggle={() => setOpenSection(s => s === "ai" ? null : "ai")}
          />
          <AccordionBody open={openSection === "ai"}>
            {keysLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 style={{ width: 14, height: 14, color: tone[400] }} className="animate-spin" />
                <span style={{ fontSize: type.sm, color: tone[500] }}>Loading…</span>
              </div>
            ) : !firstKey ? noKeyBanner : (
              <>
                {/* Where to paste */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <p style={{ fontSize: type.sm, fontWeight: 700, margin: 0 }}>
                    Where to paste this
                  </p>
                  {([
                    {
                      name: "Replit",
                      steps: "Open your project → click the AI chat tab on the left → paste and send.",
                    },
                    {
                      name: "Lovable",
                      steps: "Open your project → click the chat box at the bottom → paste and send.",
                    },
                    {
                      name: "Claude Code",
                      steps: "Open your terminal → type claude → paste and press Enter.",
                    },
                  ] as const).map(p => (
                    <div key={p.name} style={{
                      display: "flex", gap: 8, alignItems: "flex-start",
                      padding: "8px 12px", borderRadius: r.md,
                      background: tone[50], border: `1px solid ${line.faint}`,
                    }}>
                      <span style={{ fontSize: type.xs, fontWeight: 700, color: BRAND.ink, minWidth: 72, flexShrink: 0 }}>{p.name}</span>
                      <span style={{ fontSize: type.xs, color: tone[600], lineHeight: 1.55 }}>{p.steps}</span>
                    </div>
                  ))}
                </div>

                {/* The prompt */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: type.xs, fontWeight: 700, color: tone[500], textTransform: "uppercase" as const, letterSpacing: "0.07em", margin: 0 }}>
                    Copy this prompt
                  </p>
                  {replitPrompt ? <CodeBlock text={replitPrompt} which="prompt" /> : (
                    <div style={{ padding: "12px 14px", borderRadius: r.md, background: tone[50], border: `1px solid ${line.base}` }}>
                      <p style={{ fontSize: type.sm, color: tone[500], margin: 0 }}>
                        Add fields in the <strong>Fields</strong> tab first — the prompt will list exactly what to tag.
                      </p>
                    </div>
                  )}
                </div>

                {/* Heads-up disclaimer */}
                <div style={{
                  padding: "10px 14px", borderRadius: r.md,
                  background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.3)",
                  display: "flex", gap: 8,
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
                  <p style={{ fontSize: type.xs, color: "#78350f", lineHeight: 1.6, margin: 0 }}>
                    <strong>AI doesn't always get it right first try.</strong> After you paste the prompt, open your site and click <strong>Verify install</strong> below. If any fields show as missing, paste the prompt again and say: <em>"It didn't tag [field name] — please fix just that one."</em>
                  </p>
                </div>
              </>
            )}
          </AccordionBody>
        </div>

        {/* ── Manual Connect accordion ─────────────────────────────────── */}
        <div>
          <AccordionHeader
            id="manual"
            label="Manual Connect"
            badge="Add the code yourself — step by step"
            open={openSection === "manual"}
            onToggle={() => setOpenSection(s => s === "manual" ? null : "manual")}
          />
          <AccordionBody open={openSection === "manual"}>
            {keysLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Loader2 style={{ width: 14, height: 14, color: tone[400] }} className="animate-spin" />
                <span style={{ fontSize: type.sm, color: tone[500] }}>Loading…</span>
              </div>
            ) : !firstKey ? noKeyBanner : (
              <>
                {/* Step 1 */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <p style={{ fontSize: type.sm, fontWeight: 700, margin: 0 }}>
                    Step 1 — Add this code to your site
                  </p>
                  <CodeBlock text={snippet} which="snippet" />
                  <p style={{ fontSize: 11.5, color: tone[500], margin: 0, lineHeight: 1.55 }}>
                    Replace <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>YOUR_PROJECT_KEY</code> with your full project key — it looks like <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>{firstKey ? `${firstKey.keyPrefix}…` : "pk_live_…"}</code> and was shown in full when you created it.{" "}
                    {firstKey ? <>Don't have it? Go to the <strong>Keys</strong> tab to create a new one.</> : <>Create one in the <strong>Keys</strong> tab first.</>}
                  </p>

                  {/* Where to put it — by platform */}
                  <p style={{ fontSize: type.xs, fontWeight: 700, color: tone[600], margin: 0, marginTop: 4 }}>
                    Where to paste it:
                  </p>
                  {([
                    {
                      name: "Replit",
                      how: "In the file tree on the left, open your main HTML file (usually index.html). Scroll to the very bottom and find </body>. Paste the code just above that line.",
                    },
                    {
                      name: "Lovable",
                      how: 'Click the "</>" code button in the top toolbar → open index.html → find </body> near the bottom → paste just above it.',
                    },
                    {
                      name: "Claude Code",
                      how: 'Tell Claude: "Open my main HTML file and paste this code just before the closing </body> tag — don\'t change anything else." Then paste the code into the chat.',
                    },
                  ] as const).map(p => (
                    <div key={p.name} style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      padding: "10px 12px", borderRadius: r.md,
                      background: tone[50], border: `1px solid ${line.faint}`,
                    }}>
                      <span style={{ fontSize: type.xs, fontWeight: 700, color: BRAND.ink, minWidth: 72, flexShrink: 0 }}>{p.name}</span>
                      <span style={{ fontSize: type.xs, color: tone[600], lineHeight: 1.6 }}>{p.how}</span>
                    </div>
                  ))}
                </div>

                {/* Step 2 */}
                <div style={{ borderTop: `1px solid ${line.faint}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: type.sm, fontWeight: 700, margin: 0, marginBottom: 4 }}>
                      Step 2 — Mark each piece of content
                    </p>
                    <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.6, marginBottom: 10 }}>
                      On each HTML element you want clients to be able to edit, add a <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>data-get-key</code> attribute. The value must exactly match the field name — including capital letters.
                    </p>
                    {fields.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {fields.map(f => {
                          const ex =
                            f.type === "image"
                              ? `<img data-get-key="${f.label}" src="current-image.jpg" alt="" />`
                              : f.type === "url"
                              ? `<a data-get-key="${f.label}" href="/current-link">Link text</a>`
                              : `<p data-get-key="${f.label}">Current text here</p>`;
                          return (
                            <div key={f.label} style={{
                              padding: "8px 12px", borderRadius: r.md,
                              background: "#0f1419", border: `1px solid rgba(255,255,255,0.06)`,
                              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
                            }}>
                              <code style={{ fontSize: 11.5, fontFamily: "ui-monospace, Menlo, monospace", color: "#e5e7eb", flex: 1, wordBreak: "break-word" as const }}>
                                {ex}
                              </code>
                              <button
                                onClick={() => copy("snippet", ex)}
                                style={{
                                  background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)",
                                  borderRadius: 6, padding: "4px 8px", cursor: "pointer",
                                  fontSize: 11, color: "#f9fafb", fontWeight: 600, flexShrink: 0,
                                }}
                              >
                                Copy
                              </button>
                            </div>
                          );
                        })}
                        <p style={{ fontSize: 11.5, color: tone[500], margin: 0, lineHeight: 1.55 }}>
                          Find each element on your page and add that exact attribute to it. Don't change anything else on the element.
                        </p>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", borderRadius: r.md, background: tone[50], border: `1px solid ${line.base}` }}>
                        <p style={{ fontSize: type.sm, color: tone[500], margin: 0 }}>
                          No fields set up yet. Go to the <strong>Fields</strong> tab to define what clients can edit — then come back here.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </AccordionBody>
        </div>

        {/* ── Verify install — always visible ─────────────────────────── */}
        <div style={{ borderTop: `1px solid ${line.faint}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: type.sm, fontWeight: 600, marginBottom: 2 }}>
                Verify install
              </p>
              <p style={{ fontSize: type.xs, color: tone[500] }}>
                Open your site in another tab, then click this. We'll check if the script is working.
              </p>
            </div>
            <PrimaryButton
              size="sm"
              onClick={handleVerify}
              loading={verify.kind === "polling"}
              disabled={!firstKey || verify.kind === "polling"}
              data-testid="verify-install-button"
            >
              <Radio style={{ width: 14, height: 14 }} />
              {verify.kind === "polling" ? "Listening…" : "Verify install"}
            </PrimaryButton>
          </div>

          {verify.kind === "ok" && (
            <div data-testid="verify-result-ok" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {/* Script alive banner */}
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                color: "#047857",
                fontSize: type.sm, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Check style={{ width: 14, height: 14, flexShrink: 0 }} />
                Script connected at {format(new Date(verify.at), "h:mm:ss a")}.
              </div>

              {/* Per-field check — only shown when we have a snapshot */}
              {verify.fieldResults && verify.fieldResults.length > 0 && (() => {
                const missing = verify.fieldResults.filter(r => !r.found);
                const allGood = missing.length === 0;
                return (
                  <div style={{
                    padding: "12px 14px", borderRadius: 10,
                    background: allGood ? "rgba(16,185,129,0.06)" : "rgba(217,119,6,0.07)",
                    border: `1px solid ${allGood ? "rgba(16,185,129,0.2)" : "rgba(217,119,6,0.25)"}`,
                    display: "flex", flexDirection: "column", gap: 8,
                  }}>
                    <p style={{ fontSize: type.xs, fontWeight: 700, color: allGood ? "#047857" : "#92400e", margin: 0 }}>
                      {allGood
                        ? `All ${verify.fieldResults.length} field${verify.fieldResults.length !== 1 ? "s" : ""} tagged correctly`
                        : `${missing.length} field${missing.length !== 1 ? "s" : ""} not found on the page`}
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {verify.fieldResults.map(r => (
                        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {r.found
                            ? <Check style={{ width: 13, height: 13, color: "#10b981", flexShrink: 0 }} />
                            : <XIcon style={{ width: 13, height: 13, color: "#f59e0b", flexShrink: 0 }} />}
                          <code style={{
                            fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace",
                            color: r.found ? "#047857" : "#92400e",
                          }}>
                            data-get-key="{r.label}"
                          </code>
                          {!r.found && (
                            <span style={{ fontSize: type.xs, color: tone[500] }}>— not found on page</span>
                          )}
                        </div>
                      ))}
                    </div>
                    {!allGood && (
                      <p style={{ fontSize: type.xs, color: "#92400e", margin: 0, lineHeight: 1.55 }}>
                        The missing fields aren't tagged yet. Run the Replit AI prompt again, or manually add <code style={{ fontFamily: "monospace" }}>data-get-key="..."</code> to the right elements.
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* No fields defined yet */}
              {verify.fieldResults && verify.fieldResults.length === 0 && (
                <p style={{ fontSize: type.xs, color: tone[500], margin: 0 }}>
                  No fields set up yet — go to the Fields tab to add what clients can edit.
                </p>
              )}
            </div>
          )}
          {verify.kind === "fail" && (
            <div data-testid="verify-result-fail" style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(217, 119, 6, 0.08)",
              border: "1px solid rgba(217, 119, 6, 0.25)",
              color: "#92400e",
              fontSize: type.sm, lineHeight: 1.5,
            }}>
              <strong>Still nothing.</strong> Try reloading your site in another tab, then click again. If you just published a new version, wait 30 seconds and try again. Things to check:
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                <li>You're using the full key, not just the beginning of it.</li>
                <li>The script is in your published site, not just your local version.</li>
                <li>Nothing is blocking scripts from <code>{new URL(scannerUrl).origin}</code>.</li>
              </ul>
            </div>
          )}
        </div>

      </div>
    </Card>
  );
}

function ContentMapTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data: fields, isLoading, refetch } = useListContentFields(projectId);
  const createMutation = useCreateContentField();
  const updateMutation = useUpdateContentField();
  const deleteMutation = useDeleteContentField();
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<any>("text");
  // Track which field row is expanded for inline content editing
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  // Scan-from-site state
  const [syncState, setSyncState] = useState<"idle" | "loading" | "results" | "setup">("idle");
  const [syncUrl, setSyncUrl] = useState<string>("");
  const [syncCapturedAt, setSyncCapturedAt] = useState<string>("");
  const [sections, setSections] = useState<SiteSection[]>([]);
  // selectedKeys: "sectionIdx:fieldIdx"
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [applyingSync, setApplyingSync] = useState(false);

  // Setup card: visible at the top of the tab for admins/owners until explicitly dismissed.
  // Stored per-project in localStorage so it stays gone after a page reload.
  const setupDismissKey = `get:setup-dismissed:${projectId}`;
  const [setupDismissed, setSetupDismissed] = useState(() => {
    try { return !!localStorage.getItem(`get:setup-dismissed:${projectId}`); } catch { return false; }
  });
  const dismissSetup = () => {
    try { localStorage.setItem(setupDismissKey, "1"); } catch {}
    setSetupDismissed(true);
  };
  const showSetupCard = canManage && (syncState === "setup" || (!setupDismissed && syncState === "idle"));

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

  const handleSyncFromSite = async () => {
    setSyncState("loading");
    try {
      const r = await apiFetch(`/api/projects/${projectId}/content/pull-from-site`, {
        method: "POST",
      });
      const data = r as any;
      setSyncUrl(data.url ?? "");
      setSyncCapturedAt(data.capturedAt ?? "");
      const scanned = (data.sections ?? []) as SiteSection[];
      setSections(scanned);
      const allKeys = new Set<string>();
      scanned.forEach((sec, si) => sec.fields.forEach((_, fi) => allKeys.add(`${si}:${fi}`)));
      setSelectedKeys(allKeys);
      if (scanned.length === 0) {
        toast({ title: "Nothing found", description: "The scanner ran but found no text sections. Make sure the page has visible content." });
        setSyncState("idle");
      } else {
        setSyncState("results");
      }
    } catch (err: any) {
      // 404 means no snapshot exists yet → show setup instructions
      if (err.message?.includes("No scan found")) {
        setSyncState("setup");
      } else {
        toast({ variant: "destructive", title: "Scan failed", description: err.message });
        setSyncState("idle");
      }
    }
  };

  const handleApplySync = async () => {
    setApplyingSync(true);
    // Collect selected fields from sections
    const toCreate: SiteField[] = [];
    sections.forEach((sec, si) =>
      sec.fields.forEach((field, fi) => {
        if (selectedKeys.has(`${si}:${fi}`)) toCreate.push(field);
      })
    );
    try {
      await Promise.all(
        toCreate.map((f) =>
          apiFetch(`/api/projects/${projectId}/content`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: f.label, type: f.type, value: f.value }),
          })
        )
      );
      toast({
        title: "Fields imported",
        description: `${toCreate.length} field${toCreate.length !== 1 ? "s" : ""} added to your content map.`,
      });
      setSyncState("idle");
      setSections([]);
      refetch();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Import failed", description: err.message });
    } finally {
      setApplyingSync(false);
    }
  };

  const openEdit = (field: any) => {
    setEditValues((prev) => ({ ...prev, [field.id]: field.value ?? "" }));
    setExpandedField(field.id);
  };

  const saveValue = (field: any) => {
    updateMutation.mutate(
      { projectId, fieldId: field.id, data: { value: editValues[field.id] } },
      {
        onSuccess: () => {
          toast({ title: "Content updated", description: "The live value has been saved." });
          setExpandedField(null);
          refetch();
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't save", description: err.message }),
      }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Connect your site — always visible for admins until dismissed */}
      {showSetupCard && (
        <ScannerSetupCard
          projectId={projectId}
          onDismiss={dismissSetup}
        />
      )}

      <SectionTitle
        description={canManage ? "Everything clients are allowed to change." : "Everything clients are allowed to change on this project."}
        action={
          canManage && !isAdding ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Re-open setup when dismissed */}
              {setupDismissed && syncState === "idle" && (
                <button
                  type="button"
                  onClick={() => setSetupDismissed(false)}
                  style={{
                    fontSize: 12, fontWeight: 600, color: tone[500],
                    background: "transparent", border: `1px solid ${line.base}`,
                    borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}
                >
                  <ShieldCheck style={{ width: 12, height: 12 }} />
                  Setup
                </button>
              )}
              <SecondaryButton
                size="sm"
                onClick={handleSyncFromSite}
                loading={syncState === "loading"}
                disabled={syncState === "loading"}
                title="Pull in content found on your site"
              >
                <RefreshCw style={{ width: 13, height: 13 }} />
                Scan my site
              </SecondaryButton>
              <PrimaryButton onClick={() => setIsAdding(true)}>
                <Plus style={{ width: 14, height: 14 }} />
                Add field
              </PrimaryButton>
            </div>
          ) : null
        }
      >
        Content fields
      </SectionTitle>

      {canManage && syncState === "idle" && (
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "10px 14px",
            borderRadius: r.md,
            background: tone[50],
            border: `1px solid ${line.base}`,
            fontSize: type.xs,
            color: tone[600],
            lineHeight: 1.55,
          }}
        >
          <Info style={{ width: 14, height: 14, color: tone[400], flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ color: tone[700] }}>How scanning works.</strong>{" "}
            The scanner captures every visible heading, paragraph, link, and image on each page your app loads — including pages your users navigate to. Content that appears only after a click, hover, or scroll (modals, tabs, lazy-loaded sections) won't be picked up automatically. If your site fetches data on load, the scanner runs again 3 seconds later to catch it. You can always click <strong>Scan my site</strong> again after any change.
          </div>
        </div>
      )}

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
          fields.map((field, idx) => {
            const isExpanded = expandedField === field.id;
            const isSaving = updateMutation.isPending && expandedField === field.id;
            const hasValue = field.value != null && field.value !== "";
            return (
              <div
                key={field.id}
                style={{ borderTop: idx === 0 ? "none" : `1px solid ${line.base}` }}
              >
                {/* Main row */}
                <div style={{ ...rowStyle, borderTop: "none" }}>
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
                      <p
                        style={{
                          fontSize: type.xs,
                          color: hasValue ? tone[500] : tone[400],
                          marginTop: 2,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 260,
                        }}
                      >
                        {hasValue ? field.value : `${prettyType(field.type)} — no content yet`}
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {/* Inline edit toggle — owners/admins only */}
                    {canManage && (
                      <button
                        onClick={() => isExpanded ? setExpandedField(null) : openEdit(field)}
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
                          background: isExpanded ? BRAND.ink : tone[100],
                          color: isExpanded ? BRAND.paper : tone[600],
                          transition: `background 0.18s ${ease}`,
                        }}
                      >
                        <FileEdit style={{ width: 12, height: 12 }} />
                        {isExpanded ? "Cancel" : "Edit"}
                      </button>
                    )}
                    {canManage ? (
                      <button
                      onClick={() =>
                        updateMutation.mutate(
                          { projectId, fieldId: field.id, data: { isLocked: !field.isLocked } },
                          { onSuccess: () => refetch() }
                        )
                      }
                      title={field.isLocked
                        ? "Locked — clients can't change this. Click to unlock."
                        : "Unlocked — clients can change this. Click to lock."}
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
                        background: field.isLocked ? BRAND.ink : tone[100],
                        color: field.isLocked ? BRAND.paper : tone[600],
                        transition: `background 0.18s ${ease}`,
                      }}
                    >
                      {field.isLocked ? (
                        <Lock style={{ width: 12, height: 12 }} />
                      ) : (
                        <Unlock style={{ width: 12, height: 12 }} />
                      )}
                      {field.isLocked ? "Locked" : "Unlocked"}
                    </button>
                    ) : (
                      <span
                        title={field.isLocked
                          ? "Locked — clients can't change this."
                          : "Unlocked — clients can change this."}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: type.xs,
                          fontWeight: 600,
                          padding: "6px 11px",
                          borderRadius: 8,
                          background: field.isLocked ? BRAND.ink : tone[100],
                          color: field.isLocked ? BRAND.paper : tone[600],
                        }}
                      >
                        {field.isLocked ? (
                          <Lock style={{ width: 12, height: 12 }} />
                        ) : (
                          <Unlock style={{ width: 12, height: 12 }} />
                        )}
                        {field.isLocked ? "Locked" : "Unlocked"}
                      </span>
                    )}
                    {canManage && (
                      <IconDeleteButton
                        onClick={() =>
                          deleteMutation.mutate(
                            { projectId, fieldId: field.id },
                            { onSuccess: () => refetch() }
                          )
                        }
                      />
                    )}
                  </div>
                </div>

                {/* Inline content editor — expands below the row */}
                {isExpanded && canManage && (
                  <div
                    style={{
                      padding: "0 20px 18px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {field.type === "richtext" ? (
                      <Textarea
                        value={editValues[field.id] ?? ""}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder={`Enter ${field.label} content…`}
                        style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                      />
                    ) : field.type === "boolean" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, height: 44 }}>
                        <Switch
                          checked={editValues[field.id] === "true"}
                          onCheckedChange={(c) =>
                            setEditValues((prev) => ({ ...prev, [field.id]: c ? "true" : "false" }))
                          }
                          className="data-[state=checked]:bg-[#1a1a2e]"
                        />
                        <span style={{ fontSize: type.base, fontWeight: 500 }}>
                          {editValues[field.id] === "true" ? "Yes" : "No"}
                        </span>
                      </div>
                    ) : (
                      <Input
                        type={field.type === "url" || field.type === "image" ? "url" : field.type === "number" ? "number" : "text"}
                        value={editValues[field.id] ?? ""}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                        }
                        placeholder={
                          field.type === "url" || field.type === "image" ? "https://" : `Enter ${field.label}…`
                        }
                        style={{
                          ...inputStyle,
                          fontFamily: field.type === "url" || field.type === "image" ? "monospace" : undefined,
                          fontSize: field.type === "url" || field.type === "image" ? type.sm : undefined,
                        }}
                      />
                    )}
                    <div style={{ display: "flex", gap: 8 }}>
                      <PrimaryButton
                        size="sm"
                        onClick={() => saveValue(field)}
                        loading={isSaving}
                        disabled={isSaving}
                      >
                        {isSaving ? "Saving…" : "Save content"}
                      </PrimaryButton>
                      <SecondaryButton size="sm" onClick={() => setExpandedField(null)}>
                        Cancel
                      </SecondaryButton>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>
      {/* Setup card is now rendered at the top of the tab — see showSetupCard */}

      {/* Scan results panel */}
      {syncState === "results" && sections.length > 0 && (
        <Card padded>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: type.base, fontWeight: 600, marginBottom: 4 }}>
              Content found on your site
            </p>
            <p style={{ fontSize: type.xs, color: tone[500] }}>
              {syncCapturedAt && (
                <>Captured {format(new Date(syncCapturedAt), "MMM d 'at' h:mm a")}
                  {syncUrl ? <> from <span style={{ fontFamily: "monospace" }}>{syncUrl}</span></> : null}
                  {" — "}
                </>
              )}
              Uncheck anything you don't want to import. Each checked item will be added as a new content field.
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 16 }}>
            {sections.map((sec, si) => (
              <div key={si}>
                {/* Section header with select-all toggle */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    paddingBottom: 6,
                    borderBottom: `1px solid ${line.base}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={sec.fields.every((_, fi) => selectedKeys.has(`${si}:${fi}`))}
                    onChange={(e) => {
                      const next = new Set(selectedKeys);
                      sec.fields.forEach((_, fi) => {
                        e.target.checked ? next.add(`${si}:${fi}`) : next.delete(`${si}:${fi}`);
                      });
                      setSelectedKeys(next);
                    }}
                    style={{ accentColor: BRAND.ink, flexShrink: 0 }}
                  />
                  <p style={{ fontSize: type.sm, fontWeight: 700, color: tone[700] }}>{sec.name}</p>
                  <span style={{ fontSize: type.xs, color: tone[400], marginLeft: "auto" }}>
                    {sec.fields.filter((_, fi) => selectedKeys.has(`${si}:${fi}`)).length}/{sec.fields.length} selected
                  </span>
                </div>
                {/* Fields inside the section */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sec.fields.map((field, fi) => {
                    const key = `${si}:${fi}`;
                    const checked = selectedKeys.has(key);
                    return (
                      <label
                        key={key}
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-start",
                          cursor: "pointer",
                          padding: "10px 12px",
                          borderRadius: 10,
                          background: checked ? tone[50] : "transparent",
                          border: `1px solid ${checked ? line.base : "transparent"}`,
                          transition: `background 0.15s ${ease}`,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(selectedKeys);
                            e.target.checked ? next.add(key) : next.delete(key);
                            setSelectedKeys(next);
                          }}
                          style={{ marginTop: 3, flexShrink: 0, accentColor: BRAND.ink }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            <p style={{ fontSize: type.sm, fontWeight: 600 }}>{field.label}</p>
                            <span
                              style={{
                                fontSize: 10,
                                color: tone[400],
                                background: tone[100],
                                borderRadius: 4,
                                padding: "1px 5px",
                                textTransform: "uppercase",
                                letterSpacing: "0.04em",
                              }}
                            >
                              {field.type}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: type.xs,
                              color: tone[600],
                              overflow: "hidden",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              lineHeight: "1.4",
                            }}
                          >
                            {field.value || <span style={{ color: tone[400], fontStyle: "italic" }}>empty</span>}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <PrimaryButton
              size="sm"
              onClick={handleApplySync}
              loading={applyingSync}
              disabled={applyingSync || selectedKeys.size === 0}
            >
              {applyingSync ? "Importing…" : `Import ${selectedKeys.size} field${selectedKeys.size !== 1 ? "s" : ""}`}
            </PrimaryButton>
            <SecondaryButton size="sm" onClick={() => { setSyncState("idle"); setSections([]); setSelectedKeys(new Set()); }}>
              Discard
            </SecondaryButton>
          </div>
        </Card>
      )}
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

function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return "";
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/accept-invite/${token}`;
}

function CopyInviteLinkButton({ token, label = "Copy link" }: { token: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    const url = buildInviteUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Invite link copied", description: "Send it to your client to give them access." });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy", description: "Copy this link manually: " + url });
    }
  };
  return (
    <SecondaryButton size="sm" onClick={onCopy}>
      {copied ? "Copied" : label}
    </SecondaryButton>
  );
}

function ClientsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data: users, refetch: refetchUsers } = useListProjectUsers(projectId);
  const { data: invites, refetch: refetchInvites } = useListInvites(projectId);
  const inviteMutation = useCreateInvite();
  const revokeMutation = useRevokeInvite();
  const roleMutation = useUpdateUserRole();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<any>("editor");
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);

  const handleInvite = () => {
    inviteMutation.mutate(
      { projectId, data: { email, role } },
      {
        onSuccess: (created: any) => {
          setEmail("");
          refetchInvites();
          const token = created?.token as string | undefined;
          if (token) {
            const url = buildInviteUrl(token);
            setLatestInviteUrl(url);
            navigator.clipboard?.writeText(url).catch(() => {});
            toast({ title: "Invite ready", description: "Link copied — share it with your client." });
          } else {
            toast({ title: "Invite created" });
          }
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Invite failed", description: err.message }),
      }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {canManage && (
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
            {inviteMutation.isPending ? "Sending…" : "Create invite link"}
          </PrimaryButton>
        </div>

        {latestInviteUrl && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: `1px solid ${line.base}`,
              borderRadius: r.md,
              background: tone[50],
            }}
          >
            <p
              style={{
                fontSize: type.xs,
                color: tone[500],
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 6,
              }}
            >
              Share this private link
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <code
                style={{
                  flex: "1 1 220px",
                  minWidth: 0,
                  fontSize: type.xs,
                  color: BRAND.ink,
                  background: "white",
                  padding: "8px 10px",
                  borderRadius: r.sm,
                  border: `1px solid ${line.base}`,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {latestInviteUrl}
              </code>
              <SecondaryButton
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(latestInviteUrl);
                    toast({ title: "Link copied" });
                  } catch {
                    toast({ variant: "destructive", title: "Couldn't copy" });
                  }
                }}
              >
                Copy
              </SecondaryButton>
            </div>
            <p style={{ fontSize: type.xs, color: tone[500], marginTop: 8, lineHeight: 1.5 }}>
              They'll create an account (or sign in) with this email to accept. Link expires in 7 days.
            </p>
          </div>
        )}
      </Card>
      )}

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
                {canManage && u.role !== "owner" ? (
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
                ) : (
                  <span
                    style={{
                      fontSize: type.xs,
                      fontWeight: 600,
                      color: tone[600],
                      background: tone[100],
                      padding: "4px 10px",
                      borderRadius: 999,
                      textTransform: "capitalize",
                    }}
                  >
                    {u.role}
                  </span>
                )}
              </div>
            ))
          )}
        </Card>
      </div>

      {(() => {
        const pendingInvites = invites?.filter((inv) => inv.status === "pending") ?? [];
        if (!pendingInvites.length) return null;
        return (
          <div>
            <SectionTitle>Pending invites</SectionTitle>
            <Card>
              {pendingInvites.map((inv, idx) => {
                const token = (inv as any).token as string | undefined;
                return (
                  <div
                    key={inv.id}
                    style={{ ...rowStyle, borderTop: idx === 0 ? "none" : rowStyle.borderTop }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: type.base, fontWeight: 600 }}>{inv.email}</p>
                      <p style={{ fontSize: type.xs, color: tone[500], marginTop: 2 }}>
                        {inv.role}
                      </p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      {canManage && token && <CopyInviteLinkButton token={token} />}
                      {canManage && (
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
                      )}
                    </div>
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

// ── Domains ──────────────────────────────────────────────────────────────────

function DomainsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
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
      {canManage && (
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
      )}

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
              {canManage && (
                <IconDeleteButton
                  onClick={() =>
                    removeMutation.mutate(
                      { projectId, domainId: d.id },
                      { onSuccess: () => refetch() }
                    )
                  }
                />
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

// ── Drafts ───────────────────────────────────────────────────────────────────

function DraftsTab({
  projectId,
  canManage,
  autoPublish,
}: {
  projectId: string;
  canManage: boolean;
  autoPublish: boolean;
}) {
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
      {autoPublish && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            background: tone[50],
            border: `1px solid ${line.faint}`,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.55 }}>
            <strong style={{ color: BRAND.ink }}>Auto-publish is on.</strong>{" "}
            Client edits go live right away, so nothing waits here. Every change is
            still saved in the history below. To review before publishing, go to{" "}
            <em>Settings → Client publishing</em>.
          </span>
        </div>
      )}
      <div>
        <SectionTitle description="Client edits wait here until you publish them. Once you publish, the change shows up on your site right away.">
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
                  {canManage && (
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
                  )}
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
  const qc = useQueryClient();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description || "");
  // The server defaults autoPublish to true; legacy projects without the
  // column should also behave as autonomous, so we coerce undefined to true.
  const [autoPublish, setAutoPublish] = useState<boolean>(project.autoPublish ?? true);
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  // Toggling the auto-publish flag is its own one-click action so the user
  // sees the change take effect immediately without having to hit "Save".
  const toggleAutoPublish = (next: boolean) => {
    const previous = autoPublish;
    setAutoPublish(next); // optimistic
    updateMutation.mutate(
      { projectId: project.id, data: { autoPublish: next } },
      {
        onSuccess: () => {
          // The parent loads the project via useGetProject and passes
          // autoPublish down to the Drafts tab. Without this invalidation,
          // the cached project object would still claim the old value and
          // the Drafts banner would show the wrong state.
          qc.invalidateQueries({ queryKey: getGetProjectQueryKey(String(project.id)) });
          toast({
            title: next ? "Auto-publish on" : "Review required",
            description: next
              ? "Client edits go live the moment they save."
              : "Client edits now wait for your approval.",
          });
        },
        onError: (err) => {
          setAutoPublish(previous); // revert
          toast({ variant: "destructive", title: "Couldn't update", description: err.message });
        },
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(
      { projectId: project.id },
      {
        onSuccess: () => {
          setConfirmDelete(false);
          setLocation("/app/projects");
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't delete", description: err.message }),
      }
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 540 }}>
      <Card padded>
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

      <Card padded>
        <SectionTitle description="Choose what happens when a client saves a change.">
          Client publishing
        </SectionTitle>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 18,
            padding: "4px 0",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink, marginBottom: 4 }}>
              {autoPublish ? "Auto-publish client edits" : "Require my approval"}
            </p>
            <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.55 }}>
              {autoPublish
                ? "Clients hit Save and their changes go live right away. Nothing waits for approval."
                : "Client edits land in your Drafts tab and only go live after you publish them."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoPublish}
            onClick={() => toggleAutoPublish(!autoPublish)}
            disabled={updateMutation.isPending}
            data-testid="toggle-auto-publish"
            style={{
              flexShrink: 0,
              width: 44,
              height: 26,
              borderRadius: 999,
              border: "none",
              padding: 3,
              cursor: updateMutation.isPending ? "wait" : "pointer",
              background: autoPublish ? BRAND.ink : tone[300],
              transition: "background 160ms ease",
              position: "relative",
            }}
          >
            <span
              style={{
                display: "block",
                width: 20,
                height: 20,
                borderRadius: 999,
                background: BRAND.paper,
                transform: autoPublish ? "translateX(18px)" : "translateX(0)",
                transition: "transform 160ms ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
          </button>
        </div>
        <p style={{ fontSize: type.xs, color: tone[400], marginTop: 14, lineHeight: 1.55 }}>
          This only affects clients with the Editor role. Owners and admins always go live right away.
        </p>
      </Card>

      <Card padded>
        <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink, marginBottom: 4 }}>
          Delete this project
        </p>
        <p style={{ fontSize: type.sm, color: tone[500], marginBottom: 18, lineHeight: 1.55 }}>
          This will delete the project and everything in it — fields, drafts, and keys. It can't be undone.
        </p>
        <DangerButton onClick={() => setConfirmDelete(true)} disabled={deleteMutation.isPending}>
          <Trash2 style={{ width: 13, height: 13 }} />
          Delete project
        </DangerButton>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this project?"
        description="This will delete everything — the project, all fields, all drafts, and all keys. You can't get this back."
        confirmLabel="Delete project"
        cancelLabel="Keep it"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
      />
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

function KeysTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mcpCopied, setMcpCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

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
    setRevokingId(keyId);
    try {
      await apiFetch(`/api/projects/${projectId}/keys/${keyId}`, { method: "DELETE" });
      qc.invalidateQueries({ queryKey: ["project-keys", projectId] });
      toast({ title: "Key revoked" });
      setPendingRevokeId(null);
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
      {/* Install / Self-host download — mirrored here from the Content tab so
          users who land on the tab literally called "Connect" can actually
          find the connect-your-site flow. (UX fix for Erin-style stuckness.)
          No onDismiss prop = no X button; the card stays put on this tab. */}
      <ScannerSetupCard projectId={projectId} />

      {generatedKey && (
        <Card
          padded
          style={{
            padding: 22,
            border: `1px solid ${BRAND.ink}`,
            background: tone[50],
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <ShieldCheck style={{ width: 16, height: 16, color: BRAND.ink }} />
            <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink }}>
              Key generated — copy it now
            </p>
          </div>
          <p style={{ fontSize: type.sm, color: tone[600], marginBottom: 14, lineHeight: 1.55 }}>
            This is the only time you'll see the full key. Save it somewhere safe — like your Replit Secrets.
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
            <PrimaryButton onClick={handleCopy}>
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

      {canManage && (
      <Card padded>
        <SectionTitle description="A key connects your site to this project. Keep it safe — if it ever leaks, revoke it and make a new one.">
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
      )}

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
              description="Make one above to connect your site."
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
                {canManage && (
                  <DangerButton
                    size="sm"
                    onClick={() => setPendingRevokeId(k.id)}
                    disabled={revokingId === k.id}
                  >
                    {revokingId === k.id ? "Revoking…" : "Revoke"}
                  </DangerButton>
                )}
              </div>
            ))
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!pendingRevokeId}
        onOpenChange={(open) => { if (!open) setPendingRevokeId(null); }}
        title="Revoke this key?"
        description="Any site using this key will stop getting content right away. This can't be undone."
        confirmLabel="Revoke key"
        cancelLabel="Keep it"
        destructive
        loading={revokingId !== null}
        onConfirm={() => { if (pendingRevokeId) handleRevoke(pendingRevokeId); }}
      />

      <Card style={{ padding: 18, background: tone[50], border: `1px solid ${line.faint}` }}>
        <p style={{ fontSize: type.sm, fontWeight: 600, marginBottom: 8, color: BRAND.ink }}>
          How to use it in your app
        </p>
        <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.65, marginBottom: 12 }}>
          Save the key as a secret in your server, then use it to fetch your published content:
        </p>
        <pre
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12.5,
            lineHeight: 1.6,
            background: BRAND.ink,
            color: BRAND.paper,
            padding: "14px 16px",
            borderRadius: 10,
            overflowX: "auto",
            margin: 0,
          }}
        >
{`const res = await fetch("${typeof window !== "undefined" ? window.location.origin : "https://your-host"}/api/public/content", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.GET_PROJECT_KEY}\`,
    "Content-Type": "application/json",
  },
  // seed: your current content. Stored once if the field is empty,
  // so clients see real text in the editor — not blank boxes.
  body: JSON.stringify({ seed: {
    // "Hero Headline": "Welcome to My App",
  }}),
});
const { content } = await res.json();
// content["Hero Headline"]?.value ?? "Welcome to My App"`}
        </pre>
        <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.65, marginTop: 10 }}>
          Server use only — never put this key in code that runs in the browser.
        </p>
      </Card>

      {/* ── AI Assistant (MCP) ───────────────────────────────────────────
          Lets the user wire any MCP-capable AI assistant (Claude Desktop,
          Cursor, Replit Agent) directly to this project so the assistant
          can read fields, return the install snippet, and check status
          without copy-pasted prompts. The key in the JSON is a placeholder
          — we don't echo the real key here because it's only displayed
          once at generation time and we don't want to teach users to
          screenshot it.                                                  */}
      <Card style={{ padding: 18, background: tone[50], border: `1px solid ${line.faint}` }}>
        <p style={{ fontSize: type.sm, fontWeight: 600, marginBottom: 8, color: BRAND.ink }}>
          Use from an AI assistant (MCP)
        </p>
        <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.65, marginBottom: 12 }}>
          Add this to your <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>mcp.json</code> in Claude Desktop, Cursor, Replit Agent, or any MCP-capable client. The assistant can then fetch the install snippet, list your fields, and verify your install — no prompts needed.
        </p>
        {(() => {
          const mcpUrl = `${typeof window !== "undefined" ? window.location.origin : "https://your-host"}/api/mcp`;
          const mcpJson =
`{
  "mcpServers": {
    "get-cms": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer YOUR_FULL_KEY_HERE"
      }
    }
  }
}`;
          const handleMcpCopy = async () => {
            await navigator.clipboard.writeText(mcpJson);
            setMcpCopied(true);
            setTimeout(() => setMcpCopied(false), 2000);
          };
          return (
            <div style={{ position: "relative" }} data-testid="mcp-config-block">
              <pre
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  fontSize: 12.5,
                  lineHeight: 1.6,
                  background: BRAND.ink,
                  color: BRAND.paper,
                  padding: "14px 52px 14px 16px",
                  borderRadius: 10,
                  overflowX: "auto",
                  margin: 0,
                  whiteSpace: "pre",
                }}
              >
{mcpJson}
              </pre>
              <button
                onClick={handleMcpCopy}
                data-testid="mcp-copy-button"
                style={{
                  position: "absolute", top: 10, right: 10,
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "6px 10px", borderRadius: 8,
                  background: mcpCopied ? "#10b981" : "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer", fontSize: type.xs, fontWeight: 600, color: "#f9fafb",
                }}
              >
                {mcpCopied
                  ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
                  : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
              </button>
            </div>
          );
        })()}
        <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.65, marginTop: 10 }}>
          Replace <code style={{ fontFamily: "monospace" }}>YOUR_FULL_KEY_HERE</code> with the full project key (generated above). Restart your AI client after editing <code style={{ fontFamily: "monospace" }}>mcp.json</code>.
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
        (e.currentTarget as HTMLElement).style.background = tone[100];
        (e.currentTarget as HTMLElement).style.color = BRAND.ink;
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

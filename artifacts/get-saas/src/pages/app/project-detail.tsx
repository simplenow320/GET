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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Globe, Users, Database, FileEdit, Settings, Trash2,
  Lock, Unlock, Plus, Activity as ActivityIcon, ArrowLeft, Loader2,
  KeyRound, Copy, Check, ShieldCheck, RefreshCw, ArrowRight, Info,
  Radio, X as XIcon,
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
    { value: "keys",     icon: KeyRound,    label: "Site keys" },
    { value: "activity", icon: ActivityIcon,label: "Activity" },
    // Settings holds rename + delete; owners only.
    ...(isOwner ? [{ value: "settings", icon: Settings, label: "Settings" }] : []),
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

// Stacks shown in the install panel. We picked the four that cover ~95% of
// the vibe-coder long tail today (raw HTML + the two SSR/SSG meta-frameworks
// + WordPress because non-coders still pay people to build them in WP).
type Stack = "replit" | "html" | "vite" | "next" | "wordpress";

const STACK_LABELS: Record<Stack, string> = {
  replit: "Replit",
  html: "Vanilla HTML",
  vite: "React / Vite",
  next: "Next.js",
  wordpress: "WordPress",
};

function buildStackSnippet(stack: Stack, scannerUrl: string, keyHint: string): string {
  switch (stack) {
    case "replit":
      return `<!-- In your main HTML file, just before </body> -->\n<script\n  src="${scannerUrl}"\n  data-key="${keyHint}"\n  defer\n></script>`;
    case "html":
      return `<!-- Add just before </body> in your main HTML file -->\n<script\n  src="${scannerUrl}"\n  data-key="${keyHint}"\n  defer\n></script>`;
    case "vite":
      // Vite serves index.html as a literal template — same script tag, same place.
      return `<!-- index.html, just before </body> -->\n<script\n  src="${scannerUrl}"\n  data-key="${keyHint}"\n  defer\n></script>`;
    case "next":
      return `// app/layout.tsx (App Router)\nimport Script from "next/script";\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>\n        {children}\n        <Script\n          src="${scannerUrl}"\n          data-key="${keyHint}"\n          strategy="afterInteractive"\n        />\n      </body>\n    </html>\n  );\n}`;
    case "wordpress":
      return `<?php\n// In your active theme's footer.php, just before </body>.\n// Or use a plugin like "Insert Headers and Footers" → footer scripts.\n?>\n<script\n  src="${scannerUrl}"\n  data-key="${keyHint}"\n  defer\n></script>`;
  }
}

const STACK_HINTS: Record<Stack, string> = {
  replit: "Copy the AI prompt below and paste it into Replit AI — it will find your HTML file and add the tag.",
  html: "Paste this just before the closing </body> tag in your main HTML file.",
  vite: "Paste this near the bottom of your index.html file, just before </body>.",
  next: "Paste this into your root layout file. App Router shown — Pages Router works the same way.",
  wordpress: "Add this to your theme's footer, or use a plugin like 'Insert Headers and Footers'.",
};

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
  onDismiss: () => void;
}) {
  const [stack, setStack] = useState<Stack>("replit");
  const [copied, setCopied] = useState<"snippet" | "prompt" | null>(null);
  const [showAgentPrompt, setShowAgentPrompt] = useState(false);
  const [showReplitSnippet, setShowReplitSnippet] = useState(false);

  const { data: keys = [], isLoading: keysLoading } = useQuery<ProjectKeyBasic[]>({
    queryKey: ["project-keys-scanner", projectId],
    queryFn: async () => apiFetch(`/api/projects/${projectId}/keys`),
  });

  const firstKey = keys[0];
  const scannerUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${BASE}/api/public/scanner.js`;
  const keyHint = firstKey ? `${firstKey.keyPrefix}…` : "YOUR_PROJECT_KEY";

  const snippet = buildStackSnippet(stack, scannerUrl, keyHint);

  const replitPrompt = firstKey
    ? `Add the get CMS scanner script to my Replit app. Make ONLY the change described — do not rename, delete, or modify anything else.\n\nI've already added GET_PROJECT_KEY to my Replit Secrets. Find my main HTML file (usually index.html, or the template file that wraps every page). Just before the closing </body> tag, add this script tag:\n\n<script\n  src="${scannerUrl}"\n  data-key="INSERT_GET_PROJECT_KEY_VALUE_HERE"\n  defer\n></script>\n\nHow to get the data-key value:\n- If this is a server-rendered app (Express + EJS, Handlebars, etc.), read it from process.env.GET_PROJECT_KEY and inject it into the template.\n- If it's a static HTML file, open Replit Secrets, copy GET_PROJECT_KEY, and paste the value directly. The key starts with "${firstKey.keyPrefix}".\n\nRules:\n- Only add this one script tag. Change nothing else.\n- Do not rename or delete any files.\n- Do not touch styles, routes, or other logic.\n- After making the change, show me the exact line you added so I can confirm it looks right.`
    : null;

  const agentPrompt = firstKey
    ? `Add this script tag to my HTML file, just before the closing </body> tag:\n\n<script\n  src="${scannerUrl}"\n  data-key="YOUR_FULL_PROJECT_KEY"\n  defer\n></script>\n\nWhere to find YOUR_FULL_PROJECT_KEY: in the get dashboard, click "Site keys" on this project and copy the full key — it starts with "${firstKey.keyPrefix}". Only add the script tag. Change nothing else.`
    : null;

  const copy = async (which: "snippet" | "prompt", text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 2500);
  };

  // Verify install: poll the project's lastSeenAt, looking for it to advance
  // past the baseline we captured when the user clicked Verify. We try for
  // ~10s to keep the UI snappy and to keep accidental clicks cheap.
  type VerifyState =
    | { kind: "idle" }
    | { kind: "polling"; baselineMs: number; attempts: number }
    | { kind: "ok"; at: string }
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
          setVerify({ kind: "ok", at });
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

  return (
    <Card padded>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: type.base, fontWeight: 700, marginBottom: 6 }}>
              Connect your site
            </p>
            <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.6 }}>
              Two steps: add a small script to your site, then mark anything you want clients to be able to change. When they save an edit, it shows up on your site automatically.
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

        {/* Stack tabs */}
        <div role="tablist" style={{ display: "flex", gap: 4, padding: 4, background: tone[100], borderRadius: 10, overflowX: "auto" }}>
          {(Object.keys(STACK_LABELS) as Stack[]).map((s) => {
            const active = s === stack;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => setStack(s)}
                data-testid={`install-tab-${s}`}
                style={{
                  flex: 1,
                  minWidth: "max-content",
                  padding: "8px 14px",
                  borderRadius: 7,
                  border: "none",
                  background: active ? BRAND.paper : "transparent",
                  color: active ? BRAND.ink : tone[600],
                  fontSize: type.sm,
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                  transition: `background 0.15s ${ease}`,
                }}
              >
                {STACK_LABELS[s]}
              </button>
            );
          })}
        </div>

        {/* Per-stack hint */}
        <p style={{ fontSize: type.xs, color: tone[500], margin: 0 }}>
          {STACK_HINTS[stack]}
        </p>

        {/* Snippet box */}
        {keysLoading ? (
          <div style={{ height: 120, background: tone[50], borderRadius: r.md, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Loader2 style={{ width: 16, height: 16, color: tone[400] }} className="animate-spin" />
          </div>
        ) : !firstKey ? (
          <div style={{ padding: "14px 16px", borderRadius: r.md, background: tone[50], border: `1px solid ${line.base}` }}>
            <p style={{ fontSize: type.sm, color: tone[600] }}>
              You need a project key before you can install. Go to the <strong>Site keys</strong> tab and make one, then come back here.
            </p>
          </div>
        ) : stack === "replit" && replitPrompt ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ fontSize: type.xs, fontWeight: 700, color: tone[500], textTransform: "uppercase" as const, letterSpacing: "0.07em", margin: 0 }}>
              Paste into Replit AI
            </p>
            <div style={{ position: "relative" }} data-testid="install-snippet">
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
                {replitPrompt}
              </pre>
              <button
                onClick={() => copy("prompt", replitPrompt)}
                data-testid="install-copy-snippet"
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: copied === "prompt" ? "#10b981" : "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  fontSize: type.xs,
                  fontWeight: 600,
                  color: "#f9fafb",
                  transition: `background 0.15s ${ease}`,
                }}
              >
                {copied === "prompt"
                  ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
                  : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowReplitSnippet((s) => !s)}
              style={{
                background: "none", border: "none", padding: 0,
                cursor: "pointer", fontSize: type.xs, color: tone[500],
                fontWeight: 500, textDecoration: "underline", textAlign: "left" as const,
              }}
            >
              {showReplitSnippet ? "Hide raw snippet" : "Or add the tag yourself →"}
            </button>
            {showReplitSnippet && (
              <div style={{ position: "relative" }}>
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
                  whiteSpace: "pre",
                  maxHeight: 280,
                }}>
                  {snippet}
                </pre>
                <button
                  onClick={() => copy("snippet", snippet)}
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: copied === "snippet" ? "#10b981" : "rgba(255,255,255,0.10)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    cursor: "pointer",
                    fontSize: type.xs,
                    fontWeight: 600,
                    color: "#f9fafb",
                    transition: `background 0.15s ${ease}`,
                  }}
                >
                  {copied === "snippet"
                    ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
                    : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ position: "relative" }} data-testid="install-snippet">
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
              whiteSpace: "pre",
              maxHeight: 280,
            }}>
              {snippet}
            </pre>
            <button
              onClick={() => copy("snippet", snippet)}
              data-testid="install-copy-snippet"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 10px",
                borderRadius: 8,
                background: copied === "snippet" ? "#10b981" : "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.15)",
                cursor: "pointer",
                fontSize: type.xs,
                fontWeight: 600,
                color: "#f9fafb",
                transition: `background 0.15s ${ease}`,
              }}
            >
              {copied === "snippet"
                ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
                : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
            </button>
          </div>
        )}

        {firstKey && (
          <p style={{ fontSize: 11.5, color: tone[500], margin: 0, lineHeight: 1.55 }}>
            Replace <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>{keyHint}</code> with your full key (found in the Site keys tab). If it ever leaks, just revoke it and make a new one.
          </p>
        )}

        {/* Step 2: tag your elements */}
        <div style={{ borderTop: `1px solid ${line.faint}`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <p style={{ fontSize: type.sm, fontWeight: 700, marginBottom: 4 }}>
              Step 2 — tag your elements
            </p>
            <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.6, marginBottom: 10 }}>
              Add <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>data-get-key</code> to any element on your page. Set it to the exact name of the field from your Fields tab. The script will swap in the saved content every time the page loads.
            </p>
            <div style={{ position: "relative" }} data-testid="step2-example">
              <pre style={{
                margin: 0,
                padding: "14px 52px 14px 16px",
                borderRadius: r.lg,
                background: "#0f1419",
                color: "#e5e7eb",
                fontSize: 12,
                lineHeight: 1.65,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                overflow: "auto",
                whiteSpace: "pre",
              }}>
{`<!-- text / long text field -->
<h1 data-get-key="Hero Heading">Default headline</h1>
<p  data-get-key="Hero Body">Default paragraph text.</p>

<!-- image field -->
<img data-get-key="Hero Image" src="default.jpg" alt="" />

<!-- link / URL field -->
<a data-get-key="CTA Link" href="/default">Get started</a>`}
              </pre>
              <button
                onClick={() => copy("prompt",
                  `<!-- text / long text field -->\n<h1 data-get-key="Hero Heading">Default headline</h1>\n<p  data-get-key="Hero Body">Default paragraph text.</p>\n\n<!-- image field -->\n<img data-get-key="Hero Image" src="default.jpg" alt="" />\n\n<!-- link / URL field -->\n<a data-get-key="CTA Link" href="/default">Get started</a>`
                )}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 10,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: copied === "prompt" ? "#10b981" : "rgba(255,255,255,0.10)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  cursor: "pointer",
                  fontSize: type.xs,
                  fontWeight: 600,
                  color: "#f9fafb",
                  transition: `background 0.15s ${ease}`,
                }}
              >
                {copied === "prompt"
                  ? <><Check style={{ width: 12, height: 12 }} /> Copied!</>
                  : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
              </button>
            </div>
            <p style={{ fontSize: 11.5, color: tone[500], margin: "8px 0 0", lineHeight: 1.55 }}>
              The name must match exactly — capital letters matter. You can put it on any element, anywhere on the page.
            </p>
          </div>

          {/* Loading state tip */}
          <div style={{ marginTop: 4 }}>
            <p style={{ fontSize: type.sm, fontWeight: 700, marginBottom: 4 }}>
              Optional — loading state
            </p>
            <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.6, marginBottom: 10 }}>
              While the script is loading your content, it adds <code style={{ background: tone[100], padding: "1px 5px", borderRadius: 4, fontFamily: "monospace" }}>data-get-loading</code> to the page. You can use that in your CSS to hide or dim your tagged elements so visitors don't see a flash of the old text.
            </p>
            <div style={{ position: "relative" }}>
              <pre style={{
                margin: 0,
                padding: "14px 16px",
                borderRadius: r.lg,
                background: "#0f1419",
                color: "#e5e7eb",
                fontSize: 12,
                lineHeight: 1.65,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                overflow: "auto",
                whiteSpace: "pre",
              }}>
{`/* Simple fade — add to your stylesheet */
[data-get-loading] [data-get-key] {
  opacity: 0;
}
[data-get-key] {
  transition: opacity 0.2s ease;
}

/* Or a skeleton shimmer */
[data-get-loading] [data-get-key] {
  color: transparent;
  border-radius: 4px;
  background: linear-gradient(90deg,#e5e7eb 25%,#f3f4f6 50%,#e5e7eb 75%);
  background-size: 200% 100%;
  animation: get-shimmer 1.2s infinite;
}
@keyframes get-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* Verify install */}
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
            <div data-testid="verify-result-ok" style={{
              padding: "10px 14px", borderRadius: 10,
              background: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.25)",
              color: "#047857",
              fontSize: type.sm, fontWeight: 600,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <Check style={{ width: 14, height: 14 }} />
              We just saw your site at {format(new Date(verify.at), "h:mm:ss a")}.
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

        {/* Fallback: agent prompt for non-Replit tabs (Replit tab already shows the prompt as primary) */}
        {firstKey && stack !== "replit" && (
          <div style={{ borderTop: `1px solid ${line.faint}`, paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowAgentPrompt((s) => !s)}
              style={{
                background: "none", border: "none", padding: 0,
                cursor: "pointer", fontSize: type.xs, color: tone[600],
                fontWeight: 600, textDecoration: "underline",
              }}
            >
              {showAgentPrompt ? "Hide AI agent prompt" : "Or have an AI agent do it for you"}
            </button>
            {showAgentPrompt && agentPrompt && (
              <div style={{ position: "relative", marginTop: 10 }}>
                <div style={{
                  padding: "14px 48px 14px 16px",
                  borderRadius: r.md,
                  background: tone[50],
                  border: `1px solid ${line.base}`,
                  fontSize: type.sm,
                  color: BRAND.ink,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {agentPrompt}
                </div>
                <button
                  onClick={() => copy("prompt", agentPrompt)}
                  style={{
                    position: "absolute", top: 8, right: 8,
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 9px", borderRadius: 7,
                    background: copied === "prompt" ? BRAND.ink : tone[100],
                    color: copied === "prompt" ? BRAND.paper : tone[600],
                    border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                  }}
                >
                  {copied === "prompt" ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </div>
        )}
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
      <SectionTitle
        description={canManage ? "Everything clients are allowed to change." : "Everything clients are allowed to change on this project."}
        action={
          canManage && !isAdding ? (
            <div style={{ display: "flex", gap: 8 }}>
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
      {/* Setup instructions — shown when no snapshot exists yet */}
      {syncState === "setup" && (
        <ScannerSetupCard
          projectId={projectId}
          onDismiss={() => setSyncState("idle")}
        />
      )}

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

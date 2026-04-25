import { useState, useEffect } from "react";
import { useLocation, useParams, Link } from "wouter";
import {
  useGetProject,
  useCreateContentField,
  useCreateInvite,
  useAddDomain,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Copy, Check,
  Zap, Loader2, ArrowRight, Edit3,
  MonitorSmartphone, Box,
} from "lucide-react";
import {
  BRAND, tone, line, type, ease, r,
  PrimaryButton, SecondaryButton, GhostButton, Card, Field,
  inputStyle, labelStyle, IconTile,
} from "@/lib/ui";

// Brand rule: this is inside the authenticated product UI — do NOT render
// any get branding (logo, mascot, wordmark) on this surface.

// ── Helpers ───────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function getToken() { return localStorage.getItem("auth_token") ?? ""; }
async function apiFetch(path: string, opts: RequestInit = {}) {
  const r = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts.headers ?? {}) },
  });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${r.status}`); }
  if (r.status === 204) return null;
  return r.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AppType = "replit" | "nextjs" | "other";

interface WizardState {
  appType: AppType | null;
  generatedKey: string | null;
  keyName: string;
  keyGenerated: boolean;
  domainAdded: boolean;
  fields: { label: string; type: string }[];
  clientInvited: boolean;
}

const TOTAL_STEPS = 7;

// ── Sub-components ───────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "relative", background: BRAND.ink, borderRadius: r.lg, overflow: "hidden" }}>
      <pre
        style={{
          margin: 0,
          padding: "16px 56px 16px 18px",
          fontSize: type.sm,
          fontFamily: "ui-monospace, Menlo, monospace",
          color: BRAND.paper,
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {code}
      </pre>
      <button
        onClick={handleCopy}
        aria-label="Copy"
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: copied ? "rgba(255,215,71,0.22)" : "rgba(255,255,255,0.07)",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: copied ? BRAND.yellow : "rgba(255,255,255,0.65)",
          transition: `background 0.18s ${ease}`,
        }}
      >
        {copied ? <Check style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
      </button>
    </div>
  );
}

function KeyReveal({ keyValue }: { keyValue: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(keyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div
      style={{
        background: tone[50],
        border: `1px solid ${BRAND.ink}`,
        borderRadius: r.lg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "11px 16px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderBottom: `1px solid ${tone[200]}`,
          background: BRAND.surface,
        }}
      >
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: BRAND.yellow }} />
        <span style={{ fontSize: type.xs, fontWeight: 600, color: BRAND.ink }}>
          Copy now — your key won't be shown again
        </span>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <code
          style={{
            flex: 1,
            fontSize: type.sm,
            fontFamily: "ui-monospace, Menlo, monospace",
            color: BRAND.ink,
            wordBreak: "break-all",
            lineHeight: 1.55,
          }}
        >
          {keyValue}
        </code>
        <PrimaryButton onClick={handleCopy} style={{ flexShrink: 0 }}>
          {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
          {copied ? "Copied" : "Copy"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function StepDots({ step }: { step: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={step}
      aria-valuemin={1}
      aria-valuemax={TOTAL_STEPS}
      style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}
    >
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const idx = i + 1;
        const past = idx < step;
        const current = idx === step;
        return (
          <div
            key={i}
            style={{
              width: current ? 22 : 6,
              height: 6,
              borderRadius: 3,
              background: past || current ? BRAND.ink : tone[200],
              transition: `width 0.3s ${ease}, background 0.3s ${ease}`,
            }}
          />
        );
      })}
    </div>
  );
}

function StepHeader({
  step,
  title,
  intro,
  optional = false,
}: {
  step: number;
  title: React.ReactNode;
  intro: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div>
      <p
        style={{
          fontSize: type.xs,
          fontWeight: 600,
          color: tone[500],
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span>Step {step} of {TOTAL_STEPS}</span>
        {optional && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: tone[500],
              background: tone[100],
              padding: "2px 8px",
              borderRadius: 999,
              letterSpacing: "0.04em",
            }}
          >
            Optional
          </span>
        )}
      </p>
      <h1
        style={{
          fontSize: 28,
          fontWeight: 600,
          color: BRAND.ink,
          letterSpacing: "-0.025em",
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p style={{ fontSize: type.md, color: tone[500], lineHeight: 1.6, marginTop: 10 }}>
        {intro}
      </p>
    </div>
  );
}

// ── Field types & app types ──────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text",     label: "Short text", desc: "Headlines, names, labels" },
  { value: "richtext", label: "Long text",  desc: "Paragraphs and bios" },
  { value: "image",    label: "Image",      desc: "Photo, logo, illustration" },
  { value: "url",      label: "Link",       desc: "Buttons or external URLs" },
  { value: "number",   label: "Number",     desc: "Price, count, stat" },
];

const APP_TYPES: { id: AppType; icon: React.ElementType; label: string; desc: string }[] = [
  { id: "replit", icon: Zap,                label: "Replit app",      desc: "Built and running on Replit" },
  { id: "nextjs", icon: MonitorSmartphone,  label: "Next.js / Remix", desc: "Vercel, Netlify, or similar" },
  { id: "other",  icon: Box,                label: "Something else",  desc: "Any other framework or host" },
];

function getEnvHint(appType: AppType | null) {
  if (appType === "replit") return "In Replit, open the Secrets pane (lock icon in the sidebar) and add it there.";
  if (appType === "nextjs") return "Add it to your .env.local file, or to your hosting provider's environment variables.";
  return "Add it to your .env file, or wherever your app reads environment variables.";
}

function getEnvCode(key: string) {
  return `GET_PROJECT_KEY=${key}`;
}

function getReadCode(apiOrigin: string) {
  return `// Run this on your server (Node 18+, Cloudflare Workers, Deno, etc.)
const res = await fetch("${apiOrigin}/api/public/content", {
  headers: { Authorization: \`Bearer \${process.env.GET_PROJECT_KEY}\` }
});
const { content } = await res.json();

// content is keyed by the field labels you defined.
// Example: content["Hero Headline"]?.value`;
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function SetupWizard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });

  const createFieldMutation = useCreateContentField();
  const createInviteMutation = useCreateInvite();
  const addDomainMutation = useAddDomain();

  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    appType: null,
    generatedKey: null,
    keyName: "Production",
    keyGenerated: false,
    domainAdded: false,
    fields: [],
    clientInvited: false,
  });

  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [email, setEmail] = useState("");
  const [hostname, setHostname] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  function buildInviteUrl(token: string): string {
    if (typeof window === "undefined") return "";
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    return `${window.location.origin}${base}/accept-invite/${token}`;
  }

  const goBack = () => { if (step > 1) setStep((s) => s - 1); };
  const goNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS));

  const generateKey = () => {
    setIsGeneratingKey(true);
    setKeyError(null);
    apiFetch(`/api/projects/${projectId}/keys`, {
      method: "POST",
      body: JSON.stringify({ name: "Production" }),
    })
      .then((result: any) => {
        setState((s) => ({ ...s, generatedKey: result.rawKey, keyGenerated: true }));
      })
      .catch((e: any) => {
        setKeyError(e.message || "Something went wrong");
        toast({
          variant: "destructive",
          title: "Couldn't generate key",
          description: e.message,
        });
      })
      .finally(() => setIsGeneratingKey(false));
  };

  // Auto-generate key when arriving at the connect step (step 3)
  useEffect(() => {
    if (step === 3 && !state.keyGenerated && !isGeneratingKey && !keyError) {
      generateKey();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const apiOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://your-host";

  const handleAddField = () => {
    if (!fieldLabel.trim()) return;
    createFieldMutation.mutate(
      { projectId, data: { label: fieldLabel.trim(), type: fieldType as any } },
      {
        onSuccess: () => {
          setState((s) => ({
            ...s,
            fields: [...s.fields, { label: fieldLabel.trim(), type: fieldType }],
          }));
          setFieldLabel("");
          setFieldType("text");
          toast({ title: `"${fieldLabel.trim()}" added` });
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't add", description: err.message }),
      }
    );
  };

  const handleAddDomain = () => {
    if (!hostname.trim()) { goNext(); return; }
    addDomainMutation.mutate(
      { projectId, data: { hostname: hostname.trim() } },
      {
        onSuccess: () => {
          setState((s) => ({ ...s, domainAdded: true }));
          goNext();
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't add domain", description: err.message }),
      }
    );
  };

  const handleInvite = () => {
    if (!email.trim()) { goNext(); return; }
    createInviteMutation.mutate(
      { projectId, data: { email: email.trim(), role: "editor" } },
      {
        onSuccess: (created: any) => {
          setState((s) => ({ ...s, clientInvited: true }));
          const token = created?.token as string | undefined;
          if (token) {
            const url = buildInviteUrl(token);
            setInviteUrl(url);
            navigator.clipboard?.writeText(url).catch(() => {});
            toast({ title: "Invite ready", description: "Link copied — share it with your client." });
          } else {
            toast({ title: "Invite sent" });
            goNext();
          }
        },
        onError: (err) =>
          toast({ variant: "destructive", title: "Couldn't invite", description: err.message }),
      }
    );
  };

  const handleCopyInviteUrl = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
      toast({ title: "Link copied" });
    } catch {
      toast({ variant: "destructive", title: "Couldn't copy", description: inviteUrl });
    }
  };

  if (isLoading || !project) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.paper,
        }}
      >
        <Loader2
          style={{
            width: 24,
            height: 24,
            color: tone[300],
            animation: "spin 1s linear infinite",
          }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BRAND.paper,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top bar (single, calmer than before) */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(250,249,246,0.9)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${line.faint}`,
          padding: "0 clamp(16px, 4vw, 28px)",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <button
            onClick={goBack}
            aria-label="Back"
            disabled={step <= 1}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: "none",
              background: step > 1 ? tone[100] : "transparent",
              cursor: step > 1 ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: step > 1 ? BRAND.ink : "transparent",
              transition: `background 0.15s ${ease}`,
              flexShrink: 0,
            }}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>
          <span
            style={{
              fontSize: type.base,
              fontWeight: 600,
              color: BRAND.ink,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            Set up project
          </span>
        </div>

        <StepDots step={step} />

        <Link
          href="/app/projects"
          style={{
            fontSize: type.sm,
            color: tone[500],
            textDecoration: "none",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          Exit
        </Link>
      </header>

      {/* Content */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "60px clamp(20px, 4vw, 32px) 60px",
        }}
      >
        <div style={{ width: "100%", maxWidth: 540 }}>

          {/* Step 1 */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div
                style={{
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 18,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
                    background: BRAND.ink,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle2 style={{ width: 28, height: 28, color: "#fff" }} />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: type.xs,
                      fontWeight: 600,
                      color: tone[500],
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      marginBottom: 8,
                    }}
                  >
                    Project created
                  </p>
                  <h1
                    style={{
                      fontSize: 30,
                      fontWeight: 600,
                      color: BRAND.ink,
                      letterSpacing: "-0.025em",
                      lineHeight: 1.15,
                      margin: 0,
                    }}
                  >
                    {project.name}
                  </h1>
                  <p
                    style={{
                      fontSize: type.md,
                      color: tone[500],
                      marginTop: 12,
                      maxWidth: 380,
                      lineHeight: 1.6,
                    }}
                  >
                    Let's connect it to your app so clients can edit safely — without touching your code.
                  </p>
                </div>
              </div>

              <Card>
                {[
                  { n: "1", text: "Build your app", sub: "In Replit, Next.js, or anywhere." },
                  { n: "2", text: "Connect it",      sub: "Add a key and a snippet — three minutes." },
                  { n: "3", text: "Invite clients",  sub: "They get a simple editor. You stay in control." },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "18px 22px",
                      borderTop: i > 0 ? `1px solid ${line.faint}` : "none",
                      display: "flex",
                      gap: 14,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: tone[100],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      <span style={{ fontSize: type.xs, fontWeight: 700, color: BRAND.ink }}>
                        {item.n}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink }}>
                        {item.text}
                      </p>
                      <p
                        style={{
                          fontSize: type.sm,
                          color: tone[500],
                          marginTop: 3,
                          lineHeight: 1.55,
                        }}
                      >
                        {item.sub}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>

              <PrimaryButton onClick={goNext} size="lg" block>
                Let's connect it <ArrowRight style={{ width: 16, height: 16 }} />
              </PrimaryButton>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <StepHeader
                step={2}
                title="What are you building?"
                intro="We'll tailor the next steps to your stack."
              />

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {APP_TYPES.map((t) => {
                  const Icon = t.icon;
                  const selected = state.appType === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setState((s) => ({ ...s, appType: t.id }))}
                      style={{
                        padding: "16px 18px",
                        borderRadius: 14,
                        border: `1px solid ${selected ? BRAND.ink : line.base}`,
                        background: selected ? tone[50] : BRAND.surface,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        textAlign: "left",
                        transition: `border-color 0.15s ${ease}, background 0.15s ${ease}`,
                        boxShadow: "0 1px 2px rgba(26,26,46,0.03)",
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 11,
                          background: tone[50],
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Icon style={{ width: 17, height: 17, color: BRAND.ink }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: type.md, fontWeight: 600, color: BRAND.ink }}>
                          {t.label}
                        </p>
                        <p style={{ fontSize: type.sm, color: tone[500], marginTop: 2 }}>
                          {t.desc}
                        </p>
                      </div>
                      {selected && (
                        <CheckCircle2 style={{ width: 18, height: 18, color: BRAND.ink, flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <PrimaryButton onClick={goNext} disabled={!state.appType} size="lg" block>
                Continue <ChevronRight style={{ width: 16, height: 16 }} />
              </PrimaryButton>
            </div>
          )}

          {/* Step 3 — Connect your app (combined: key + env + real fetch snippet) */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <StepHeader
                step={3}
                title="Connect your app"
                intro="We just made a project key for you. Add it to your environment, then read your live content with one fetch call."
              />

              {isGeneratingKey ? (
                <Card padded style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "28px 24px" }}>
                  <Loader2 style={{ width: 18, height: 18, color: tone[300], animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: type.base, color: tone[500] }}>Making your key…</span>
                </Card>
              ) : state.generatedKey ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                  <KeyReveal keyValue={state.generatedKey} />

                  <div>
                    <p
                      style={{
                        fontSize: type.xs,
                        fontWeight: 600,
                        color: tone[500],
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 10,
                      }}
                    >
                      1. Save it as an environment variable
                    </p>
                    <CodeBlock code={getEnvCode(state.generatedKey)} />
                    <p style={{ fontSize: type.sm, color: tone[500], marginTop: 8, lineHeight: 1.55 }}>
                      {getEnvHint(state.appType)}
                    </p>
                  </div>

                  <div>
                    <p
                      style={{
                        fontSize: type.xs,
                        fontWeight: 600,
                        color: tone[500],
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 10,
                      }}
                    >
                      2. Read your content from your code
                    </p>
                    <CodeBlock code={getReadCode(apiOrigin)} />
                    <p style={{ fontSize: type.sm, color: tone[500], marginTop: 8, lineHeight: 1.55 }}>
                      Drop this anywhere your app needs editable content. Works from any framework, any host — no library to install.
                    </p>
                  </div>
                </div>
              ) : (
                <Card padded style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                  <p style={{ fontSize: type.base, color: BRAND.ink, fontWeight: 600 }}>
                    Couldn't make your key
                  </p>
                  <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.55 }}>
                    {keyError ?? "Something went wrong. Try again."}
                  </p>
                  <PrimaryButton
                    onClick={generateKey}
                    disabled={isGeneratingKey}
                    loading={isGeneratingKey}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {isGeneratingKey ? "Trying again…" : "Try again"}
                  </PrimaryButton>
                </Card>
              )}

              <div
                style={{
                  background: "rgba(255,215,71,0.14)",
                  border: "1px solid rgba(255,215,71,0.55)",
                  borderRadius: 12,
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 7,
                    height: 7,
                    marginTop: 7,
                    borderRadius: "50%",
                    background: BRAND.yellow,
                    flexShrink: 0,
                  }}
                />
                <p style={{ fontSize: type.sm, color: BRAND.ink, lineHeight: 1.55 }}>
                  Keep this key on your server only — never paste it into frontend code that ships to browsers.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <SecondaryButton onClick={goBack} size="lg">Back</SecondaryButton>
                <PrimaryButton onClick={goNext} disabled={!state.keyGenerated} size="lg" block>
                  Done — continue <ChevronRight style={{ width: 16, height: 16 }} />
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* Step 4 — Domain (Optional) */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <StepHeader
                step={4}
                title="Where does your app live?"
                intro="Add your app's domain so the editor only loads there. Skip this if you're not sure yet — you can add it later."
                optional
              />

              <Card padded style={{ padding: 24 }}>
                <Field
                  label="Your app's domain"
                  hint={
                    state.appType === "replit"
                      ? "Find it in Replit — looks like my-app.replit.app"
                      : "Your production domain, e.g. mysite.com or app.mysite.com"
                  }
                >
                  <Input
                    value={hostname}
                    onChange={(e) => setHostname(e.target.value)}
                    placeholder={state.appType === "replit" ? "your-app.replit.app" : "yourapp.com"}
                    style={{ ...inputStyle, height: 48 }}
                  />
                </Field>
              </Card>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SecondaryButton onClick={goBack} size="lg">Back</SecondaryButton>
                <SecondaryButton onClick={goNext} size="lg">Skip for now</SecondaryButton>
                <PrimaryButton
                  onClick={handleAddDomain}
                  disabled={!hostname.trim() || addDomainMutation.isPending}
                  loading={addDomainMutation.isPending}
                  size="lg"
                  block
                >
                  {addDomainMutation.isPending ? "Saving…" : (
                    <>Add domain <ChevronRight style={{ width: 16, height: 16 }} /></>
                  )}
                </PrimaryButton>
              </div>
            </div>
          )}

          {/* Step 5 — Editable areas (Optional but recommended) */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <StepHeader
                step={5}
                title="What should clients edit?"
                intro="Each item becomes an editable area in your client's editor. You can add or change these any time."
                optional
              />

              {state.fields.length > 0 && (
                <Card>
                  {state.fields.map((f, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "14px 20px",
                        borderTop: i > 0 ? `1px solid ${line.faint}` : "none",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: BRAND.yellow, flexShrink: 0 }} />
                      <span style={{ fontSize: type.base, fontWeight: 600 }}>{f.label}</span>
                      <span style={{ fontSize: type.xs, color: tone[500], marginLeft: "auto" }}>
                        {FIELD_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                      </span>
                    </div>
                  ))}
                </Card>
              )}

              <Card padded style={{ padding: 22 }}>
                <p style={{ fontSize: type.base, fontWeight: 600, marginBottom: 16 }}>
                  {state.fields.length === 0 ? "Add your first area" : "Add another"}
                </p>

                <Field label="What is it?">
                  <Input
                    value={fieldLabel}
                    onChange={(e) => setFieldLabel(e.target.value)}
                    placeholder="e.g. Hero Headline, About Text, Logo"
                    style={{ ...inputStyle, height: 48 }}
                    onKeyDown={(e) => e.key === "Enter" && handleAddField()}
                  />
                </Field>

                <div style={{ marginTop: 16 }}>
                  <label style={labelStyle}>What kind of content?</label>
                  <div
                    style={{
                      marginTop: 8,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    {FIELD_TYPES.map((ft) => {
                      const selected = fieldType === ft.value;
                      return (
                        <button
                          key={ft.value}
                          onClick={() => setFieldType(ft.value)}
                          style={{
                            padding: "11px 13px",
                            borderRadius: 11,
                            textAlign: "left",
                            border: `1px solid ${selected ? BRAND.ink : line.base}`,
                            background: selected ? tone[50] : "transparent",
                            cursor: "pointer",
                            transition: `border-color 0.15s ${ease}, background 0.15s ${ease}`,
                          }}
                        >
                          <p style={{ fontSize: type.sm, fontWeight: 600, color: BRAND.ink }}>
                            {ft.label}
                          </p>
                          <p style={{ fontSize: type.xs, color: tone[500], marginTop: 2 }}>
                            {ft.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <GhostButton
                  onClick={handleAddField}
                  disabled={!fieldLabel.trim() || createFieldMutation.isPending}
                  size="lg"
                  block
                  style={{ marginTop: 18 }}
                >
                  {createFieldMutation.isPending
                    ? "Saving…"
                    : `+ Add "${fieldLabel || "this area"}"`}
                </GhostButton>
              </Card>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SecondaryButton onClick={goBack} size="lg">Back</SecondaryButton>
                {state.fields.length === 0 ? (
                  <PrimaryButton onClick={goNext} size="lg" block>
                    Skip for now <ChevronRight style={{ width: 16, height: 16 }} />
                  </PrimaryButton>
                ) : (
                  <PrimaryButton onClick={goNext} size="lg" block>
                    Continue with {state.fields.length} area{state.fields.length > 1 ? "s" : ""}
                    <ChevronRight style={{ width: 16, height: 16 }} />
                  </PrimaryButton>
                )}
              </div>
            </div>
          )}

          {/* Step 6 — Invite client (Optional) */}
          {step === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
              <StepHeader
                step={6}
                title="Who's editing this site?"
                intro="They'll get an email with a link to their private editor — no code in sight. You can invite people any time from the project page."
                optional
              />

              <Card padded style={{ padding: 24 }}>
                <Field label="Client's email">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    type="email"
                    disabled={!!inviteUrl}
                    style={{ ...inputStyle, height: 48 }}
                    onKeyDown={(e) => e.key === "Enter" && email && !inviteUrl && handleInvite()}
                  />
                </Field>

                {inviteUrl && (
                  <div
                    style={{
                      marginTop: 18,
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
                        fontWeight: 600,
                      }}
                    >
                      Share this private link with {email}
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
                          borderRadius: 6,
                          border: `1px solid ${line.base}`,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {inviteUrl}
                      </code>
                      <SecondaryButton size="sm" onClick={handleCopyInviteUrl}>
                        {linkCopied ? (
                          <><Check style={{ width: 13, height: 13 }} /> Copied</>
                        ) : (
                          <><Copy style={{ width: 13, height: 13 }} /> Copy</>
                        )}
                      </SecondaryButton>
                    </div>
                    <p style={{ fontSize: type.xs, color: tone[500], marginTop: 10, lineHeight: 1.5 }}>
                      The link expires in 7 days. Send it to your client however you like — email, Slack, Messages.
                    </p>
                  </div>
                )}
              </Card>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <SecondaryButton onClick={goBack} size="lg">Back</SecondaryButton>
                {inviteUrl ? (
                  <PrimaryButton onClick={goNext} size="lg" block>
                    Continue <ArrowRight style={{ width: 16, height: 16 }} />
                  </PrimaryButton>
                ) : (
                  <>
                    <SecondaryButton onClick={goNext} size="lg">Skip for now</SecondaryButton>
                    <PrimaryButton
                      onClick={handleInvite}
                      disabled={!email.trim() || createInviteMutation.isPending}
                      loading={createInviteMutation.isPending}
                      size="lg"
                      block
                    >
                      {createInviteMutation.isPending ? "Creating…" : (
                        <>Create invite link <ArrowRight style={{ width: 16, height: 16 }} /></>
                      )}
                    </PrimaryButton>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 7 — Done */}
          {step === 7 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28, textAlign: "center", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
                <IconTile icon={CheckCircle2} variant="ink" size={72} />
                <div>
                  <h1
                    style={{
                      fontSize: 30,
                      fontWeight: 600,
                      color: BRAND.ink,
                      letterSpacing: "-0.025em",
                      lineHeight: 1.15,
                      margin: 0,
                    }}
                  >
                    You're all set.
                  </h1>
                  <p
                    style={{
                      fontSize: type.md,
                      color: tone[500],
                      marginTop: 12,
                      maxWidth: 400,
                      lineHeight: 1.6,
                    }}
                  >
                    {project.name} is connected. Your clients can now edit safely.
                  </p>
                </div>
              </div>

              <Card style={{ width: "100%" }}>
                {[
                  { label: "Project key",    value: "Generated and ready",                                                done: state.keyGenerated },
                  { label: "Domain",         value: state.domainAdded ? hostname : "Not set — add later",                done: state.domainAdded },
                  { label: "Editable areas", value: state.fields.length > 0
                    ? `${state.fields.length} area${state.fields.length > 1 ? "s" : ""}`
                    : "Not set — add later", done: state.fields.length > 0 },
                  { label: "Client invite",  value: state.clientInvited ? email : "Not sent — add later",                done: state.clientInvited },
                ].map((item, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "14px 22px",
                      borderTop: i > 0 ? `1px solid ${line.faint}` : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span style={{ fontSize: type.sm, fontWeight: 500, color: tone[600] }}>
                      {item.label}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: type.sm,
                          fontWeight: 600,
                          color: item.done ? BRAND.ink : tone[400],
                        }}
                      >
                        {item.value}
                      </span>
                      {item.done && (
                        <CheckCircle2 style={{ width: 14, height: 14, color: BRAND.ink, flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                ))}
              </Card>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <PrimaryButton
                  onClick={() => setLocation(`/app/projects/${projectId}`)}
                  size="lg"
                  block
                >
                  Go to my project <ArrowRight style={{ width: 16, height: 16 }} />
                </PrimaryButton>
                <SecondaryButton
                  onClick={() => setLocation(`/app/editor/${projectId}`)}
                  size="lg"
                  block
                >
                  <Edit3 style={{ width: 16, height: 16 }} /> Try the editor yourself
                </SecondaryButton>
                <button
                  onClick={() => setLocation("/app/projects")}
                  style={{
                    height: 44,
                    border: "none",
                    background: "transparent",
                    fontSize: type.base,
                    color: tone[500],
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  Back to all projects
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

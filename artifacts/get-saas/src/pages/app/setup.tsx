import { useState, useEffect, useCallback } from "react";
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
  Zap, Globe, KeyRound, Users, Layers, Loader2, ArrowRight,
  Terminal, MonitorSmartphone, Box, ExternalLink
} from "lucide-react";

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

// ── Steps config ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;

const STEP_LABELS = [
  "Project ready",
  "App type",
  "Install",
  "Project key",
  "Your domain",
  "Editable areas",
  "Invite client",
  "Done",
];

// ── Styles ────────────────────────────────────────────────────────────────────

const T = {
  heading: { fontSize: 26, fontWeight: 700, color: "#1a1a2e", letterSpacing: "-0.02em", lineHeight: 1.25 } as React.CSSProperties,
  subheading: { fontSize: 15, color: "rgba(26,26,46,0.52)", lineHeight: 1.65, marginTop: 10 } as React.CSSProperties,
  label: { fontSize: 13, fontWeight: 600, color: "rgba(26,26,46,0.6)", textTransform: "uppercase" as const, letterSpacing: "0.06em" } as React.CSSProperties,
};

function PrimaryBtn({ children, onClick, disabled, fullWidth }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; fullWidth?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: fullWidth ? "100%" : undefined,
        height: 52, padding: "0 28px",
        borderRadius: 14, background: disabled ? "rgba(26,26,46,0.15)" : "#1a1a2e",
        color: "#fff", border: "none", fontSize: 15, fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "opacity 0.15s", letterSpacing: "-0.01em",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 52, padding: "0 24px", borderRadius: 14,
        background: "transparent", color: "rgba(26,26,46,0.45)",
        border: "1px solid rgba(26,26,46,0.12)", fontSize: 15, fontWeight: 500,
        cursor: "pointer", display: "flex", alignItems: "center", gap: 6, letterSpacing: "-0.01em",
      }}
    >
      {children}
    </button>
  );
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{ position: "relative", background: "#0f111a", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "18px 20px 18px 22px", fontSize: 13.5, fontFamily: "monospace", color: "#e8eaf6", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {code}
      </div>
      <button
        onClick={handleCopy}
        style={{
          position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: 8,
          background: copied ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          color: copied ? "#10b981" : "rgba(255,255,255,0.5)", transition: "all 0.2s",
        }}
        title="Copy"
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
    <div style={{ background: "#f0fdf4", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid rgba(16,185,129,0.12)" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#059669" }}>Your project key — copy it now. It won't be shown again.</span>
      </div>
      <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <code style={{ flex: 1, fontSize: 13, fontFamily: "monospace", color: "#1a1a2e", wordBreak: "break-all", lineHeight: 1.6 }}>
          {keyValue}
        </code>
        <button
          onClick={handleCopy}
          style={{
            flexShrink: 0, height: 38, padding: "0 16px", borderRadius: 10,
            background: copied ? "#10b981" : "#1a1a2e", color: "#fff",
            border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6, transition: "background 0.2s",
          }}
        >
          {copied ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ── Field types ───────────────────────────────────────────────────────────────

const FIELD_TYPES = [
  { value: "text", label: "Short text", desc: "A headline, name, or label" },
  { value: "richtext", label: "Long text", desc: "Paragraphs, descriptions, bios" },
  { value: "image", label: "Image", desc: "A photo, logo, or illustration" },
  { value: "url", label: "Link", desc: "A button URL or external link" },
  { value: "number", label: "Number", desc: "A price, count, or stat" },
];

// ── App type cards ────────────────────────────────────────────────────────────

const APP_TYPES: { id: AppType; icon: React.ElementType; label: string; desc: string }[] = [
  { id: "replit", icon: Zap, label: "Replit app", desc: "Built and running on Replit" },
  { id: "nextjs", icon: MonitorSmartphone, label: "Next.js / Remix", desc: "Deployed to Vercel, Netlify, or similar" },
  { id: "other", icon: Box, label: "Something else", desc: "Any other framework or host" },
];

function getInstallCode(appType: AppType | null) {
  return `npm install @getapp/sdk`;
}

function getEnvCode(key: string) {
  return `GET_PROJECT_KEY=${key}`;
}

function getInitCode(appType: AppType | null) {
  if (appType === "nextjs") {
    return `// app/layout.tsx (or _app.tsx)\nimport { GetProvider } from "@getapp/sdk/react";\n\nexport default function RootLayout({ children }) {\n  return (\n    <GetProvider projectKey={process.env.GET_PROJECT_KEY}>\n      {children}\n    </GetProvider>\n  );\n}`;
  }
  return `// index.js or main entry file\nimport { init } from "@getapp/sdk";\n\ninit({\n  projectKey: process.env.GET_PROJECT_KEY,\n});`;
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export default function SetupWizard() {
  const { projectId } = useParams<{ projectId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
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

  // Step-local state
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldAdded, setFieldAdded] = useState(false);
  const [email, setEmail] = useState("");
  const [hostname, setHostname] = useState("");
  const [isGeneratingKey, setIsGeneratingKey] = useState(false);

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  const goBack = () => { if (step > 1) setStep(s => s - 1); };
  const goNext = () => setStep(s => Math.min(s + 1, TOTAL_STEPS));

  // Auto-generate key when arriving at step 4
  useEffect(() => {
    if (step === 4 && !state.keyGenerated && !isGeneratingKey) {
      setIsGeneratingKey(true);
      apiFetch(`/api/projects/${projectId}/keys`, {
        method: "POST",
        body: JSON.stringify({ name: "Production" }),
      })
        .then((result: any) => {
          setState(s => ({ ...s, generatedKey: result.rawKey, keyGenerated: true }));
        })
        .catch((e: any) => {
          toast({ variant: "destructive", title: "Couldn't generate key", description: e.message });
        })
        .finally(() => setIsGeneratingKey(false));
    }
  }, [step]);

  const handleAddField = () => {
    if (!fieldLabel.trim()) return;
    createFieldMutation.mutate({ projectId, data: { label: fieldLabel.trim(), type: fieldType } }, {
      onSuccess: () => {
        setState(s => ({ ...s, fields: [...s.fields, { label: fieldLabel.trim(), type: fieldType }] }));
        setFieldAdded(true);
        setFieldLabel("");
        setFieldType("text");
        toast({ title: `"${fieldLabel.trim()}" added` });
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  const handleAddDomain = () => {
    if (!hostname.trim()) { goNext(); return; }
    addDomainMutation.mutate({ projectId, data: { hostname: hostname.trim() } }, {
      onSuccess: () => {
        setState(s => ({ ...s, domainAdded: true }));
        goNext();
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  const handleInvite = () => {
    if (!email.trim()) { goNext(); return; }
    createInviteMutation.mutate({ projectId, data: { email: email.trim(), role: "editor" } }, {
      onSuccess: () => {
        setState(s => ({ ...s, clientInvited: true }));
        goNext();
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  if (isLoading || !project) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#faf9f6" }}>
        <Loader2 style={{ width: 24, height: 24, color: "rgba(26,26,46,0.3)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#faf9f6", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}>
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(0,0,0,0.06)" }}>
          <div style={{ height: "100%", background: "#1a1a2e", width: `${progress}%`, transition: "width 0.5s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>

        {/* Nav row */}
        <div style={{ background: "rgba(250,249,246,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(0,0,0,0.05)", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <button
            onClick={goBack}
            style={{ width: 36, height: 36, borderRadius: 10, border: "none", background: step > 1 ? "rgba(0,0,0,0.05)" : "transparent", cursor: step > 1 ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", color: step > 1 ? "#1a1a2e" : "transparent", transition: "all 0.2s" }}
          >
            <ChevronLeft style={{ width: 16, height: 16 }} />
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: "rgba(26,26,46,0.4)" }}>
              Step {step} of {TOTAL_STEPS}
            </span>
            <div style={{ display: "flex", gap: 5 }}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: i + 1 === step ? 20 : 6, height: 6, borderRadius: 3,
                    background: i + 1 < step ? "#1a1a2e" : i + 1 === step ? "#1a1a2e" : "rgba(0,0,0,0.12)",
                    transition: "all 0.3s ease",
                  }}
                />
              ))}
            </div>
          </div>

          <Link href="/app/projects" style={{ fontSize: 13, color: "rgba(26,26,46,0.4)", textDecoration: "none", fontWeight: 500 }}>
            Exit
          </Link>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "100px 24px 60px" }}>
        <div style={{ width: "100%", maxWidth: 520 }}>

          {/* ── Step 1: Project Created ─────────────────────────────────────── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "#1a1a2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 style={{ width: 32, height: 32, color: "#fff" }} />
                </div>
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 600, color: "rgba(26,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Project created</p>
                  <h1 style={{ ...T.heading, fontSize: 30, textAlign: "center" }}>{project.name}</h1>
                  <p style={{ ...T.subheading, textAlign: "center", marginTop: 12, maxWidth: 380 }}>
                    Your project is ready. Now let's connect it to your app so your clients can edit safely — without touching your code.
                  </p>
                </div>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                {[
                  { icon: "1", text: "Build your app first", sub: "Finish building in Replit, Next.js, or whatever you use." },
                  { icon: "2", text: "Connect get second", sub: "We'll give you a key and a snippet. Takes about 3 minutes." },
                  { icon: "3", text: "Let clients edit safely — third", sub: "Your clients get a simple editor. Your code stays untouched." },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "20px 24px", borderTop: i > 0 ? "1px solid rgba(0,0,0,0.05)" : "none", display: "flex", gap: 16, alignItems: "flex-start" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(26,26,46,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e" }}>{item.icon}</span>
                    </div>
                    <div>
                      <p style={{ fontSize: 14.5, fontWeight: 600, color: "#1a1a2e" }}>{item.text}</p>
                      <p style={{ fontSize: 13.5, color: "rgba(26,26,46,0.5)", marginTop: 3, lineHeight: 1.55 }}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <PrimaryBtn onClick={goNext} fullWidth>
                Let's connect it <ArrowRight style={{ width: 16, height: 16 }} />
              </PrimaryBtn>
            </div>
          )}

          {/* ── Step 2: Choose App Type ─────────────────────────────────────── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <p style={T.label}>Step 2</p>
                <h1 style={{ ...T.heading, marginTop: 8 }}>What are you building?</h1>
                <p style={T.subheading}>We'll tailor the setup instructions so you can skip anything that doesn't apply to you.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {APP_TYPES.map((type) => {
                  const Icon = type.icon;
                  const selected = state.appType === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setState(s => ({ ...s, appType: type.id }))}
                      style={{
                        padding: "20px 22px", borderRadius: 16,
                        border: selected ? "2px solid #1a1a2e" : "2px solid rgba(0,0,0,0.07)",
                        background: selected ? "#1a1a2e" : "#fff",
                        cursor: "pointer", display: "flex", alignItems: "center", gap: 18,
                        textAlign: "left", transition: "all 0.15s",
                      }}
                    >
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: selected ? "rgba(255,255,255,0.1)" : "rgba(26,26,46,0.06)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon style={{ width: 20, height: 20, color: selected ? "#fff" : "#1a1a2e" }} />
                      </div>
                      <div>
                        <p style={{ fontSize: 15.5, fontWeight: 600, color: selected ? "#fff" : "#1a1a2e" }}>{type.label}</p>
                        <p style={{ fontSize: 13.5, color: selected ? "rgba(255,255,255,0.6)" : "rgba(26,26,46,0.5)", marginTop: 2 }}>{type.desc}</p>
                      </div>
                      {selected && <CheckCircle2 style={{ width: 18, height: 18, color: "#fff", marginLeft: "auto", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              <PrimaryBtn onClick={goNext} disabled={!state.appType} fullWidth>
                Continue <ChevronRight style={{ width: 16, height: 16 }} />
              </PrimaryBtn>
            </div>
          )}

          {/* ── Step 3: Install SDK ─────────────────────────────────────────── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <p style={T.label}>Step 3</p>
                <h1 style={{ ...T.heading, marginTop: 8 }}>Install get</h1>
                <p style={T.subheading}>
                  Open your terminal in {state.appType === "replit" ? "Replit" : "your project"} and run this command. It only takes a second.
                </p>
              </div>

              <div>
                <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(26,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                  Terminal
                </p>
                <CodeBlock code={getInstallCode(state.appType)} />
              </div>

              {state.appType === "replit" && (
                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,0.07)", padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Terminal style={{ width: 16, height: 16, color: "rgba(26,26,46,0.35)", marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a2e", marginBottom: 3 }}>In Replit</p>
                    <p style={{ fontSize: 13, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>
                      Open the Shell tab at the bottom of your workspace, paste the command, and hit Enter.
                    </p>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <SecondaryBtn onClick={goBack}>Back</SecondaryBtn>
                <PrimaryBtn onClick={goNext} fullWidth>
                  Installed — continue <ChevronRight style={{ width: 16, height: 16 }} />
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 4: Add Project Key ─────────────────────────────────────── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <p style={T.label}>Step 4</p>
                <h1 style={{ ...T.heading, marginTop: 8 }}>Connect your app</h1>
                <p style={T.subheading}>
                  This key tells get which project your app belongs to. Add it to your environment variables and your app is connected.
                </p>
              </div>

              {isGeneratingKey ? (
                <div style={{ padding: "32px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
                  <Loader2 style={{ width: 18, height: 18, color: "rgba(26,26,46,0.3)", animation: "spin 1s linear infinite" }} />
                  <span style={{ fontSize: 14, color: "rgba(26,26,46,0.4)" }}>Generating your key…</span>
                </div>
              ) : state.generatedKey ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <KeyReveal keyValue={state.generatedKey} />

                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(26,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Add to your .env file
                    </p>
                    <CodeBlock code={getEnvCode(state.generatedKey)} />
                  </div>

                  <div>
                    <p style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(26,26,46,0.4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Initialize in your code
                    </p>
                    <CodeBlock code={getInitCode(state.appType)} language="js" />
                  </div>
                </div>
              ) : (
                <div style={{ padding: "32px 24px", display: "flex", alignItems: "center", justifyContent: "center", gap: 12, background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)" }}>
                  <span style={{ fontSize: 14, color: "rgba(26,26,46,0.4)" }}>Something went wrong generating your key.</span>
                </div>
              )}

              <div style={{ background: "rgba(255,215,71,0.12)", border: "1px solid rgba(255,215,71,0.35)", borderRadius: 12, padding: "14px 18px" }}>
                <p style={{ fontSize: 13, color: "#92700a", lineHeight: 1.6 }}>
                  <strong>Never put this key in your frontend code.</strong> Keep it in your server environment variables only. It controls who can write to your project.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <SecondaryBtn onClick={goBack}>Back</SecondaryBtn>
                <PrimaryBtn onClick={goNext} disabled={!state.keyGenerated} fullWidth>
                  Added it — continue <ChevronRight style={{ width: 16, height: 16 }} />
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 5: Add Allowed Domain ──────────────────────────────────── */}
          {step === 5 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <p style={T.label}>Step 5</p>
                <h1 style={{ ...T.heading, marginTop: 8 }}>Where does your app live?</h1>
                <p style={T.subheading}>
                  Add your app's domain so the editor only works where you expect. This stops anyone else from using your key.
                </p>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.07)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a2e", display: "block", marginBottom: 10 }}>
                    Your app's domain
                  </label>
                  <Input
                    value={hostname}
                    onChange={e => setHostname(e.target.value)}
                    placeholder={state.appType === "replit" ? "your-app.replit.app" : "yourapp.com"}
                    style={{ height: 48, borderRadius: 12, fontSize: 14.5, border: "1px solid rgba(0,0,0,0.12)" }}
                  />
                  <p style={{ fontSize: 12.5, color: "rgba(26,26,46,0.4)", marginTop: 8, lineHeight: 1.6 }}>
                    {state.appType === "replit"
                      ? "Find this in Replit by clicking Open \u2014 it looks like my-app.replit.app"
                      : "Use your production domain, e.g. mysite.com or app.mysite.com"}
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <SecondaryBtn onClick={goBack}>Back</SecondaryBtn>
                <SecondaryBtn onClick={goNext}>Skip for now</SecondaryBtn>
                <PrimaryBtn onClick={handleAddDomain} disabled={!hostname.trim() || addDomainMutation.isPending} fullWidth>
                  {addDomainMutation.isPending ? "Saving…" : <>Add domain <ChevronRight style={{ width: 16, height: 16 }} /></>}
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 6: Review Editable Areas ──────────────────────────────── */}
          {step === 6 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <p style={T.label}>Step 6</p>
                <h1 style={{ ...T.heading, marginTop: 8 }}>What should clients be able to change?</h1>
                <p style={T.subheading}>
                  Each item you add here becomes an editable area in your client's editor. Think: headlines, images, button text.
                </p>
              </div>

              {/* Already added fields */}
              {state.fields.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  {state.fields.map((f, i) => (
                    <div key={i} style={{ padding: "14px 20px", borderTop: i > 0 ? "1px solid rgba(0,0,0,0.05)" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1a1a2e" }}>{f.label}</span>
                      <span style={{ fontSize: 12.5, color: "rgba(26,26,46,0.4)", marginLeft: "auto" }}>
                        {FIELD_TYPES.find(t => t.value === f.type)?.label ?? f.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Add a field */}
              <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.07)", padding: "24px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
                  {state.fields.length === 0 ? "Add your first editable area" : "Add another"}
                </p>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(26,26,46,0.55)", display: "block", marginBottom: 8 }}>
                    What is this? (e.g. Hero Headline)
                  </label>
                  <Input
                    value={fieldLabel}
                    onChange={e => setFieldLabel(e.target.value)}
                    placeholder="e.g. Hero Headline, About Text, Logo Image"
                    style={{ height: 46, borderRadius: 11, fontSize: 14 }}
                    onKeyDown={e => e.key === "Enter" && handleAddField()}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: "rgba(26,26,46,0.55)", display: "block", marginBottom: 10 }}>
                    What kind of content?
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {FIELD_TYPES.map(ft => (
                      <button
                        key={ft.value}
                        onClick={() => setFieldType(ft.value)}
                        style={{
                          padding: "12px 14px", borderRadius: 11, textAlign: "left",
                          border: fieldType === ft.value ? "2px solid #1a1a2e" : "2px solid rgba(0,0,0,0.07)",
                          background: fieldType === ft.value ? "#1a1a2e" : "transparent",
                          cursor: "pointer", transition: "all 0.15s",
                        }}
                      >
                        <p style={{ fontSize: 13.5, fontWeight: 600, color: fieldType === ft.value ? "#fff" : "#1a1a2e" }}>{ft.label}</p>
                        <p style={{ fontSize: 12, color: fieldType === ft.value ? "rgba(255,255,255,0.55)" : "rgba(26,26,46,0.4)", marginTop: 2 }}>{ft.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleAddField}
                  disabled={!fieldLabel.trim() || createFieldMutation.isPending}
                  style={{
                    height: 46, borderRadius: 11, background: "rgba(26,26,46,0.06)", color: "#1a1a2e",
                    border: "none", fontSize: 14, fontWeight: 600, cursor: fieldLabel.trim() ? "pointer" : "not-allowed",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    opacity: fieldLabel.trim() ? 1 : 0.5,
                  }}
                >
                  {createFieldMutation.isPending ? "Saving…" : `+ Add "${fieldLabel || "this area"}"`}
                </button>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <SecondaryBtn onClick={goBack}>Back</SecondaryBtn>
                {state.fields.length === 0
                  ? <SecondaryBtn onClick={goNext}>Skip for now</SecondaryBtn>
                  : null
                }
                <PrimaryBtn onClick={goNext} disabled={state.fields.length === 0} fullWidth>
                  {state.fields.length === 0 ? "Skip →" : `Continue with ${state.fields.length} area${state.fields.length > 1 ? "s" : ""} →`}
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 7: Invite Client ───────────────────────────────────────── */}
          {step === 7 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <div>
                <p style={T.label}>Step 7</p>
                <h1 style={{ ...T.heading, marginTop: 8 }}>Who's editing this site?</h1>
                <p style={T.subheading}>
                  We'll send them an email with a link to their private, simple editor. They won't see any code — just the areas you set up.
                </p>
              </div>

              <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.07)", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a2e", display: "block", marginBottom: 10 }}>
                    Client's email address
                  </label>
                  <Input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="client@example.com"
                    type="email"
                    style={{ height: 48, borderRadius: 12, fontSize: 14.5, border: "1px solid rgba(0,0,0,0.12)" }}
                    onKeyDown={e => e.key === "Enter" && email && handleInvite()}
                  />
                </div>

                <div style={{ background: "rgba(0,0,0,0.02)", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <Users style={{ width: 15, height: 15, color: "rgba(26,26,46,0.35)", marginTop: 2, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>
                    They'll get access to an editor page — just the content areas, nothing else. You stay in control of what they can change.
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <SecondaryBtn onClick={goBack}>Back</SecondaryBtn>
                <SecondaryBtn onClick={goNext}>Skip for now</SecondaryBtn>
                <PrimaryBtn onClick={handleInvite} disabled={!email.trim() || createInviteMutation.isPending} fullWidth>
                  {createInviteMutation.isPending ? "Sending invite…" : <>Send invite <ArrowRight style={{ width: 16, height: 16 }} /></>}
                </PrimaryBtn>
              </div>
            </div>
          )}

          {/* ── Step 8: Done ────────────────────────────────────────────────── */}
          {step === 8 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 32, textAlign: "center", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
                <div style={{ width: 80, height: 80, borderRadius: 22, background: "linear-gradient(135deg, #1a1a2e, #2d2d5a)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 32px rgba(26,26,46,0.18)" }}>
                  <CheckCircle2 style={{ width: 36, height: 36, color: "#fff" }} />
                </div>
                <div>
                  <h1 style={{ ...T.heading, fontSize: 30, textAlign: "center" }}>You're all set.</h1>
                  <p style={{ ...T.subheading, textAlign: "center", marginTop: 12, maxWidth: 400 }}>
                    {project.name} is connected and ready. Your clients can now edit their content — without breaking a single line of your code.
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div style={{ background: "#fff", borderRadius: 18, border: "1px solid rgba(0,0,0,0.07)", overflow: "hidden", width: "100%" }}>
                {[
                  { label: "Project key", value: "Generated and ready", done: state.keyGenerated },
                  { label: "Domain", value: state.domainAdded ? hostname : "Not set — add later", done: state.domainAdded },
                  { label: "Editable areas", value: state.fields.length > 0 ? `${state.fields.length} area${state.fields.length > 1 ? "s" : ""} configured` : "Not set — add later", done: state.fields.length > 0 },
                  { label: "Client invite", value: state.clientInvited ? email : "Not sent — add later", done: state.clientInvited },
                ].map((item, i) => (
                  <div key={i} style={{ padding: "16px 22px", borderTop: i > 0 ? "1px solid rgba(0,0,0,0.05)" : "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: "rgba(26,26,46,0.5)" }}>{item.label}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: item.done ? "#1a1a2e" : "rgba(26,26,46,0.3)" }}>{item.value}</span>
                      {item.done && <CheckCircle2 style={{ width: 14, height: 14, color: "#10b981", flexShrink: 0 }} />}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <PrimaryBtn onClick={() => setLocation(`/app/projects/${projectId}`)} fullWidth>
                  Go to my project <ArrowRight style={{ width: 16, height: 16 }} />
                </PrimaryBtn>
                <button
                  onClick={() => setLocation("/app/projects")}
                  style={{ height: 48, border: "none", background: "transparent", fontSize: 14, color: "rgba(26,26,46,0.4)", cursor: "pointer", fontWeight: 500 }}
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

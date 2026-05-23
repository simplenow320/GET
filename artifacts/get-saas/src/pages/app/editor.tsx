import { useState, useEffect, useRef, useMemo } from "react";
import { useParams } from "wouter";
import {
  useListContentFields,
  useUpdateContentField,
  useCreateContentField,
  useGetProject,
  getGetProjectQueryKey,
  getListContentFieldsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import {
  Loader2, Save, FileEdit, Lock, Check, RefreshCw, Undo2, AlertTriangle, X,
  HelpCircle, ArrowRight, ExternalLink, MousePointerClick,
} from "lucide-react";
import {
  BRAND, tone, line, type, ease, r,
  EmptyState,
} from "@/lib/ui";

const SKIP_WARN_KEY = "get_skip_save_warning";

// Per-field local autosave format. We snapshot the server's updatedAt so we
// can detect "the server version moved on while I was typing" later. Older
// drafts (plain string) are still readable — see parseDraft.
//
// We tag v2 payloads with an explicit `_v: 2` marker so we never mistake a
// user's literal-JSON-looking text (e.g. they typed `{"value":"abc"}` into a
// rich-text field) for a structured draft. Without the marker we treat the
// raw localStorage string as plain text.
type StoredDraft = { value: string; capturedServerUpdatedAt: string | null };

const DRAFT_VERSION = 2;

function serializeDraft(d: StoredDraft): string {
  return JSON.stringify({ _v: DRAFT_VERSION, ...d });
}

function parseDraft(raw: string | null): StoredDraft | null {
  if (raw == null) return null;
  // Only attempt structured parsing if the stored blob is plausibly v2 JSON.
  // This avoids misinterpreting a user's literal `{...}` text as a draft envelope.
  if (raw.startsWith("{") && raw.includes('"_v"')) {
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed === "object" &&
        parsed._v === DRAFT_VERSION &&
        typeof parsed.value === "string"
      ) {
        return {
          value: parsed.value,
          capturedServerUpdatedAt:
            typeof parsed.capturedServerUpdatedAt === "string"
              ? parsed.capturedServerUpdatedAt
              : null,
        };
      }
    } catch {
      // Fall through to plain-string handling.
    }
  }
  // Pre-v2 format (or anything we couldn't decode): treat as plain text.
  return { value: raw, capturedServerUpdatedAt: null };
}

// ---------------------------------------------------------------------------
// Client-side rich-text sanitizer
// Mirrors the server allowlist in artifacts/api-server/src/lib/sanitize.ts
// (sanitizeRichContent). Used only for rendering local draft previews —
// the server still re-sanitizes on save.
// ---------------------------------------------------------------------------
const RICH_ALLOWED_TAGS = new Set(["B","STRONG","I","EM","UL","OL","LI","A","BR","P"]);
// Tags whose contents should be removed entirely (not unwrapped) to mirror
// the server sanitizer's `stripIgnoreTagBody: ["script", "style"]` option.
const RICH_DROP_WITH_BODY = new Set(["SCRIPT","STYLE"]);
function sanitizeRichClient(input: string): string {
  if (!input) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";
  const doc = new DOMParser().parseFromString(`<div id="__r">${input}</div>`, "text/html");
  const root = doc.getElementById("__r");
  if (!root) return "";
  const walk = (node: Element) => {
    // Iterate over a snapshot since we may mutate the live list.
    const children = Array.from(node.children);
    for (const child of children) {
      if (RICH_DROP_WITH_BODY.has(child.tagName)) {
        // Drop the element AND its contents.
        child.parentNode?.removeChild(child);
        continue;
      }
      if (!RICH_ALLOWED_TAGS.has(child.tagName)) {
        // Unwrap: replace with its sanitized children.
        walk(child);
        const parent = child.parentNode;
        if (parent) {
          while (child.firstChild) parent.insertBefore(child.firstChild, child);
          parent.removeChild(child);
        }
        continue;
      }
      // Strip all attributes except a[href] with safe protocol.
      for (const attr of Array.from(child.attributes)) {
        if (child.tagName === "A" && attr.name === "href") {
          const v = attr.value.trim().toLowerCase();
          if (v.startsWith("javascript:") || v.startsWith("vbscript:") || v.startsWith("data:")) {
            child.removeAttribute(attr.name);
          }
          continue;
        }
        child.removeAttribute(attr.name);
      }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}

// ---------------------------------------------------------------------------
// Save-confirmation dialog
// ---------------------------------------------------------------------------
function SaveWarningDialog({
  fieldLabel,
  fieldType,
  value,
  onConfirm,
  onCancel,
}: {
  fieldLabel: string;
  fieldType: string;
  value: string;
  onConfirm: (skipNext: boolean) => void;
  onCancel: () => void;
}) {
  const [skipNext, setSkipNext] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(26,26,46,0.38)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: BRAND.paper,
          borderRadius: 18,
          padding: 28,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 24px 60px rgba(26,26,46,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: "rgba(255,215,71,0.18)",
                border: "1px solid rgba(255,215,71,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <AlertTriangle style={{ width: 17, height: 17, color: "#b45309" }} />
            </div>
            <div>
              <p style={{ fontSize: type.md, fontWeight: 700, color: BRAND.ink, lineHeight: 1.3 }}>
                Publish this change?
              </p>
              <p style={{ fontSize: type.sm, color: tone[500], marginTop: 3, lineHeight: 1.4 }}>
                {fieldLabel}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: tone[400],
              padding: 2,
              borderRadius: 6,
              flexShrink: 0,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {/* Body */}
        <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.65 }}>
          Saving this will make it visible to everyone visiting the site — usually within a few minutes. Make sure you're happy with it before continuing.
        </p>

        {/* Formatted preview — only for richtext fields, so the user can
            verify their formatting before publishing. */}
        {fieldType === "richtext" && value && (
          <div
            style={{
              border: `1px solid ${line.base}`,
              background: tone[50],
              borderRadius: 10,
              padding: "10px 12px",
              maxHeight: 180,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: tone[500], textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>
              Preview
            </div>
            <div
              style={{ fontSize: type.sm, color: BRAND.ink, lineHeight: 1.55 }}
              dangerouslySetInnerHTML={{ __html: sanitizeRichClient(value) }}
            />
          </div>
        )}

        {/* Don't show again */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <div
            onClick={() => setSkipNext((v) => !v)}
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              border: `2px solid ${skipNext ? BRAND.ink : line.base}`,
              background: skipNext ? BRAND.ink : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
              transition: `background 0.14s ${ease}, border-color 0.14s ${ease}`,
            }}
          >
            {skipNext && <Check style={{ width: 11, height: 11, color: BRAND.paper }} />}
          </div>
          <span style={{ fontSize: type.sm, color: tone[600] }}>
            Don't ask me again
          </span>
        </label>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 10,
              border: `1px solid ${line.base}`,
              background: "transparent",
              cursor: "pointer",
              fontSize: type.sm,
              fontWeight: 600,
              color: BRAND.ink,
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(skipNext)}
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 10,
              border: "none",
              background: BRAND.ink,
              cursor: "pointer",
              fontSize: type.sm,
              fontWeight: 600,
              color: BRAND.paper,
            }}
          >
            Yes, save it
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

// Brand rule: this is inside the authenticated product UI — do NOT render
// any get branding (logo, mascot, wordmark) on this surface.

export default function ClientEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: fields, isLoading, refetch } = useListContentFields(projectId);
  const { data: project } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) },
  });
  const updateMutation = useUpdateContentField();
  const { toast } = useToast();

  const myRole = (project?.myRole ?? "editor") as "owner" | "admin" | "editor" | "viewer";
  const isManager = myRole === "owner" || myRole === "admin";
  // Owners/admins always auto-publish; for editor-role clients we honor the
  // project's autoPublish flag (default true) so the vibe coder can choose.
  const projectAutoPublish: boolean = (project as any)?.autoPublish ?? true;
  const editsGoLiveImmediately = isManager || projectAutoPublish;

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [justRefreshed, setJustRefreshed] = useState(false);

  // Set of fieldIds where the server-side value moved on after we captured a
  // local draft AND the two values disagree. Drives the per-field "Server
  // changed since you started editing" banner with Keep mine / Use server.
  const [conflictFields, setConflictFields] = useState<Set<string>>(new Set());

  // Warning dialog state
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [skipWarning, setSkipWarning] = useState(
    () => localStorage.getItem(SKIP_WARN_KEY) === "true",
  );

  // ── Install check ──────────────────────────────────────────────────────
  // Background "is this actually wired up on the live site?" check.
  // Runs once on mount and on demand. Drives the per-field health dot and
  // the honest header badge ("Live on site" vs "Saved — not visible yet").
  // Failures are silent — the editor must keep working even if the user's
  // site is offline or the install-check endpoint 500s.
  type InstallCheck = {
    siteUrl: string | null;
    fetched: boolean;
    scannerFound: boolean;
    scannerKeyMatches: boolean;
    tagsFound: string[];
    fieldStatuses: Array<{ label: string; status: "wired" | "missing" }>;
  };
  const [installCheck, setInstallCheck] = useState<InstallCheck | null>(null);
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    fetch(`/api/projects/${projectId}/install-check`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setInstallCheck(data as InstallCheck);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  // Resolve a single field's wiring status by label. Returns a small
  // descriptor used for both the dot color and tooltip text.
  function statusForField(label: string): {
    color: string;
    tip: string;
    tone: "ok" | "warn" | "bad" | "unknown";
  } {
    if (!installCheck || !installCheck.fetched) {
      return { color: tone[300], tip: "Checking your site…", tone: "unknown" };
    }
    if (!installCheck.scannerFound) {
      return {
        color: "#ef4444",
        tip: "Scanner script not installed on your site — saves won't show.",
        tone: "bad",
      };
    }
    if (!installCheck.scannerKeyMatches) {
      return {
        color: "#ef4444",
        tip: "Scanner is installed but the key doesn't match this project — saves won't show.",
        tone: "bad",
      };
    }
    const fs = installCheck.fieldStatuses.find((f) => f.label === label);
    if (fs && fs.status === "wired") {
      return { color: "#22c55e", tip: "Wired up — changes will show on your site.", tone: "ok" };
    }
    return {
      color: "#f59e0b",
      tip:
        "This field isn't tagged on your site yet. Add data-get-key=\"" +
        label +
        "\" to the element you want to update.",
      tone: "warn",
    };
  }

  // Live preview iframe
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [windowWidth, setWindowWidth] = useState(
    () => typeof window !== "undefined" ? window.innerWidth : 1200,
  );
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Manual URL fallback: when the developer hasn't installed scanner.js yet,
  // lastSeenOrigin is null and there's nothing to preview against. We let the
  // user type a URL in the empty state and remember it per-project in
  // localStorage so refreshing the editor doesn't lose it. Once scanner.js
  // pings the server, lastSeenOrigin takes precedence automatically.
  const MANUAL_URL_KEY = `get:editor-manual-url:${projectId}`;
  const [manualUrl, setManualUrl] = useState<string>(() => {
    try { return localStorage.getItem(MANUAL_URL_KEY) || ""; } catch { return ""; }
  });
  const [manualUrlInput, setManualUrlInput] = useState<string>("");
  const [manualUrlError, setManualUrlError] = useState<string>("");

  // Re-hydrate manualUrl whenever the route's project changes. wouter swaps
  // params without unmounting the editor, so without this the previous
  // project's URL would leak into the next one and show the wrong iframe.
  useEffect(() => {
    let next = "";
    try { next = localStorage.getItem(MANUAL_URL_KEY) || ""; } catch {}
    setManualUrl(next);
    setManualUrlInput("");
    setManualUrlError("");
  }, [MANUAL_URL_KEY]);

  function commitManualUrl(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) { setManualUrlError("Enter a URL"); return; }
    // Allow bare hostnames by prepending https:// — most users will paste
    // "example.com" rather than the full scheme.
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    let parsed: URL;
    try { parsed = new URL(candidate); }
    catch { setManualUrlError("That doesn't look like a valid URL"); return; }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      setManualUrlError("URL must start with http:// or https://"); return;
    }
    const clean = parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname) + parsed.search;
    try { localStorage.setItem(MANUAL_URL_KEY, clean); } catch {}
    setManualUrl(clean);
    setManualUrlError("");
  }

  const siteUrl: string | null = project?.lastSeenOrigin ?? (manualUrl || null);
  const showPreviewPanel = windowWidth >= 900;

  // "loading" while the iframe is fetching; "loaded" on success;
  // "blocked" when X-Frame-Options or a network error prevents rendering.
  const [iframeStatus, setIframeStatus] = useState<"loading" | "loaded" | "blocked">("loading");

  // Reset status whenever the URL changes.
  useEffect(() => {
    if (siteUrl) setIframeStatus("loading");
  }, [siteUrl]);

  // When entering desktop mode, ensure iframe gets a fresh load attempt.
  useEffect(() => {
    if (showPreviewPanel && siteUrl) setIframeStatus("loading");
  }, [showPreviewPanel]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timeout: if onLoad hasn't fired within 10 s, assume blocked.
  // Only active when the preview panel is actually rendered.
  useEffect(() => {
    if (!siteUrl || !showPreviewPanel || iframeStatus !== "loading") return;
    const t = setTimeout(() => setIframeStatus("blocked"), 10_000);
    return () => clearTimeout(t);
  }, [siteUrl, showPreviewPanel, iframeStatus]);

  // ── Editor ↔ scanner postMessage bridge (audit High #3) ────────────────────
  //
  // The preview iframe runs the customer's site, which loads our scanner.js.
  // Scanner emits get:field-click / -input / -save up to this editor; editor
  // emits get:highlight down. Without origin checking AND a shared secret,
  // a malicious page that happens to be open in another window could spoof
  // either side and either steal field state or trigger writes.
  //
  // Defenses:
  //   1. expectedIframeOrigin — derived from siteUrl, used as targetOrigin
  //      for every outbound postMessage and validated on every inbound one.
  //   2. bridgeNonce — fresh per editor mount, sent to the scanner once via
  //      the get:bridge-init handshake and required on every inbound
  //      get:field-* message. The scanner only ever learns it after we
  //      explicitly send it to the iframe's *real* origin, so a hostile
  //      page on a different origin literally cannot guess it.
  const expectedIframeOrigin = useMemo(() => {
    if (!siteUrl) return null;
    try {
      return new URL(siteUrl).origin;
    } catch {
      return null;
    }
  }, [siteUrl]);
  const bridgeNonceRef = useRef<string>("");
  if (!bridgeNonceRef.current) {
    bridgeNonceRef.current =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // ── Edit-mode (Fix B: visual click-to-tag) ────────────────────────────────
  // When ON, postMessages a get:edit-mode toggle into the iframe so the
  // scanner shows a "+ Make editable" button on any element the user hovers.
  // The scanner replies with get:tag-request; we create the field via the
  // normal admin endpoint and post get:tag-applied back so the scanner
  // writes data-get-key into the clicked element without a page reload.
  const [editMode, setEditMode] = useState(false);
  const createFieldMutation = useCreateContentField();
  const queryClient = useQueryClient();

  function postEditMode(on: boolean) {
    if (!expectedIframeOrigin) return;
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "get:bridge-init", nonce: bridgeNonceRef.current },
        expectedIframeOrigin,
      );
      iframeRef.current?.contentWindow?.postMessage(
        { type: "get:edit-mode", on, nonce: bridgeNonceRef.current },
        expectedIframeOrigin,
      );
    } catch {}
  }
  // Re-emit edit-mode whenever it changes — and re-emit after iframe loads
  // (handleIframeLoad does the handshake; we don't need to track it here
  // because the user will toggle again if they reload mid-session).
  useEffect(() => { postEditMode(editMode); }, [editMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIframeLoad = () => {
    try {
      // If we can access contentDocument without a SecurityError, the frame
      // loaded. An empty body (childElementCount === 0) means the browser
      // silently blocked it (X-Frame-Options / CSP frame-ancestors).
      const doc = iframeRef.current?.contentDocument;
      if (doc !== null && doc !== undefined && (doc.body?.childElementCount ?? 0) === 0) {
        setIframeStatus("blocked");
        return;
      } else {
        setIframeStatus("loaded");
      }
    } catch {
      // SecurityError → cross-origin frame loaded successfully; we just
      // can't read the document from here.
      setIframeStatus("loaded");
    }
    // Bridge handshake: hand the scanner our nonce so subsequent inbound
    // messages can be authenticated. Send to the iframe's real origin only
    // — never '*' — so a hostile sibling window can't sniff the nonce.
    if (expectedIframeOrigin) {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "get:bridge-init", nonce: bridgeNonceRef.current },
          expectedIframeOrigin,
        );
      } catch {}
    }
    // Re-apply the current highlight after the page finishes loading.
    // The 300 ms delay lets the scanner script initialise before we post.
    const labelToRestore = highlightedLabelRef.current;
    if (labelToRestore && expectedIframeOrigin) {
      setTimeout(() => {
        try {
          iframeRef.current?.contentWindow?.postMessage(
            { type: "get:highlight", label: labelToRestore, nonce: bridgeNonceRef.current },
            expectedIframeOrigin,
          );
        } catch {}
      }, 300);
    }
  };

  const reloadIframe = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    setIframeStatus("loading");
    try {
      iframe.contentWindow?.location.reload();
    } catch {
      // Cross-origin — fall back to re-assigning src
      const src = iframe.src;
      iframe.src = "";
      iframe.src = src;
    }
  };

  // ── Field highlight overlay + click-to-edit ──────────────────────────────
  // Phase 2: postMessage to iframe to ring the matching [data-get-key] element.
  // Phase 3: receive get:field-click from iframe → scroll, flash, focus field.

  const highlightedLabelRef = useRef<string | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref so the message handler can read the latest fields without
  // needing to be recreated every render.
  const fieldsRef = useRef(fields);
  useEffect(() => { fieldsRef.current = fields; }, [fields]);

  // Stable ref for the user's role — kept in sync so the message handler can
  // gate focus without needing to be re-created on every render.
  const myRoleRef = useRef(myRole);
  useEffect(() => { myRoleRef.current = myRole; }, [myRole]);

  // Stable ref for executeSave — used by the get:field-save message handler to
  // pass an explicit value (bypassing stale React state) when saving inline edits.
  const executeSaveRef = useRef<(fieldId: string, valueOverride?: string) => void>(() => {});

  // Callback-ref map so we can imperatively scroll/focus any field container.
  const fieldContainerRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Flash state: briefly ring a field row in yellow when it is jumped-to.
  const [flashedFieldId, setFlashedFieldId] = useState<string | null>(null);

  const postHighlight = (label: string | null) => {
    try {
      // targetOrigin must be the iframe's real origin, never '*' — a wildcard
      // would leak the highlight (and the nonce we ride alongside) to any
      // origin the iframe redirected to.
      if (!expectedIframeOrigin) return;
      iframeRef.current?.contentWindow?.postMessage(
        { type: "get:highlight", label, nonce: bridgeNonceRef.current },
        expectedIframeOrigin,
      );
      highlightedLabelRef.current = label;
    } catch {
      // Iframe not mounted or cross-origin blocked — silently swallow.
    }
  };

  const handleFieldFocus = (label: string) => {
    // Cancel any pending clear so switching between fields doesn't flicker.
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    postHighlight(label);
  };

  const handleFieldBlur = () => {
    // Short debounce: if focus moves to a sibling element within the same
    // container the new onFocus fires and cancels this before it runs.
    blurTimerRef.current = setTimeout(() => {
      postHighlight(null);
      blurTimerRef.current = null;
    }, 50);
  };

  // ── Phase 3: receive messages from the scanner in the preview iframe
  //
  // get:field-click  → scroll/focus the matching field in the left panel.
  // get:field-input  → mirror an inline-edit keystroke into localValues
  //                    (debounced from the scanner; no API call yet).
  // get:field-save   → trigger a save for the label that was inline-edited
  //                    (fired when the user clicks ✓ Save in the toolbar).
  useEffect(() => {
    const handler = (evt: MessageEvent) => {
      try {
        // Defense in depth — three independent checks, ALL must pass:
        //   (a) message came from our iframe's window object
        //   (b) message came from the iframe's expected origin (not a
        //       redirected-to attacker origin)
        //   (c) message carries the per-mount nonce we handed the scanner
        //       via the bridge handshake — proves the sender saw our
        //       targeted postMessage, i.e. it really is the scanner we
        //       initialised, not a hostile page riding the same parent.
        if (evt.source !== iframeRef.current?.contentWindow) return;
        if (!expectedIframeOrigin || evt.origin !== expectedIframeOrigin) return;
        const msg = evt.data as {
          type: string;
          label?: string;
          value?: string;
          nonce?: string;
        } | null;
        if (!msg || typeof msg.type !== "string") return;
        if (msg.nonce !== bridgeNonceRef.current) return;

        // ── get:tag-request: scanner asks editor to create a new field
        // for an element the owner clicked in edit-mode. We prompt for a
        // label, POST to the admin create endpoint, then post tag-applied
        // back so the scanner writes data-get-key into the clicked element.
        if (msg.type === "get:tag-request") {
          const m = msg as unknown as {
            text?: string;
            imageSrc?: string | null;
            suggestedType?: string;
            selector?: string;
            tagName?: string;
          };
          // Owner/admin only — viewers and editors can't create fields.
          if (!["owner", "admin"].includes(myRoleRef.current ?? "")) {
            toast({
              variant: "destructive",
              title: "Not allowed",
              description: "Only project owners and admins can tag new fields.",
            });
            return;
          }
          const suggested =
            (m.text && m.text.length > 0
              ? m.text
              : m.tagName === "IMG"
                ? "Image"
                : "Field")
              .slice(0, 40);
          const label = window.prompt(
            "Name this field (clients will see this label):",
            suggested,
          );
          if (!label || !label.trim()) return;
          const trimmed = label.trim();
          // Dedupe against existing labels — POST would 500 otherwise.
          if (fieldsRef.current?.some((f) => f.label === trimmed)) {
            toast({
              variant: "destructive",
              title: "Field already exists",
              description: `A field named "${trimmed}" already exists.`,
            });
            return;
          }
          const fieldType =
            m.suggestedType === "image" ||
            m.suggestedType === "url" ||
            m.suggestedType === "richtext"
              ? m.suggestedType
              : "text";
          const initialValue =
            fieldType === "image"
              ? (m.imageSrc ?? "")
              : (m.text ?? "");
          createFieldMutation.mutate(
            {
              projectId,
              data: {
                label: trimmed,
                type: fieldType,
                selector: m.selector || undefined,
                value: initialValue || undefined,
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({
                  queryKey: getListContentFieldsQueryKey(projectId),
                });
                if (expectedIframeOrigin) {
                  try {
                    iframeRef.current?.contentWindow?.postMessage(
                      {
                        type: "get:tag-applied",
                        label: trimmed,
                        nonce: bridgeNonceRef.current,
                      },
                      expectedIframeOrigin,
                    );
                  } catch {}
                }
                toast({
                  title: "Field added",
                  description: `"${trimmed}" is now editable.`,
                });
              },
              onError: (err) =>
                toast({
                  variant: "destructive",
                  title: "Couldn't add field",
                  description: err.message,
                }),
            },
          );
          return;
        }

        // ── get:field-input: mirror inline keystrokes ─────────────────
        if (msg.type === "get:field-input") {
          const label = msg.label;
          const value = typeof msg.value === "string" ? msg.value : "";
          const field = fieldsRef.current?.find((f) => f.label === label);
          if (!field) return;
          setLocalValues((prev) => ({ ...prev, [field.id]: value }));
          // Persist draft so a tab-close doesn't lose in-progress typing.
          // capturedServerUpdatedAt is omitted (null) here — conflict detection
          // is not needed for inline edits; the user sees the result live.
          try {
            const serverVal = field.draftValue || field.value || "";
            if (value === serverVal) {
              localStorage.removeItem(
                `get:editor-draft:${projectId}:${field.id}`,
              );
            } else {
              localStorage.setItem(
                `get:editor-draft:${projectId}:${field.id}`,
                JSON.stringify({
                  _v: 2,
                  value,
                  capturedServerUpdatedAt: null,
                }),
              );
            }
          } catch {}
          return;
        }

        // ── get:field-save: trigger the save pipeline ─────────────────
        if (msg.type === "get:field-save") {
          const label = msg.label;
          const value = typeof msg.value === "string" ? msg.value : undefined;
          const field = fieldsRef.current?.find((f) => f.label === label);
          if (!field || field.isLocked || myRoleRef.current === "viewer")
            return;
          // Use the explicit value from the message to avoid reading from
          // possibly-stale React state (setLocalValues is async).
          executeSaveRef.current(field.id, value);
          return;
        }

        // ── get:field-click: scroll & focus the field panel row ───────
        if (msg.type !== "get:field-click") return;
        const label = msg.label;
        const field = fieldsRef.current?.find((f) => f.label === label);
        if (!field) return;
        // Phase 2 hook: ring the element in the iframe immediately.
        postHighlight(label ?? null);
        // Scroll the field panel to the matching row and flash it.
        const container = fieldContainerRefs.current.get(field.id);
        if (container) {
          container.scrollIntoView({ behavior: "smooth", block: "center" });
          setFlashedFieldId(field.id);
          setTimeout(
            () => setFlashedFieldId((prev) => (prev === field.id ? null : prev)),
            700,
          );
          // Focus the input — skip if the field is locked by the owner OR if the
          // current user is a viewer (viewer role can still see fields but must
          // not be able to edit them even when the field itself is not locked).
          const isViewerRole = myRoleRef.current === "viewer";
          if (!field.isLocked && !isViewerRole) {
            // Include button[role="switch"] so boolean fields (shadcn Switch)
            // receive focus, in addition to text/textarea/url/number inputs.
            const input = container.querySelector<HTMLElement>(
              'input, textarea, button[role="switch"]',
            );
            if (input) setTimeout(() => input.focus(), 200);
          }
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [expectedIframeOrigin]); // eslint-disable-line react-hooks/exhaustive-deps

  // First-visit intro modal — once per project per device. The "?" button in
  // the header re-opens it.
  const introKey = `get:editor-intro-seen:${projectId}`;
  const [introOpen, setIntroOpen] = useState(false);
  const [introCheckedOnce, setIntroCheckedOnce] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 1800);
      reloadIframe();
    } finally {
      setIsRefreshing(false);
    }
  };

  // localStorage autosave key per field — survives tab close / refresh
  const draftKey = (fieldId: string) => `get:editor-draft:${projectId}:${fieldId}`;

  // Open the intro modal once per project per device. We do this in an effect
  // (not initial state) so SSR / pre-hydration doesn't flash it.
  useEffect(() => {
    if (introCheckedOnce || !projectId) return;
    try {
      if (!localStorage.getItem(introKey)) setIntroOpen(true);
    } catch {}
    setIntroCheckedOnce(true);
  }, [introCheckedOnce, introKey, projectId]);

  useEffect(() => {
    if (!fields) return;
    const newValues: Record<string, string> = {};
    const newConflicts = new Set(conflictFields);
    let conflictsChanged = false;

    fields.forEach((f) => {
      if (localValues[f.id] !== undefined) return;
      const serverVal = f.draftValue || f.value || "";
      const draft = (() => {
        try { return parseDraft(localStorage.getItem(draftKey(f.id))); } catch { return null; }
      })();

      if (!draft || draft.value === serverVal) {
        // No live draft, or it matches the server already — nothing to restore.
        newValues[f.id] = serverVal;
        return;
      }

      // The local draft disagrees with the server.
      newValues[f.id] = draft.value;

      // Conflict: we captured a server timestamp when the draft was written,
      // and the server has since moved past that timestamp. Without the
      // captured timestamp (legacy drafts) we silently keep the local value
      // — that's the previous behaviour.
      const serverUpdatedAt = (f as any).updatedAt as string | undefined;
      if (
        draft.capturedServerUpdatedAt &&
        serverUpdatedAt &&
        new Date(serverUpdatedAt).getTime() > new Date(draft.capturedServerUpdatedAt).getTime()
      ) {
        if (!newConflicts.has(f.id)) {
          newConflicts.add(f.id);
          conflictsChanged = true;
        }
      }
    });

    if (Object.keys(newValues).length > 0) {
      setLocalValues((prev) => ({ ...prev, ...newValues }));
    }
    if (conflictsChanged) setConflictFields(newConflicts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  // ── Conflict resolution ───────────────────────────────────────────────────
  const acceptServer = (fieldId: string) => {
    const f = fields?.find((x) => x.id === fieldId);
    if (!f) return;
    const serverVal = f.draftValue || f.value || "";
    setLocalValues((prev) => ({ ...prev, [fieldId]: serverVal }));
    try { localStorage.removeItem(draftKey(fieldId)); } catch {}
    setConflictFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  };

  const keepMine = (fieldId: string) => {
    const f = fields?.find((x) => x.id === fieldId);
    if (!f) return;
    // Re-stamp the captured timestamp to "now we've acknowledged the server's
    // current version" so the banner doesn't keep firing on every refetch.
    const serverUpdatedAt = (f as any).updatedAt as string | undefined;
    try {
      const payload: StoredDraft = {
        value: localValues[fieldId] ?? "",
        capturedServerUpdatedAt: serverUpdatedAt ?? null,
      };
      localStorage.setItem(draftKey(fieldId), serializeDraft(payload));
    } catch {}
    setConflictFields((prev) => {
      const next = new Set(prev);
      next.delete(fieldId);
      return next;
    });
  };

  // Attempt save — show dialog if warning not suppressed
  const handleSaveClick = (fieldId: string) => {
    if (skipWarning) {
      executeSave(fieldId);
    } else {
      setPendingFieldId(fieldId);
    }
  };
  // Keep the stable ref in sync on every render.
  useEffect(() => { executeSaveRef.current = executeSave; });

  // Dialog confirmed
  const handleDialogConfirm = (skipNext: boolean) => {
    if (skipNext) {
      localStorage.setItem(SKIP_WARN_KEY, "true");
      setSkipWarning(true);
    }
    const fieldId = pendingFieldId!;
    setPendingFieldId(null);
    executeSave(fieldId);
  };

  // Dialog cancelled
  const handleDialogCancel = () => {
    setPendingFieldId(null);
  };

  // Actually call the API.
  // valueOverride lets callers (e.g. the get:field-save message handler) pass the
  // final value explicitly, avoiding a race with async React setState.
  const executeSave = (fieldId: string, valueOverride?: string) => {
    setSavingField(fieldId);
    updateMutation.mutate(
      {
        projectId,
        fieldId,
        data: { draftValue: valueOverride !== undefined ? valueOverride : localValues[fieldId] },
      },
      {
        onSuccess: (data: any) => {
          const isPending = data?.draftValue != null;
          // Honest save toast — append the same install-check hint the
          // header badge uses so we never tell the user "now live" when
          // the scanner isn't installed or the field isn't tagged.
          // Prefer the label off the server response (authoritative) and
          // fall back to the local closure only as a secondary lookup.
          const savedLabel: string | undefined = data?.label
            ?? fields?.find((f) => f.id === fieldId)?.label;
          const s = savedLabel ? statusForField(savedLabel) : null;
          // Conservative default: if we couldn't resolve the field or have
          // no install-check yet, do NOT claim "now live."
          let liveDescription = "Saved. We haven't confirmed your site is wired up yet — open it in another tab so we can check.";
          if (s && s.tone === "bad") liveDescription = "Saved — but " + s.tip;
          else if (s && s.tone === "warn") liveDescription = "Saved — " + s.tip;
          else if (s && s.tone === "ok") liveDescription = "Your change is now live.";
          toast({
            title: isPending ? "Saved — pending review" : "Saved",
            description: isPending
              ? "The project owner will review before it goes live."
              : liveDescription,
          });
          // Server now has the change — drop the local autosave for this field.
          try { localStorage.removeItem(draftKey(fieldId)); } catch {}
          refetch();
          setSavingField(null);
          // Reload the preview so the scanner picks up the new value.
          reloadIframe();
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Save failed", description: err.message });
          setSavingField(null);
        },
      },
    );
  };

  // Discard local edits for a field
  const handleUndo = (fieldId: string) => {
    const field = fields?.find((f) => f.id === fieldId);
    if (!field) return;
    setLocalValues((prev) => ({
      ...prev,
      [fieldId]: field.draftValue || field.value || "",
    }));
    try { localStorage.removeItem(draftKey(fieldId)); } catch {}
  };

  const handleValueChange = (fieldId: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: val }));
    // Persist immediately so a tab close doesn't lose typing. We also stamp
    // the server's current updatedAt so a future restore can detect that the
    // server moved on while this draft was sitting in localStorage.
    try {
      const field = fields?.find((f) => f.id === fieldId);
      const serverVal = field ? field.draftValue || field.value || "" : "";
      if (val === serverVal) {
        localStorage.removeItem(draftKey(fieldId));
      } else {
        const payload: StoredDraft = {
          value: val,
          capturedServerUpdatedAt: ((field as any)?.updatedAt as string | undefined) ?? null,
        };
        localStorage.setItem(draftKey(fieldId), serializeDraft(payload));
      }
    } catch {}
  };

  const fieldInputStyle: React.CSSProperties = {
    height: 46,
    borderRadius: r.md,
    fontSize: type.base,
    background: BRAND.surface,
    border: `1px solid ${line.base}`,
  };

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: BRAND.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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

  if (!fields || fields.length === 0) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: BRAND.paper,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <EmptyState
          icon={FileEdit}
          title="Nothing to edit yet"
          description="Your team hasn't set up any editable areas for this project. Check back soon."
        />
      </div>
    );
  }

  // Find the label for whichever field is waiting on the dialog
  const pendingField = fields.find((f) => f.id === pendingFieldId);

  // Field-type counts for the intro modal — gives the user a concrete answer
  // to "what can I edit?" instead of an abstract welcome.
  const typeCounts = (fields ?? []).reduce<Record<string, number>>((acc, f) => {
    acc[f.type] = (acc[f.type] ?? 0) + 1;
    return acc;
  }, {});

  const handleIntroDone = () => {
    try { localStorage.setItem(introKey, "1"); } catch {}
    setIntroOpen(false);
  };

  return (
    <div style={{ minHeight: "100dvh", background: BRAND.paper, color: BRAND.ink }}>
      {/* Confirmation dialog */}
      {pendingFieldId && pendingField && (
        <SaveWarningDialog
          fieldLabel={pendingField.label}
          fieldType={pendingField.type}
          value={localValues[pendingField.id] ?? ""}
          onConfirm={handleDialogConfirm}
          onCancel={handleDialogCancel}
        />
      )}

      {/* First-visit intro modal */}
      {introOpen && (
        <ClientIntroModal
          totalFields={fields.length}
          typeCounts={typeCounts}
          isManager={isManager}
          editsGoLiveImmediately={editsGoLiveImmediately}
          ownerName={(project as any)?.ownerName ?? null}
          onDone={handleIntroDone}
        />
      )}

      {/* Sticky top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(250,249,246,0.9)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${line.faint}`,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(20px, 4vw, 32px)",
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: type.base,
            fontWeight: 600,
            color: BRAND.ink,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {project?.name ?? "Editor"}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: windowWidth < 500 ? 8 : 12, minWidth: 0 }}>
          {/* Help / re-open intro */}
          <button
            onClick={() => setIntroOpen(true)}
            title="What can I edit here?"
            aria-label="Help"
            data-testid="open-intro"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 30,
              height: 30,
              borderRadius: 8,
              border: `1px solid ${line.base}`,
              background: "transparent",
              cursor: "pointer",
              color: tone[500],
              flexShrink: 0,
              transition: `color 0.15s ${ease}, background 0.15s ${ease}`,
            }}
          >
            <HelpCircle style={{ width: 14, height: 14 }} />
          </button>
          {/* Open site in new tab — always visible */}
          {siteUrl && (
            <a
              href={siteUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Open site in new tab"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 8,
                border: `1px solid ${line.base}`,
                background: "transparent",
                cursor: "pointer",
                color: tone[500],
                flexShrink: 0,
                textDecoration: "none",
              }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
            </a>
          )}
          {/* Edit-mode toggle (Fix B: click-to-tag any element in preview).
              Only meaningful when the preview iframe is shown — hidden on
              narrow widths where the preview isn't rendered. */}
          {showPreviewPanel && siteUrl && ["owner", "admin"].includes(myRole ?? "") && (
            <button
              onClick={() => setEditMode((v) => !v)}
              title={editMode ? "Exit tag mode" : "Click an element in preview to make it editable"}
              data-testid="btn-edit-mode"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: windowWidth < 500 ? "7px" : "5px 10px",
                borderRadius: 8,
                border: `1px solid ${editMode ? "#22c55e" : line.base}`,
                background: editMode ? "#22c55e" : "transparent",
                cursor: "pointer",
                fontSize: type.xs,
                fontWeight: 600,
                flexShrink: 0,
                color: editMode ? "#fff" : tone[500],
                transition: `all 0.15s ${ease}`,
              }}
            >
              <MousePointerClick style={{ width: 12, height: 12 }} />
              {windowWidth >= 500 && (editMode ? "Tagging…" : "Tag element")}
            </button>
          )}
          {/* Refresh button — icon-only on narrow screens */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh content"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: windowWidth < 500 ? "7px" : "5px 10px",
              borderRadius: 8,
              border: `1px solid ${line.base}`,
              background: "transparent",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              fontSize: type.xs,
              fontWeight: 500,
              flexShrink: 0,
              color: justRefreshed ? "#16a34a" : tone[500],
              transition: `color 0.3s ${ease}`,
            }}
          >
            {isRefreshing ? (
              <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
            ) : (
              <RefreshCw style={{ width: 12, height: 12 }} />
            )}
            {windowWidth >= 500 && (justRefreshed ? "Refreshed" : "Refresh")}
          </button>
          {/* Status badge — hidden on very narrow screens */}
          {windowWidth >= 500 && (() => {
            // Honest live badge: only claim "Live on site" when the install
            // check has actually confirmed the scanner is present and at
            // least one field is wired. Otherwise tell the user exactly what
            // we found ("Saved — scanner not installed", etc).
            const anyPending = fields?.some((f) => f.draftValue != null);
            let dot = "#4ade80";
            let label = "All changes live";
            if (anyPending) {
              dot = BRAND.yellow;
              label = "Changes pending review";
            } else if (!installCheck || !installCheck.fetched) {
              dot = tone[300];
              label = "Saved";
            } else if (!installCheck.scannerFound) {
              dot = "#ef4444";
              label = "Saved — scanner not installed";
            } else {
              const wired = installCheck.fieldStatuses.filter((f) => f.status === "wired").length;
              const total = installCheck.fieldStatuses.length;
              if (total > 0 && wired === 0) {
                dot = "#ef4444";
                label = "Saved — no fields tagged on site";
              } else if (wired < total) {
                dot = "#f59e0b";
                label = `Live on site (${wired}/${total} fields wired)`;
              } else {
                dot = "#22c55e";
                label = "Live on site";
              }
            }
            return (
              <span
                data-testid="badge-live-status"
                title={installCheck?.siteUrl ? `Checked: ${installCheck.siteUrl}` : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: type.xs,
                  fontWeight: 500,
                  color: tone[500],
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: dot,
                    flexShrink: 0,
                    display: "inline-block",
                  }}
                />
                {label}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Two-column body: fields (left) + live preview (right) */}
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {/* ── Left panel: field list ─────────────────────────────────────── */}
        <div
          style={{
            flex: showPreviewPanel ? "0 0 42%" : "1 1 auto",
            minWidth: 0,
            borderRight: showPreviewPanel ? `1px solid ${line.faint}` : "none",
          }}
        >
        <div style={{ maxWidth: showPreviewPanel ? "none" : 640, margin: showPreviewPanel ? "0" : "0 auto", padding: "44px clamp(20px, 4vw, 32px) 80px" }}>
        <div style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            {project?.name ? `Editing ${project.name}` : "Your content"}
          </h1>
          <p style={{ fontSize: type.base, color: tone[500], lineHeight: 1.55 }}>
            {editsGoLiveImmediately
              ? "Update the fields below and hit Save. Your changes go live as soon as you save."
              : "Update the fields below and hit Save. Your changes are sent to the project owner for review before they go live."}
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {fields.map((field) => {
            const serverValue = field.draftValue || field.value || "";
            const hasChanges = localValues[field.id] !== serverValue;
            const isSaving = savingField === field.id;
            const hasDraftPending =
              field.draftValue && field.draftValue !== field.value && !hasChanges;

            return (
              <div
                key={field.id}
                ref={(el) => {
                  if (el) fieldContainerRefs.current.set(field.id, el);
                  else fieldContainerRefs.current.delete(field.id);
                }}
                data-field-label={field.label}
                onFocus={() => handleFieldFocus(field.label)}
                onBlur={handleFieldBlur}
                style={{
                  opacity: field.isLocked ? 0.55 : 1,
                  borderRadius: 10,
                  boxShadow: flashedFieldId === field.id
                    ? "0 0 0 3px rgba(250,204,21,0.55), 0 0 0 7px rgba(250,204,21,0.18)"
                    : "none",
                  transition: `opacity 0.2s ${ease}, box-shadow 0.5s ${ease}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: windowWidth < 500 ? "flex-start" : "center",
                    flexDirection: windowWidth < 500 ? "column" : "row",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    gap: windowWidth < 500 ? 8 : 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    {/* Health dot: green wired, yellow tag missing, red no
                        scanner, gray still checking. Driven by install-check. */}
                    {(() => {
                      const s = statusForField(field.label);
                      return (
                        <span
                          data-testid={`field-health-${field.label}`}
                          data-health-tone={s.tone}
                          title={s.tip}
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: s.color,
                            flexShrink: 0,
                            display: "inline-block",
                          }}
                        />
                      );
                    })()}
                    <span style={{ fontSize: type.base, fontWeight: 600 }}>
                      {field.label}
                    </span>
                    {field.isLocked ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: tone[500],
                          background: tone[100],
                          padding: "2px 8px",
                          borderRadius: 6,
                        }}
                      >
                        <Lock style={{ width: 10, height: 10 }} /> Locked
                      </span>
                    ) : null}
                  </div>

                  {!field.isLocked && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {/* Undo button — only visible when there are unsaved changes */}
                      {hasChanges && (
                        <button
                          onClick={() => handleUndo(field.id)}
                          title="Undo changes"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: type.xs,
                            fontWeight: 600,
                            padding: "6px 10px",
                            borderRadius: 8,
                            border: `1px solid ${line.base}`,
                            background: "transparent",
                            cursor: "pointer",
                            color: tone[500],
                            transition: `color 0.14s ${ease}, border-color 0.14s ${ease}`,
                          }}
                        >
                          <Undo2 style={{ width: 12, height: 12 }} />
                          Undo
                        </button>
                      )}

                      {/* Save button */}
                      <button
                        onClick={() => handleSaveClick(field.id)}
                        disabled={!hasChanges || isSaving}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          fontSize: type.xs,
                          fontWeight: 600,
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "none",
                          cursor: hasChanges ? "pointer" : "default",
                          background: hasChanges ? BRAND.ink : tone[100],
                          color: hasChanges ? "#fff" : tone[400],
                          transition: `background 0.18s ${ease}, color 0.18s ${ease}`,
                        }}
                      >
                        {isSaving ? (
                          <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                        ) : hasChanges ? (
                          <Save style={{ width: 12, height: 12 }} />
                        ) : (
                          <Check style={{ width: 12, height: 12 }} />
                        )}
                        {hasChanges ? "Save" : "Saved"}
                      </button>
                    </div>
                  )}
                </div>

                {conflictFields.has(field.id) && (
                  <div
                    data-testid={`conflict-banner-${field.id}`}
                    style={{
                      marginBottom: 10,
                      padding: "10px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 215, 71, 0.18)",
                      border: "1px solid rgba(217, 119, 6, 0.30)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <AlertTriangle style={{ width: 16, height: 16, color: "#b45309", flexShrink: 0 }} />
                    <p style={{ flex: 1, fontSize: type.xs, color: "#92400e", lineHeight: 1.45, minWidth: 200 }}>
                      <strong>This was changed while you were editing.</strong> Someone else saved a new version. Keep what you typed, or load the latest?
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => keepMine(field.id)}
                        data-testid={`conflict-keep-${field.id}`}
                        style={{
                          fontSize: type.xs, fontWeight: 600,
                          padding: "5px 10px", borderRadius: 7,
                          border: `1px solid ${line.base}`,
                          background: BRAND.paper, cursor: "pointer", color: BRAND.ink,
                        }}
                      >
                        Keep mine
                      </button>
                      <button
                        type="button"
                        onClick={() => acceptServer(field.id)}
                        data-testid={`conflict-server-${field.id}`}
                        style={{
                          fontSize: type.xs, fontWeight: 600,
                          padding: "5px 10px", borderRadius: 7,
                          border: "none",
                          background: BRAND.ink, cursor: "pointer", color: BRAND.paper,
                        }}
                      >
                        Load latest
                      </button>
                    </div>
                  </div>
                )}

                {field.type === "text" && (
                  <Input
                    value={localValues[field.id] || ""}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    style={fieldInputStyle}
                  />
                )}

                {field.type === "richtext" && (
                  <RichTextField
                    value={localValues[field.id] || ""}
                    disabled={!!field.isLocked}
                    onChange={(v) => handleValueChange(field.id, v)}
                    fieldInputStyle={fieldInputStyle}
                  />
                )}

                {field.type === "url" && (
                  <Input
                    type="url"
                    value={localValues[field.id] || ""}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    placeholder="https://"
                    style={{ ...fieldInputStyle, fontFamily: "monospace", fontSize: type.sm }}
                  />
                )}

                {field.type === "image" && (
                  <ImageField
                    value={localValues[field.id] || ""}
                    disabled={!!field.isLocked}
                    onChange={(v) => handleValueChange(field.id, v)}
                    fieldInputStyle={fieldInputStyle}
                    projectId={Number(projectId)}
                  />
                )}

                {field.type === "number" && (
                  <Input
                    type="number"
                    value={localValues[field.id] || ""}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    style={{ ...fieldInputStyle, maxWidth: 180 }}
                  />
                )}

                {field.type === "boolean" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 46, flexWrap: "wrap" }}>
                    <Switch
                      checked={localValues[field.id] === "true"}
                      onCheckedChange={(c) => handleValueChange(field.id, c ? "true" : "false")}
                      disabled={field.isLocked}
                      className="data-[state=checked]:bg-[#1a1a2e]"
                    />
                    <span style={{ fontSize: type.base, fontWeight: 500 }}>
                      {localValues[field.id] === "true" ? "Yes" : "No"}
                    </span>
                  </div>
                )}

                {hasDraftPending && (
                  <p
                    style={{
                      marginTop: 8,
                      fontSize: type.xs,
                      color: tone[600],
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: BRAND.yellow,
                        display: "inline-block",
                      }}
                    />
                    Draft pending approval
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Preferences row */}
        <div
          style={{
            marginTop: 56,
            paddingTop: 24,
            borderTop: `1px solid ${line.faint}`,
            display: "flex",
            alignItems: windowWidth < 500 ? "flex-start" : "center",
            justifyContent: "space-between",
            flexDirection: windowWidth < 500 ? "column" : "row",
            gap: windowWidth < 500 ? 12 : 16,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: type.sm, fontWeight: 600, color: BRAND.ink, marginBottom: 2 }}>
              Save confirmation
            </p>
            <p style={{ fontSize: type.xs, color: tone[400], lineHeight: 1.45 }}>
              {skipWarning
                ? "Saves go through immediately without asking."
                : "A confirmation dialog appears before every save."}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: type.xs, color: tone[400] }}>
              {skipWarning ? "Off" : "On"}
            </span>
            <Switch
              checked={!skipWarning}
              onCheckedChange={(on) => {
                const next = !on;
                setSkipWarning(next);
                if (next) {
                  localStorage.setItem(SKIP_WARN_KEY, "true");
                } else {
                  localStorage.removeItem(SKIP_WARN_KEY);
                }
              }}
              className="data-[state=checked]:bg-[#1a1a2e]"
            />
          </div>
        </div>
        </div>
        </div>

        {/* ── Right panel: live preview ──────────────────────────────────── */}
        {showPreviewPanel && (
          <div
            style={{
              flex: "0 0 58%",
              position: "sticky",
              top: 60,
              height: "calc(100dvh - 60px)",
              display: "flex",
              flexDirection: "column",
              background: tone[50],
            }}
          >
            {!siteUrl ? (
              /* No URL yet — site hasn't connected */
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 40,
                  gap: 12,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    background: tone[100],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 4,
                  }}
                >
                  <ExternalLink style={{ width: 20, height: 20, color: tone[400] }} />
                </div>
                <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink }}>
                  No preview yet
                </p>
                <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.55, maxWidth: 320 }}>
                  Paste your site's URL to preview it here, or finish setup to connect it permanently.
                </p>
                <form
                  onSubmit={(e) => { e.preventDefault(); commitManualUrl(manualUrlInput); }}
                  style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", maxWidth: 320, marginTop: 4 }}
                >
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      inputMode="url"
                      placeholder="https://your-site.com"
                      value={manualUrlInput}
                      onChange={(e) => { setManualUrlInput(e.target.value); if (manualUrlError) setManualUrlError(""); }}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        fontSize: type.sm,
                        border: `1px solid ${manualUrlError ? "#dc2626" : line.base}`,
                        borderRadius: 8,
                        outline: "none",
                        background: BRAND.paper,
                        color: BRAND.ink,
                      }}
                      data-testid="input-manual-preview-url"
                    />
                    <button
                      type="submit"
                      style={{
                        padding: "8px 14px",
                        fontSize: type.sm,
                        fontWeight: 600,
                        background: BRAND.ink,
                        color: BRAND.paper,
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                      }}
                      data-testid="button-preview-url"
                    >
                      Preview
                    </button>
                  </div>
                  {manualUrlError && (
                    <p style={{ fontSize: type.xs, color: "#dc2626", textAlign: "left", margin: 0 }}>
                      {manualUrlError}
                    </p>
                  )}
                </form>
                <a
                  href={`/app/setup/${projectId}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    fontSize: type.xs,
                    fontWeight: 500,
                    color: tone[500],
                    textDecoration: "none",
                  }}
                >
                  Or go to setup
                  <ArrowRight style={{ width: 11, height: 11 }} />
                </a>
              </div>
            ) : (
              /* Live site iframe */
              <>
                {/* Blocked overlay — shown when X-Frame-Options prevents rendering */}
                {iframeStatus === "blocked" ? (
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 40,
                      gap: 12,
                      textAlign: "center",
                      background: tone[50],
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: "rgba(255,215,71,0.18)",
                        border: "1px solid rgba(255,215,71,0.55)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 4,
                      }}
                    >
                      <AlertTriangle style={{ width: 20, height: 20, color: "#b45309" }} />
                    </div>
                    <p style={{ fontSize: type.base, fontWeight: 600, color: BRAND.ink }}>
                      Preview unavailable
                    </p>
                    <p style={{ fontSize: type.sm, color: tone[500], lineHeight: 1.55, maxWidth: 300 }}>
                      Your site doesn't allow previews — open it in a new tab instead.
                    </p>
                    <a
                      href={siteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                        fontSize: type.sm,
                        fontWeight: 600,
                        color: BRAND.ink,
                        textDecoration: "none",
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: `1px solid ${line.base}`,
                      }}
                    >
                      Open site in new tab
                      <ExternalLink style={{ width: 13, height: 13 }} />
                    </a>
                  </div>
                ) : (
                  <iframe
                    ref={iframeRef}
                    src={siteUrl}
                    title="Site preview"
                    onLoad={handleIframeLoad}
                    onError={() => setIframeStatus("blocked")}
                    style={{
                      flex: 1,
                      border: "none",
                      display: "block",
                      width: "100%",
                      opacity: iframeStatus === "loading" ? 0.4 : 1,
                      transition: "opacity 0.3s ease",
                    }}
                  />
                )}
                {/* Always-visible footer: quick link and status hint */}
                <div
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderTop: `1px solid ${line.faint}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: BRAND.paper,
                  }}
                >
                  <p style={{ fontSize: type.xs, color: tone[400], margin: 0 }}>
                    {iframeStatus === "loading" ? "Loading preview…" : "Live preview"}
                  </p>
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: type.xs,
                      fontWeight: 600,
                      color: BRAND.ink,
                      textDecoration: "none",
                    }}
                  >
                    Open in new tab
                    <ExternalLink style={{ width: 11, height: 11 }} />
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// RichTextField — contenteditable panel editor with Bold / Italic / List / Link
// ────────────────────────────────────────────────────────────────────────────

function RichTextField({
  value,
  disabled,
  onChange,
  fieldInputStyle,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  fieldInputStyle: React.CSSProperties;
}) {
  const editableRef = useRef<HTMLDivElement>(null);
  const isFocused = useRef(false);
  const [inLink, setInLink] = useState(false);

  // Sync external value → DOM, but only when the field isn't being actively edited.
  // This prevents cursor-jump when React re-renders mid-keystroke.
  useEffect(() => {
    const el = editableRef.current;
    if (!el || isFocused.current) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  // Track whether the caret is currently inside an <a>, so we can show
  // an Unlink button to remove or change the link.
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const update = () => {
      if (!isFocused.current) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) {
        setInLink(false);
        return;
      }
      let node: Node | null = sel.anchorNode;
      while (node && node !== el) {
        if (node.nodeType === 1 && (node as HTMLElement).tagName === "A") {
          setInLink(true);
          return;
        }
        node = node.parentNode;
      }
      setInLink(false);
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const handleInput = () => {
    const html = editableRef.current?.innerHTML ?? "";
    onChange(html);
  };

  const execFormat = (cmd: string, val?: string) => {
    if (disabled) return;
    editableRef.current?.focus();
    try {
      document.execCommand(cmd, false, val);
    } catch {}
    onChange(editableRef.current?.innerHTML ?? "");
  };

  const handleLinkClick = () => {
    const url = prompt("Enter URL:", "https://");
    if (url && !/^(javascript|data|vbscript):/i.test(url.trim())) {
      execFormat("createLink", url);
    }
  };

  const handleUnlinkClick = () => {
    execFormat("unlink");
    setInLink(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {!disabled && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <RichFormatBtn onMouseDown={(e) => { e.preventDefault(); execFormat("bold"); }} title="Bold">
            <strong>B</strong>
          </RichFormatBtn>
          <RichFormatBtn onMouseDown={(e) => { e.preventDefault(); execFormat("italic"); }} title="Italic">
            <em>I</em>
          </RichFormatBtn>
          <RichFormatBtn onMouseDown={(e) => { e.preventDefault(); execFormat("insertUnorderedList"); }} title="Bullet list">
            • List
          </RichFormatBtn>
          <RichFormatBtn onMouseDown={(e) => { e.preventDefault(); handleLinkClick(); }} title="Insert link">
            🔗 Link
          </RichFormatBtn>
          {inLink && (
            <RichFormatBtn onMouseDown={(e) => { e.preventDefault(); handleUnlinkClick(); }} title="Remove link">
              ⛓️‍💥 Unlink
            </RichFormatBtn>
          )}
        </div>
      )}
      <div
        ref={editableRef}
        contentEditable={disabled ? false : true}
        suppressContentEditableWarning
        onFocus={() => { isFocused.current = true; }}
        onBlur={() => { isFocused.current = false; setInLink(false); }}
        onInput={handleInput}
        style={{
          ...fieldInputStyle,
          height: "auto",
          minHeight: 140,
          overflowY: "auto",
          padding: "12px 14px",
          lineHeight: 1.6,
          outline: "none",
          cursor: disabled ? "default" : "text",
          border: `1px solid ${line.base}`,
          borderRadius: r.md,
          fontSize: type.base,
          background: disabled ? "transparent" : "white",
          wordBreak: "break-word",
        }}
        data-placeholder="Enter rich text..."
      />
    </div>
  );
}

function RichFormatBtn({
  children,
  onMouseDown,
  title,
}: {
  children: React.ReactNode;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${line.base}`,
        background: "transparent",
        color: BRAND.ink,
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        lineHeight: 1.4,
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {children}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ImageField — picker that uploads to object storage + URL paste fallback
// ────────────────────────────────────────────────────────────────────────────
function ImageField({
  value,
  disabled,
  onChange,
  fieldInputStyle,
  projectId,
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  fieldInputStyle: React.CSSProperties;
  projectId: number;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  // Same-origin storage routes — proxied to the api-server.
  const baseHref = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const { uploadFile, isUploading, progress } = useUpload({
    basePath: `${baseHref}/api/storage`,
    projectId,
    onSuccess: (resp: { objectPath: string }) => {
      // Build an absolute URL so client sites on other origins can render it.
      const absolute =
        typeof window !== "undefined"
          ? `${window.location.origin}${baseHref}/api/storage${resp.objectPath}`
          : `${baseHref}/api/storage${resp.objectPath}`;
      onChange(absolute);
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Upload failed", description: err.message });
    },
  });

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: "Pick an image file", description: "JPG, PNG, GIF, or WebP." });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Image too large", description: "Max 10 MB." });
      return;
    }
    uploadFile(file);
    // Reset so picking the same file again still fires onChange
    e.target.value = "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        {value && (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 12,
              overflow: "hidden",
              border: `1px solid ${line.base}`,
              flexShrink: 0,
              background: tone[50],
            }}
          >
            <img
              src={value}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 200px", minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handlePick}
              disabled={disabled || isUploading}
              style={{ display: "none" }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || isUploading}
              style={{
                height: 38,
                padding: "0 14px",
                borderRadius: r.md,
                border: `1px solid ${line.base}`,
                background: BRAND.paper,
                color: BRAND.ink,
                fontSize: type.sm,
                fontWeight: 600,
                cursor: disabled || isUploading ? "not-allowed" : "pointer",
                opacity: disabled ? 0.55 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
                  Uploading… {progress}%
                </>
              ) : (
                <>Upload image</>
              )}
            </button>
            <span style={{ fontSize: type.xs, color: tone[400] }}>or paste a URL ↓</span>
          </div>
          <span
            style={{ fontSize: 11, color: tone[400], lineHeight: 1.45 }}
            data-testid="image-caption"
          >
            Max 10 MB · JPG, PNG, WebP, GIF, SVG
          </span>
          <Input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || isUploading}
            placeholder="https://… or upload above"
            style={{
              ...fieldInputStyle,
              fontFamily: "monospace",
              fontSize: type.sm,
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ClientIntroModal — shown once per project per device on first editor visit
// ────────────────────────────────────────────────────────────────────────────
function ClientIntroModal({
  totalFields,
  typeCounts,
  isManager,
  editsGoLiveImmediately,
  ownerName,
  onDone,
}: {
  totalFields: number;
  typeCounts: Record<string, number>;
  isManager: boolean;
  // Whether saves bypass the review queue. True for owners/admins always, and
  // for editors when the project's autoPublish flag is on.
  editsGoLiveImmediately: boolean;
  ownerName: string | null;
  onDone: () => void;
}) {
  const [step, setStep] = useState<0 | 1>(0);

  // Pretty per-type labels for the field-mix summary on screen 1.
  const TYPE_LABEL: Record<string, string> = {
    text: "text",
    richtext: "long text",
    image: "image",
    url: "link",
    number: "number",
    boolean: "toggle",
  };
  const summary = Object.entries(typeCounts)
    .filter(([, n]) => n > 0)
    .map(([t, n]) => `${n} ${TYPE_LABEL[t] ?? t}${n === 1 ? "" : "s"}`)
    .join(" · ");

  const next = () => setStep(1);

  return (
    <div
      onClick={onDone}
      data-testid="client-intro-modal"
      style={{
        position: "fixed", inset: 0, zIndex: 250,
        background: "rgba(26,26,46,0.42)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: BRAND.paper, borderRadius: 18, padding: "clamp(20px, 5vw, 32px)",
          maxWidth: 460, width: "100%",
          maxHeight: "calc(100dvh - 48px)",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(26,26,46,0.20)",
          display: "flex", flexDirection: "column", gap: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: tone[500], letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
              Step {step + 1} of 2
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25 }}>
              {step === 0 ? "Welcome — here's what you can edit." : "What happens when you save?"}
            </h2>
          </div>
          <button
            onClick={onDone}
            aria-label="Close"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: tone[400], padding: 2,
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>

        {step === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.6 }}>
              You'll see <strong>{totalFields}</strong> editable {totalFields === 1 ? "area" : "areas"} below — text, images, links, and toggles your team has marked as safe to change. Everything else on the site stays exactly the way it is.
            </p>
            {summary && (
              <div style={{
                padding: "10px 14px",
                background: tone[50],
                border: `1px solid ${line.base}`,
                borderRadius: 10,
                fontSize: type.xs,
                color: tone[600],
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              }}>
                {summary}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.6 }}>
              {editsGoLiveImmediately
                ? isManager
                  ? <>Since you're a manager, your changes <strong>go live the moment you hit Save</strong>. You should see them on the site in a minute or two.</>
                  : <>Your changes <strong>go live the moment you hit Save</strong>. You should see them on the site in a minute or two.</>
                : <>Your changes are sent to {ownerName ? <strong>{ownerName}</strong> : "the project owner"} to check first. Once they approve, the change goes live. You'll see a <em>"Draft pending"</em> note under the field until then.</>}
            </p>
            <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.55 }}>
              You can always tap the <strong>?</strong> button at the top to see this again.
            </p>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          {step === 0 ? (
            <button
              onClick={next}
              data-testid="intro-next"
              style={{
                padding: "11px 18px", borderRadius: 10,
                border: "none", background: BRAND.ink, color: BRAND.paper,
                cursor: "pointer", fontSize: type.sm, fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              Next <ArrowRight style={{ width: 13, height: 13 }} />
            </button>
          ) : (
            <button
              onClick={onDone}
              data-testid="intro-done"
              style={{
                padding: "11px 18px", borderRadius: 10,
                border: "none", background: BRAND.ink, color: BRAND.paper,
                cursor: "pointer", fontSize: type.sm, fontWeight: 600,
              }}
            >
              Got it
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

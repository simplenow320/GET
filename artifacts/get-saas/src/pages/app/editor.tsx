import { useState, useEffect, useRef } from "react";
import { useParams } from "wouter";
import {
  useListContentFields,
  useUpdateContentField,
  useGetProject,
  getGetProjectQueryKey,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@workspace/object-storage-web";
import {
  Loader2, Save, FileEdit, Lock, Check, RefreshCw, Undo2, AlertTriangle, X,
  HelpCircle, ArrowRight,
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
// Save-confirmation dialog
// ---------------------------------------------------------------------------
function SaveWarningDialog({
  fieldLabel,
  onConfirm,
  onCancel,
}: {
  fieldLabel: string;
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

  // Actually call the API
  const executeSave = (fieldId: string) => {
    setSavingField(fieldId);
    updateMutation.mutate(
      {
        projectId,
        fieldId,
        data: { draftValue: localValues[fieldId] },
      },
      {
        onSuccess: (data: any) => {
          const isPending = data?.draftValue != null;
          toast({
            title: isPending ? "Saved — pending review" : "Saved",
            description: isPending
              ? "The project owner will review before it goes live."
              : "Your change is now live.",
          });
          // Server now has the change — drop the local autosave for this field.
          try { localStorage.removeItem(draftKey(fieldId)); } catch {}
          refetch();
          setSavingField(null);
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
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
              transition: `color 0.15s ${ease}, background 0.15s ${ease}`,
            }}
          >
            <HelpCircle style={{ width: 14, height: 14 }} />
          </button>
          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh content"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              borderRadius: 8,
              border: `1px solid ${line.base}`,
              background: "transparent",
              cursor: isRefreshing ? "not-allowed" : "pointer",
              fontSize: type.xs,
              fontWeight: 500,
              color: justRefreshed ? "#16a34a" : tone[500],
              transition: `color 0.3s ${ease}`,
            }}
          >
            {isRefreshing ? (
              <Loader2 style={{ width: 12, height: 12 }} className="animate-spin" />
            ) : (
              <RefreshCw style={{ width: 12, height: 12 }} />
            )}
            {justRefreshed ? "Refreshed" : "Refresh"}
          </button>
          {/* Status badge */}
          {(() => {
            const anyPending = fields?.some((f) => f.draftValue != null);
            return (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: type.xs,
                  fontWeight: 500,
                  color: tone[500],
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: anyPending ? BRAND.yellow : "#4ade80",
                    display: "inline-block",
                  }}
                />
                {anyPending ? "Changes pending review" : "All changes live"}
              </span>
            );
          })()}
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "44px clamp(20px, 4vw, 32px) 80px" }}>
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
            {isManager
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
                style={{
                  opacity: field.isLocked ? 0.55 : 1,
                  transition: `opacity 0.2s ${ease}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                    gap: 10,
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
                      <strong>This field changed since you started editing.</strong> Someone else updated it on the server. Keep your version or load theirs?
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
                        Use server
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
                  <Textarea
                    value={localValues[field.id] || ""}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    style={{
                      ...fieldInputStyle,
                      height: "auto",
                      minHeight: 140,
                      resize: "vertical",
                      lineHeight: 1.6,
                      padding: "12px 14px",
                    }}
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
                  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 46 }}>
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
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
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
}: {
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  fieldInputStyle: React.CSSProperties;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();
  // Same-origin storage routes — proxied to the api-server.
  const baseHref = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const { uploadFile, isUploading, progress } = useUpload({
    basePath: `${baseHref}/api/storage`,
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
  ownerName,
  onDone,
}: {
  totalFields: number;
  typeCounts: Record<string, number>;
  isManager: boolean;
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
          background: BRAND.paper, borderRadius: 18, padding: 32,
          maxWidth: 460, width: "100%",
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
              {isManager
                ? <>Because you're a project {ownerName ? "manager" : "manager"}, your changes <strong>go live as soon as you save</strong>. You'll see them on the site within a few minutes.</>
                : <>Your changes are sent to {ownerName ? <strong>{ownerName}</strong> : "the project owner"} for review. They'll go live once approved — you'll see a <em>"Draft pending approval"</em> note below the field until then.</>}
            </p>
            <p style={{ fontSize: type.xs, color: tone[500], lineHeight: 1.55 }}>
              You can come back and tap the <strong>?</strong> in the top bar any time to see this again.
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

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
} from "lucide-react";
import {
  BRAND, tone, line, type, ease, r,
  EmptyState,
} from "@/lib/ui";

const SKIP_WARN_KEY = "get_skip_save_warning";

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

  // Warning dialog state
  const [pendingFieldId, setPendingFieldId] = useState<string | null>(null);
  const [skipWarning, setSkipWarning] = useState(
    () => localStorage.getItem(SKIP_WARN_KEY) === "true",
  );

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

  useEffect(() => {
    if (fields) {
      const newValues: Record<string, string> = {};
      fields.forEach((f) => {
        if (localValues[f.id] === undefined) {
          const serverVal = f.draftValue || f.value || "";
          // If the user has unsaved local edits from a previous session, prefer them.
          let stored: string | null = null;
          try {
            stored = localStorage.getItem(draftKey(f.id));
          } catch {}
          newValues[f.id] = stored !== null && stored !== serverVal ? stored : serverVal;
        }
      });
      if (Object.keys(newValues).length > 0) {
        setLocalValues((prev) => ({ ...prev, ...newValues }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

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
    // Persist immediately so a tab close doesn't lose typing.
    try {
      const field = fields?.find((f) => f.id === fieldId);
      const serverVal = field ? field.draftValue || field.value || "" : "";
      if (val === serverVal) {
        localStorage.removeItem(draftKey(fieldId));
      } else {
        localStorage.setItem(draftKey(fieldId), val);
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

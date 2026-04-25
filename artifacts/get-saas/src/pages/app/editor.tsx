import { useState, useEffect } from "react";
import { useParams } from "wouter";
import {
  useListContentFields,
  useUpdateContentField,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, FileEdit, Lock, Check } from "lucide-react";
import {
  BRAND, tone, line, type, ease, r,
  EmptyState,
} from "@/lib/ui";

// Brand rule: this is inside the authenticated product UI — do NOT render
// any get branding (logo, mascot, wordmark) on this surface.

export default function ClientEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: fields, isLoading, refetch } = useListContentFields(projectId);
  const updateMutation = useUpdateContentField();
  const { toast } = useToast();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    if (fields) {
      const newValues: Record<string, string> = {};
      fields.forEach((f) => {
        if (localValues[f.id] === undefined) {
          newValues[f.id] = f.draftValue || f.value || "";
        }
      });
      if (Object.keys(newValues).length > 0) {
        setLocalValues((prev) => ({ ...prev, ...newValues }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields]);

  const handleSave = (fieldId: string) => {
    setSavingField(fieldId);
    updateMutation.mutate(
      {
        projectId,
        fieldId,
        data: { draftValue: localValues[fieldId] },
      },
      {
        onSuccess: (data: any) => {
          // If the server auto-published (owner/admin), draftValue comes back
          // null. If it's pending review (client editor), draftValue is set.
          const isPending = data?.draftValue != null;
          toast({
            title: isPending ? "Saved — pending review" : "Saved",
            description: isPending
              ? "The project owner will review before it goes live."
              : "Your change is now live.",
          });
          refetch();
          setSavingField(null);
        },
        onError: (err) => {
          toast({ variant: "destructive", title: "Save failed", description: err.message });
          setSavingField(null);
        },
      }
    );
  };

  const handleValueChange = (fieldId: string, val: string) => {
    setLocalValues((prev) => ({ ...prev, [fieldId]: val }));
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

  return (
    <div style={{ minHeight: "100dvh", background: BRAND.paper, color: BRAND.ink }}>
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
          }}
        >
          Editor
        </span>
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
            Your content
          </h1>
          <p style={{ fontSize: type.base, color: tone[500], lineHeight: 1.55 }}>
            Update the fields below and hit Save. Changes go live immediately.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {fields.map((field) => {
            const hasChanges =
              localValues[field.id] !== (field.draftValue || field.value || "");
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
                    <button
                      onClick={() => handleSave(field.id)}
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
                    {localValues[field.id] && (
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
                          src={localValues[field.id]}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    )}
                    <Input
                      type="url"
                      value={localValues[field.id] || ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      disabled={field.isLocked}
                      placeholder="Image URL"
                      style={{
                        ...fieldInputStyle,
                        flex: "1 1 200px",
                        minWidth: 0,
                        fontFamily: "monospace",
                        fontSize: type.sm,
                      }}
                    />
                  </div>
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
      </div>
    </div>
  );
}

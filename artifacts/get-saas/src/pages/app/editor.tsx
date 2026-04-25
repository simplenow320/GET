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
import { Loader2, Save, AlertCircle, Lock } from "lucide-react";

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
      fields.forEach(f => {
        if (localValues[f.id] === undefined) {
          newValues[f.id] = f.draftValue || f.value || "";
        }
      });
      if (Object.keys(newValues).length > 0) {
        setLocalValues(prev => ({ ...prev, ...newValues }));
      }
    }
  }, [fields]);

  const handleSave = (fieldId: string) => {
    setSavingField(fieldId);
    updateMutation.mutate({
      projectId,
      fieldId,
      data: { draftValue: localValues[fieldId] }
    }, {
      onSuccess: () => {
        toast({ title: "Saved as draft", description: "Your change is pending review." });
        refetch();
        setSavingField(null);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Save failed", description: err.message });
        setSavingField(null);
      }
    });
  };

  const handleValueChange = (fieldId: string, val: string) => {
    setLocalValues(prev => ({ ...prev, [fieldId]: val }));
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#faf9f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 style={{ width: 24, height: 24, color: "rgba(26,26,46,0.2)", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  if (!fields || fields.length === 0) {
    return (
      <div style={{ minHeight: "100dvh", background: "#faf9f6", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <AlertCircle style={{ width: 22, height: 22, color: "rgba(26,26,46,0.3)" }} />
          </div>
          <p style={{ fontSize: 17, fontWeight: 600, marginBottom: 8 }}>Nothing to edit yet</p>
          <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>Your developer hasn't mapped any editable fields for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: "#faf9f6", color: "#1a1a2e", fontFamily: "inherit" }}>

      {/* Sticky top bar */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 40,
        background: "rgba(250,249,246,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
      }}>
        <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.01em" }}>Edit content</span>
        <span style={{ fontSize: 12, fontWeight: 500, background: "rgba(0,0,0,0.05)", color: "rgba(26,26,46,0.55)", padding: "4px 12px", borderRadius: 20 }}>
          Changes require approval
        </span>
      </div>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "52px 24px 80px" }}>

        <div style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 6 }}>Your content</h1>
          <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>
            Update the fields below. Changes are saved as drafts and reviewed before going live.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {fields.map((field) => {
            const hasChanges = localValues[field.id] !== (field.draftValue || field.value || "");
            const isSaving = savingField === field.id;
            const hasDraftPending = field.draftValue && field.draftValue !== field.value && !hasChanges;

            return (
              <div key={field.id} style={{ opacity: field.isLocked ? 0.55 : 1, transition: "opacity 0.2s ease" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{field.label}</span>
                    <span style={{ fontSize: 10.5, color: "rgba(26,26,46,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{field.type}</span>
                    {field.isLocked && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "rgba(26,26,46,0.4)", background: "rgba(0,0,0,0.05)", padding: "2px 8px", borderRadius: 6 }}>
                        <Lock style={{ width: 10, height: 10 }} /> Locked
                      </span>
                    )}
                  </div>

                  {!field.isLocked && (
                    <button
                      onClick={() => handleSave(field.id)}
                      disabled={!hasChanges || isSaving}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 12.5,
                        fontWeight: 500,
                        padding: "5px 12px",
                        borderRadius: 8,
                        border: "none",
                        cursor: hasChanges ? "pointer" : "default",
                        background: hasChanges ? "#1a1a2e" : "rgba(0,0,0,0.05)",
                        color: hasChanges ? "#fff" : "rgba(26,26,46,0.3)",
                        transition: "all 0.2s ease",
                      }}
                    >
                      {isSaving
                        ? <Loader2 style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }} />
                        : <Save style={{ width: 12, height: 12 }} />}
                      Save draft
                    </button>
                  )}
                </div>

                {field.type === "text" && (
                  <Input
                    value={localValues[field.id] || ""}
                    onChange={e => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    style={{ height: 48, borderRadius: 11, fontSize: 15, background: "#fff", border: "1px solid rgba(0,0,0,0.09)" }}
                  />
                )}

                {field.type === "richtext" && (
                  <Textarea
                    value={localValues[field.id] || ""}
                    onChange={e => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    style={{ borderRadius: 11, fontSize: 15, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", minHeight: 140, resize: "vertical", lineHeight: 1.6, padding: "12px 14px" }}
                  />
                )}

                {field.type === "url" && (
                  <Input
                    type="url"
                    value={localValues[field.id] || ""}
                    onChange={e => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    placeholder="https://"
                    style={{ height: 48, borderRadius: 11, fontSize: 14, fontFamily: "monospace", background: "#fff", border: "1px solid rgba(0,0,0,0.09)" }}
                  />
                )}

                {field.type === "image" && (
                  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                    {localValues[field.id] && (
                      <div style={{ width: 80, height: 80, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0 }}>
                        <img src={localValues[field.id]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                    <Input
                      type="url"
                      value={localValues[field.id] || ""}
                      onChange={e => handleValueChange(field.id, e.target.value)}
                      disabled={field.isLocked}
                      placeholder="Image URL"
                      style={{ flex: 1, height: 48, borderRadius: 11, fontSize: 14, fontFamily: "monospace", background: "#fff", border: "1px solid rgba(0,0,0,0.09)" }}
                    />
                  </div>
                )}

                {field.type === "number" && (
                  <Input
                    type="number"
                    value={localValues[field.id] || ""}
                    onChange={e => handleValueChange(field.id, e.target.value)}
                    disabled={field.isLocked}
                    style={{ height: 48, borderRadius: 11, fontSize: 15, background: "#fff", border: "1px solid rgba(0,0,0,0.09)", maxWidth: 180 }}
                  />
                )}

                {field.type === "boolean" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 48 }}>
                    <Switch
                      checked={localValues[field.id] === "true"}
                      onCheckedChange={c => handleValueChange(field.id, c ? "true" : "false")}
                      disabled={field.isLocked}
                      className="data-[state=checked]:bg-[#1a1a2e]"
                    />
                    <span style={{ fontSize: 15, fontWeight: 500 }}>
                      {localValues[field.id] === "true" ? "Yes" : "No"}
                    </span>
                  </div>
                )}

                {hasDraftPending && (
                  <p style={{ marginTop: 6, fontSize: 12, color: "#b45309", display: "flex", alignItems: "center", gap: 4 }}>
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

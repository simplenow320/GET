import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { 
  useListContentFields, 
  useUpdateContentField,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, AlertCircle } from "lucide-react";

export default function ClientEditor() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: fields, isLoading, refetch } = useListContentFields(projectId);
  const updateMutation = useUpdateContentField();
  const { toast } = useToast();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingField, setSavingField] = useState<string | null>(null);

  // Initialize local values when fields load
  useEffect(() => {
    if (fields) {
      const newValues: Record<string, string> = {};
      fields.forEach(f => {
        if (localValues[f.id] === undefined) {
          // draftValue takes precedence in the editor if it exists, otherwise value
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
        toast({ title: "Draft saved", description: "Changes pending review." });
        refetch();
        setSavingField(null);
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error saving", description: err.message });
        setSavingField(null);
      }
    });
  };

  const handleValueChange = (fieldId: string, val: string) => {
    setLocalValues(prev => ({ ...prev, [fieldId]: val }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-black/20" />
      </div>
    );
  }

  if (!fields || fields.length === 0) {
    return (
      <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-black/40" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Nothing to edit yet</h2>
          <p className="text-black/60">Your developer hasn't mapped any editable fields for this project.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#fcfcfc] text-[#111] font-sans selection:bg-black/10 selection:text-black">
      <header className="bg-white border-b border-black/[0.04] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="font-semibold tracking-tight text-lg">Content Editor</div>
          <div className="text-sm text-black/50 bg-black/5 px-3 py-1.5 rounded-full font-medium">Safe Mode</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Edit Content</h1>
          <p className="text-black/60 text-lg">Update text and images. Changes will be saved as drafts for review.</p>
        </div>

        <div className="space-y-12">
          {fields.map((field) => {
            const hasUnsavedChanges = localValues[field.id] !== (field.draftValue || field.value || "");
            const isSaving = savingField === field.id;

            return (
              <div key={field.id} className={`group relative transition-opacity ${field.isLocked ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-base font-medium flex items-center gap-2">
                    {field.label}
                    {field.isLocked && <span className="text-xs bg-black/5 px-2 py-0.5 rounded text-black/60 uppercase tracking-wider font-semibold">Locked</span>}
                  </Label>
                  {!field.isLocked && (
                    <Button 
                      size="sm" 
                      onClick={() => handleSave(field.id)}
                      disabled={!hasUnsavedChanges || isSaving}
                      className={`h-8 px-4 rounded-lg text-sm transition-all duration-300 ${
                        hasUnsavedChanges 
                          ? "bg-black text-white hover:bg-black/90 shadow-sm" 
                          : "bg-black/5 text-black/40"
                      }`}
                    >
                      {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                      Save Draft
                    </Button>
                  )}
                </div>

                <div className="relative">
                  {field.type === "text" && (
                    <Input
                      value={localValues[field.id] || ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      disabled={field.isLocked}
                      className="text-lg py-6 px-4 bg-white border-black/10 rounded-xl shadow-sm focus-visible:ring-black focus-visible:border-black disabled:bg-black/5"
                    />
                  )}
                  
                  {field.type === "richtext" && (
                    <Textarea
                      value={localValues[field.id] || ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      disabled={field.isLocked}
                      className="text-lg py-4 px-4 bg-white border-black/10 rounded-xl shadow-sm min-h-[160px] resize-y focus-visible:ring-black focus-visible:border-black disabled:bg-black/5 leading-relaxed"
                    />
                  )}

                  {field.type === "url" && (
                    <Input
                      type="url"
                      value={localValues[field.id] || ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      disabled={field.isLocked}
                      className="text-lg py-6 px-4 bg-white border-black/10 rounded-xl shadow-sm font-mono focus-visible:ring-black focus-visible:border-black disabled:bg-black/5"
                      placeholder="https://"
                    />
                  )}

                  {field.type === "image" && (
                    <div className="flex gap-4 items-start">
                      {localValues[field.id] && (
                        <div className="w-24 h-24 rounded-xl bg-black/5 border border-black/10 overflow-hidden shrink-0">
                          <img src={localValues[field.id]} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <Input
                        type="url"
                        value={localValues[field.id] || ""}
                        onChange={(e) => handleValueChange(field.id, e.target.value)}
                        disabled={field.isLocked}
                        className="text-lg py-6 px-4 bg-white border-black/10 rounded-xl shadow-sm font-mono focus-visible:ring-black focus-visible:border-black disabled:bg-black/5"
                        placeholder="Image URL"
                      />
                    </div>
                  )}

                  {field.type === "number" && (
                    <Input
                      type="number"
                      value={localValues[field.id] || ""}
                      onChange={(e) => handleValueChange(field.id, e.target.value)}
                      disabled={field.isLocked}
                      className="text-lg py-6 px-4 bg-white border-black/10 rounded-xl shadow-sm focus-visible:ring-black focus-visible:border-black disabled:bg-black/5 max-w-[200px]"
                    />
                  )}

                  {field.type === "boolean" && (
                    <div className="flex items-center h-12">
                      <Switch
                        checked={localValues[field.id] === "true"}
                        onCheckedChange={(checked) => handleValueChange(field.id, checked ? "true" : "false")}
                        disabled={field.isLocked}
                        className="data-[state=checked]:bg-black"
                      />
                      <span className="ml-3 text-lg font-medium">{localValues[field.id] === "true" ? "Yes" : "No"}</span>
                    </div>
                  )}

                  {field.draftValue && field.draftValue !== field.value && !hasUnsavedChanges && (
                    <div className="absolute -bottom-6 right-0 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                      Draft pending review
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

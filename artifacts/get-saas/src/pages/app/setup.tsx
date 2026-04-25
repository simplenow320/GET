import { useState } from "react";
import { useLocation, useParams } from "wouter";
import {
  useGetProject,
  useCreateContentField,
  useCreateInvite,
  useAddDomain,
  getGetProjectQueryKey
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Globe, Users, Database, ChevronRight } from "lucide-react";

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

  const [step, setStep] = useState(2);
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<any>("text");
  const [email, setEmail] = useState("");
  const [hostname, setHostname] = useState("");

  const handleAddField = () => {
    createFieldMutation.mutate({ projectId, data: { label: fieldLabel, type: fieldType } }, {
      onSuccess: () => setStep(3),
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  const handleInvite = () => {
    if (!email) { setStep(4); return; }
    createInviteMutation.mutate({ projectId, data: { email, role: "editor" } }, {
      onSuccess: () => setStep(4),
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  const handleAddDomain = () => {
    if (!hostname) { setLocation(`/app/projects/${projectId}`); return; }
    addDomainMutation.mutate({ projectId, data: { hostname } }, {
      onSuccess: () => { toast({ title: "Setup complete" }); setLocation(`/app/projects/${projectId}`); },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message }),
    });
  };

  const steps = [
    { id: 1, label: "Project created", icon: CheckCircle2, done: true },
    { id: 2, label: "Add a field", icon: Database, done: step > 2 },
    { id: 3, label: "Invite client", icon: Users, done: step > 3 },
    { id: 4, label: "Connect domain", icon: Globe, done: step > 4 },
  ];

  if (isLoading || !project) {
    return <AppLayout><div style={{ padding: 48, color: "rgba(26,26,46,0.4)", fontSize: 14 }}>Loading…</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "64px 24px" }}>

        {/* Step indicators */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 56 }}>
          {steps.map((s, idx) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", flex: idx < steps.length - 1 ? 1 : "unset" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: s.done || step === s.id ? "#1a1a2e" : "rgba(0,0,0,0.06)",
                  color: s.done || step === s.id ? "#fff" : "rgba(26,26,46,0.3)",
                  transition: "all 0.3s ease",
                }}>
                  {s.done ? <CheckCircle2 style={{ width: 15, height: 15 }} /> : <s.icon style={{ width: 15, height: 15 }} />}
                </div>
                <span style={{ fontSize: 11, fontWeight: 500, color: step === s.id || s.done ? "#1a1a2e" : "rgba(26,26,46,0.3)", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{ flex: 1, height: 1, background: step > s.id ? "#1a1a2e" : "rgba(0,0,0,0.08)", margin: "0 8px", marginBottom: 22, transition: "background 0.4s ease" }} />
              )}
            </div>
          ))}
        </div>

        {/* Step cards */}
        <div style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.06)", borderRadius: 22, padding: "40px 36px", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 21, fontWeight: 600, marginBottom: 6 }}>Map your first field</h2>
                <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>What should your client be able to edit first?</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label style={{ fontSize: 13, fontWeight: 500 }}>Field label</Label>
                <Input value={fieldLabel} onChange={e => setFieldLabel(e.target.value)} placeholder="e.g. Hero Headline" style={{ height: 44, borderRadius: 10, fontSize: 14 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label style={{ fontSize: 13, fontWeight: 500 }}>Field type</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger style={{ height: 44, borderRadius: 10, fontSize: 14 }}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text — single line</SelectItem>
                    <SelectItem value="richtext">Rich text — multi-line</SelectItem>
                    <SelectItem value="image">Image URL</SelectItem>
                    <SelectItem value="url">Link / URL</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Toggle — yes / no</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddField}
                disabled={!fieldLabel || createFieldMutation.isPending}
                style={{ height: 44, borderRadius: 10, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
              >
                {createFieldMutation.isPending ? "Saving…" : <>Continue <ChevronRight style={{ width: 15, height: 15 }} /></>}
              </Button>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 21, fontWeight: 600, marginBottom: 6 }}>Invite a client</h2>
                <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>Give someone access to edit the fields you mapped. You can skip this for now.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label style={{ fontSize: 13, fontWeight: 500 }}>Client email</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="client@example.com" type="email" style={{ height: 44, borderRadius: 10, fontSize: 14 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  variant="outline"
                  onClick={() => setStep(4)}
                  style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 400, border: "1px solid rgba(0,0,0,0.12)", background: "transparent", cursor: "pointer" }}
                >
                  Skip
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!email || createInviteMutation.isPending}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                >
                  {createInviteMutation.isPending ? "Sending…" : "Send invite"}
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <h2 style={{ fontSize: 21, fontWeight: 600, marginBottom: 6 }}>Connect a domain</h2>
                <p style={{ fontSize: 14, color: "rgba(26,26,46,0.5)", lineHeight: 1.6 }}>Where will this editor be embedded? Optional — you can add this later.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <Label style={{ fontSize: 13, fontWeight: 500 }}>Hostname</Label>
                <Input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="e.g. yoursite.com" style={{ height: 44, borderRadius: 10, fontSize: 14 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/app/projects/${projectId}`)}
                  style={{ flex: 1, height: 44, borderRadius: 10, fontSize: 14, fontWeight: 400, border: "1px solid rgba(0,0,0,0.12)", background: "transparent", cursor: "pointer" }}
                >
                  Skip
                </Button>
                <Button
                  onClick={handleAddDomain}
                  disabled={!hostname || addDomainMutation.isPending}
                  style={{ flex: 1, height: 44, borderRadius: 10, background: "#1a1a2e", color: "#fff", border: "none", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
                >
                  {addDomainMutation.isPending ? "Saving…" : "Finish setup"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

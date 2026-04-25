import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronRight, Globe, Users, Database } from "lucide-react";

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

  const [step, setStep] = useState(2); // Step 1 was creating the project

  // Step 2 State
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState<any>("text");

  // Step 3 State
  const [email, setEmail] = useState("");

  // Step 4 State
  const [hostname, setHostname] = useState("");

  const handleAddField = () => {
    createFieldMutation.mutate({
      projectId,
      data: { label: fieldLabel, type: fieldType }
    }, {
      onSuccess: () => {
        setStep(3);
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const handleInvite = () => {
    if (!email) {
      setStep(4);
      return;
    }
    createInviteMutation.mutate({
      projectId,
      data: { email, role: "editor" }
    }, {
      onSuccess: () => {
        setStep(4);
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const handleAddDomain = () => {
    if (!hostname) {
      setLocation(`/app/projects/${projectId}`);
      return;
    }
    addDomainMutation.mutate({
      projectId,
      data: { hostname }
    }, {
      onSuccess: () => {
        toast({ title: "Setup Complete!" });
        setLocation(`/app/projects/${projectId}`);
      },
      onError: (err) => toast({ variant: "destructive", title: "Error", description: err.message })
    });
  };

  const steps = [
    { id: 1, label: "Project Created", icon: CheckCircle2, completed: true },
    { id: 2, label: "Add Content", icon: Database, completed: step > 2 },
    { id: 3, label: "Invite Client", icon: Users, completed: step > 3 },
    { id: 4, label: "Connect Domain", icon: Globe, completed: step > 4 },
  ];

  if (isLoading || !project) {
    return <AppLayout><div className="p-10">Loading setup...</div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 md:p-10 max-w-4xl mx-auto min-h-[calc(100vh-80px)] flex flex-col justify-center">
        <div className="mb-12">
          <h1 className="text-3xl font-semibold tracking-tight text-center mb-8">Set up {project.name}</h1>
          
          <div className="flex items-center justify-between relative max-w-2xl mx-auto">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-black/5 -z-10" />
            <div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-black transition-all duration-500 ease-in-out -z-10" 
              style={{ width: `${((step - 1) / 3) * 100}%` }}
            />
            
            {steps.map((s) => {
              const isCurrent = step === s.id;
              const isCompleted = s.completed;
              return (
                <div key={s.id} className="flex flex-col items-center gap-3 bg-white px-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                    isCompleted ? 'bg-black border-black text-white' :
                    isCurrent ? 'bg-white border-black text-black' :
                    'bg-white border-black/10 text-black/20'
                  }`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                  </div>
                  <span className={`text-xs font-medium uppercase tracking-wider ${
                    isCurrent || isCompleted ? 'text-black' : 'text-black/40'
                  }`}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="max-w-xl mx-auto w-full">
          {step === 2 && (
            <Card className="rounded-3xl border-black/[0.04] shadow-xl shadow-black/5">
              <CardHeader className="text-center pt-10">
                <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Database className="w-8 h-8 text-black" />
                </div>
                <CardTitle className="text-2xl">Map your first field</CardTitle>
                <CardDescription className="text-base mt-2">
                  What should your client be able to edit first?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-10 pb-10">
                <div className="space-y-2">
                  <Label>Field Label</Label>
                  <Input 
                    value={fieldLabel} 
                    onChange={e => setFieldLabel(e.target.value)} 
                    placeholder="e.g. Hero Headline" 
                    className="rounded-xl h-12 text-lg" 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select value={fieldType} onValueChange={setFieldType}>
                    <SelectTrigger className="rounded-xl h-12 text-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text (Single Line)</SelectItem>
                      <SelectItem value="richtext">Rich Text (Multi-line)</SelectItem>
                      <SelectItem value="image">Image</SelectItem>
                      <SelectItem value="url">URL / Link</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="boolean">Toggle (Yes/No)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleAddField} 
                  disabled={!fieldLabel || createFieldMutation.isPending} 
                  className="w-full bg-black text-white hover:bg-black/90 rounded-xl h-12 text-lg mt-4"
                >
                  {createFieldMutation.isPending ? "Saving..." : "Continue"} <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="rounded-3xl border-black/[0.04] shadow-xl shadow-black/5">
              <CardHeader className="text-center pt-10">
                <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-black" />
                </div>
                <CardTitle className="text-2xl">Invite a client</CardTitle>
                <CardDescription className="text-base mt-2">
                  Give someone access to edit the fields you map.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-10 pb-10">
                <div className="space-y-2">
                  <Label>Client Email</Label>
                  <Input 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="client@example.com" 
                    className="rounded-xl h-12 text-lg" 
                  />
                  <p className="text-sm text-black/50">You can also skip this and do it later.</p>
                </div>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setStep(4)} className="flex-1 rounded-xl h-12 text-lg border-black/10">Skip</Button>
                  <Button 
                    onClick={handleInvite} 
                    disabled={createInviteMutation.isPending || !email} 
                    className="flex-1 bg-black text-white hover:bg-black/90 rounded-xl h-12 text-lg"
                  >
                    {createInviteMutation.isPending ? "Sending..." : "Send Invite"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="rounded-3xl border-black/[0.04] shadow-xl shadow-black/5">
              <CardHeader className="text-center pt-10">
                <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Globe className="w-8 h-8 text-black" />
                </div>
                <CardTitle className="text-2xl">Connect a domain</CardTitle>
                <CardDescription className="text-base mt-2">
                  Where will this editor be embedded? (Optional)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 px-10 pb-10">
                <div className="space-y-2">
                  <Label>Hostname</Label>
                  <Input 
                    value={hostname} 
                    onChange={e => setHostname(e.target.value)} 
                    placeholder="e.g. yoursite.com" 
                    className="rounded-xl h-12 text-lg" 
                  />
                </div>
                <div className="flex gap-3 mt-4">
                  <Button variant="outline" onClick={() => setLocation(`/app/projects/${projectId}`)} className="flex-1 rounded-xl h-12 text-lg border-black/10">Skip</Button>
                  <Button 
                    onClick={handleAddDomain} 
                    disabled={addDomainMutation.isPending || !hostname} 
                    className="flex-1 bg-black text-white hover:bg-black/90 rounded-xl h-12 text-lg"
                  >
                    {addDomainMutation.isPending ? "Saving..." : "Finish Setup"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

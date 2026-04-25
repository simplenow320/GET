import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, RequireAuth } from "@/components/auth-context";

import LandingPage from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/app/dashboard";
import Projects from "@/pages/app/projects";
import ProjectDetail from "@/pages/app/project-detail";
import SetupWizard from "@/pages/app/setup";
import ClientEditor from "@/pages/app/editor";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />

      {/* Authenticated Routes */}
      <Route path="/app/dashboard">
        <RequireAuth><Dashboard /></RequireAuth>
      </Route>
      <Route path="/app/projects">
        <RequireAuth><Projects /></RequireAuth>
      </Route>
      <Route path="/app/projects/:projectId">
        <RequireAuth><ProjectDetail /></RequireAuth>
      </Route>
      <Route path="/app/setup/:projectId">
        <RequireAuth><SetupWizard /></RequireAuth>
      </Route>
      <Route path="/app/editor/:projectId">
        <RequireAuth><ClientEditor /></RequireAuth>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

import { createContext, useContext, useEffect, ReactNode } from "react";
import { useGetMe } from "@workspace/api-client-react";
import { User } from "@workspace/api-client-react/src/generated/api.schemas";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null | undefined;
  isLoading: boolean;
  error: Error | null;
}

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  isLoading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
    }
  });

  return (
    <AuthContext.Provider value={{ user, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, error } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

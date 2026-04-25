import { createContext, useContext, useEffect, ReactNode } from "react";
import { useGetMe, ApiError, getGetMeQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";
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
    query: { retry: false, queryKey: getGetMeQueryKey() },
  });

  // Only clear the stored token when the server explicitly rejects it (401).
  // Network errors, 5xx, or CORS hiccups must NOT log the user out — those are
  // transient and the existing session may still be valid on retry.
  useEffect(() => {
    if (
      error &&
      error instanceof ApiError &&
      error.status === 401 &&
      typeof window !== "undefined"
    ) {
      localStorage.removeItem("auth_token");
    }
  }, [error]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
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

  if (!user) return null;

  return <>{children}</>;
}

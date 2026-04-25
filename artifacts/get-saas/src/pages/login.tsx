import { useEffect, useRef } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { BRAND, tone, type, inputStyle, labelStyle, PrimaryButton, BrandLogo, PasswordInput } from "@/lib/ui";
import { GoogleSignInButton, OrDivider } from "@/components/google-sign-in-button";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

function readNextParam(): string | null {
  if (typeof window === "undefined") return null;
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

// Friendly messages for the `?error=` codes our Google OAuth callback
// redirects with. The codes themselves are stable and safe to surface; we
// translate to copy here so the route handler can stay terse.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_cancelled: "Sign-in was cancelled. You can try again any time.",
  oauth_state:
    "Your sign-in session expired or was blocked. Please try again — make sure third-party cookies are allowed.",
  oauth_exchange:
    "Couldn't finish signing in with Google. Please try again in a moment.",
  oauth_unverified:
    "Your Google account email isn't verified. Verify it with Google and try again.",
  oauth_unavailable:
    "Sign-in with Google isn't available right now. Please use email and password.",
  oauth_conflict:
    "This email is already linked to a different Google account. Sign in with email and password, then link Google from your account settings.",
};

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Surface OAuth callback errors as a toast and strip the param so a
  // refresh doesn't replay the message.
  //
  // Three subtleties to get right:
  //   1. The global <Toaster/> registers its listener inside *its own* effect,
  //      which on a fresh mount runs AFTER this one (sibling-effect order).
  //      So we defer the toast() call by one tick.
  //   2. Calling replaceState below changes wouter's `search`, re-runs this
  //      effect, and would normally fire the previous cleanup — which would
  //      cancel the deferred toast. We avoid that by NOT returning a cleanup
  //      and instead deduping with a ref so each error code only ever fires
  //      one toast over this component's lifetime.
  //   3. We also strip the URL param INSIDE the deferred callback so the
  //      `search` change can't race ahead of the toast dispatch.
  const search = useSearch();
  const handledErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const code = params.get("error");
    if (!code) return;
    if (handledErrorRef.current === code) return;
    const message = OAUTH_ERROR_MESSAGES[code];
    if (!message) return;
    handledErrorRef.current = code;
    setTimeout(() => {
      toast({ variant: "destructive", title: "Sign-in failed", description: message });
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: async () => {
          // Auth lives in an httpOnly session cookie set by the API.
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          const next = readNextParam();
          setLocation(next ?? "/app/dashboard");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Login failed",
            description: error.message || "Please check your credentials and try again.",
          });
        },
      }
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: BRAND.paper,
        color: BRAND.ink,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "center" }}>
          <BrandLogo width={140} />
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              marginBottom: 8,
              lineHeight: 1.2,
            }}
          >
            Welcome back
          </h1>
          <p style={{ fontSize: type.md, color: tone[600], lineHeight: 1.55 }}>
            Sign in to manage your projects.
          </p>
        </div>

        <GoogleSignInButton next={readNextParam() ?? undefined} />
        <OrDivider />

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Email</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="you@example.com"
                      autoComplete="email"
                      style={inputStyle}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage style={{ fontSize: type.xs }} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <FormLabel style={labelStyle}>Password</FormLabel>
                    <Link
                      href="/forgot-password"
                      style={{
                        fontSize: type.xs,
                        color: tone[600],
                        textDecoration: "none",
                        fontWeight: 500,
                      }}
                    >
                      Forgot?
                    </Link>
                  </div>
                  <FormControl>
                    <PasswordInput
                      placeholder="••••••••"
                      autoComplete="current-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage style={{ fontSize: type.xs }} />
                </FormItem>
              )}
            />

            <PrimaryButton
              type="submit"
              size="lg"
              block
              loading={loginMutation.isPending}
              style={{ marginTop: 6 }}
            >
              {loginMutation.isPending ? (
                <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
              ) : (
                "Sign in"
              )}
            </PrimaryButton>
          </form>
        </Form>

        <p
          style={{
            textAlign: "center",
            marginTop: 28,
            fontSize: type.base,
            color: tone[600],
          }}
        >
          New here?{" "}
          <Link
            href="/signup"
            style={{ color: BRAND.ink, fontWeight: 600, textDecoration: "none" }}
          >
            Create an account
          </Link>
        </p>

        <p
          style={{
            textAlign: "center",
            marginTop: 14,
            fontSize: type.sm,
          }}
        >
          <Link
            href="/"
            style={{ color: tone[500], textDecoration: "none" }}
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}

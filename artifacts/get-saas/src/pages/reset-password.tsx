import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  BRAND, tone, type, labelStyle, PrimaryButton, BrandLogo, PasswordInput,
} from "@/lib/ui";

const schema = z.object({
  password: z.string().min(8, "At least 8 characters"),
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ResetPassword() {
  const [, params] = useRoute("/reset-password/:token");
  const token = params?.token ?? "";
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    if (!token) {
      toast({
        variant: "destructive",
        title: "Missing reset token",
        description: "This link is incomplete. Request a new one.",
      });
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`${BASE}/api/auth/reset-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast({
          variant: "destructive",
          title: "Couldn't reset password",
          description: body?.error || "This link may have expired. Request a new one.",
        });
        setSubmitting(false);
        return;
      }
      // Reset invalidates all sessions for this user, so the cookie (if any)
      // is now pointing at a deleted session. Refresh /me to reflect that.
      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSuccess(true);
    } catch {
      toast({
        variant: "destructive",
        title: "Network error",
        description: "Please try again in a moment.",
      });
      setSubmitting(false);
    }
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

        {success ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: tone[100],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ShieldCheck style={{ width: 26, height: 26, color: BRAND.ink }} />
              </div>
            </div>
            <h1 style={{ fontSize: type.xl, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.015em" }}>
              Password updated
            </h1>
            <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.6, marginBottom: 26 }}>
              All your existing sessions have been signed out. Sign back in with
              your new password.
            </p>
            <PrimaryButton block size="lg" onClick={() => setLocation("/login")}>
              Sign in
            </PrimaryButton>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <h1
                style={{
                  fontSize: type.display,
                  fontWeight: 600,
                  letterSpacing: "-0.025em",
                  lineHeight: 1.15,
                  marginBottom: 8,
                }}
              >
                Choose a new password
              </h1>
              <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.55 }}>
                Pick something at least 8 characters. We'll sign out your other devices.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={labelStyle}>New password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          {...field}
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <PrimaryButton type="submit" block size="lg" disabled={submitting || !token}>
                  {submitting ? (
                    <>
                      <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Update password"
                  )}
                </PrimaryButton>
              </form>
            </Form>

            <p style={{ fontSize: type.sm, color: tone[600], textAlign: "center", marginTop: 24 }}>
              <Link
                href="/login"
                style={{ color: BRAND.ink, fontWeight: 600, textDecoration: "none" }}
              >
                ← Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

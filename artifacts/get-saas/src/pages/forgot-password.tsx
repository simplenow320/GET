import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MailCheck } from "lucide-react";
import {
  BRAND, tone, type, inputStyle, labelStyle, PrimaryButton, BrandLogo,
} from "@/lib/ui";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function ForgotPassword() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSubmitting(true);
    try {
      // We deliberately ignore the response shape — the API always returns 200
      // with the same body to prevent email enumeration. Render the same
      // confirmation regardless.
      await fetch(`${BASE}/api/auth/forgot-password`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setSubmitted(true);
    } catch {
      toast({
        variant: "destructive",
        title: "Couldn't send reset email",
        description: "Please check your connection and try again.",
      });
    } finally {
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

        {submitted ? (
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
                <MailCheck style={{ width: 26, height: 26, color: BRAND.ink }} />
              </div>
            </div>
            <h1 style={{ fontSize: type.xl, fontWeight: 600, marginBottom: 10, letterSpacing: "-0.015em" }}>
              Check your inbox
            </h1>
            <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.6, marginBottom: 26 }}>
              If an account exists for that email, we've sent a link to reset your password.
              The link will expire in one hour.
            </p>
            <Link
              href="/login"
              style={{
                color: BRAND.ink,
                fontSize: type.sm,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              ← Back to sign in
            </Link>
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
                Forgot your password?
              </h1>
              <p style={{ fontSize: type.sm, color: tone[600], lineHeight: 1.55 }}>
                Enter your email and we'll send you a link to reset it.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel style={labelStyle}>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          style={inputStyle}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <PrimaryButton type="submit" block size="lg" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send reset link"
                  )}
                </PrimaryButton>
              </form>
            </Form>

            <p style={{ fontSize: type.sm, color: tone[600], textAlign: "center", marginTop: 24 }}>
              Remembered it?{" "}
              <Link
                href="/login"
                style={{ color: BRAND.ink, fontWeight: 600, textDecoration: "none" }}
              >
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

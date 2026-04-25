import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useSignup, getGetMeQueryKey } from "@workspace/api-client-react";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { BRAND, tone, type, inputStyle, labelStyle, PrimaryButton, BrandLogo } from "@/lib/ui";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "At least 8 characters"),
});

function readQueryParams(): { next: string | null; email: string | null } {
  if (typeof window === "undefined") return { next: null, email: null };
  const sp = new URLSearchParams(window.location.search);
  const next = sp.get("next");
  const email = sp.get("email");
  return {
    next: next && next.startsWith("/") && !next.startsWith("//") ? next : null,
    email: email || null,
  };
}

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const signupMutation = useSignup();
  const queryClient = useQueryClient();

  const params = readQueryParams();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: params.email ?? "", password: "" },
  });

  function onSubmit(values: z.infer<typeof signupSchema>) {
    signupMutation.mutate(
      { data: values },
      {
        onSuccess: async (data: any) => {
          if (data?.token) localStorage.setItem("auth_token", data.token);
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation(params.next ?? "/app/dashboard");
        },
        onError: (error) => {
          toast({
            variant: "destructive",
            title: "Signup failed",
            description: error.message || "An error occurred during signup.",
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
          <Link href="/">
            <span style={{ cursor: "pointer", display: "inline-block" }}>
              <BrandLogo width={140} />
            </span>
          </Link>
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
            Create your account
          </h1>
          <p style={{ fontSize: type.md, color: tone[600], lineHeight: 1.55 }}>
            Set up safe client editing in minutes.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Your name</FormLabel>
                  <FormControl>
                    <Input placeholder="Jane Doe" autoComplete="name" style={inputStyle} {...field} />
                  </FormControl>
                  <FormMessage style={{ fontSize: type.xs }} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="you@example.com" autoComplete="email" style={inputStyle} {...field} />
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
                  <FormLabel style={labelStyle}>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      style={inputStyle}
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
              loading={signupMutation.isPending}
              style={{ marginTop: 6 }}
            >
              {signupMutation.isPending ? (
                <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" />
              ) : (
                "Create account"
              )}
            </PrimaryButton>
          </form>
        </Form>

        <p style={{ textAlign: "center", marginTop: 28, fontSize: type.base, color: tone[600] }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: BRAND.ink, fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

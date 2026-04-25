import { Link, useLocation } from "wouter";
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
import { BRAND, tone, type, inputStyle, labelStyle, PrimaryButton, Wordmark } from "@/lib/ui";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: values },
      {
        onSuccess: async (data: any) => {
          if (data?.token) localStorage.setItem("auth_token", data.token);
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation("/app/dashboard");
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
        <div style={{ marginBottom: 32 }}>
          <Link href="/">
            <span style={{ cursor: "pointer", display: "inline-flex" }}>
              <Wordmark size={22} />
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
            Welcome back
          </h1>
          <p style={{ fontSize: type.md, color: tone[600], lineHeight: 1.55 }}>
            Sign in to manage your projects.
          </p>
        </div>

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
                  <FormLabel style={labelStyle}>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
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
      </div>
    </div>
  );
}

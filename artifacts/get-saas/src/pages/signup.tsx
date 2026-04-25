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

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const C = "#1a1a2e";
const BG = "#faf9f6";

const inputStyle: React.CSSProperties = {
  height: 48, padding: "0 14px", borderRadius: 12,
  border: `1px solid ${C}1a`, background: "#fff", fontSize: 15,
};
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: `${C}b3` };

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const signupMutation = useSignup();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  function onSubmit(values: z.infer<typeof signupSchema>) {
    signupMutation.mutate(
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
            title: "Signup failed",
            description: error.message || "An error occurred during signup.",
          });
        },
      }
    );
  }

  return (
    <div style={{
      minHeight: "100dvh", background: BG, color: C,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "32px 24px",
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{
            fontSize: 28, fontWeight: 700, letterSpacing: "-0.025em",
            marginBottom: 8, lineHeight: 1.2,
          }}>
            Create account
          </h1>
          <p style={{ fontSize: 15, color: `${C}80`, lineHeight: 1.55 }}>
            Set up safe client editing in minutes.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Name</FormLabel>
                  <FormControl><Input placeholder="Jane Doe" autoComplete="name" style={inputStyle} {...field} /></FormControl>
                  <FormMessage style={{ fontSize: 12.5 }} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Email</FormLabel>
                  <FormControl><Input placeholder="you@example.com" autoComplete="email" style={inputStyle} {...field} /></FormControl>
                  <FormMessage style={{ fontSize: 12.5 }} />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel style={labelStyle}>Password</FormLabel>
                  <FormControl><Input type="password" placeholder="••••••••" autoComplete="new-password" style={inputStyle} {...field} /></FormControl>
                  <FormMessage style={{ fontSize: 12.5 }} />
                </FormItem>
              )}
            />

            <button
              type="submit"
              disabled={signupMutation.isPending}
              style={{
                marginTop: 6, height: 48, borderRadius: 12,
                background: C, color: BG, border: "none",
                fontSize: 15, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "opacity 0.25s cubic-bezier(0.4,0,0.2,1)",
                opacity: signupMutation.isPending ? 0.7 : 1,
              }}
            >
              {signupMutation.isPending ? <Loader2 style={{ width: 18, height: 18 }} className="animate-spin" /> : "Create account"}
            </button>
          </form>
        </Form>

        <p style={{ textAlign: "center", marginTop: 32, fontSize: 14, color: `${C}80` }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: C, fontWeight: 600, textDecoration: "none" }}>
            Sign in
          </Link>
        </p>

      </div>
    </div>
  );
}

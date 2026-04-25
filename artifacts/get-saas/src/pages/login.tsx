import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import mascotPath from "@assets/B56BFD2D-C1F8-4FD4-92D3-52BF5E977238_1777091776546.png";

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
    defaultValues: {
      email: "",
      password: "",
    },
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
    <div className="min-h-[100dvh] bg-[#faf9f6] flex flex-col items-center justify-center p-4 selection:bg-[#FFD747] selection:text-[#1a1a2e]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 p-8 md:p-12">
        <div className="flex flex-col items-center mb-10">
          <Link href="/">
            <img src={mascotPath} alt="get mascot" className="w-16 h-16 mb-6 cursor-pointer hover:scale-105 transition-transform" />
          </Link>
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-2">Welcome back</h1>
          <p className="text-[#1a1a2e]/60 text-center">Sign in to your account to manage your projects.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#1a1a2e] font-medium">Email address</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="you@example.com" 
                      className="h-12 px-4 rounded-xl border-black/10 focus-visible:ring-[#FFD747] focus-visible:border-[#FFD747] bg-[#faf9f6]/50"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-[#1a1a2e] font-medium">Password</FormLabel>
                  </div>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="h-12 px-4 rounded-xl border-black/10 focus-visible:ring-[#FFD747] focus-visible:border-[#FFD747] bg-[#faf9f6]/50"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl bg-[#1a1a2e] hover:bg-[#1a1a2e]/90 text-white font-medium text-lg mt-2"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center mt-8 text-[#1a1a2e]/60">
          Don't have an account?{" "}
          <Link href="/signup" className="text-[#1a1a2e] font-semibold hover:underline decoration-[#FFD747] decoration-2 underline-offset-2">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

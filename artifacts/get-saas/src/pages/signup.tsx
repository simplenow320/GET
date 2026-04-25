import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useSignup } from "@workspace/api-client-react";
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

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export default function Signup() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const signupMutation = useSignup();

  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof signupSchema>) {
    signupMutation.mutate(
      { data: values },
      {
        onSuccess: () => {
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
    <div className="min-h-[100dvh] bg-[#faf9f6] flex flex-col items-center justify-center p-4 selection:bg-[#FFD747] selection:text-[#1a1a2e]">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-black/5 border border-black/5 p-8 md:p-12">
        <div className="flex flex-col items-center mb-10">
          <Link href="/">
            <img src={mascotPath} alt="get mascot" className="w-16 h-16 mb-6 cursor-pointer hover:scale-105 transition-transform" />
          </Link>
          <h1 className="text-3xl font-bold text-[#1a1a2e] mb-2">Create an account</h1>
          <p className="text-[#1a1a2e]/60 text-center">Start giving your clients the keys, safely.</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[#1a1a2e] font-medium">Full name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Jane Doe" 
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
                  <FormLabel className="text-[#1a1a2e] font-medium">Password</FormLabel>
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
              disabled={signupMutation.isPending}
            >
              {signupMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center mt-8 text-[#1a1a2e]/60">
          Already have an account?{" "}
          <Link href="/login" className="text-[#1a1a2e] font-semibold hover:underline decoration-[#FFD747] decoration-2 underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

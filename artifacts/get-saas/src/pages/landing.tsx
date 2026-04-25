import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import logoHeroPath from "@assets/IMG_6687_1777091776547.jpeg";

export default function LandingPage() {
  return (
    <div
      className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-24"
      style={{ backgroundColor: "#faf9f6", color: "#1a1a2e" }}
    >
      <div className="w-full max-w-xl flex flex-col items-center text-center gap-12">

        <img
          src={logoHeroPath}
          alt="get — Let clients edit your app without breaking it."
          className="w-full max-w-md"
          style={{ transition: "opacity 0.4s ease" }}
        />

        <p
          className="text-lg leading-relaxed max-w-sm"
          style={{ color: "#1a1a2e", opacity: 0.65 }}
        >
          Build your app in Replit. Connect get. Let your client update content
          themselves — without ever touching your code.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Link href="/signup">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full px-8 h-12 text-base font-medium"
              style={{
                backgroundColor: "#1a1a2e",
                color: "#faf9f6",
                transition: "opacity 0.2s ease",
              }}
            >
              Get started free
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto rounded-full px-8 h-12 text-base font-medium"
              style={{
                color: "#1a1a2e",
                opacity: 0.55,
                transition: "opacity 0.2s ease",
              }}
            >
              Sign in
            </Button>
          </Link>
        </div>

        <div className="w-full border-t pt-12 mt-4 flex flex-col gap-6" style={{ borderColor: "#1a1a2e11" }}>
          {[
            {
              title: "Safe editing",
              body: "Clients update only the content you allow. Layouts, styles, and logic stay yours.",
            },
            {
              title: "Visual and simple",
              body: "No code, no confusion. Clients see a clean editor that just works.",
            },
            {
              title: "Fast to install",
              body: "A few lines of setup. Works with any Replit-built app.",
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-1 text-left">
              <span className="text-sm font-semibold tracking-wide" style={{ color: "#1a1a2e" }}>
                {item.title}
              </span>
              <span className="text-sm leading-relaxed" style={{ color: "#1a1a2e", opacity: 0.55 }}>
                {item.body}
              </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

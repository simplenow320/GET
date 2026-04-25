import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import logoHeroPath from "@assets/IMG_6687_1777091776547.jpeg";

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-[#faf9f6] text-[#1a1a2e] font-sans selection:bg-[#FFD747] selection:text-[#1a1a2e]">
      <main className="max-w-6xl mx-auto px-6 py-20 md:py-32 flex flex-col items-center text-center">
        
        <div className="mb-12 relative w-full max-w-2xl mx-auto aspect-video rounded-3xl overflow-hidden shadow-2xl shadow-black/5 hover-elevate transition-transform duration-500 hover:scale-[1.02]">
          <img 
            src={logoHeroPath} 
            alt="get - Let clients edit your app without breaking it" 
            className="w-full h-full object-cover object-center"
          />
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 max-w-4xl text-balance">
          Give them the keys.<br/>Keep the engine safe.
        </h1>
        
        <p className="text-xl md:text-2xl text-[#1a1a2e]/70 mb-10 max-w-2xl leading-relaxed">
          The white-label content editor SDK for vibe coders. Build your app in Replit, let your clients edit the copy safely.
        </p>

        <div className="flex flex-col sm:flex-row gap-4">
          <Link href="/signup">
            <Button size="lg" className="bg-[#1a1a2e] text-[#faf9f6] hover:bg-[#1a1a2e]/90 text-lg px-8 h-14 rounded-full font-medium shadow-lg hover:-translate-y-1 transition-all duration-300">
              Start building for free
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="bg-transparent border-[#1a1a2e]/10 text-[#1a1a2e] hover:bg-[#1a1a2e]/5 text-lg px-8 h-14 rounded-full font-medium transition-all duration-300">
              Sign in
            </Button>
          </Link>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 w-full text-left">
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-black/5 border border-black/5">
            <div className="w-12 h-12 bg-[#FFD747]/20 rounded-2xl flex items-center justify-center mb-6 text-2xl">🛡️</div>
            <h3 className="text-xl font-semibold mb-3">Bulletproof Editing</h3>
            <p className="text-[#1a1a2e]/70 leading-relaxed">Clients can only touch exactly what you map out. No broken layouts, no missing closing tags, just content.</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-black/5 border border-black/5">
            <div className="w-12 h-12 bg-[#FFD747]/20 rounded-2xl flex items-center justify-center mb-6 text-2xl">✨</div>
            <h3 className="text-xl font-semibold mb-3">White-label Magic</h3>
            <p className="text-[#1a1a2e]/70 leading-relaxed">Your clients see a beautiful, serene editor on your domain. They think you built a custom CMS just for them.</p>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-xl shadow-black/5 border border-black/5">
            <div className="w-12 h-12 bg-[#FFD747]/20 rounded-2xl flex items-center justify-center mb-6 text-2xl">⚡</div>
            <h3 className="text-xl font-semibold mb-3">Vibe Coder Ready</h3>
            <p className="text-[#1a1a2e]/70 leading-relaxed">Built specifically for the Replit ecosystem. Drop in the SDK, map your fields, and ship faster.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

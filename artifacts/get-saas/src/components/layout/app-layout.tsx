import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, FolderKanban, Settings, LogOut, Menu } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/login");
      }
    });
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/app/dashboard" },
    { icon: FolderKanban, label: "Projects", href: "/app/projects" },
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#fafafa] border-r border-black/[0.04]">
      <div className="p-6">
        <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center text-black/60 font-semibold tracking-tighter">
          gt
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                  isActive
                    ? "bg-white shadow-sm shadow-black/[0.02] text-black font-medium border border-black/[0.04]"
                    : "text-black/60 hover:bg-black/5 hover:text-black"
                }`}
              >
                <item.icon className={`w-4 h-4 ${isActive ? "text-black" : "text-black/40"}`} />
                <span className="text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-black/[0.04]">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl cursor-pointer transition-colors text-black/60 hover:bg-black/5 hover:text-black text-left"
        >
          <LogOut className="w-4 h-4 text-black/40" />
          <span className="text-sm">Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-white flex w-full font-sans text-[#111]">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 flex-col fixed inset-y-0 z-50">
        <SidebarContent />
      </div>

      {/* Mobile Header & Main Content */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        <div className="md:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-black/[0.04] p-4 flex items-center justify-between">
          <div className="w-8 h-8 bg-black/5 rounded-lg flex items-center justify-center text-black/60 font-semibold tracking-tighter">
            gt
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-black/60">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r-0">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

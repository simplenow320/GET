import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, FolderOpen, LogOut, Menu } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutGrid, label: "Overview", href: "/app/dashboard" },
  { icon: FolderOpen, label: "Projects", href: "/app/projects" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        localStorage.removeItem("auth_token");
        setLocation("/login");
      },
    });
  };

  const SidebarContent = () => (
    <div
      className="flex flex-col h-full"
      style={{ background: "#f8f8f7", borderRight: "1px solid rgba(0,0,0,0.05)" }}
    >
      <div style={{ height: 72 }} />

      <nav style={{ flex: 1, padding: "0 12px" }}>
        {navItems.map((item) => {
          const isActive =
            location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 10,
                  marginBottom: 2,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  background: isActive ? "#fff" : "transparent",
                  boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
                  border: isActive ? "1px solid rgba(0,0,0,0.05)" : "1px solid transparent",
                  color: isActive ? "#1a1a2e" : "rgba(26,26,46,0.5)",
                }}
              >
                <item.icon
                  style={{
                    width: 15,
                    height: 15,
                    color: isActive ? "#1a1a2e" : "rgba(26,26,46,0.35)",
                  }}
                />
                <span style={{ fontSize: 13.5, fontWeight: isActive ? 500 : 400 }}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "16px 12px", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 12px",
            borderRadius: 10,
            width: "100%",
            cursor: "pointer",
            background: "transparent",
            border: "none",
            color: "rgba(26,26,46,0.4)",
            transition: "background 0.15s ease, color 0.15s ease",
            fontSize: 13.5,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.04)";
            (e.currentTarget as HTMLElement).style.color = "#1a1a2e";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "rgba(26,26,46,0.4)";
          }}
        >
          <LogOut style={{ width: 15, height: 15 }} />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-[100dvh] flex w-full font-sans"
      style={{ background: "#faf9f6", color: "#1a1a2e" }}
    >
      {/* Desktop Sidebar */}
      <div className="hidden md:flex" style={{ width: 220, flexShrink: 0 }}>
        <div style={{ width: 220, position: "fixed", top: 0, bottom: 0 }}>
          <SidebarContent />
        </div>
      </div>

      {/* Mobile header */}
      <div
        className="md:hidden sticky top-0 z-40 flex items-center justify-end px-5"
        style={{
          height: 56,
          background: "rgba(250,249,246,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(0,0,0,0.05)",
        }}
      >
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              style={{ color: "rgba(26,26,46,0.5)" }}
            >
              <Menu style={{ width: 18, height: 18 }} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r-0" style={{ width: 220 }}>
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-0" style={{ marginLeft: 0 }}>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { LayoutGrid, FolderOpen, LogOut, Menu } from "lucide-react";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BRAND, tone, line, type, ease, IconTile } from "@/lib/ui";

// Brand rule: the authenticated product UI is white-label.
// Do NOT import or render any get branding (logo, mascot, wordmark) here.

interface AppLayoutProps {
  children: ReactNode;
}

const navItems = [
  { icon: LayoutGrid, label: "Overview", href: "/app/dashboard" },
  { icon: FolderOpen, label: "Projects", href: "/app/projects" },
];

function currentSectionLabel(location: string) {
  const item = navItems.find(
    (n) => location === n.href || location.startsWith(n.href + "/")
  );
  return item?.label ?? "";
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const logoutMutation = useLogout();
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        // Server clears the httpOnly cookie; nothing for us to wipe locally.
        setLocation("/login");
      },
    });
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: BRAND.paper, borderRight: `1px solid ${line.soft}` }}
    >
      <div
        style={{
          height: 64,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Link href="/app/dashboard">
          <span
            onClick={onNavigate}
            style={{
              cursor: "pointer",
              fontSize: type.xs,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: tone[500],
            }}
          >
            Workspace
          </span>
        </Link>
      </div>

      <nav style={{ flex: 1, padding: "8px 12px" }}>
        {navItems.map((item) => {
          const isActive =
            location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={onNavigate}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "8px 10px",
                  borderRadius: 12,
                  marginBottom: 2,
                  cursor: "pointer",
                  transition: `background 0.15s ${ease}, color 0.15s ${ease}`,
                  background: isActive ? BRAND.surface : "transparent",
                  boxShadow: isActive ? "0 1px 2px rgba(26,26,46,0.06)" : "none",
                  border: isActive
                    ? `1px solid ${line.faint}`
                    : "1px solid transparent",
                  color: isActive ? BRAND.ink : tone[700],
                }}
              >
                <IconTile icon={item.icon} variant={isActive ? "ink" : "soft"} size={28} />
                <span style={{ fontSize: type.base, fontWeight: isActive ? 600 : 500 }}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: "12px", borderTop: `1px solid ${line.faint}` }}>
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            padding: "10px 12px",
            borderRadius: 10,
            width: "100%",
            cursor: "pointer",
            background: "transparent",
            border: "none",
            color: tone[500],
            transition: `background 0.15s ${ease}, color 0.15s ${ease}`,
            fontSize: type.base,
            fontWeight: 500,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = tone[100];
            (e.currentTarget as HTMLElement).style.color = BRAND.ink;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = tone[500];
          }}
        >
          <LogOut style={{ width: 16, height: 16 }} />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const sectionLabel = currentSectionLabel(location);

  return (
    <div
      className="min-h-[100dvh] flex w-full font-sans"
      style={{ background: BRAND.paper, color: BRAND.ink }}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex" style={{ width: 224, flexShrink: 0 }}>
        <div style={{ width: 224, position: "fixed", top: 0, bottom: 0 }}>
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile header */}
      <div
        className="md:hidden sticky top-0 z-40 flex items-center justify-between px-5"
        style={{
          height: 56,
          background: "rgba(250,249,246,0.9)",
          backdropFilter: "blur(14px)",
          borderBottom: `1px solid ${line.faint}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              fontSize: type.base,
              fontWeight: 600,
              color: BRAND.ink,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sectionLabel || "Workspace"}
          </span>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              style={{ color: tone[600] }}
            >
              <Menu style={{ width: 18, height: 18 }} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 border-r-0" style={{ width: 224 }}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetContentInner />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

// Wrapper to keep sheet content tied to its own location updates without re-render issues
function SheetContentInner() {
  return <SidebarContent />;
}

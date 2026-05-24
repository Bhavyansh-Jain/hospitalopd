import { Link, useLocation } from "wouter";
import { LayoutDashboard, FileText, MessageSquare, ShieldCheck, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "./ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  const navItems = [
    { href: "/", label: "Home", icon: LayoutDashboard },
    { href: "/scan-id", label: "Scan ID", icon: FileText },
    { href: "/chat", label: "Chat", icon: MessageSquare },
    { href: "/insurance", label: "Insurance", icon: ShieldCheck },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* Sidebar for desktop, header for mobile */}
      <nav className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col">
        <div className="p-6 md:p-8 flex items-center justify-between md:justify-center border-b border-border">
          <div className="flex flex-col items-start md:items-center">
            <h1 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">Zero-Wait</h1>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mt-1">OPD Kiosk</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>
        </div>

        <div className="flex-1 flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto p-4 gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/");
            
            return (
              <Link key={item.href} href={item.href} className="flex-shrink-0 md:w-full">
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-4 h-14 md:h-16 px-6 text-lg rounded-xl transition-all ${
                    isActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className={`h-6 w-6 ${isActive ? "text-primary" : ""}`} />
                  <span className="hidden md:inline">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>

        <div className="hidden md:flex p-6 border-t border-border mt-auto">
          <Button
            variant="outline"
            className="w-full justify-center gap-2 h-14 rounded-xl text-muted-foreground"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-5 w-5" />
                <span>Dark Mode</span>
              </>
            ) : (
              <>
                <Sun className="h-5 w-5" />
                <span>Light Mode</span>
              </>
            )}
          </Button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] pointer-events-none" />
        <div className="flex-1 overflow-y-auto p-6 md:p-12 z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
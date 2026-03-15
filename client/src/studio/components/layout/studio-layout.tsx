import React from "react";
import { SidebarProvider, SidebarTrigger } from "@studio/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useAuth } from "@studio/hooks/use-auth";
import { ShieldAlert } from "lucide-react";
import { Link } from "wouter";

interface StudioLayoutProps {
  studioId: string;
  children: React.ReactNode;
}

export function StudioLayout({ studioId, children }: StudioLayoutProps) {
  const { user } = useAuth();

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-background text-foreground relative overflow-hidden">
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/12 via-background to-background"></div>
          <div className="absolute -top-28 right-[-12rem] w-[34rem] h-[34rem] rounded-full bg-primary/10 blur-3xl opacity-70" />
          <div className="absolute -bottom-24 left-[-8rem] w-[26rem] h-[26rem] rounded-full bg-primary/8 blur-3xl opacity-70" />
        </div>

        <AppSidebar studioId={studioId} />
        <div className="flex flex-col flex-1 w-full overflow-hidden min-w-0 relative z-10">
          <header className="flex h-16 shrink-0 items-center gap-4 px-6 sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 shadow-sm">
            <SidebarTrigger className="-ml-2 h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors rounded-full md:hidden" data-testid="button-sidebar-trigger" />
            <div className="flex-1" />
            
            <div className="flex items-center gap-2">
              {user?.role === "platform_owner" && (
                <Link href="/hub-dub/admin">
                  <button className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border/60 bg-card/60 hover:bg-card" data-testid="button-header-admin">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Admin
                  </button>
                </Link>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-7xl px-6 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

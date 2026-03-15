import { useAuth } from "@studio/hooks/use-auth";
import { ShieldAlert, LogOut, Building2, UserCircle, LayoutDashboard, Calendar } from "lucide-react";
import { Link, useLocation } from "wouter";
import { pt } from "@studio/lib/i18n";

interface StudioLayoutProps {
  studioId: string;
  children: React.ReactNode;
}

export function StudioLayout({ studioId, children }: StudioLayoutProps) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const navItems = [
    { title: pt.nav.dashboard, url: `/hub-dub/studio/${studioId}/dashboard`, icon: LayoutDashboard },
    { title: pt.nav.sessions, url: `/hub-dub/studio/${studioId}/sessions`, icon: Calendar },
  ];

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground relative overflow-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/12 via-background to-background"></div>
        <div className="absolute -top-28 right-[-12rem] w-[34rem] h-[34rem] rounded-full bg-primary/10 blur-3xl opacity-70" />
        <div className="absolute -bottom-24 left-[-8rem] w-[26rem] h-[26rem] rounded-full bg-primary/8 blur-3xl opacity-70" />
      </div>

      <div className="flex flex-col flex-1 w-full overflow-hidden min-w-0 relative z-10">
        <header className="flex h-16 shrink-0 items-center gap-8 px-8 sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50 shadow-sm">
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="h-8 w-8 rounded-lg border border-border/70 bg-card/70 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <img src="/logo.svg" alt="V.HUB" className="h-5 w-5" />
              </div>
              <span className="font-semibold tracking-tight text-sm text-foreground">V.HUB</span>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location === item.url || location.startsWith(item.url + "?");
              return (
                <Link key={item.url} href={item.url}>
                  <button 
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                      isActive 
                        ? "bg-primary/10 text-primary border border-primary/20" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.title}
                  </button>
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 border-r border-border/60 pr-4">
              <Link href="/hub-dub/profile">
                <button className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted/40" data-testid="button-header-profile">
                  <UserCircle className="h-3.5 w-3.5" />
                  Perfil
                </button>
              </Link>
              <Link href="/hub-dub/studios">
                <button className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted/40" data-testid="button-header-switch-studio">
                  <Building2 className="h-3.5 w-3.5" />
                  Trocar Estúdio
                </button>
              </Link>
              <button 
                onClick={() => logout()}
                className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors px-2.5 py-1.5 rounded-md hover:bg-red-500/5" 
                data-testid="button-header-logout"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </div>
            
            {user?.role === "platform_owner" && (
              <Link href="/hub-dub/admin">
                <button className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-full border border-border/60 bg-card/60 hover:bg-card" data-testid="button-header-admin">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Admin
                </button>
              </Link>
            )}
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="mx-auto max-w-7xl px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

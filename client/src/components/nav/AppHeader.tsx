import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LanguageThemePill } from "@/components/nav/LanguageThemePill";
import { useAuth } from "@/hooks/use-auth";
import { Menu, X, Settings, User, History, Wrench, HelpCircle, LogOut, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { Drawer } from "vaul";

export type LandingHeaderTextConfig = {
  brandAlt: string;
  brandName: string;
  navHubDub: string;
  authEnter: string;
  authPanel: string;
};

export const defaultLandingHeaderTextConfig: LandingHeaderTextConfig = {
  brandAlt: "THE HUB",
  brandName: "THE HUB",
  navHubDub: "HUBDUB",
  authEnter: "ENTRAR",
  authPanel: "Painel",
};

export function AppHeader({
  lang,
  setLang,
  textConfig,
}: {
  lang: "en" | "pt";
  setLang: (lang: "en" | "pt") => void;
  textConfig?: Partial<LandingHeaderTextConfig>;
}) {
  const { user, isLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 768);
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const t = { ...defaultLandingHeaderTextConfig, ...(textConfig || {}) };
  const username = String(user?.email || "").trim().toLowerCase().split("@")[0] || "";
  const canAccessHubAlign = username === "borbaggabriel";

  const menuItems = [
    { label: "Configurações", icon: Settings, href: "/settings" },
    { label: "Perfil", icon: User, href: "/profile" },
    { label: "Histórico", icon: History, href: "/history" },
    { label: "Ferramentas", icon: Wrench, href: "/tools" },
    { label: "Ajuda", icon: HelpCircle, href: "/help" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-[100] bg-background/80 backdrop-blur-md border-b border-border/50">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 h-[60px] flex items-center justify-between relative">
        <div className="flex items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <img
                src="/logo.svg"
                alt={t.brandAlt}
                className="w-7 h-7 md:w-8 md:h-8 group-hover:scale-110 transition-transform duration-300"
              />
              <span className="text-base md:text-lg font-bold tracking-tight text-foreground">{t.brandName}</span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase" />

        {isMobile && (
          <Drawer.Root open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen} direction="right">
            <Drawer.Trigger asChild>
              <button className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-muted transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 bg-black/40 z-[150]" />
              <Drawer.Content className="fixed bottom-0 right-0 top-0 w-[280px] bg-background border-l border-border shadow-2xl z-[200] flex flex-col outline-none">
                <div className="p-6 flex-1 overflow-y-auto">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-2">
                      <img src="/logo.svg" className="w-6 h-6" alt="Logo" />
                      <span className="font-bold">V.HUB Menu</span>
                    </div>
                    <Drawer.Close asChild>
                      <button className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </Drawer.Close>
                  </div>

                  <div className="space-y-2">
                    {menuItems.map((item) => (
                      <Link key={item.label} href={item.href}>
                        <button 
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-muted transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                              <item.icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-semibold">{item.label}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </Link>
                    ))}
                  </div>
                </div>

                <div className="p-6 border-t border-border">
                  <button
                    onClick={() => {
                      logout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-destructive/10 text-destructive transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-semibold">Sair da Conta</span>
                  </button>
                </div>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
        )}

        {!isLoading && canAccessHubAlign && !isMobile && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <Button
              type="button"
              className="rounded-full px-5 h-9 text-xs font-semibold"
              onClick={() => navigate("/hub-align")}
              data-testid="button-exclusive-hubalign"
            >
              HubAlign
            </Button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isMobile && <LanguageThemePill lang={lang} setLang={setLang} />}
          {!isLoading && !isMobile && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-5 h-10 bg-transparent"
              onClick={() => {
                if (user) {
                  navigate("/hub-dub/studios");
                } else {
                  navigate("/hub-dub/login");
                }
              }}
              data-testid="button-auth"
            >
              {user ? t.authPanel : t.authEnter}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

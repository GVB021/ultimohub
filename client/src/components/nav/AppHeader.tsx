import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LanguageThemePill } from "@/components/nav/LanguageThemePill";
import { useAuth } from "@/hooks/use-auth";

export function AppHeader({
  lang,
  setLang,
}: {
  lang: "en" | "pt";
  setLang: (lang: "en" | "pt") => void;
}) {
  const { user, isLoading, logout, isLoggingOut } = useAuth();
  const [, navigate] = useLocation();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-[1400px] mx-auto px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <img
                src="/logo.svg"
                alt="THE HUB"
                className="w-8 h-8 group-hover:scale-110 transition-transform duration-300"
              />
              <span className="text-lg font-semibold tracking-tight text-foreground">THE HUB</span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
          <Link href="/hub-dub/login" className="hover:text-foreground transition-colors">
            HUBDUB
          </Link>
          <Link href="/hubschool" className="hover:text-foreground transition-colors">
            HUBSCHOOL
          </Link>
          <Link href="/hub-align" className="hover:text-foreground transition-colors">
            HUBALIGN
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LanguageThemePill lang={lang} setLang={setLang} />
          {!isLoading && (
            <Button
              type="button"
              variant="outline"
              className="rounded-full px-5 h-10 bg-transparent"
              onClick={() => {
                if (user) {
                  logout();
                } else {
                  navigate("/hub-dub/login");
                }
              }}
              disabled={!!user && isLoggingOut}
              data-testid="button-auth"
            >
              {user ? "SAIR" : "ENTRAR"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { LanguageThemePill } from "@/components/nav/LanguageThemePill";
import { useAuth } from "@/hooks/use-auth";

export type LandingHeaderTextConfig = {
  brandAlt: string;
  brandName: string;
  authEnter: string;
  authPanel: string;
};

export const defaultLandingHeaderTextConfig: LandingHeaderTextConfig = {
  brandAlt: "THE HUB",
  brandName: "THE HUB",
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
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const t = { ...defaultLandingHeaderTextConfig, ...(textConfig || {}) };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-transparent">
      <div className="max-w-[1400px] mx-auto px-6 h-[60px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <img
                src="/logo.svg"
                alt={t.brandAlt}
                className="w-8 h-8 group-hover:scale-110 transition-transform duration-300"
              />
              <span className="text-lg font-semibold tracking-tight text-foreground">{t.brandName}</span>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
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

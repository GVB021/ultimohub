import { Globe } from "lucide-react";

export function LanguageThemePill({
  lang,
  setLang,
}: {
  lang: "en" | "pt";
  setLang: (lang: "en" | "pt") => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full px-2 py-1 bg-background border border-border/60 shadow-sm">
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "pt" : "en")}
        className="h-9 px-4 rounded-full hover:bg-black/5 transition-colors flex items-center gap-2"
      >
        {lang === "en" ? (
          <>
            <img
              src="https://flagcdn.com/w20/br.png"
              srcSet="https://flagcdn.com/w40/br.png 2x"
              width="16"
              alt="Brazil"
              className="rounded-[2px]"
            />
            <span className="text-xs font-semibold tracking-wider">PT</span>
          </>
        ) : (
          <>
            <Globe className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold tracking-wider">EN</span>
          </>
        )}
      </button>
    </div>
  );
}

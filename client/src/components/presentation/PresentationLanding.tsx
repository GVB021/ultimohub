import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { MeshGradient } from "@/components/landing/MeshGradient";
import { AppHeader, defaultLandingHeaderTextConfig, type LandingHeaderTextConfig } from "@/components/nav/AppHeader";
import { useAuth } from "@/hooks/use-auth";
import { canEditLandingTextByEmail } from "@/lib/landing-editor-access";

type LandingTextConfig = LandingHeaderTextConfig & { phrasesPt: string[]; phrasesEn: string[] };

const LANDING_TEXT_STORAGE_KEY = "vhub_landing_text_config_v1";

const defaultLandingTextConfig: LandingTextConfig = {
  ...defaultLandingHeaderTextConfig,
  phrasesPt: ["The Future of Dubb....", "O Futuro da Dublagem", "T H E H U B", "MENOS CLIQUES", "MAIS DUBLAGEM", "T H E H U B"],
  phrasesEn: ["The Future of Dubb....", "O Futuro da Dublagem", "T H E H U B", "MENOS CLIQUES", "MAIS DUBLAGEM", "T H E H U B"],
};

function cleanSingleLine(v: unknown, fallback: string, max = 42) {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  return (s || fallback).slice(0, max);
}

function cleanPhraseList(input: unknown, fallback: string[]) {
  const list = Array.isArray(input) ? input : String(input ?? "").split("\n");
  const out = list.map((v) => cleanSingleLine(v, "", 84)).filter(Boolean).slice(0, 8);
  return out.length ? out : fallback;
}

function normalizeLandingTextConfig(input: unknown): LandingTextConfig {
  const obj = typeof input === "object" && input ? (input as Record<string, unknown>) : {};
  return {
    brandAlt: cleanSingleLine(obj.brandAlt, defaultLandingTextConfig.brandAlt, 32),
    brandName: cleanSingleLine(obj.brandName, defaultLandingTextConfig.brandName, 24),
    navHubDub: cleanSingleLine(obj.navHubDub, defaultLandingTextConfig.navHubDub, 16),
    authEnter: cleanSingleLine(obj.authEnter, defaultLandingTextConfig.authEnter, 16),
    authPanel: cleanSingleLine(obj.authPanel, defaultLandingTextConfig.authPanel, 16),
    phrasesPt: cleanPhraseList(obj.phrasesPt, defaultLandingTextConfig.phrasesPt),
    phrasesEn: cleanPhraseList(obj.phrasesEn, defaultLandingTextConfig.phrasesEn),
  };
}

function loadLandingTextConfig() {
  try { return normalizeLandingTextConfig(JSON.parse(localStorage.getItem(LANDING_TEXT_STORAGE_KEY) || "{}")); }
  catch { return defaultLandingTextConfig; }
}

export default function PresentationLanding() {
  const { user } = useAuth();
  const [lang, setLang] = useState<"en" | "pt">("en");
  const [textConfig, setTextConfig] = useState<LandingTextConfig>(() => loadLandingTextConfig());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const phrases = useMemo(() => (lang === "pt" ? textConfig.phrasesPt : textConfig.phrasesEn), [lang, textConfig.phrasesEn, textConfig.phrasesPt]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const canEditLandingText = canEditLandingTextByEmail(user?.email);

  useEffect(() => {
    localStorage.setItem(LANDING_TEXT_STORAGE_KEY, JSON.stringify(textConfig));
  }, [textConfig]);

  useEffect(() => {
    if (!canEditLandingText) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setIsEditorOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEditLandingText]);

  useEffect(() => {
    if (!canEditLandingText) setIsEditorOpen(false);
  }, [canEditLandingText]);

  const longPhrases = phrases.filter((p) => p.length > 42);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-hidden">
      <AppHeader lang={lang} setLang={setLang} textConfig={textConfig} />

      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="opacity-35">
          <MeshGradient />
        </div>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px]" />
      </div>

      <main className="relative z-10 min-h-screen flex items-center justify-center px-6 pt-[60px]">
        <div className="w-full max-w-5xl text-center">
          <div className="text-5xl md:text-7xl lg:text-8xl font-semibold tracking-tight leading-[1.05]">
            <TypeCycle
              phrases={phrases}
              activeIndex={activeIndex}
              setActiveIndex={setActiveIndex}
              display={display}
              setDisplay={setDisplay}
              isDeleting={isDeleting}
              setIsDeleting={setIsDeleting}
            />
          </div>
        </div>
      </main>

      {canEditLandingText && (
        <button
          type="button"
          onClick={() => setIsEditorOpen((v) => !v)}
          className="fixed right-4 bottom-4 z-30 rounded-full border border-border bg-background/90 backdrop-blur px-4 h-9 text-xs font-semibold"
          data-testid="button-landing-text-editor"
        >
          Editar textos
        </button>
      )}

      {canEditLandingText && isEditorOpen && (
        <div className="fixed right-4 bottom-16 z-30 w-[min(92vw,460px)] rounded-2xl border border-border bg-background/95 backdrop-blur p-4 shadow-2xl space-y-3">
          <input className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm" value={textConfig.brandName} onChange={(e) => setTextConfig((c) => ({ ...c, brandName: cleanSingleLine(e.target.value, c.brandName, 24) }))} placeholder="Marca" />
          <input className="w-full rounded-md border border-border bg-background px-3 h-9 text-sm" value={textConfig.navHubDub} onChange={(e) => setTextConfig((c) => ({ ...c, navHubDub: cleanSingleLine(e.target.value, c.navHubDub, 16) }))} placeholder="HUBDUB" />
          <textarea
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-28"
            value={(lang === "pt" ? textConfig.phrasesPt : textConfig.phrasesEn).join("\n")}
            onChange={(e) => setTextConfig((c) => (lang === "pt" ? { ...c, phrasesPt: cleanPhraseList(e.target.value, c.phrasesPt) } : { ...c, phrasesEn: cleanPhraseList(e.target.value, c.phrasesEn) }))}
          />
          {longPhrases.length > 0 && <p className="text-xs text-amber-500">Algumas frases podem quebrar em telas menores. Mantenha até ~42 caracteres.</p>}
          <div className="flex justify-between gap-2">
            <button type="button" className="rounded-md border border-border px-3 h-9 text-xs" onClick={() => setTextConfig(defaultLandingTextConfig)}>Resetar</button>
            <button type="button" className="rounded-md border border-border px-3 h-9 text-xs" onClick={() => setIsEditorOpen(false)}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}
function TypeCycle({
  phrases,
  activeIndex,
  setActiveIndex,
  display,
  setDisplay,
  isDeleting,
  setIsDeleting,
}: {
  phrases: string[];
  activeIndex: number;
  setActiveIndex: (v: number) => void;
  display: string;
  setDisplay: (v: string) => void;
  isDeleting: boolean;
  setIsDeleting: (v: boolean) => void;
}) {
  useEffect(() => {
    const phrase = phrases[activeIndex] || "";
    const holdMs = 1200;
    const typeMs = 38;
    const deleteMs = 22;

    const timeout = window.setTimeout(() => {
      if (!isDeleting) {
        const next = phrase.slice(0, display.length + 1);
        setDisplay(next);
        if (next.length === phrase.length) {
          window.setTimeout(() => setIsDeleting(true), holdMs);
        }
        return;
      }

      const next = phrase.slice(0, Math.max(0, display.length - 1));
      setDisplay(next);
      if (next.length === 0) {
        setIsDeleting(false);
        setActiveIndex((activeIndex + 1) % phrases.length);
      }
    }, isDeleting ? deleteMs : typeMs);

    return () => window.clearTimeout(timeout);
  }, [activeIndex, display.length, isDeleting, phrases, setActiveIndex, setDisplay, setIsDeleting]);

  return (
    <div className="inline-flex items-end justify-center gap-2">
      <span className="bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/55">
        {display}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={isDeleting ? "del" : "type"}
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          exit={{ opacity: 0.2 }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="text-foreground/60"
          aria-hidden
        >
          |
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

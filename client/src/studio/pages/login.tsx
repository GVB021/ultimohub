import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@studio/hooks/use-auth";
import { Input } from "@studio/components/ui/input";
import { useToast } from "@studio/hooks/use-toast";
import { AppHeader } from "@/components/nav/AppHeader";
import { MeshGradient } from "@/components/landing/MeshGradient";

export default function Login() {
  const [lang, setLang] = useState<"en" | "pt">(() => {
    const saved = localStorage.getItem("vhub_language");
    return saved === "pt" ? "pt" : "en";
  });
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("thehub_login_email") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("thehub_login_remember") === "true";
    } catch {
      return false;
    }
  });
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const { user, login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    localStorage.setItem("vhub_language", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    try {
      localStorage.setItem("thehub_login_remember", rememberMe ? "true" : "false");
      if (rememberMe) {
        localStorage.setItem("thehub_login_email", email);
      } else {
        localStorage.removeItem("thehub_login_email");
      }
    } catch {}
  }, [rememberMe, email]);

  useEffect(() => {
    if (user) {
      setLocation("/hub-dub/studios", { replace: true });
    }
  }, [user, setLocation]);

  const emailError = useMemo(() => {
    const v = email.trim();
    if (!v) return lang === "en" ? "Email is required" : "Email é obrigatório";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return lang === "en" ? "Invalid email" : "Email inválido";
    return null;
  }, [email, lang]);

  const passwordError = useMemo(() => {
    if (!password) return lang === "en" ? "Password is required" : "Senha é obrigatória";
    if (password.length < 4) return lang === "en" ? "Minimum 4 characters" : "Mínimo de 4 caracteres";
    return null;
  }, [password, lang]);

  const canSubmit = !emailError && !passwordError && !isLoggingIn;

  const tutorials = useMemo(() => {
    if (lang === "en") {
      return [
        {
          title: "Fast start in a session",
          items: [
            "Use SPACE to play/pause and keep your hand off the mouse.",
            "Use L to toggle loop on the current line and repeat takes faster.",
            "Use ←/→ to jump 2s for micro-adjustments.",
          ],
        },
        {
          title: "Best practices (quality + speed)",
          items: [
            "Record in headphones to avoid bleed and keep alignment clean.",
            "Keep input gain stable; avoid clipping and extreme fixes later.",
            "Prefer short loops over long playback to keep momentum.",
          ],
        },
        {
          title: "Text + timing workflow",
          items: [
            "If you can't click lines, ask for Text Control authorization.",
            "Edit only what’s necessary and keep the original intent consistent.",
            "Work line-by-line and avoid random seeking.",
          ],
        },
      ];
    }
    return [
      {
        title: "Começo rápido na sessão",
        items: [
          "Use SPACE para play/pause e reduza o uso do mouse.",
          "Use L para alternar loop na fala atual e acelerar a repetição de takes.",
          "Use ←/→ para saltar 2s e fazer microajustes.",
        ],
      },
      {
        title: "Melhores práticas (qualidade + velocidade)",
        items: [
          "Grave com fones para evitar vazamento e manter o alinhamento limpo.",
          "Mantenha o ganho estável; evite clip e correções agressivas depois.",
          "Prefira loops curtos em vez de rodar trechos longos para manter o ritmo.",
        ],
      },
      {
        title: "Fluxo texto + timing",
        items: [
          "Se você não consegue clicar nas falas, peça autorização de Controle de Texto.",
          "Edite apenas o essencial; mantenha consistência entre takes e revisões.",
          "Trabalhe fala a fala; evite buscar aleatoriamente no vídeo.",
        ],
      },
    ];
  }, [lang]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (emailError || passwordError) {
      toast({ title: lang === "en" ? "Check your credentials" : "Verifique seus dados", variant: "destructive" });
      return;
    }
    const safeEmail = email.trim();
    login(
      { email: safeEmail, password },
      {
        onSuccess: () => {
          toast({ title: lang === "en" ? "Signed in" : "Login realizado" });
          setLocation("/hub-dub/studios", { replace: true });
        },
        onError: (err: any) => {
          toast({
            title: lang === "en" ? "Login failed" : "Falha no login",
            description: String(err?.message || (lang === "en" ? "Try again." : "Tente novamente.")),
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader lang={lang} setLang={setLang} />

      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="opacity-35 dark:opacity-100">
          <MeshGradient />
        </div>
        <div className="absolute inset-0 bg-white/60 dark:bg-black/35 backdrop-blur-[2px]" />
      </div>

      <main className="relative z-10 pt-[60px]">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            <section className="order-2 lg:order-1 space-y-6">
              <div className="space-y-3">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
                  {lang === "en" ? "Work faster. Sound better." : "Trabalhe mais rápido. Soe melhor."}
                </h1>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                  {lang === "en"
                    ? "Short guides to keep your dubbing workflow fast and consistent."
                    : "Guias curtos para manter seu fluxo de dublagem rápido e consistente."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {tutorials.map((block) => (
                  <motion.div
                    key={block.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-5"
                  >
                    <div className="text-xs font-semibold tracking-[0.22em] uppercase text-muted-foreground">
                      {block.title}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-foreground/90">
                      {block.items.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-[6px] h-1.5 w-1.5 rounded-full bg-foreground/35 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>
            </section>

            <section className="order-1 lg:order-2">
              <div className="mx-auto w-full max-w-[420px]">
                <div className="rounded-2xl border border-border/60 bg-card/75 backdrop-blur-xl p-6 md:p-7">
                  <div className="space-y-2 mb-6">
                    <div className="text-xs font-semibold tracking-[0.22em] uppercase text-muted-foreground">
                      {lang === "en" ? "Studio Login" : "Login do Estúdio"}
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      {lang === "en" ? "Access your workspace" : "Acesse seu workspace"}
                    </h2>
                  </div>

                  <form onSubmit={submit} className="space-y-4" data-testid="form-login">
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">{lang === "en" ? "Email" : "Email"}</label>
                      <Input
                        name="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                        placeholder={lang === "en" ? "you@studio.com" : "voce@estudio.com"}
                        autoComplete="email"
                        data-testid="input-email"
                      />
                      {touched.email && emailError && (
                        <div className="text-xs text-red-400" data-testid="error-email">
                          {emailError}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">{lang === "en" ? "Password" : "Senha"}</label>
                      <Input
                        name="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                        placeholder={lang === "en" ? "Password" : "Senha"}
                        autoComplete="current-password"
                        data-testid="input-password"
                      />
                      {touched.password && passwordError && (
                        <div className="text-xs text-red-400" data-testid="error-password">
                          {passwordError}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="h-4 w-4 accent-amber-500"
                          data-testid="checkbox-remember-me"
                        />
                        {lang === "en" ? "Remember me" : "Lembrar-me"}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email.trim());
                          setResetOpen(true);
                        }}
                        className="text-xs underline underline-offset-2 text-muted-foreground hover:text-foreground transition-colors"
                        data-testid="button-forgot-password"
                      >
                        {lang === "en" ? "Forgot password?" : "Esqueci minha senha"}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="w-full h-11 rounded-xl bg-foreground text-background font-semibold text-sm transition-opacity disabled:opacity-60"
                      data-testid="button-submit-login"
                    >
                      {isLoggingIn ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {lang === "en" ? "Signing in..." : "Entrando..."}
                        </span>
                      ) : (
                        <span>{lang === "en" ? "Sign in" : "Entrar"}</span>
                      )}
                    </button>
                  </form>

                  <div className="mt-5 text-xs text-muted-foreground leading-relaxed">
                    {lang === "en"
                      ? "Tip: if you can’t control the script, ask a director/admin to grant Text Control."
                      : "Dica: se você não consegue controlar o roteiro, peça para diretor/admin liberar o Controle de Texto."}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {resetOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.55)" }}>
              <div className="w-full max-w-[420px] rounded-2xl border border-border/60 bg-card/90 backdrop-blur-xl p-6">
                <div className="text-xs font-semibold tracking-[0.22em] uppercase text-muted-foreground">
                  {lang === "en" ? "Password recovery" : "Recuperação de senha"}
                </div>
                <div className="mt-2 text-sm text-foreground/90">
                  {lang === "en"
                    ? "Enter your email. We'll register your request for the studio admin."
                    : "Informe seu email. Vamos registrar sua solicitação para o admin do estúdio."}
                </div>
                <div className="mt-4 space-y-2">
                  <Input
                    name="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder={lang === "en" ? "you@studio.com" : "voce@estudio.com"}
                    data-testid="input-reset-email"
                  />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetOpen(false)}
                    className="h-10 px-4 rounded-xl border border-border/60 bg-transparent text-sm"
                    data-testid="button-cancel-reset"
                  >
                    {lang === "en" ? "Cancel" : "Cancelar"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const v = resetEmail.trim();
                      if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
                        toast({ title: lang === "en" ? "Invalid email" : "Email inválido", variant: "destructive" });
                        return;
                      }
                      try {
                        await fetch("/api/auth/request-password-reset", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email: v }),
                          credentials: "include",
                        });
                        toast({ title: lang === "en" ? "Request sent" : "Solicitação enviada" });
                        setResetOpen(false);
                      } catch (err: any) {
                        toast({ title: lang === "en" ? "Request failed" : "Falha ao solicitar", description: String(err?.message || ""), variant: "destructive" });
                      }
                    }}
                    className="h-10 px-4 rounded-xl bg-foreground text-background text-sm font-semibold"
                    data-testid="button-submit-reset"
                  >
                    {lang === "en" ? "Send" : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

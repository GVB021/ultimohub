import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Mail, Lock, ChevronRight, CheckCircle2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@studio/hooks/use-auth";
import { Input } from "@studio/components/ui/input";
import { Button } from "@studio/components/ui/button";
import { useToast } from "@studio/hooks/use-toast";
import { MeshGradient } from "@/components/landing/MeshGradient";
import { LanguageThemePill } from "@/components/nav/LanguageThemePill";

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    try {
      return localStorage.getItem("thehub_login_remember") === "true";
    } catch {
      return false;
    }
  });
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({ email: false, password: false });
  const [isSuccess, setIsSuccess] = useState(false);
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
    if (user && !isLoggingIn) {
      const timer = setTimeout(() => {
        setLocation("/hub-dub/studios", { replace: true });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, setLocation, isLoggingIn]);

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

  const canSubmit = !emailError && !passwordError && !isLoggingIn && !isSuccess;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (emailError || passwordError) return;

    login(
      { email: email.trim(), password },
      {
        onSuccess: () => {
          setIsSuccess(true);
          toast({ title: lang === "en" ? "Welcome back!" : "Bem-vindo de volta!" });
        },
        onError: (err: any) => {
          toast({
            title: lang === "en" ? "Login failed" : "Falha no login",
            description: String(err?.message || (lang === "en" ? "Invalid credentials." : "Credenciais inválidas.")),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleResetPassword = async () => {
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
      toast({ 
        title: lang === "en" ? "Request failed" : "Falha ao solicitar", 
        description: String(err?.message || ""), 
        variant: "destructive" 
      });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 flex flex-col overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-40 scale-110">
          <MeshGradient />
        </div>
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[100px]" />
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse delay-700" />
      </div>

      {/* Header */}
      <header className="relative z-50 w-full px-6 py-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <div className="h-10 w-10 rounded-2xl bg-white border border-border/50 flex items-center justify-center shadow-lg shadow-black/5 group-hover:border-primary/50 transition-colors">
                <img src="/logo.svg" alt="V.HUB" className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">V.HUB</span>
            </motion.div>
          </Link>
          <LanguageThemePill lang={lang} setLang={setLang} />
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: Branding & Value Prop */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="hidden lg:flex flex-col space-y-8"
          >
            <div className="space-y-4">
              <motion.span 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold uppercase tracking-[0.2em] text-primary"
              >
                <div className="h-1 w-1 rounded-full bg-primary animate-ping" />
                {lang === "en" ? "Studio Platform" : "Plataforma de Estúdio"}
              </motion.span>
              <h1 className="text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.1]">
                {lang === "en" ? (
                  <>The future of <span className="text-primary italic">voice</span> production.</>
                ) : (
                  <>O futuro da produção de <span className="text-primary italic">voz</span>.</>
                )}
              </h1>
              <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
                {lang === "en" 
                  ? "Professional workspace for studios, directors and actors to collaborate in real-time."
                  : "Workspace profissional para estúdios, diretores e atores colaborarem em tempo real."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { en: "High Fidelity", pt: "Alta Fidelidade", icon: "🎙️" },
                { en: "Real-time", pt: "Tempo Real", icon: "⚡" },
                { en: "Smart Sync", pt: "Sincronia Inteligente", icon: "🧠" },
                { en: "Cloud Scale", pt: "Escala em Nuvem", icon: "☁️" }
              ].map((feature, i) => (
                <motion.div
                  key={feature.en}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (i * 0.1) }}
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md flex items-center gap-3"
                >
                  <span className="text-xl">{feature.icon}</span>
                  <span className="text-xs font-semibold">{lang === "en" ? feature.en : feature.pt}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right Column: Login Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="flex flex-col"
          >
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 to-blue-500/30 rounded-[2rem] blur-2xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
              
              <div className="relative bg-white/70 backdrop-blur-3xl border border-white/20 rounded-[2rem] shadow-2xl overflow-hidden">
                <div className="p-8 md:p-10">
                  <div className="space-y-2 mb-10">
                    <h2 className="text-3xl font-bold tracking-tight">
                      {lang === "en" ? "Welcome back" : "Boas-vindas"}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      {lang === "en" ? "Enter your credentials to continue" : "Insira suas credenciais para continuar"}
                    </p>
                  </div>

                  <form onSubmit={submit} className="space-y-6" data-testid="form-login">
                    <div className="space-y-5">
                      {/* Email Field */}
                      <div className="space-y-2 group/input">
                        <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 px-1">
                          {lang === "en" ? "Work Email" : "E-mail Profissional"}
                        </label>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/input:text-primary">
                            <Mail className="w-4 h-4" />
                          </div>
                          <Input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                            placeholder="exemplo@estudio.com"
                            className="pl-11 h-12 rounded-2xl border-border/40 bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                            autoComplete="email"
                            data-testid="input-email"
                          />
                        </div>
                        <AnimatePresence>
                          {touched.email && emailError && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-1.5 px-1 text-xs text-rose-500 font-medium overflow-hidden"
                              data-testid="error-email"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {emailError}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Password Field */}
                      <div className="space-y-2 group/input">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80">
                            {lang === "en" ? "Security Key" : "Chave de Segurança"}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setResetEmail(email.trim());
                              setResetOpen(true);
                            }}
                            className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary hover:text-primary/80 transition-colors"
                            data-testid="button-forgot-password"
                          >
                            {lang === "en" ? "Forgot?" : "Esqueceu?"}
                          </button>
                        </div>
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/input:text-primary">
                            <Lock className="w-4 h-4" />
                          </div>
                          <Input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                            placeholder="••••••••"
                            className="pl-11 pr-11 h-12 rounded-2xl border-border/40 bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                            autoComplete="current-password"
                            data-testid="input-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <AnimatePresence>
                          {touched.password && passwordError && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-1.5 px-1 text-xs text-rose-500 font-medium overflow-hidden"
                              data-testid="error-password"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {passwordError}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-1">
                      <div 
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`w-10 h-5 rounded-full p-1 cursor-pointer transition-colors duration-300 ${rememberMe ? "bg-primary" : "bg-muted"}`}
                        data-testid="checkbox-remember-me"
                      >
                        <motion.div 
                          animate={{ x: rememberMe ? 20 : 0 }}
                          className="w-3 h-3 rounded-full bg-white shadow-sm"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground select-none cursor-pointer" onClick={() => setRememberMe(!rememberMe)}>
                        {lang === "en" ? "Stay signed in" : "Manter-me conectado"}
                      </span>
                    </div>

                    <Button
                      type="submit"
                      disabled={!canSubmit}
                      data-testid="button-submit-login"
                      className={`w-full h-14 rounded-2xl font-bold text-base transition-all duration-300 relative overflow-hidden ${
                        isSuccess ? "bg-emerald-500 hover:bg-emerald-500" : "bg-foreground hover:bg-foreground/90"
                      }`}
                    >
                      <AnimatePresence mode="wait">
                        {isLoggingIn ? (
                          <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3"
                          >
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {lang === "en" ? "Authenticating..." : "Autenticando..."}
                          </motion.div>
                        ) : isSuccess ? (
                          <motion.div 
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-3"
                          >
                            <CheckCircle2 className="w-5 h-5" />
                            {lang === "en" ? "Authorized" : "Autorizado"}
                          </motion.div>
                        ) : (
                          <motion.div 
                            key="default"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-2"
                          >
                            {lang === "en" ? "Enter Studio" : "Entrar no Estúdio"}
                            <ChevronRight className="w-5 h-5" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </form>
                </div>

                <div className="p-8 text-center">
                  <p className="text-xs text-muted-foreground/60">
                    {lang === "en" 
                      ? "By signing in, you agree to our Terms of Service."
                      : "Ao entrar, você concorda com nossos Termos de Serviço."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer Info (Desktop) */}
      <footer className="relative z-10 px-6 py-8 hidden md:block">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
          <span>&copy; 2026 THE HUB PRODUCTIONS</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Security</a>
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Status</a>
          </div>
        </div>
      </footer>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setResetOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-[420px] rounded-[2rem] border border-white/20 bg-white p-8 shadow-2xl"
            >
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold tracking-tight">
                    {lang === "en" ? "Recovery" : "Recuperação"}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {lang === "en"
                      ? "Enter your email. We'll register your request for the studio admin."
                      : "Informe seu email. Vamos registrar sua solicitação para o admin do estúdio."}
                  </p>
                </div>
                <div className="space-y-2 group/input">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/80 px-1">
                    {lang === "en" ? "Work Email" : "E-mail Profissional"}
                  </label>
                  <Input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="exemplo@estudio.com"
                    className="h-12 rounded-2xl border-border/40 bg-white/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    data-testid="input-reset-email"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setResetOpen(false)}
                    className="flex-1 h-12 rounded-2xl font-bold"
                    data-testid="button-cancel-reset"
                  >
                    {lang === "en" ? "Cancel" : "Cancelar"}
                  </Button>
                  <Button
                    onClick={handleResetPassword}
                    className="flex-1 h-12 rounded-2xl bg-foreground text-background font-bold"
                    data-testid="button-submit-reset"
                  >
                    {lang === "en" ? "Send" : "Enviar"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

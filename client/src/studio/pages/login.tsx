import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@studio/hooks/use-auth";
import { Input } from "@studio/components/ui/input";
import { Loader2, ArrowRight, ArrowLeft, UserPlus, CheckCircle2, ShieldCheck, AudioWaveform, Clock3 } from "lucide-react";
import { useLocation } from "wouter";
import { pt } from "@studio/lib/i18n";
import { useToast } from "@studio/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { AppHeader } from "@/components/nav/AppHeader";
import { MeshGradient } from "@/components/landing/MeshGradient";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register" | "pending">("login");
  const [language, setLanguage] = useState<"en" | "pt">(() => {
    const saved = localStorage.getItem("vhub_language");
    return saved === "pt" ? "pt" : "en";
  });
  const [showSignInPanel, setShowSignInPanel] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, user, register, isRegistering } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const content = useMemo(() => ({
    en: {
        nav: ["HubDub", "HubSchool", "HubAlign"],
        signIn: "Sign In",
        heroTitle: "Voice Dubbing, Redefined.",
        heroDescription: "The ultimate platform for voice actors, directors, and studios. High-fidelity ADR, real-time collaboration, and intelligent synchronization in one elegant flow.",
        heroPrimary: "Explore Platform",
        heroSecondary: "See Workflow",
        secureAccess: "Secure access for production and recording workspace.",
        profiles: "Profiles",
        sessions: "Sessions",
        liveScheduled: "Live and scheduled",
        dubbingDirection: "Dubbing • Direction",
        waitingApproval: "Waiting for approval",
        approvalHint: "You will be notified by email.",
        pendingTitle: "Account under review",
        pendingDescription: "Your account has been created and is waiting for approval.",
        backToLogin: "Back to sign in",
        rights: "All rights reserved.",
        timeline: "Take Timeline",
        quality: "Assisted Quality",
        schedule: "Precise Scheduling",
        delivery: "Organized Delivery",
        section2Title: "Professional Dubbing Studio",
        section2Desc: "Advanced tools for high-end voice production. Multi-track recording, real-time monitoring, and seamless project management for the modern industry.",
        section3Title: "Smart Audio Alignment",
        section3Desc: "Our proprietary engine ensures perfect lip-sync and timing. Automatically align takes with the original dialogue for flawless results.",
      },
      pt: {
        nav: ["HubDub", "HubSchool", "HubAlign"],
        signIn: "Sign In",
        heroTitle: "Dublagem Profissional, Redefinida.",
        heroDescription: "A plataforma definitiva para dubladores, diretores e estúdios. ADR de alta fidelidade, colaboração em tempo real e sincronia inteligente em um fluxo elegante.",
        heroPrimary: "Explore Platform",
        heroSecondary: "See Workflow",
        secureAccess: "Acesso seguro ao ambiente de produção e gravação.",
        profiles: "Perfis",
        sessions: "Sessões",
        liveScheduled: "Ao vivo e agendadas",
        dubbingDirection: "Dublador • Direção",
        waitingApproval: "Aguardando aprovação",
        approvalHint: "Você será notificado por email.",
        pendingTitle: "Conta em análise",
        pendingDescription: "Sua conta foi criada e está aguardando aprovação.",
        backToLogin: "Voltar para o login",
        rights: "Todos os direitos reservados.",
        timeline: "Timeline de Takes",
        quality: "Qualidade Assistida",
        schedule: "Agendamento Precisão",
        delivery: "Entrega Organizada",
        section2Title: "Studio de Dublagem Profissional",
        section2Desc: "Ferramentas avançadas para produção de voz de alto nível. Gravação multi-track, monitoramento em tempo real e gestão de projetos para a indústria moderna.",
        section3Title: "Sincronia Inteligente",
        section3Desc: "Nosso motor proprietário garante sincronia labial e timing perfeitos. Alinhe takes automaticamente com o diálogo original para resultados impecáveis.",
      },
  }[language]), [language]);

  const authText = useMemo(() => language === "pt" ? pt.auth : {
    login: "Sign In",
    loginTitle: "Sign In",
    loginSubtitle: "Access your V.HUB workspace",
    loginButton: "Sign In",
    createAccount: "Create Account",
    newHere: "New here",
    email: "Email",
    emailPlaceholder: "Email",
    password: "Password",
    passwordPlaceholder: "Password",
    welcomeBack: "Welcome back",
    signInSubtitle: "Access your V.HUB workspace",
    signingIn: "Signing in...",
    loginFailed: "Login failed",
    successLogin: "Login successful.",
    pendingTitle: "Account under review",
    pendingDescription: "Your account has been created and is waiting for approval.",
    pendingMessage: "Your account has been created and is waiting for admin approval.",
    accountCreated: "Account created",
    registerTitle: "Create Account",
    registerSubtitle: "Fill in your professional details to create your account",
    fullName: "Full name",
    artistName: "Artist name (optional)",
    phone: "Mobile phone",
    altPhone: "Alternative phone (optional)",
    birthDate: "Birth date",
    city: "City",
    state: "State",
    country: "Country",
    mainLanguage: "Main language",
    additionalLanguages: "Additional languages (optional)",
    experience: "Professional experience",
    specialty: "Specialty",
    bio: "Short bio",
    portfolioUrl: "Portfolio link (optional)",
    selectStudio: "Select studio",
    registering: "Registering...",
    signOut: "Sign out",
    switchStudio: "Switch Studio",
  }, [language]);

  const registerText = useMemo(() => language === "pt" ? pt.register : {
    submit: "Create Account",
    backToLogin: "Back to Sign In",
  }, [language]);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    localStorage.setItem("vhub_language", language);
    document.documentElement.lang = language;
  }, [language]);

  // We remove the automatic redirect to /studios if already logged in,
  // to respect the user's wish that the initial page is always the Login page.
  useEffect(() => {
    // No auto-redirect here to allow the login page to be the entry point.
  }, [user, setLocation]);

  // We no longer return null if user exists, allowing the login page to be visible.
  // The UI can handle showing a "Continue" button if needed.

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    login({ email, password }, {
      onError: (err: any) => {
        if (err.message === "pending") {
          setMode("pending");
        } else {
          toast({ title: language === "en" ? "Sign in error" : "Erro ao entrar", description: err.message, variant: "destructive" });
        }
      },
      onSuccess: async () => {
        try {
          const res = await fetch("/api/studios");
          if (!res.ok) throw new Error(language === "en" ? "Failed to load studios" : "Falha ao buscar estúdios");
          const studios = await res.json();
          if (Array.isArray(studios) && studios.length === 1) {
            setLocation(`/hub-dub/studio/${studios[0].id}/dashboard`);
          } else {
            setLocation("/hub-dub/studios");
          }
        } catch {
          setLocation("/hub-dub/studios");
        }
      }
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password) {
      toast({ title: language === "en" ? "Error" : "Erro", description: language === "en" ? "Fill all required fields." : "Preencha todos os campos obrigatorios.", variant: "destructive" });
      return;
    }
    register(form, {
      onSuccess: () => {
        setMode("pending");
      },
      onError: (err: any) => {
        toast({ title: language === "en" ? "Failed to create account" : "Erro ao criar conta", description: err.message, variant: "destructive" });
      }
    });
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const MarketingBackground = () => (
    <>
      <div className="fixed inset-0 z-0 pointer-events-none bg-background" />
      <MeshGradient />
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(circle_at_1px_1px,_currentColor_1px,_transparent_0)] text-foreground bg-[length:26px_26px]" />
    </>
  );

  if (mode === "pending") {
    return (
      <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
        <MarketingBackground />
        <AppHeader
          lang={language}
          setLang={setLanguage}
          rightCta={{ label: content.signIn, onClick: () => setShowSignInPanel(true) }}
        />
        <main className="pt-[60px] px-6 py-16 flex justify-center relative z-10">
          <div className="w-full max-w-md bg-card border border-border/60 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-xl opacity-60 rounded-full" />
              <img src="/logo.svg" alt="THE HUB" className="h-16 w-16 relative z-10" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                {authText.pendingTitle}
              </h1>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {authText.pendingDescription}
              </p>
            </div>

            <div className="w-full p-4 bg-muted/30 border border-border/60 rounded-xl flex items-center gap-3 text-left">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{content.waitingApproval}</p>
                <p className="text-xs text-muted-foreground">{content.approvalHint}</p>
              </div>
            </div>

            <button 
              onClick={() => setMode("login")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> {content.backToLogin}
            </button>
          </div>
          </div>
        </main>
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
        <MarketingBackground />
        <AppHeader lang={language} setLang={setLanguage} rightCta={{ label: content.signIn, onClick: () => setShowSignInPanel(true) }} />
        <main className="pt-[60px] px-6 py-10 relative z-10 flex justify-center">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <img src="/logo.svg" alt="THE HUB" className="h-12 w-12 mx-auto mb-4" />
              <h1 className="text-3xl font-semibold tracking-tight mb-2">{authText.registerTitle}</h1>
              <p className="text-muted-foreground">{language === "en" ? "Create your account with the essentials." : "Crie sua conta com o essencial."}</p>
            </div>

            <form onSubmit={handleRegister} className="bg-card border border-border/60 rounded-2xl p-8 shadow-2xl space-y-6">
              <div className="max-w-lg mx-auto space-y-4">
                <Input
                  placeholder={authText.fullName}
                  value={form.fullName}
                  onChange={e => updateForm("fullName", e.target.value)}
                  required
                  className="bg-background border-border/70 focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                />
                <Input
                  type="email"
                  placeholder={authText.emailPlaceholder}
                  value={form.email}
                  onChange={e => updateForm("email", e.target.value)}
                  required
                  className="bg-background border-border/70 focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                />
                <Input
                  type="password"
                  placeholder={authText.passwordPlaceholder}
                  value={form.password}
                  onChange={e => updateForm("password", e.target.value)}
                  required
                  className="bg-background border-border/70 focus:border-primary/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border/60">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="px-6 py-3 rounded-lg border border-border/60 hover:bg-muted/30 text-muted-foreground transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {registerText.backToLogin}
              </button>
              <button
                type="submit"
                disabled={isRegistering}
                className="flex-1 px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {isRegistering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {registerText.submit} <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </form>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <MarketingBackground />
      <AppHeader lang={language} setLang={setLanguage} rightCta={{ label: content.signIn, onClick: () => setShowSignInPanel(true) }} />

      <main className="pt-[60px] relative z-10">
        <section className="max-w-[1400px] mx-auto px-6 pt-16 pb-10 grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-7">
            <h1 className="text-5xl md:text-6xl font-semibold leading-[1.02] tracking-tight">
              {content.heroTitle}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              {content.heroDescription}
            </p>

            <div className="grid gap-3 max-w-xl">
              <div className="flex items-center gap-3 text-sm text-foreground/80">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>{content.secureAccess}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground/80">
                <AudioWaveform className="w-4 h-4 text-primary" />
                <span>{content.timeline}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-foreground/80">
                <Clock3 className="w-4 h-4 text-primary" />
                <span>{content.schedule}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSignInPanel(true)}
                className="h-11 px-6 rounded-full bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
              >
                {content.heroPrimary}
              </button>
              <button
                type="button"
                onClick={() => setLocation("/hub-dub/studios")}
                className="h-11 px-6 rounded-full border border-border/70 hover:bg-muted/30 transition-colors"
              >
                {content.heroSecondary}
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="relative aspect-[16/10] bg-card rounded-2xl border border-border/60 shadow-2xl overflow-hidden">
              <img src="/landing/hubdub-mic.svg" alt="HubDub Studio" className="absolute inset-0 w-full h-full object-cover opacity-90" />
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 to-transparent" />
            </div>
            <div className="absolute -inset-6 bg-primary/10 blur-3xl -z-10" />
          </div>
        </section>

        <section className="max-w-[1400px] mx-auto px-6 pb-16">
          <div className="grid md:grid-cols-3 gap-6">
            <div className="rounded-2xl bg-card border border-border/60 p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold tracking-tight mb-2">{content.quality}</h3>
              <p className="text-sm text-muted-foreground">{content.delivery}</p>
            </div>
            <div className="rounded-2xl bg-card border border-border/60 p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <AudioWaveform className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold tracking-tight mb-2">{content.timeline}</h3>
              <p className="text-sm text-muted-foreground">{content.dubbingDirection}</p>
            </div>
            <div className="rounded-2xl bg-card border border-border/60 p-6">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                <Clock3 className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold tracking-tight mb-2">{content.schedule}</h3>
              <p className="text-sm text-muted-foreground">{content.liveScheduled}</p>
            </div>
          </div>
        </section>

        <div className="px-6 pb-10 text-xs text-muted-foreground max-w-[1400px] mx-auto">
          © {new Date().getFullYear()} THE HUB. {content.rights}
        </div>
      </main>

      <AnimatePresence>
        {showSignInPanel ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/45 p-4 flex items-center justify-center"
            onClick={() => setShowSignInPanel(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="w-full max-w-md bg-background border border-border/70 rounded-2xl p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col space-y-2 text-center mb-8">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">{authText.loginTitle}</h2>
                <p className="text-sm text-muted-foreground">{authText.loginSubtitle}</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-4">
                  <Input type="email" placeholder={authText.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background border-border/70 focus:border-primary/60 focus:ring-primary/25 h-11 transition-all text-foreground placeholder:text-muted-foreground" />
                  <Input type="password" placeholder={authText.passwordPlaceholder} value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-background border-border/70 focus:border-primary/60 focus:ring-primary/25 h-11 transition-all text-foreground placeholder:text-muted-foreground" />
                </div>

                <button type="submit" disabled={isLoggingIn} className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2">
                  {isLoggingIn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {authText.loginButton} <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="grid grid-cols-2 gap-2 mt-5 mb-6">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{content.profiles}</p>
                  <p className="text-xs text-foreground">{content.dubbingDirection}</p>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-2 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{content.sessions}</p>
                  <p className="text-xs text-foreground">{content.liveScheduled}</p>
                </div>
              </div>

              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">{authText.newHere}</span>
                </div>
              </div>

              <button onClick={() => { setShowSignInPanel(false); setMode("register"); }} className="w-full h-11 border border-border/70 hover:bg-muted/30 text-foreground font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                {authText.createAccount}
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mic2, Loader2, ArrowRight, ArrowLeft, UserPlus } from "lucide-react";
import { useLocation } from "wouter";
import { pt } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register" | "pending">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, user, register, isRegistering } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [form, setForm] = useState({
    fullName: "", artistName: "", email: "", password: "",
    phone: "", altPhone: "", birthDate: "", city: "", state: "", country: "",
    mainLanguage: "", additionalLanguages: "", experience: "", specialty: "",
    bio: "", portfolioUrl: "",
  });

  if (user) {
    setLocation("/studios");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    login({ email, password }, {
      onError: (err: any) => {
        if (err.message === "pending") {
          setMode("pending");
        } else {
          toast({ title: "Erro ao entrar", description: err.message, variant: "destructive" });
        }
      },
      onSuccess: () => {
        setLocation("/studios");
      }
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.password || !form.phone ||
        !form.city || !form.state || !form.country ||
        !form.mainLanguage || !form.experience || !form.specialty || !form.bio) {
      toast({ title: "Erro", description: "Preencha todos os campos obrigatorios.", variant: "destructive" });
      return;
    }
    register(form, {
      onSuccess: () => {
        setMode("pending");
      },
      onError: (err: any) => {
        toast({ title: "Erro ao criar conta", description: err.message, variant: "destructive" });
      }
    });
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (mode === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-primary/5 blur-[120px] rounded-full" />
        </div>
        <div className="w-full max-w-sm relative page-enter text-center">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-100 ring-1 ring-amber-200 flex items-center justify-center mb-6">
            <Loader2 className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="vhub-page-title text-foreground mb-2" data-testid="text-pending-title">{pt.status.pending}</h1>
          <p className="vhub-body text-muted-foreground mb-8" data-testid="text-pending-message">
            {pt.auth.pendingMessage}
          </p>
          <button
            onClick={() => setMode("login")}
            className="vhub-btn-ghost vhub-btn-sm gap-1.5"
            data-testid="button-back-login"
          >
            <ArrowLeft className="w-4 h-4" />
            {pt.register.backToLogin}
          </button>
        </div>
      </div>
    );
  }

  if (mode === "register") {
    return (
      <div className="min-h-screen bg-background p-4 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-primary/5 blur-[120px] rounded-full" />
        </div>
        <div className="w-full max-w-2xl mx-auto relative page-enter py-8">
          <div className="text-center mb-8">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-6">
              <UserPlus className="w-6 h-6 text-primary" />
            </div>
            <h1 className="vhub-page-title text-foreground mb-2" data-testid="text-register-title">{pt.register.title}</h1>
            <p className="vhub-page-subtitle !mt-0">{pt.register.subtitle}</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="vhub-card-glass rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-sm text-foreground">Dados pessoais</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.fullName} *</label>
                  <Input value={form.fullName} onChange={e => updateForm("fullName", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-fullName" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.artistName}</label>
                  <Input value={form.artistName} onChange={e => updateForm("artistName", e.target.value)} className="h-11 bg-card border-border/60" data-testid="input-artistName" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.auth.email} *</label>
                  <Input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-reg-email" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.auth.password} *</label>
                  <Input type="password" value={form.password} onChange={e => updateForm("password", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-reg-password" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.phone} *</label>
                  <Input value={form.phone} onChange={e => updateForm("phone", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-phone" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.altPhone}</label>
                  <Input value={form.altPhone} onChange={e => updateForm("altPhone", e.target.value)} className="h-11 bg-card border-border/60" data-testid="input-altPhone" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.birthDate} *</label>
                  <Input type="date" value={form.birthDate} onChange={e => updateForm("birthDate", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-birthDate" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.specialty} *</label>
                  <Input value={form.specialty} onChange={e => updateForm("specialty", e.target.value)} placeholder={pt.register.specialtyPlaceholder} className="h-11 bg-card border-border/60" required data-testid="input-specialty" />
                </div>
              </div>
            </div>

            <div className="vhub-card-glass rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-sm text-foreground">Localizacao e idiomas</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.city} *</label>
                  <Input value={form.city} onChange={e => updateForm("city", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-city" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.state} *</label>
                  <Input value={form.state} onChange={e => updateForm("state", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-state" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.country} *</label>
                  <Input value={form.country} onChange={e => updateForm("country", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-country" />
                </div>
                <div className="vhub-field">
                  <label className="vhub-field-label">{pt.register.mainLanguage} *</label>
                  <Input value={form.mainLanguage} onChange={e => updateForm("mainLanguage", e.target.value)} className="h-11 bg-card border-border/60" required data-testid="input-mainLanguage" />
                </div>
                <div className="vhub-field md:col-span-2">
                  <label className="vhub-field-label">{pt.register.additionalLanguages}</label>
                  <Input value={form.additionalLanguages} onChange={e => updateForm("additionalLanguages", e.target.value)} className="h-11 bg-card border-border/60" data-testid="input-additionalLanguages" />
                </div>
              </div>
            </div>

            <div className="vhub-card-glass rounded-2xl p-6 space-y-4">
              <h3 className="font-semibold text-sm text-foreground">Perfil profissional</h3>
              <div className="vhub-field">
                <label className="vhub-field-label">{pt.register.experience} *</label>
                <Textarea value={form.experience} onChange={e => updateForm("experience", e.target.value)} className="bg-card border-border/60 min-h-[80px]" required data-testid="input-experience" />
              </div>
              <div className="vhub-field">
                <label className="vhub-field-label">{pt.register.bio} *</label>
                <Textarea value={form.bio} onChange={e => updateForm("bio", e.target.value)} className="bg-card border-border/60 min-h-[80px]" required data-testid="input-bio" />
              </div>
              <div className="vhub-field">
                <label className="vhub-field-label">{pt.register.portfolioUrl}</label>
                <Input value={form.portfolioUrl} onChange={e => updateForm("portfolioUrl", e.target.value)} placeholder="https://" className="h-11 bg-card border-border/60" data-testid="input-portfolioUrl" />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setMode("login")}
                className="vhub-btn-ghost vhub-btn-md gap-1.5"
                data-testid="button-back-to-login"
              >
                <ArrowLeft className="w-4 h-4" />
                {pt.register.backToLogin}
              </button>
              <button
                type="submit"
                disabled={isRegistering}
                className="vhub-btn-md vhub-btn-primary flex-1"
                data-testid="button-register"
              >
                {isRegistering ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {pt.register.submit}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="mt-8 text-center vhub-caption opacity-50">
            {pt.common.platform}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute top-0 right-1/4 w-[300px] h-[300px] bg-primary/3 blur-[100px] rounded-full" />
      </div>

      <div className="w-full max-w-sm relative page-enter">
        <div className="text-center mb-10">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-6">
            <Mic2 className="w-6 h-6 text-primary" />
          </div>
          <h1 className="vhub-page-title text-foreground mb-2" data-testid="text-welcome">{pt.auth.welcomeBack}</h1>
          <p className="vhub-page-subtitle !mt-0">{pt.auth.signInSubtitle}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="vhub-field">
            <label className="vhub-field-label" htmlFor="email">{pt.auth.email}</label>
            <Input
              id="email"
              type="email"
              placeholder="nome@estudio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-card border-border/60"
              required
              data-testid="input-email"
            />
          </div>

          <div className="vhub-field">
            <label className="vhub-field-label" htmlFor="password">{pt.auth.password}</label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-card border-border/60"
              required
              data-testid="input-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="vhub-btn-md vhub-btn-primary w-full mt-2"
            data-testid="button-login"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {pt.auth.login}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4">
          <button
            onClick={() => setMode("register")}
            className="vhub-btn-ghost vhub-btn-md w-full gap-1.5"
            data-testid="button-create-account"
          >
            <UserPlus className="w-4 h-4" />
            {pt.auth.createAccount}
          </button>
        </div>

        <p className="mt-8 text-center vhub-caption opacity-50">
          {pt.common.platform}
        </p>
      </div>
    </div>
  );
}

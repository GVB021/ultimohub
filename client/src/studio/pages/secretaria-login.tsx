import { useState } from "react";
import { useAuth } from "@studio/hooks/use-auth";
import { Input } from "@studio/components/ui/input";
import { Loader2, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@studio/hooks/use-toast";

export default function SecretariaLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoggingIn, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  if (user) {
    // If already logged in, redirect to studios or dashboard
    // Ideally this would go to a specific secretariat dashboard if one existed
    setLocation("/studios");
    return null;
  }

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    login({ email, password }, {
      onError: (err: any) => {
        toast({ title: "Erro ao entrar na Secretaria", description: err.message, variant: "destructive" });
      },
      onSuccess: () => {
        setLocation("/studios");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4 relative overflow-hidden">
      {/* Different background style for differentiation */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-sm relative page-enter bg-white p-8 rounded-2xl shadow-xl border border-zinc-200">
        <div className="text-center mb-10">
          <div className="mx-auto w-16 h-16 flex items-center justify-center mb-6 bg-blue-50 rounded-2xl">
            <img src="/logo.svg" alt="V.HUB" className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Secretaria V.HUB</h1>
          <p className="text-sm text-muted-foreground">Acesso exclusivo para gestão administrativa</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="email">
              Email Corporativo
            </label>
            <Input
              id="email"
              type="email"
              placeholder="admin@vhub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-zinc-50"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="password">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-zinc-50"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-foreground text-background hover:bg-foreground/90 h-11 px-8 mt-6"
          >
            {isLoggingIn ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Acessar Sistema
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted-foreground opacity-70">
          Sistema Integrado de Gestão V.HUB
        </p>
      </div>
    </div>
  );
}

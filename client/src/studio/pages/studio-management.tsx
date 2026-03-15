import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Loader2, Lock } from "lucide-react";
import { Button } from "@studio/components/ui/button";
import { Input } from "@studio/components/ui/input";
import { Label } from "@studio/components/ui/label";
import { authFetch } from "@studio/lib/auth-fetch";
import { useAuth } from "@studio/hooks/use-auth";
import { useToast } from "@studio/hooks/use-toast";

const AUTHORIZED_EMAIL = "borbaggabriel@gmail.com";

function hasManagementAccess(user: any) {
  const normalizedEmail = String(user?.email || "").trim().toLowerCase();
  const normalizedRole = String(user?.role || "").trim().toLowerCase().replace(/\s+/g, "_");
  return normalizedEmail === AUTHORIZED_EMAIL || normalizedRole === "platform_owner" || normalizedRole === "master" || normalizedRole === "admin";
}

type ManagementSettings = {
  maxVoiceActors: number;
  maxDirectors: number;
  totalSessionsAvailable: number;
  simultaneousProductionsLimit: number;
  maxDirectorsPerSession: number;
  maxDubbersStudentsPerSession: number;
};

type FormState = Record<keyof ManagementSettings, string>;

const EMPTY_FORM: FormState = {
  maxVoiceActors: "",
  maxDirectors: "",
  totalSessionsAvailable: "",
  simultaneousProductionsLimit: "",
  maxDirectorsPerSession: "",
  maxDubbersStudentsPerSession: "",
};

export default function StudioManagementPage() {
  const { studioId } = useParams<{ studioId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const canAccess = hasManagementAccess(user);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof ManagementSettings, string>>>({});
  const [feedback, setFeedback] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["/api/admin/studios", studioId, "management-settings"],
    queryFn: () => authFetch(`/api/admin/studios/${studioId}/management-settings`) as Promise<{ studio: { id: string; name: string }; settings: ManagementSettings }>,
    enabled: canAccess && Boolean(studioId),
  });

  useEffect(() => {
    if (!data?.settings) return;
    setForm({
      maxVoiceActors: String(data.settings.maxVoiceActors),
      maxDirectors: String(data.settings.maxDirectors),
      totalSessionsAvailable: String(data.settings.totalSessionsAvailable),
      simultaneousProductionsLimit: String(data.settings.simultaneousProductionsLimit),
      maxDirectorsPerSession: String(data.settings.maxDirectorsPerSession),
      maxDubbersStudentsPerSession: String(data.settings.maxDubbersStudentsPerSession),
    });
    setErrors({});
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (payload: ManagementSettings) =>
      authFetch(`/api/admin/studios/${studioId}/management-settings`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }) as Promise<ManagementSettings>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/studios", studioId, "management-settings"] });
      setFeedback("Alterações salvas com sucesso");
      toast({ title: "Configurações salvas" });
    },
    onError: (error: any) => {
      setFeedback("");
      toast({ title: error?.message || "Falha ao salvar configurações", variant: "destructive" });
    },
  });

  const fields = useMemo(() => ([
    { key: "maxVoiceActors", label: "Capacidade máxima de dubladores" },
    { key: "maxDirectors", label: "Capacidade máxima de diretores" },
    { key: "totalSessionsAvailable", label: "Número total de sessões disponíveis" },
    { key: "simultaneousProductionsLimit", label: "Limite de produções simultâneas" },
    { key: "maxDirectorsPerSession", label: "Máximo de diretores por sessão" },
    { key: "maxDubbersStudentsPerSession", label: "Máximo de dubladores/alunos por sessão" },
  ]) as Array<{ key: keyof ManagementSettings; label: string }>, []);

  const handleInputChange = (key: keyof ManagementSettings, value: string) => {
    setFeedback("");
    if (!/^\d*$/.test(value)) return;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: Partial<Record<keyof ManagementSettings, string>> = {};
    for (const field of fields) {
      const raw = String(form[field.key] || "").trim();
      if (!raw) {
        nextErrors[field.key] = "Campo obrigatório";
        continue;
      }
      const numeric = Number(raw);
      if (!Number.isInteger(numeric) || numeric <= 0) {
        nextErrors[field.key] = "Use um número inteiro positivo";
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    if (!studioId) {
      toast({ title: "Estúdio inválido", variant: "destructive" });
      return;
    }
    const payload: ManagementSettings = {
      maxVoiceActors: Number(form.maxVoiceActors),
      maxDirectors: Number(form.maxDirectors),
      totalSessionsAvailable: Number(form.totalSessionsAvailable),
      simultaneousProductionsLimit: Number(form.simultaneousProductionsLimit),
      maxDirectorsPerSession: Number(form.maxDirectorsPerSession),
      maxDubbersStudentsPerSession: Number(form.maxDubbersStudentsPerSession),
    };
    updateMutation.mutate(payload);
  };

  if (!canAccess) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 md:p-10 text-center">
          <Lock className="w-10 h-10 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold">Acesso Negado</h1>
          <p className="text-sm text-muted-foreground mt-2">Você não possui permissão para acessar esta página.</p>
          <Button className="mt-6" variant="outline" onClick={() => setLocation("/hub-dub/admin")} data-testid="button-management-back-denied">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!studioId) {
    return (
      <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 md:p-10 text-center">
          <h1 className="text-2xl font-bold">Estúdio não encontrado</h1>
          <p className="text-sm text-muted-foreground mt-2">Não foi possível identificar o estúdio para gerenciamento.</p>
          <Button className="mt-6" variant="outline" onClick={() => setLocation("/hub-dub/admin")} data-testid="button-management-back-missing-studio">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" onClick={() => setLocation("/hub-dub/admin")} className="gap-2" data-testid="button-management-back">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao painel
          </Button>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
            <Building2 className="w-3.5 h-3.5" />
            Gestão exclusiva de estúdio
          </div>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 md:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Gestão de Estúdio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? "Carregando configurações..." : `Estúdio: ${data?.studio?.name || "—"}`}
            </p>
            {isError && (
              <p className="text-sm text-destructive mt-2" data-testid="text-management-load-error">
                {(error as any)?.message || "Falha ao carregar configurações de gestão"}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            {fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  id={field.key}
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form[field.key]}
                  onChange={(event) => handleInputChange(field.key, event.target.value)}
                  disabled={isLoading || updateMutation.isPending}
                  data-testid={`input-management-${field.key}`}
                />
                {errors[field.key] && <p className="text-xs text-destructive">{errors[field.key]}</p>}
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="text-sm text-emerald-500 min-h-5" data-testid="text-management-feedback">
              {feedback}
            </div>
            <Button onClick={handleSave} disabled={isLoading || updateMutation.isPending} data-testid="button-save-management-settings">
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar alterações
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useState, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@studio/lib/auth-fetch";
import {
  Users, CheckCircle2, XCircle, Loader2, UserPlus, Pencil,
  BarChart3, Film, Calendar, Mic2, Shield, Trash2, Download, Settings
} from "lucide-react";
import { Button } from "@studio/components/ui/button";
import { Badge } from "@studio/components/ui/badge";
import { Checkbox } from "@studio/components/ui/checkbox";
import { Label } from "@studio/components/ui/label";
import { Input } from "@studio/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@studio/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@studio/components/ui/select";
import {
  PageSection, PageHeader, EmptyState, StatCard, RoleBadge, StatusBadge
} from "@studio/components/ui/design-system";
import { pt } from "@studio/lib/i18n";
import { useToast } from "@studio/hooks/use-toast";
import { useStudioRole } from "@studio/hooks/use-studio-role";
import { useAuth } from "@studio/hooks/use-auth";
import { format } from "date-fns";

const STUDIO_ROLES = [
  { value: "studio_admin", label: pt.roles.studio_admin },
  { value: "diretor", label: pt.roles.diretor },
  { value: "engenheiro_audio", label: pt.roles.engenheiro_audio },
  { value: "dublador", label: pt.roles.dublador },
  { value: "aluno", label: "Aluno" },
];

const PRODUCTION_STATUSES = [
  { value: "planned", label: "Planejada" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "completed", label: "Concluida" },
];

const SESSION_STATUSES = [
  { value: "scheduled", label: "Agendada" },
  { value: "in_progress", label: "Em Progresso" },
  { value: "completed", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
];

type AdminTab = "overview" | "pending" | "members" | "productions" | "sessions" | "takes" | "settings";
type TimecodeFormat = "HH:MM:SS" | "HH:MM:SS:MMM" | "HH:MM:SS:FF";

const StudioAdmin = memo(function StudioAdmin({ studioId }: { studioId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canManageMembers } = useStudioRole(studioId);
  const { user } = useAuth();
  const isPlatformOwner = user?.role === "platform_owner";
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");

  const [selectedRoles, setSelectedRoles] = useState<Record<string, string[]>>({});
  const [editMember, setEditMember] = useState<any | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [removeMemberConfirm, setRemoveMemberConfirm] = useState<any | null>(null);

  const [createProductionOpen, setCreateProductionOpen] = useState(false);
  const [newProductionName, setNewProductionName] = useState("");
  const [newProductionDesc, setNewProductionDesc] = useState("");
  const [editProduction, setEditProduction] = useState<any | null>(null);
  const [editProductionForm, setEditProductionForm] = useState({ name: "", description: "", videoUrl: "", status: "" });
  const [deleteProductionConfirm, setDeleteProductionConfirm] = useState<any | null>(null);

  const [createSessionOpen, setCreateSessionOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState("");
  const [newSessionProductionId, setNewSessionProductionId] = useState("");
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionDuration, setNewSessionDuration] = useState("60");
  const [editSession, setEditSession] = useState<any | null>(null);
  const [editSessionForm, setEditSessionForm] = useState({ title: "", scheduledAt: "", durationMinutes: "60", status: "" });
  const [deleteSessionConfirm, setDeleteSessionConfirm] = useState<any | null>(null);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/studios", studioId, "stats"],
    queryFn: () => authFetch(`/api/studios/${studioId}/stats`),
  });

  const { data: pendingMembers, isLoading: pendingLoading } = useQuery({
    queryKey: ["/api/studios", studioId, "pending-members"],
    queryFn: () => authFetch(`/api/studios/${studioId}/pending-members`),
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["/api/studios", studioId, "members"],
    queryFn: () => authFetch(`/api/studios/${studioId}/members`),
  });

  const { data: productions, isLoading: prodsLoading } = useQuery({
    queryKey: ["/api/studios", studioId, "productions"],
    queryFn: () => authFetch(`/api/studios/${studioId}/productions`),
  });

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ["/api/studios", studioId, "sessions"],
    queryFn: () => authFetch(`/api/studios/${studioId}/sessions`),
  });

  const { data: takesGrouped, isLoading: takesLoading } = useQuery({
    queryKey: ["/api/studios", studioId, "takes-grouped"],
    queryFn: () => authFetch(`/api/studios/${studioId}/takes/grouped`),
    enabled: activeTab === "takes",
  });

  const { data: timecodeSettings, isLoading: timecodeLoading } = useQuery<{ format: TimecodeFormat }>({
    queryKey: ["/api/studios", studioId, "timecode-format"],
    queryFn: () => authFetch(`/api/studios/${studioId}/timecode-format`),
    enabled: activeTab === "settings",
  });

  const updateTimecodeMutation = useMutation({
    mutationFn: async (format: TimecodeFormat) => {
      return authFetch(`/api/studios/${studioId}/timecode-format`, {
        method: "PUT",
        body: JSON.stringify({ format }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "timecode-format"] });
      toast({ title: "Formato de timecode atualizado" });
    },
    onError: (err: any) => {
      toast({ title: "Falha ao salvar timecode", description: err?.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ membershipId, roles }: { membershipId: string; roles: string[] }) => {
      return authFetch(`/api/studios/${studioId}/members/${membershipId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "pending-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      toast({ title: "Membro aprovado com sucesso" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      return authFetch(`/api/studios/${studioId}/members/${membershipId}/reject`, { method: "POST" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "pending-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      toast({ title: "Membro rejeitado" });
    },
  });

  const updateRolesMutation = useMutation({
    mutationFn: async ({ membershipId, roles }: { membershipId: string; roles: string[] }) => {
      return authFetch(`/api/studios/${studioId}/members/${membershipId}/roles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "members"] });
      setEditMember(null);
      toast({ title: "Papeis atualizados" });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      if (!isPlatformOwner) throw new Error("Somente PLATFORM_OWNER pode remover membros.");
      return authFetch(`/api/studios/${studioId}/members/${membershipId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      setRemoveMemberConfirm(null);
      toast({ title: "Membro removido" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao remover membro", description: err?.message, variant: "destructive" });
    },
  });

  const createProductionMutation = useMutation({
    mutationFn: async () => {
      return authFetch(`/api/studios/${studioId}/productions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProductionName, description: newProductionDesc, studioId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "productions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      setCreateProductionOpen(false);
      setNewProductionName(""); setNewProductionDesc("");
      toast({ title: "Producao criada" });
    },
  });

  const updateProductionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return authFetch(`/api/studios/${studioId}/productions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "productions"] });
      setEditProduction(null);
      toast({ title: "Producao atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" });
    },
  });

  const deleteProductionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isPlatformOwner) throw new Error("Somente PLATFORM_OWNER pode excluir produções.");
      return authFetch(`/api/studios/${studioId}/productions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "productions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      setDeleteProductionConfirm(null);
      toast({ title: "Producao excluida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      return authFetch(`/api/studios/${studioId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newSessionTitle,
          productionId: newSessionProductionId,
          studioId,
          scheduledAt: newSessionDate,
          durationMinutes: parseInt(newSessionDuration) || 60,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      setCreateSessionOpen(false);
      setNewSessionTitle(""); setNewSessionProductionId(""); setNewSessionDate(""); setNewSessionDuration("60");
      toast({ title: "Sessao criada" });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return authFetch(`/api/studios/${studioId}/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "sessions"] });
      setEditSession(null);
      toast({ title: "Sessao atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!isPlatformOwner) throw new Error("Somente PLATFORM_OWNER pode excluir sessões.");
      return authFetch(`/api/studios/${studioId}/sessions/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "stats"] });
      setDeleteSessionConfirm(null);
      toast({ title: "Sessao excluida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    },
  });

  function toggleRole(membershipId: string, role: string) {
    setSelectedRoles(prev => {
      const current = prev[membershipId] || [];
      const updated = current.includes(role)
        ? current.filter(r => r !== role)
        : [...current, role];
      return { ...prev, [membershipId]: updated };
    });
  }

  const approvedMembers = members?.filter((m: any) => m.status === "approved") || [];

  const tabs: { key: AdminTab; label: string; icon: typeof BarChart3; count?: number }[] = [
    { key: "overview", label: "Visao Geral", icon: BarChart3 },
    { key: "pending", label: "Cadastros Pendentes", icon: UserPlus, count: pendingMembers?.length || 0 },
    { key: "members", label: "Membros Ativos", icon: Users, count: approvedMembers.length },
    { key: "productions", label: "Producoes", icon: Film, count: productions?.length || 0 },
    { key: "sessions", label: "Sessoes", icon: Calendar, count: sessions?.length || 0 },
    { key: "takes", label: "Takes de Audio", icon: Mic2 },
    { key: "settings", label: "Configuracoes", icon: Settings },
  ];

  return (
    <PageSection>
      <PageHeader
        label="Administracao"
        title="Painel do Estudio"
        subtitle="Gerencie membros, producoes e sessoes do seu estudio"
      />

      <div className="flex flex-col lg:flex-row gap-6">
        <nav className="lg:w-56 shrink-0">
          <div className="vhub-card p-2 space-y-0.5">
            {tabs.map(tab => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-primary/15 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                  }`}
                  data-testid={`tab-${tab.key}`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tab.count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="flex-1 min-w-0">
          {activeTab === "overview" && (
            <div className="space-y-6 page-enter">
              {statsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard label="Membros" value={stats?.members ?? 0} icon={<Users className="w-4 h-4 text-primary" />} />
                  <StatCard label="Pendentes" value={stats?.pendingMembers ?? 0} icon={<UserPlus className="w-4 h-4 text-blue-500" />} />
                  <StatCard label="Producoes" value={stats?.productions ?? 0} icon={<Film className="w-4 h-4 text-violet-500" />} />
                  <StatCard label="Sessoes" value={stats?.sessions ?? 0} icon={<Calendar className="w-4 h-4 text-emerald-500" />} />
                  <StatCard label="Takes" value={stats?.takes ?? 0} icon={<Mic2 className="w-4 h-4 text-rose-500" />} />
                </div>
              )}
            </div>
          )}

          {activeTab === "pending" && (
            <div className="space-y-4 page-enter">
              <div className="flex items-center gap-2 mb-2">
                <UserPlus className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-foreground">Cadastros Pendentes</h3>
                {(pendingMembers?.length ?? 0) > 0 && (
                  <Badge variant="secondary">{pendingMembers.length}</Badge>
                )}
              </div>
              {pendingLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : pendingMembers?.length > 0 ? (
                pendingMembers.map((m: any) => (
                  <div key={m.id} className="vhub-card p-4" data-testid={`pending-member-${m.id}`}>
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-blue-500/15 ring-1 ring-blue-500/30 flex items-center justify-center text-blue-500 font-bold text-sm shrink-0">
                          {(m.user?.fullName || m.user?.email || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-foreground truncate">
                            {m.user?.fullName || m.user?.displayName || m.user?.email}
                          </h4>
                          <p className="text-xs text-muted-foreground">{m.user?.email}</p>
                          {m.user?.specialty && (
                            <p className="text-xs text-muted-foreground mt-0.5">{m.user.specialty}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pl-14">
                        {STUDIO_ROLES.map(r => (
                          <label key={r.value} className="flex items-center gap-1.5 cursor-pointer">
                            <Checkbox
                              checked={(selectedRoles[m.id] || []).includes(r.value)}
                              onCheckedChange={() => toggleRole(m.id, r.value)}
                              data-testid={`check-role-${m.id}-${r.value}`}
                            />
                            <span className="text-xs text-foreground">{r.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pl-14">
                        <Button
                          size="sm" className="gap-1 text-xs"
                          disabled={!(selectedRoles[m.id]?.length) || approveMutation.isPending}
                          onClick={() => approveMutation.mutate({ membershipId: m.id, roles: selectedRoles[m.id] })}
                          data-testid={`button-approve-${m.id}`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
                        </Button>
                        <Button
                          size="sm" variant="outline" className="gap-1 text-xs text-destructive"
                          disabled={rejectMutation.isPending}
                          onClick={() => rejectMutation.mutate(m.id)}
                          data-testid={`button-reject-${m.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState icon={<UserPlus className="w-5 h-5" />} title="Nenhum cadastro pendente" description="Todos os cadastros foram processados." />
              )}
            </div>
          )}

          {activeTab === "members" && (
            <div className="space-y-4 page-enter">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-foreground">Membros Ativos</h3>
                <Badge variant="secondary">{approvedMembers.length}</Badge>
              </div>
              {membersLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : approvedMembers.length > 0 ? (
                <div className="vhub-card overflow-hidden">
                  <div className="vhub-table-header">
                    <span className="vhub-col-label flex-1">Membro</span>
                    <span className="vhub-col-label flex-1">Email</span>
                    <span className="vhub-col-label flex-1">Papeis</span>
                    {canManageMembers && <span className="vhub-col-label w-20"></span>}
                  </div>
                  <div className="divide-y divide-border/40">
                    {approvedMembers.map((m: any) => {
                      const memberRoles: string[] = m.roles || (m.role ? [m.role] : []);
                      return (
                        <div key={m.id} className="vhub-table-row" data-testid={`member-${m.id}`}>
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/15 ring-1 ring-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                              {(m.user?.fullName || m.user?.email || "?").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-foreground truncate">
                              {m.user?.fullName || m.user?.displayName || m.user?.email}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground flex-1">{m.user?.email}</span>
                          <div className="flex flex-wrap gap-1 flex-1">
                            {memberRoles.map(r => <RoleBadge key={r} role={r} />)}
                          </div>
                          {canManageMembers && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon" variant="ghost"
                                onClick={() => { setEditMember(m); setEditRoles(memberRoles); }}
                                data-testid={`button-edit-roles-${m.id}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              {isPlatformOwner && (
                                <Button
                                  size="icon" variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => setRemoveMemberConfirm(m)}
                                  data-testid={`button-remove-member-${m.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <EmptyState icon={<Users className="w-5 h-5" />} title="Nenhum membro ativo" description="" />
              )}
            </div>
          )}

          {activeTab === "productions" && (
            <div className="space-y-4 page-enter">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Film className="w-4 h-4 text-violet-500" />
                  <h3 className="text-sm font-semibold text-foreground">Producoes</h3>
                  <Badge variant="secondary">{productions?.length || 0}</Badge>
                </div>
                <Button size="sm" onClick={() => setCreateProductionOpen(true)} data-testid="button-new-production">
                  Nova Producao
                </Button>
              </div>
              {prodsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : productions?.length > 0 ? (
                <div className="vhub-card overflow-hidden">
                  <div className="vhub-table-header">
                    <span className="vhub-col-label flex-1">Nome</span>
                    <span className="vhub-col-label flex-1">Descricao</span>
                    <span className="vhub-col-label">Status</span>
                    <span className="vhub-col-label w-20"></span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {productions.map((p: any) => (
                      <div key={p.id} className="vhub-table-row" data-testid={`production-${p.id}`}>
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground flex-1 truncate">{p.description || "-"}</span>
                        <StatusBadge status={p.status || "planned"} />
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => {
                              setEditProduction(p);
                              setEditProductionForm({ name: p.name, description: p.description || "", videoUrl: p.videoUrl || "", status: p.status || "planned" });
                            }}
                            data-testid={`button-edit-production-${p.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {isPlatformOwner && (
                            <Button
                              size="icon" variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteProductionConfirm(p)}
                              data-testid={`button-delete-production-${p.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Film className="w-5 h-5" />}
                  title="Nenhuma producao"
                  description="Crie sua primeira producao."
                  action={<Button size="sm" onClick={() => setCreateProductionOpen(true)}>Nova Producao</Button>}
                />
              )}
            </div>
          )}

          {activeTab === "sessions" && (
            <div className="space-y-4 page-enter">
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold text-foreground">Sessoes</h3>
                  <Badge variant="secondary">{sessions?.length || 0}</Badge>
                </div>
                <Button size="sm" onClick={() => setCreateSessionOpen(true)} data-testid="button-new-session">
                  Nova Sessao
                </Button>
              </div>
              {sessionsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : sessions?.length > 0 ? (
                <div className="vhub-card overflow-hidden">
                  <div className="vhub-table-header">
                    <span className="vhub-col-label flex-1">Titulo</span>
                    <span className="vhub-col-label">Data</span>
                    <span className="vhub-col-label">Duracao</span>
                    <span className="vhub-col-label">Status</span>
                    <span className="vhub-col-label w-20"></span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {sessions.map((s: any) => (
                      <div key={s.id} className="vhub-table-row" data-testid={`session-${s.id}`}>
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{s.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {s.scheduledAt ? format(new Date(s.scheduledAt), "dd/MM/yy HH:mm") : "-"}
                        </span>
                        <span className="text-xs text-muted-foreground">{s.durationMinutes}min</span>
                        <StatusBadge status={s.status || "scheduled"} />
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => {
                              setEditSession(s);
                              const dt = s.scheduledAt ? new Date(s.scheduledAt).toISOString().slice(0, 16) : "";
                              setEditSessionForm({ title: s.title, scheduledAt: dt, durationMinutes: String(s.durationMinutes || 60), status: s.status || "scheduled" });
                            }}
                            data-testid={`button-edit-session-${s.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {isPlatformOwner && (
                            <Button
                              size="icon" variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteSessionConfirm(s)}
                              data-testid={`button-delete-session-${s.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={<Calendar className="w-5 h-5" />}
                  title="Nenhuma sessao"
                  description="Agende sua primeira sessao."
                  action={<Button size="sm" onClick={() => setCreateSessionOpen(true)}>Nova Sessao</Button>}
                />
              )}
            </div>
          )}

          {activeTab === "takes" && (
            <div className="space-y-4 page-enter">
              <div className="flex items-center gap-2 mb-2">
                <Mic2 className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-foreground">Takes de Audio</h3>
              </div>
              {takesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : takesGrouped && Array.isArray(takesGrouped) && takesGrouped.length > 0 ? (
                <div className="space-y-4">
                  {takesGrouped.map((group: any) => (
                    <div key={group.sessionId} className="vhub-card overflow-hidden">
                      <div className="px-4 py-3 border-b border-border/40">
                        <h4 className="text-sm font-semibold text-foreground">{group.sessionTitle || "Sessao sem titulo"}</h4>
                        <p className="text-xs text-muted-foreground">{group.takes?.length || 0} takes</p>
                      </div>
                      <div className="divide-y divide-border/40">
                        {(group.takes || []).map((take: any) => (
                          <div key={take.id} className="flex items-center gap-4 px-4 py-3" data-testid={`take-${take.id}`}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{take.characterName || "Personagem"}</p>
                              <p className="text-xs text-muted-foreground">{take.voiceActorName || "Dublador"}</p>
                            </div>
                            <span className="text-xs text-muted-foreground">Take #{take.takeNumber}</span>
                            {take.isPreferred && <Badge variant="default" className="text-[10px]">Preferido</Badge>}
                            <a
                              href={`/api/takes/${take.id}/download`}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                              data-testid={`button-download-take-${take.id}`}
                            >
                              <Download className="w-3.5 h-3.5" /> Baixar
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Mic2 className="w-5 h-5" />} title="Nenhum take" description="Ainda nao ha takes gravados neste estudio." />
              )}
            </div>
          )}

          {activeTab === "settings" && (
            <div className="space-y-4 page-enter">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Configuração de Timecode</h3>
              </div>
              <div className="vhub-card p-5 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Defina o formato padrão de timecode usado no RecordingRoom deste estúdio.
                </p>
                {timecodeLoading ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Carregando configuração
                  </div>
                ) : (
                  <div className="max-w-sm">
                    <Select
                      value={timecodeSettings?.format || "HH:MM:SS"}
                      onValueChange={(value) => updateTimecodeMutation.mutate(value as TimecodeFormat)}
                    >
                      <SelectTrigger data-testid="select-timecode-format">
                        <SelectValue placeholder="Selecione o formato de timecode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HH:MM:SS">00:00:00 (HH:MM:SS)</SelectItem>
                        <SelectItem value="HH:MM:SS:MMM">00:00:00:000 (HH:MM:SS:MMM)</SelectItem>
                        <SelectItem value="HH:MM:SS:FF">00:00:00:00 (HH:MM:SS:FF)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!editMember} onOpenChange={v => { if (!v) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Papeis</DialogTitle>
            <DialogDescription>
              Selecione os papeis de {editMember?.user?.fullName || editMember?.user?.displayName || editMember?.user?.email} neste estudio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {STUDIO_ROLES.map(r => (
              <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={editRoles.includes(r.value)}
                  onCheckedChange={() => {
                    setEditRoles(prev =>
                      prev.includes(r.value) ? prev.filter(x => x !== r.value) : [...prev, r.value]
                    );
                  }}
                  data-testid={`check-edit-role-${r.value}`}
                />
                <Label className="cursor-pointer">{r.label}</Label>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMember(null)}>Cancelar</Button>
            <Button
              disabled={editRoles.length === 0 || updateRolesMutation.isPending}
              onClick={() => editMember && updateRolesMutation.mutate({ membershipId: editMember.id, roles: editRoles })}
              data-testid="button-save-roles"
            >
              {updateRolesMutation.isPending ? "Salvando..." : "Salvar Papeis"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlatformOwner && !!removeMemberConfirm} onOpenChange={v => { if (!v) setRemoveMemberConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Membro</DialogTitle>
            <DialogDescription>
              Deseja remover {removeMemberConfirm?.user?.fullName || removeMemberConfirm?.user?.email} deste estudio? Esta acao nao pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={removeMemberMutation.isPending}
              onClick={() => removeMemberConfirm && removeMemberMutation.mutate(removeMemberConfirm.id)}
              data-testid="button-confirm-remove-member"
            >
              {removeMemberMutation.isPending ? "Removendo..." : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editProduction} onOpenChange={v => { if (!v) setEditProduction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Producao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="vhub-field">
              <label className="vhub-field-label">Nome</label>
              <Input value={editProductionForm.name} onChange={e => setEditProductionForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-production-name" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Descricao</label>
              <Input value={editProductionForm.description} onChange={e => setEditProductionForm(f => ({ ...f, description: e.target.value }))} data-testid="input-edit-production-desc" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">URL do Video</label>
              <Input value={editProductionForm.videoUrl} onChange={e => setEditProductionForm(f => ({ ...f, videoUrl: e.target.value }))} data-testid="input-edit-production-video" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Status</label>
              <Select value={editProductionForm.status} onValueChange={v => setEditProductionForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-edit-production-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProduction(null)}>Cancelar</Button>
            <Button
              disabled={!editProductionForm.name.trim() || updateProductionMutation.isPending}
              onClick={() => editProduction && updateProductionMutation.mutate({ id: editProduction.id, data: editProductionForm })}
              data-testid="button-save-production"
            >
              {updateProductionMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlatformOwner && !!deleteProductionConfirm} onOpenChange={v => { if (!v) setDeleteProductionConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Producao</DialogTitle>
            <DialogDescription>Excluir permanentemente "{deleteProductionConfirm?.name}"? Sessoes e takes associados podem ser afetados.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProductionConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteProductionMutation.isPending}
              onClick={() => deleteProductionConfirm && deleteProductionMutation.mutate(deleteProductionConfirm.id)}
              data-testid="button-confirm-delete-production"
            >
              {deleteProductionMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSession} onOpenChange={v => { if (!v) setEditSession(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Sessao</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="vhub-field">
              <label className="vhub-field-label">Titulo</label>
              <Input value={editSessionForm.title} onChange={e => setEditSessionForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-session-title" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Data e Hora</label>
              <Input type="datetime-local" value={editSessionForm.scheduledAt} onChange={e => setEditSessionForm(f => ({ ...f, scheduledAt: e.target.value }))} data-testid="input-edit-session-date" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Duracao (minutos)</label>
              <Input type="number" value={editSessionForm.durationMinutes} onChange={e => setEditSessionForm(f => ({ ...f, durationMinutes: e.target.value }))} data-testid="input-edit-session-duration" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Status</label>
              <Select value={editSessionForm.status} onValueChange={v => setEditSessionForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-edit-session-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSession(null)}>Cancelar</Button>
            <Button
              disabled={!editSessionForm.title.trim() || updateSessionMutation.isPending}
              onClick={() => editSession && updateSessionMutation.mutate({
                id: editSession.id,
                data: { title: editSessionForm.title, scheduledAt: editSessionForm.scheduledAt, durationMinutes: parseInt(editSessionForm.durationMinutes) || 60, status: editSessionForm.status },
              })}
              data-testid="button-save-session"
            >
              {updateSessionMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPlatformOwner && !!deleteSessionConfirm} onOpenChange={v => { if (!v) setDeleteSessionConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Sessao</DialogTitle>
            <DialogDescription>Excluir permanentemente "{deleteSessionConfirm?.title}"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSessionConfirm(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={deleteSessionMutation.isPending}
              onClick={() => deleteSessionConfirm && deleteSessionMutation.mutate(deleteSessionConfirm.id)}
              data-testid="button-confirm-delete-session"
            >
              {deleteSessionMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createProductionOpen} onOpenChange={setCreateProductionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Producao</DialogTitle>
            <DialogDescription>Preencha os dados da nova producao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="vhub-field">
              <label className="vhub-field-label">Nome</label>
              <Input value={newProductionName} onChange={e => setNewProductionName(e.target.value)} placeholder="Nome da producao" data-testid="input-production-name" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Descricao</label>
              <Input value={newProductionDesc} onChange={e => setNewProductionDesc(e.target.value)} placeholder="Descricao (opcional)" data-testid="input-production-desc" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProductionOpen(false)}>Cancelar</Button>
            <Button
              disabled={!newProductionName.trim() || createProductionMutation.isPending}
              onClick={() => createProductionMutation.mutate()}
              data-testid="button-create-production"
            >
              {createProductionMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createSessionOpen} onOpenChange={setCreateSessionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Sessao</DialogTitle>
            <DialogDescription>Agende uma nova sessao de gravacao.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="vhub-field">
              <label className="vhub-field-label">Titulo</label>
              <Input value={newSessionTitle} onChange={e => setNewSessionTitle(e.target.value)} placeholder="Titulo da sessao" data-testid="input-session-title" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Producao</label>
              <Select value={newSessionProductionId} onValueChange={setNewSessionProductionId}>
                <SelectTrigger data-testid="select-session-production">
                  <SelectValue placeholder="Selecionar producao" />
                </SelectTrigger>
                <SelectContent>
                  {(productions || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Data e Hora</label>
              <Input type="datetime-local" value={newSessionDate} onChange={e => setNewSessionDate(e.target.value)} data-testid="input-session-date" />
            </div>
            <div className="vhub-field">
              <label className="vhub-field-label">Duracao (minutos)</label>
              <Input type="number" value={newSessionDuration} onChange={e => setNewSessionDuration(e.target.value)} data-testid="input-session-duration" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSessionOpen(false)}>Cancelar</Button>
            <Button
              disabled={!newSessionTitle.trim() || !newSessionProductionId || !newSessionDate || createSessionMutation.isPending}
              onClick={() => createSessionMutation.mutate()}
              data-testid="button-create-session"
            >
              {createSessionMutation.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageSection>
  );
});

export default StudioAdmin;

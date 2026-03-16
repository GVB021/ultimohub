import { useState } from "react";
import { useAuth } from "@studio/hooks/use-auth";
import { useLocation } from "wouter";
import {
  ShieldAlert, LayoutDashboard, Users, Building2, Film,
  Calendar, Mic2, ClipboardList, KeyRound, HardDrive,
  LogOut, ChevronRight, Trash2, Pencil, Plus, RotateCcw,
  CheckCircle2, AlertCircle, Save, Search, RefreshCw,
  Eye, EyeOff, Activity, Database, BadgeCheck, XCircle,
  UserCog, ToggleLeft, ToggleRight, Star, Download
} from "lucide-react";
import { Button } from "@studio/components/ui/button";
import { Input } from "@studio/components/ui/input";
import { Badge } from "@studio/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@studio/lib/auth-fetch";
import { useToast } from "@studio/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@studio/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@studio/components/ui/select";
import { Label } from "@studio/components/ui/label";
import { Checkbox } from "@studio/components/ui/checkbox";
import { Textarea } from "@studio/components/ui/textarea";

type Section =
  | "overview" | "pending" | "users" | "studios" | "productions"
  | "sessions" | "takes" | "logs" | "integrations";

const NAV: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview", label: "Visao Geral", icon: LayoutDashboard },
  { id: "pending", label: "Pendentes", icon: AlertCircle },
  { id: "users", label: "Usuarios", icon: Users },
  { id: "studios", label: "Estudios", icon: Building2 },
  { id: "productions", label: "Producoes", icon: Film },
  { id: "sessions", label: "Sessoes", icon: Calendar },
  { id: "takes", label: "Takes de Audio", icon: Mic2 },
  { id: "logs", label: "Logs de Auditoria", icon: ClipboardList },
  { id: "integrations", label: "API e Integracoes", icon: KeyRound },
];

const ROLES = ["platform_owner", "user", "aluno"];

const ALL_STUDIO_ROLES = [
  { value: "studio_admin", label: "Admin Estudio" },
  { value: "diretor", label: "Diretor" },
  { value: "engenheiro_audio", label: "Engenheiro de Audio" },
  { value: "dublador", label: "Dublador" },
  { value: "aluno", label: "Aluno" },
];

function roleBadgeVariant(role: string): "destructive" | "default" | "secondary" | "outline" {
  if (role === "platform_owner") return "destructive";
  if (role === "studio_admin") return "default";
  if (role === "diretor") return "secondary";
  return "outline";
}

function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = "Excluir", danger = true }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description: string; confirmLabel?: string; danger?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? "destructive" : "default"} onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  return (
    <div className="vhub-card p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="vhub-label">{label}</span>
        <div className={`shrink-0 w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
      </div>
      <div className="text-3xl font-bold text-foreground">{value}</div>
    </div>
  );
}

function OverviewSection() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => authFetch("/api/admin/stats") as Promise<Record<string, number>>,
    refetchInterval: 5000,
  });
  const { data: logs } = useQuery({
    queryKey: ["/api/admin/audit"],
    queryFn: () => authFetch("/api/admin/audit") as Promise<any[]>,
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-4">Visao Geral do Sistema</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Usuarios" value={isLoading ? "—" : stats?.users ?? 0} icon={Users} color="text-primary" />
          <StatCard label="Pendentes" value={isLoading ? "—" : stats?.pendingUsers ?? 0} icon={AlertCircle} color="text-blue-400" />
          <StatCard label="Estudios" value={isLoading ? "—" : stats?.studios ?? 0} icon={Building2} color="text-violet-400" />
          <StatCard label="Producoes" value={isLoading ? "—" : stats?.productions ?? 0} icon={Film} color="text-emerald-400" />
          <StatCard label="Sessoes" value={isLoading ? "—" : stats?.sessions ?? 0} icon={Calendar} color="text-primary" />
          <StatCard label="Takes" value={isLoading ? "—" : stats?.takes ?? 0} icon={Mic2} color="text-rose-400" />
        </div>
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="vhub-card-header">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <Activity className="h-4 w-4" /> Atividade Recente
          </div>
        </div>
        <div className="vhub-card-body">
          {!logs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de auditoria.</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 10).map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 text-sm py-2 border-b border-white/6 last:border-0">
                  <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground w-36 shrink-0">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                  <span className="font-medium">{log.action}</span>
                  {log.details && <span className="text-muted-foreground truncate">{log.details}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PendingUsersSection() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: pendingUsers = [], isLoading } = useQuery({
    queryKey: ["/api/admin/pending-users"],
    queryFn: () => authFetch("/api/admin/pending-users") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: studiosList = [] } = useQuery({
    queryKey: ["/api/studios"],
    queryFn: () => authFetch("/api/studios") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const [approveUser, setApproveUser] = useState<any | null>(null);
  const [approveStudioId, setApproveStudioId] = useState("");
  const [approveRoles, setApproveRoles] = useState<string[]>([]);

  const approveMut = useMutation({
    mutationFn: ({ userId, studioId, studioRoles }: { userId: string; studioId: string; studioRoles: string[] }) =>
      authFetch(`/api/admin/users/${userId}/approve`, { method: "POST", body: JSON.stringify({ studioId, studioRoles }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setApproveUser(null);
      setApproveStudioId("");
      setApproveRoles([]);
      toast({ title: "Usuario aprovado" });
    },
    onError: (e: any) => toast({ title: e.message || "Falha ao aprovar", variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: (userId: string) =>
      authFetch(`/api/admin/users/${userId}/reject`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/pending-users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Usuario rejeitado" });
    },
    onError: (e: any) => toast({ title: e.message || "Falha ao rejeitar", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-blue-400" />
          Usuarios Pendentes
          {pendingUsers.length > 0 && (
            <Badge variant="destructive" data-testid="badge-pending-count">{pendingUsers.length}</Badge>
          )}
        </h2>
      </div>
      {isLoading ? (
        <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
      ) : pendingUsers.length === 0 ? (
        <div className="vhub-card p-6 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
            Nenhum usuario pendente de aprovacao.
        </div>
      ) : (
        <div className="space-y-3">
          {pendingUsers.map((user: any) => (
            <div key={user.id} className="vhub-card p-4" data-testid={`card-pending-user-${user.id}`}>
              <div>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-medium">{user.displayName || user.fullName || "—"}</div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
                    {user.specialty && <div className="text-xs text-muted-foreground">Especialidade: {user.specialty}</div>}
                    {user.city && <div className="text-xs text-muted-foreground">Cidade: {user.city}, {user.state}</div>}
                    {user.studioMemberships?.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap mt-1">
                        <span className="text-xs text-muted-foreground">Estudio solicitado:</span>
                        {user.studioMemberships.map((sm: any) => (
                          <Badge key={sm.studioId} variant="outline" className="text-xs">
                            {sm.studioName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      onClick={() => {
                        setApproveUser(user);
                        const firstStudio = user.studioMemberships?.[0]?.studioId || "";
                        setApproveStudioId(firstStudio);
                        setApproveRoles([]);
                      }}
                      data-testid={`button-approve-pending-${user.id}`}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => rejectMut.mutate(user.id)}
                      disabled={rejectMut.isPending}
                      data-testid={`button-reject-pending-${user.id}`}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!approveUser} onOpenChange={v => { if (!v) setApproveUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Usuario</DialogTitle>
            <DialogDescription>
              Aprovar {approveUser?.displayName || approveUser?.fullName || approveUser?.email} e atribuir a um estudio com papeis.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Estudio</Label>
              <Select value={approveStudioId} onValueChange={setApproveStudioId}>
                <SelectTrigger data-testid="select-approve-studio"><SelectValue placeholder="Selecione um estudio" /></SelectTrigger>
                <SelectContent>
                  {studiosList.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Papeis no Estudio</Label>
              <div className="space-y-2 pt-1">
                {ALL_STUDIO_ROLES.map(r => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={approveRoles.includes(r.value)}
                      onCheckedChange={() => {
                        setApproveRoles(prev =>
                          prev.includes(r.value)
                            ? prev.filter(x => x !== r.value)
                            : [...prev, r.value]
                        );
                      }}
                      data-testid={`check-approve-role-${r.value}`}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveUser(null)}>Cancelar</Button>
            <Button
              onClick={() => approveUser && approveStudioId && approveMut.mutate({
                userId: approveUser.id,
                studioId: approveStudioId,
                studioRoles: approveRoles.length > 0 ? approveRoles : ["dublador"],
              })}
              disabled={!approveStudioId || approveMut.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMut.isPending ? "Aprovando..." : "Aprovar e Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", displayName: "", role: "user" });
  const [editForm, setEditForm] = useState({ email: "", displayName: "", role: "user", phone: "" });
  const [assignUser, setAssignUser] = useState<any | null>(null);
  const [assignStudioId, setAssignStudioId] = useState("");
  const [assignRoles, setAssignRoles] = useState<string[]>([]);
  const [activityUser, setActivityUser] = useState<any | null>(null);

  const { data: usersList = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => authFetch("/api/admin/users") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: studiosList = [] } = useQuery({
    queryKey: ["/api/studios"],
    queryFn: () => authFetch("/api/studios") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ["/api/admin/users", activityUser?.id, "activity"],
    enabled: Boolean(activityUser?.id),
    queryFn: () => authFetch(`/api/admin/users/${activityUser.id}/activity`) as Promise<any[]>,
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      authFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ role }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Papel alterado" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao alterar papel", variant: "destructive" }),
  });

  const changeStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      authFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); qc.invalidateQueries({ queryKey: ["/api/admin/pending-users"] }); toast({ title: "Status alterado" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao alterar status", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => authFetch("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); setCreateOpen(false); setForm({ email: "", password: "", displayName: "", role: "user" }); toast({ title: "Usuario criado" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao criar usuario", variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: any) => authFetch(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); setEditUser(null); toast({ title: "Usuario atualizado" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao atualizar usuario", variant: "destructive" }),
  });

  const resetPwMut = useMutation({
    mutationFn: ({ id, password }: any) => authFetch(`/api/admin/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) }),
    onSuccess: () => { setResetUser(null); setNewPassword(""); toast({ title: "Senha redefinida" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao redefinir senha", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Usuario excluido" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao excluir usuario", variant: "destructive" }),
  });

  const assignMut = useMutation({
    mutationFn: ({ userId, studioId, roles }: { userId: string; studioId: string; roles?: string[] }) =>
      authFetch(`/api/admin/users/${userId}/assign-studio`, { method: "POST", body: JSON.stringify({ studioId, roles: roles?.length ? roles : undefined }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/users"] }); setAssignUser(null); setAssignStudioId(""); setAssignRoles([]); toast({ title: "Usuario atribuido ao estudio" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao atribuir usuario", variant: "destructive" }),
  });

  const filtered = usersList.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const exportUsersCsv = () => {
    window.open("/api/admin/users/export", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">Gerenciamento de Usuarios</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportUsersCsv} data-testid="button-export-users">
            <Download className="h-4 w-4 mr-2" /> Exportar CSV
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} data-testid="button-create-user">
            <Plus className="h-4 w-4 mr-2" /> Criar Usuario
          </Button>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar usuarios..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-users" />
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left p-3 font-medium text-foreground/70">Usuario</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Status</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Papel</th>
                  <th className="text-left p-3 font-medium text-foreground/70 hidden md:table-cell">Criado em</th>
                  <th className="text-right p-3 font-medium text-foreground/70">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(user => {
                  const isMaster = String(user.email || "").toLowerCase() === "borbaggabriel@gmail.com";
                  return (
                  <tr key={user.id} className="border-b border-white/6 last:border-0 hover:bg-white/3" data-testid={`row-user-${user.id}`}>
                    <td className="p-3">
                      <div className="font-medium">{user.displayName || user.fullName || "—"}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="p-3">
                      <Select
                        value={user.status}
                        onValueChange={v => changeStatusMut.mutate({ id: user.id, status: v })}
                        disabled={isMaster}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs" data-testid={`select-status-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Aprovado</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="rejected">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3">
                      <Select
                        value={user.role}
                        onValueChange={v => changeRoleMut.mutate({ id: user.id, role: v })}
                        disabled={isMaster}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs" data-testid={`select-role-${user.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {user.role !== "platform_owner" && (
                          <Button size="icon" variant="ghost" title="Atribuir a estudio" onClick={() => { setAssignUser(user); setAssignStudioId(""); setAssignRoles([]); }} data-testid={`button-assign-user-${user.id}`}>
                            <Building2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" title="Editar" onClick={() => { setEditUser(user); setEditForm({ email: user.email, displayName: user.displayName || "", role: user.role, phone: user.phone || "" }); }} data-testid={`button-edit-user-${user.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Redefinir senha" onClick={() => setResetUser(user)} data-testid={`button-reset-pw-${user.id}`}>
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Atividades" onClick={() => setActivityUser(user)} data-testid={`button-activity-user-${user.id}`}>
                          <Activity className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Excluir" className="text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(user)} disabled={isMaster} data-testid={`button-delete-user-${user.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )})}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Nenhum usuario encontrado</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input placeholder="usuario@exemplo.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} data-testid="input-create-email" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input placeholder="Nome completo" value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha</Label>
              <Input type="password" placeholder="Minimo 4 caracteres" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} data-testid="input-create-password" />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger data-testid="select-create-role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate(form)} disabled={createMut.isPending} data-testid="button-submit-create-user">
              {createMut.isPending ? "Criando..." : "Criar Usuario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuario</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editForm.displayName} onChange={e => setEditForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button onClick={() => editMut.mutate({ id: editUser.id, data: editForm })} disabled={editMut.isPending}>
              {editMut.isPending ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetUser} onOpenChange={() => { setResetUser(null); setNewPassword(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>Definir nova senha para {resetUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Nova Senha</Label>
            <div className="relative">
              <Input type={showNewPw ? "text" : "password"} placeholder="Minimo 4 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} data-testid="input-new-password" />
              <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowNewPw(v => !v)}>
                {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
            <Button onClick={() => resetPwMut.mutate({ id: resetUser.id, password: newPassword })} disabled={resetPwMut.isPending || newPassword.length < 4}>
              {resetPwMut.isPending ? "Redefinindo..." : "Redefinir Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
        title="Excluir Usuario"
        description={`Tem certeza que deseja excluir permanentemente ${deleteConfirm?.email}? Esta acao nao pode ser desfeita.`}
      />

      <Dialog open={!!assignUser} onOpenChange={v => { if (!v) setAssignUser(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Usuario ao Estudio</DialogTitle>
            <DialogDescription>
              Selecione o estudio e os papeis para {assignUser?.displayName || assignUser?.fullName || assignUser?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {assignUser && (
              <div className="text-sm text-muted-foreground space-y-1">
                <p><strong>Email:</strong> {assignUser.email}</p>
                {assignUser.specialty && <p><strong>Especialidade:</strong> {assignUser.specialty}</p>}
                {assignUser.city && <p><strong>Cidade:</strong> {assignUser.city}, {assignUser.state}</p>}
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Estudio</Label>
              <Select value={assignStudioId} onValueChange={setAssignStudioId}>
                <SelectTrigger data-testid="select-assign-studio"><SelectValue placeholder="Selecione um estudio" /></SelectTrigger>
                <SelectContent>
                  {studiosList.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Papeis no Estudio (opcional)</Label>
              <div className="space-y-2 pt-1">
                {ALL_STUDIO_ROLES.map(r => (
                  <label key={r.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={assignRoles.includes(r.value)}
                      onCheckedChange={() => {
                        setAssignRoles(prev =>
                          prev.includes(r.value)
                            ? prev.filter(x => x !== r.value)
                            : [...prev, r.value]
                        );
                      }}
                      data-testid={`check-assign-role-${r.value}`}
                    />
                    <span className="text-sm">{r.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Se selecionado, o membro sera aprovado automaticamente. Caso contrario, o Studio Admin aprovara depois.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignUser(null)}>Cancelar</Button>
            <Button
              onClick={() => assignUser && assignStudioId && assignMut.mutate({ userId: assignUser.id, studioId: assignStudioId, roles: assignRoles.length > 0 ? assignRoles : undefined })}
              disabled={!assignStudioId || assignMut.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMut.isPending ? "Atribuindo..." : "Atribuir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!activityUser} onOpenChange={() => setActivityUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Historico de Atividades</DialogTitle>
            <DialogDescription>{activityUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {!activityLogs.length && <div className="text-sm text-muted-foreground">Sem atividades registradas.</div>}
            {activityLogs.map((log: any) => (
              <div key={log.id} className="rounded-md border border-border p-2.5 text-xs space-y-1">
                <div className="font-medium">{log.action}</div>
                <div className="text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</div>
                <div className="text-muted-foreground break-words">{log.details}</div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudiosSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [editStudio, setEditStudio] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", slug: "", isActive: true });
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", studioAdminUserId: "" });

  const { data: studiosList = [], isLoading } = useQuery({
    queryKey: ["/api/admin/studios"],
    queryFn: () => authFetch("/api/admin/studios") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: usersList = [] } = useQuery({
    queryKey: ["/api/admin/users"],
    queryFn: () => authFetch("/api/admin/users") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const approvedUsers = usersList.filter((u: any) => u.role !== "platform_owner" && u.status === "approved");

  const createMut = useMutation({
    mutationFn: (data: { name: string; studioAdminUserId?: string }) =>
      authFetch("/api/studios", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/studios"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCreateOpen(false);
      setCreateForm({ name: "", studioAdminUserId: "" });
      toast({ title: "Estudio criado com sucesso" });
    },
    onError: (e: any) => toast({ title: e.message || "Falha ao criar estudio", variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: any) => authFetch(`/api/admin/studios/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/studios"] }); setEditStudio(null); toast({ title: "Estudio atualizado" }); },
    onError: (e: any) => toast({ title: e.message || "Falha", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/studios/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/studios"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Estudio excluido" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao excluir", variant: "destructive" }),
  });

  const suspendMut = useMutation({
    mutationFn: ({ id, isActive }: any) => authFetch(`/api/admin/studios/${id}`, { method: "PATCH", body: JSON.stringify({ isActive }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/studios"] }); toast({ title: "Estudio atualizado" }); },
  });

  const filtered = studiosList.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gerenciamento de Estudios</h2>
        <Button onClick={() => { setCreateOpen(true); setCreateForm({ name: "", studioAdminUserId: "" }); }} data-testid="button-create-studio">
          <Plus className="h-4 w-4 mr-1.5" /> Novo Estudio
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar estudios..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left p-3 font-medium text-foreground/70">Estudio</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Status</th>
                  <th className="text-left p-3 font-medium text-foreground/70 hidden md:table-cell">Criado em</th>
                  <th className="text-right p-3 font-medium text-foreground/70">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((studio: any) => (
                  <tr key={studio.id} className="border-b border-white/6 last:border-0 hover:bg-white/3" data-testid={`row-studio-${studio.id}`}>
                    <td className="p-3">
                      <div className="font-medium">{studio.name}</div>
                      <div className="text-xs text-muted-foreground">/{studio.slug}</div>
                    </td>
                    <td className="p-3">
                      <Badge variant={studio.isActive ? "default" : "secondary"}>
                        {studio.isActive ? "Ativo" : "Suspenso"}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {studio.createdAt ? new Date(studio.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" title={studio.isActive ? "Suspend Studio" : "Activate Studio"} 
                          onClick={() => suspendMut.mutate({ id: studio.id, isActive: !studio.isActive })} 
                          disabled={suspendMut.isPending}
                          data-testid={`button-toggle-studio-${studio.id}`}>
                          {studio.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                        <Button size="icon" variant="ghost" title="Editar Estudio" onClick={() => { setEditStudio(studio); setEditForm({ name: studio.name, slug: studio.slug, isActive: studio.isActive }); }} data-testid={`button-edit-studio-${studio.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Gerenciar Estudio"
                          onClick={() => setLocation(`/hub-dub/admin/studios/${studio.id}/management`)}
                          data-testid={`button-study-manager-${studio.id}`}
                        >
                          <UserCog className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Excluir Estudio" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(studio)} data-testid={`button-delete-studio-${studio.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhum estudio encontrado</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={!!editStudio} onOpenChange={() => setEditStudio(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Estudio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={editForm.slug} onChange={e => setEditForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStudio(null)}>Cancelar</Button>
            <Button onClick={() => editMut.mutate({ id: editStudio.id, data: editForm })} disabled={editMut.isPending}>
              {editMut.isPending ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
        title="Excluir Estudio"
        description={`Excluir permanentemente "${deleteConfirm?.name}"? Todas as producoes, sessoes e takes deste estudio podem ser afetados.`}
      />

      <Dialog open={createOpen} onOpenChange={v => { if (!v) setCreateOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Estudio</DialogTitle>
            <DialogDescription>Crie um novo estudio e selecione o administrador responsavel.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome do Estudio *</Label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Studio Alpha"
                data-testid="input-create-studio-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Admin do Estudio *</Label>
              <Select value={createForm.studioAdminUserId} onValueChange={v => setCreateForm(f => ({ ...f, studioAdminUserId: v }))}>
                <SelectTrigger data-testid="select-studio-admin">
                  <SelectValue placeholder="Selecione o administrador" />
                </SelectTrigger>
                <SelectContent>
                  {approvedUsers.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayName || u.fullName || u.email} — {u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Este usuario tera controle total sobre as configuracoes do estudio.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMut.mutate({
                name: createForm.name,
                studioAdminUserId: createForm.studioAdminUserId || undefined,
              })}
              disabled={!createForm.name.trim() || !createForm.studioAdminUserId || createMut.isPending}
              data-testid="button-confirm-create-studio"
            >
              {createMut.isPending ? "Criando..." : "Criar Estudio"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const PROD_STATUSES = [
  { value: "planned", label: "Planejada" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "completed", label: "Concluida" },
];

function ProductionsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [editProd, setEditProd] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "", status: "", videoUrl: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ studioId: "", name: "", description: "", status: "planned" });
  const [search, setSearch] = useState("");

  const { data: prods = [], isLoading } = useQuery({
    queryKey: ["/api/admin/productions"],
    queryFn: () => authFetch("/api/admin/productions") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: studiosList = [] } = useQuery({
    queryKey: ["/api/admin/studios"],
    queryFn: () => authFetch("/api/admin/studios") as Promise<any[]>,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/productions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/productions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Producao excluida" }); },
    onError: (e: any) => toast({ title: e.message || "Falha", variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: any) => authFetch(`/api/admin/productions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/productions"] }); setEditProd(null); toast({ title: "Producao atualizada" }); },
    onError: (e: any) => toast({ title: e.message || "Falha", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => authFetch("/api/admin/productions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/productions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); setCreateOpen(false); setCreateForm({ studioId: "", name: "", description: "", status: "planned" }); toast({ title: "Producao criada" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao criar", variant: "destructive" }),
  });

  const filtered = prods.filter(p => p.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gerenciamento de Producoes</h2>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-production">
          <Plus className="h-4 w-4 mr-1.5" /> Nova Producao
        </Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar producoes..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left p-3 font-medium text-foreground/70">Producao</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Status</th>
                  <th className="text-left p-3 font-medium text-foreground/70 hidden md:table-cell">Criado em</th>
                  <th className="text-right p-3 font-medium text-foreground/70">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((prod: any) => (
                  <tr key={prod.id} className="border-b border-white/6 last:border-0 hover:bg-white/3" data-testid={`row-production-${prod.id}`}>
                    <td className="p-3">
                      <div className="font-medium">{prod.name}</div>
                      {prod.description && <div className="text-xs text-muted-foreground truncate max-w-xs">{prod.description}</div>}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary">{prod.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {prod.createdAt ? new Date(prod.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditProd(prod); setEditForm({ name: prod.name, description: prod.description || "", status: prod.status || "planned", videoUrl: prod.videoUrl || "" }); }} data-testid={`button-edit-prod-${prod.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(prod)} data-testid={`button-delete-prod-${prod.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma producao encontrada</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={!!editProd} onOpenChange={() => setEditProd(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Producao</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} data-testid="input-edit-prod-name" /></div>
            <div className="space-y-1.5"><Label>Descricao</Label><Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>URL do Video</Label><Input value={editForm.videoUrl} onChange={e => setEditForm(f => ({ ...f, videoUrl: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProd(null)}>Cancelar</Button>
            <Button onClick={() => editMut.mutate({ id: editProd.id, data: editForm })} disabled={editMut.isPending}>{editMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={v => { if (!v) setCreateOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Producao</DialogTitle><DialogDescription>Crie uma producao em um estudio especifico.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Estudio *</Label>
              <Select value={createForm.studioId} onValueChange={v => setCreateForm(f => ({ ...f, studioId: v }))}>
                <SelectTrigger data-testid="select-create-prod-studio"><SelectValue placeholder="Selecione o estudio" /></SelectTrigger>
                <SelectContent>{studiosList.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Nome *</Label><Input value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome da producao" data-testid="input-create-prod-name" /></div>
            <div className="space-y-1.5"><Label>Descricao</Label><Input value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} placeholder="Descricao (opcional)" /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={createForm.status} onValueChange={v => setCreateForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PROD_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate(createForm)} disabled={!createForm.studioId || !createForm.name.trim() || createMut.isPending} data-testid="button-confirm-create-production">{createMut.isPending ? "Criando..." : "Criar Producao"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
        title="Excluir Producao"
        description={`Excluir permanentemente "${deleteConfirm?.name}"? Sessoes e takes associados podem ser afetados.`}
      />
    </div>
  );
}

const SESS_STATUSES = [
  { value: "scheduled", label: "Agendada" },
  { value: "in_progress", label: "Em Progresso" },
  { value: "completed", label: "Finalizada" },
  { value: "cancelled", label: "Cancelada" },
];

function SessionsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [editSess, setEditSess] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: "", scheduledAt: "", durationMinutes: "60", status: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ studioId: "", productionId: "", title: "", scheduledAt: "", durationMinutes: "60" });
  const [search, setSearch] = useState("");
  const [forceLogoutUserId, setForceLogoutUserId] = useState<string>("");

  const { data: sessData = [], isLoading } = useQuery({
    queryKey: ["/api/admin/sessions"],
    queryFn: () => authFetch("/api/admin/sessions") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: studiosList = [] } = useQuery({
    queryKey: ["/api/admin/studios"],
    queryFn: () => authFetch("/api/admin/studios") as Promise<any[]>,
  });

  const { data: prodsList = [] } = useQuery({
    queryKey: ["/api/admin/productions"],
    queryFn: () => authFetch("/api/admin/productions") as Promise<any[]>,
  });

  const { data: activeSessionsByUser = [] } = useQuery({
    queryKey: ["/api/admin/sessions/active-by-user"],
    queryFn: () => authFetch("/api/admin/sessions/active-by-user") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const { data: authSessionsSummary = [] } = useQuery({
    queryKey: ["/api/admin/auth-sessions/users"],
    queryFn: () => authFetch("/api/admin/auth-sessions/users") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/sessions/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/sessions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Sessao excluida" }); },
    onError: (e: any) => toast({ title: e.message || "Falha", variant: "destructive" }),
  });

  const editMut = useMutation({
    mutationFn: ({ id, data }: any) => authFetch(`/api/admin/sessions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/sessions"] }); setEditSess(null); toast({ title: "Sessao atualizada" }); },
    onError: (e: any) => toast({ title: e.message || "Falha", variant: "destructive" }),
  });

  const createMut = useMutation({
    mutationFn: (data: any) => authFetch("/api/admin/sessions", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/sessions"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); setCreateOpen(false); setCreateForm({ studioId: "", productionId: "", title: "", scheduledAt: "", durationMinutes: "60" }); toast({ title: "Sessao criada" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao criar", variant: "destructive" }),
  });

  const cleanupSessionsMut = useMutation({
    mutationFn: () => authFetch("/api/admin/sessions/cleanup-expired", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/sessions"] }); toast({ title: "Limpeza de sessoes concluida" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao limpar sessoes", variant: "destructive" }),
  });

  const cleanupAuthMut = useMutation({
    mutationFn: () => authFetch("/api/admin/auth-sessions/cleanup-expired", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/auth-sessions/users"] }); toast({ title: "Sessoes web expiradas removidas" }); },
    onError: (e: any) => toast({ title: e.message || "Falha ao limpar sessoes web", variant: "destructive" }),
  });

  const forceLogoutMut = useMutation({
    mutationFn: (userId: string) => authFetch(`/api/admin/auth-sessions/force-logout-user/${userId}`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/auth-sessions/users"] });
      toast({ title: "Logout forcado aplicado" });
      setForceLogoutUserId("");
    },
    onError: (e: any) => toast({ title: e.message || "Falha no logout forcado", variant: "destructive" }),
  });

  const filtered = sessData.filter(s => s.title?.toLowerCase().includes(search.toLowerCase()));

  const filteredProds = createForm.studioId
    ? prodsList.filter((p: any) => p.studioId === createForm.studioId)
    : prodsList;

  function statusColor(status: string): "destructive" | "default" | "secondary" | "outline" {
    if (status === "scheduled") return "default";
    if (status === "completed") return "secondary";
    if (status === "cancelled") return "destructive";
    return "secondary";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Gerenciamento de Sessoes</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => cleanupSessionsMut.mutate()} disabled={cleanupSessionsMut.isPending} data-testid="button-cleanup-expired-sessions">
            <RefreshCw className="h-4 w-4 mr-1.5" /> Limpar Expiradas
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-create-session">
            <Plus className="h-4 w-4 mr-1.5" /> Nova Sessao
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="vhub-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sessoes Ativas por Usuario</h3>
            <Badge variant="outline">{activeSessionsByUser.length}</Badge>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {activeSessionsByUser.length === 0 && <div className="text-xs text-muted-foreground">Sem usuarios com sessao ativa.</div>}
            {activeSessionsByUser.map((item: any) => (
              <div key={item.userId} className="rounded-md border border-border p-2">
                <div className="text-xs font-medium">{item.userDisplayName || item.userEmail || item.userId}</div>
                <div className="text-[11px] text-muted-foreground">{item.sessions.length} sessao(oes) ativa(s)</div>
              </div>
            ))}
          </div>
        </div>
        <div className="vhub-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Sessoes Web Ativas</h3>
            <Button size="sm" variant="outline" onClick={() => cleanupAuthMut.mutate()} disabled={cleanupAuthMut.isPending} data-testid="button-cleanup-auth-sessions">
              Limpar Expiradas
            </Button>
          </div>
          <div className="space-y-2">
            <Select value={forceLogoutUserId} onValueChange={setForceLogoutUserId}>
              <SelectTrigger data-testid="select-force-logout-user"><SelectValue placeholder="Selecionar usuario para logout forcado" /></SelectTrigger>
              <SelectContent>
                {authSessionsSummary.map((item: any) => (
                  <SelectItem key={item.userId} value={item.userId}>
                    {(item.userDisplayName || item.userEmail || item.userId) + ` (${item.sessions})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="w-full"
              variant="destructive"
              disabled={!forceLogoutUserId || forceLogoutMut.isPending}
              onClick={() => forceLogoutMut.mutate(forceLogoutUserId)}
              data-testid="button-force-logout-user"
            >
              Logout Forcado do Usuario
            </Button>
          </div>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar sessoes..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left p-3 font-medium text-foreground/70">Sessao</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Status</th>
                  <th className="text-left p-3 font-medium text-foreground/70 hidden md:table-cell">Agendada</th>
                  <th className="text-right p-3 font-medium text-foreground/70">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sess: any) => (
                  <tr key={sess.id} className="border-b border-white/6 last:border-0 hover:bg-white/3" data-testid={`row-session-${sess.id}`}>
                    <td className="p-3">
                      <div className="font-medium">{sess.title}</div>
                      <div className="text-xs text-muted-foreground">{sess.durationMinutes} min</div>
                      <div className="text-xs text-muted-foreground md:hidden mt-0.5">
                        {sess.scheduledAt ? new Date(sess.scheduledAt).toLocaleString() : "—"}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={statusColor(sess.status)}>{sess.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {sess.scheduledAt ? new Date(sess.scheduledAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" title="Editar Sessao"
                          onClick={() => {
                            setEditSess(sess);
                            const dt = sess.scheduledAt ? new Date(sess.scheduledAt).toISOString().slice(0, 16) : "";
                            setEditForm({ title: sess.title, scheduledAt: dt, durationMinutes: String(sess.durationMinutes || 60), status: sess.status || "scheduled" });
                          }}
                          data-testid={`button-edit-session-${sess.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" title="Excluir Sessao" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteConfirm(sess)} data-testid={`button-delete-session-${sess.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Nenhuma sessao encontrada</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <Dialog open={!!editSess} onOpenChange={() => setEditSess(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Sessao</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Titulo</Label><Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} data-testid="input-edit-sess-title" /></div>
            <div className="space-y-1.5"><Label>Data e Hora</Label><Input type="datetime-local" value={editForm.scheduledAt} onChange={e => setEditForm(f => ({ ...f, scheduledAt: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Duracao (min)</Label><Input type="number" value={editForm.durationMinutes} onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={v => setEditForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SESS_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSess(null)}>Cancelar</Button>
            <Button onClick={() => editMut.mutate({ id: editSess.id, data: { title: editForm.title, scheduledAt: editForm.scheduledAt, durationMinutes: parseInt(editForm.durationMinutes) || 60, status: editForm.status } })} disabled={editMut.isPending}>{editMut.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={v => { if (!v) setCreateOpen(false); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Sessao</DialogTitle><DialogDescription>Agende uma sessao em qualquer estudio.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Estudio *</Label>
              <Select value={createForm.studioId} onValueChange={v => setCreateForm(f => ({ ...f, studioId: v, productionId: "" }))}>
                <SelectTrigger data-testid="select-create-sess-studio"><SelectValue placeholder="Selecione o estudio" /></SelectTrigger>
                <SelectContent>{studiosList.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Producao *</Label>
              <Select value={createForm.productionId} onValueChange={v => setCreateForm(f => ({ ...f, productionId: v }))}>
                <SelectTrigger data-testid="select-create-sess-prod"><SelectValue placeholder="Selecione a producao" /></SelectTrigger>
                <SelectContent>{filteredProds.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Titulo *</Label><Input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="Titulo da sessao" data-testid="input-create-sess-title" /></div>
            <div className="space-y-1.5"><Label>Data e Hora *</Label><Input type="datetime-local" value={createForm.scheduledAt} onChange={e => setCreateForm(f => ({ ...f, scheduledAt: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Duracao (min)</Label><Input type="number" value={createForm.durationMinutes} onChange={e => setCreateForm(f => ({ ...f, durationMinutes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate({ ...createForm, durationMinutes: parseInt(createForm.durationMinutes) || 60 })} disabled={!createForm.studioId || !createForm.productionId || !createForm.title.trim() || !createForm.scheduledAt || createMut.isPending} data-testid="button-confirm-create-session">{createMut.isPending ? "Criando..." : "Criar Sessao"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
        title="Excluir Sessao"
        description={`Excluir permanentemente a sessao "${deleteConfirm?.title}"?`}
      />
    </div>
  );
}

function TakesSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);

  const { data: takesList = [], isLoading } = useQuery({
    queryKey: ["/api/admin/takes"],
    queryFn: () => authFetch("/api/admin/takes") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => authFetch(`/api/admin/takes/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/takes"] }); qc.invalidateQueries({ queryKey: ["/api/admin/stats"] }); toast({ title: "Take excluido" }); },
    onError: (e: any) => toast({ title: e.message || "Falha", variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Audio Takes</h2>
        <span className="text-sm text-muted-foreground">{takesList.length} takes no total</span>
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left p-3 font-medium text-foreground/70">ID do Take</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Qualidade</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Marcadores</th>
                  <th className="text-left p-3 font-medium text-foreground/70 hidden md:table-cell">Duracao</th>
                  <th className="text-left p-3 font-medium text-foreground/70 hidden md:table-cell">Criado em</th>
                  <th className="text-right p-3 font-medium text-foreground/70">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {takesList.map((take: any) => (
                  <tr key={take.id} className="border-b border-white/6 last:border-0 hover:bg-white/3" data-testid={`row-take-${take.id}`}>
                    <td className="p-3 font-mono text-xs">{take.id.slice(0, 8)}…</td>
                    <td className="p-3">
                      {take.qualityScore !== null ? (
                        <span className={`font-medium ${take.qualityScore >= 80 ? "text-emerald-400" : take.qualityScore >= 50 ? "text-blue-400" : "text-red-400"}`}>
                          {Math.round(take.qualityScore)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {take.aiRecommended && <Badge variant="secondary" className="text-xs px-1 py-0"><Star className="h-2.5 w-2.5 mr-0.5" />AI</Badge>}
                        {take.isPreferred && <Badge variant="default" className="text-xs px-1 py-0">Preferido</Badge>}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{take.durationSeconds?.toFixed(1)}s</td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell text-xs">
                      {take.createdAt ? new Date(take.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10" 
                        onClick={() => setDeleteConfirm(take)} 
                        data-testid={`button-delete-take-${take.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {takesList.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum take encontrado</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <ConfirmDialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteMut.mutate(deleteConfirm.id)}
        title="Excluir Take"
        description="Excluir permanentemente este take de audio? O arquivo WAV no Google Drive nao sera removido."
      />
    </div>
  );
}

function LogsSection() {
  const [search, setSearch] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["/api/admin/audit"],
    queryFn: () => authFetch("/api/admin/audit") as Promise<any[]>,
    refetchInterval: 5000,
  });

  const filtered = logs.filter(l =>
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.details?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Logs de Auditoria</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</Button>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar logs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="vhub-card overflow-hidden">
        <div className="p-0">
          {isLoading ? <div className="p-6 text-sm text-muted-foreground">Carregando...</div> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left p-3 font-medium text-foreground/70">Data/Hora</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Acao</th>
                  <th className="text-left p-3 font-medium text-foreground/70">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log: any) => (
                  <tr key={log.id} className="border-b border-white/6 last:border-0 hover:bg-white/3" data-testid={`row-log-${log.id}`}>
                    <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-medium">{log.action}</td>
                    <td className="p-3 text-muted-foreground text-xs">{log.details || "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Nenhum log encontrado</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [folderId, setFolderId] = useState("");
  const [saved, setSaved] = useState(false);
  const [takesPaths, setTakesPaths] = useState("");
  const [defaultProvider, setDefaultProvider] = useState<"supabase" | "local">("supabase");
  const [defaultTakesPath, setDefaultTakesPath] = useState("");
  const [supabaseBucket, setSupabaseBucket] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseServiceKey, setSupabaseServiceKey] = useState("");
  const [showSupabaseServiceKey, setShowSupabaseServiceKey] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => authFetch("/api/admin/settings") as Promise<Record<string, string>>,
    refetchInterval: 5000,
  });

  const { data: storageStatus } = useQuery({
    queryKey: ["/api/admin/storage/status"],
    queryFn: () => authFetch("/api/admin/storage/status") as Promise<any>,
    refetchInterval: 5000,
  });

  const saveMut = useMutation({
    mutationFn: (body: any) => authFetch("/api/admin/settings", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/admin/settings"] }); },
  });

  const handleSave = async () => {
    if (folderId) await saveMut.mutateAsync({ key: "GOOGLE_DRIVE_FOLDER_ID", value: folderId });
    if (supabaseUrl) await saveMut.mutateAsync({ key: "SUPABASE_URL", value: supabaseUrl });
    if (supabaseServiceKey) await saveMut.mutateAsync({ key: "SUPABASE_SERVICE_ROLE_KEY", value: supabaseServiceKey });
    if (supabaseBucket) await saveMut.mutateAsync({ key: "SUPABASE_BUCKET", value: supabaseBucket });
    if (defaultProvider) await saveMut.mutateAsync({ key: "DEFAULT_STORAGE_PROVIDER", value: defaultProvider });
    if (takesPaths) {
      const list = takesPaths
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean);
      await saveMut.mutateAsync({ key: "TAKES_SAVE_PATHS", value: JSON.stringify(list) });
      if (!defaultTakesPath && list.length > 0) {
        await saveMut.mutateAsync({ key: "DEFAULT_TAKES_PATH", value: list[0] });
      }
    }
    if (defaultTakesPath) await saveMut.mutateAsync({ key: "DEFAULT_TAKES_PATH", value: defaultTakesPath });
    toast({ title: "Configuracoes salvas" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const currentFolderId = settings?.GOOGLE_DRIVE_FOLDER_ID || "";
  const currentBucket = settings?.SUPABASE_BUCKET || storageStatus?.supabaseBucket || "takes";
  const currentDefaultProvider = (settings?.DEFAULT_STORAGE_PROVIDER === "local" ? "local" : "supabase") as "supabase" | "local";
  const currentPaths = (() => {
    try {
      const raw = settings?.TAKES_SAVE_PATHS || "[]";
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      return [];
    } catch {
      return [];
    }
  })();
  const currentDefaultPath = settings?.DEFAULT_TAKES_PATH || currentPaths[0] || "takes";

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">API e Integracoes</h2>
      <div className="vhub-card overflow-hidden">
        <div className="vhub-card-header">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <HardDrive className="h-5 w-5" /> Armazenamento Google Drive
          </div>
        </div>
        <div className="vhub-card-body space-y-6">
          <p className="text-xs text-muted-foreground">
            Configure onde os arquivos WAV gravados sao armazenados.
            Os arquivos sao organizados como <code className="text-xs bg-white/5 px-1 rounded">Estudio/Producao/Personagem/Ator/arquivo.wav</code>
          </p>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-white/8 bg-white/3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Google Drive Conectado</p>
              <p className="text-xs text-muted-foreground">Integracao OAuth ativa via conector Replit</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>ID da Pasta Raiz do Google Drive</Label>
            <p className="text-xs text-muted-foreground">
              Extraia da URL da sua pasta:{" "}
              <code className="bg-muted px-1 rounded">drive.google.com/drive/folders/&lt;FOLDER_ID&gt;</code>
            </p>
            <Input
              placeholder={currentFolderId || "e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"}
              value={folderId}
              onChange={e => setFolderId(e.target.value)}
              data-testid="input-folder-id"
            />
            {currentFolderId && (
              <p className="text-xs text-muted-foreground">
                Current: <code className="bg-muted px-1 rounded">{currentFolderId}</code>
              </p>
            )}
          </div>
          <div className="rounded-lg border border-white/8 bg-white/3 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Estrutura de Pastas</p>
            <pre className="text-xs text-muted-foreground font-mono">{`Root Folder/
  StudioName/
    ProductionName/
      CharacterName/
        VoiceActorName/
          Character_Actor_Timecode.wav`}</pre>
          </div>
        </div>
      </div>

      <div className="vhub-card overflow-hidden">
        <div className="vhub-card-header">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
            <Database className="h-5 w-5" /> Armazenamento Supabase
          </div>
        </div>
        <div className="vhub-card-body space-y-6">
          <div className="flex items-center gap-3 p-3 rounded-lg border border-white/8 bg-white/3">
            {storageStatus?.supabaseOk ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-blue-400 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {storageStatus?.supabaseOk ? "Supabase Conectado" : "Supabase Nao Conectado"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {storageStatus?.supabaseOk ? "Conexao validada via Storage API" : (storageStatus?.supabaseReason || "Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY")}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Supabase URL</Label>
            <Input
              placeholder={settings?.SUPABASE_URL || "https://<project>.supabase.co"}
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              data-testid="input-supabase-url"
            />
          </div>

          <div className="space-y-2">
            <Label>Service Role Key (Server)</Label>
            <div className="relative">
              <Input
                type={showSupabaseServiceKey ? "text" : "password"}
                placeholder={storageStatus?.supabaseConfigured ? "Configurado" : "Nao configurado"}
                value={supabaseServiceKey}
                onChange={(e) => setSupabaseServiceKey(e.target.value)}
                data-testid="input-supabase-service-key"
              />
              <button
                type="button"
                onClick={() => setShowSupabaseServiceKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showSupabaseServiceKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showSupabaseServiceKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Bucket (Supabase Storage)</Label>
            <Input
              placeholder={currentBucket}
              value={supabaseBucket}
              onChange={(e) => setSupabaseBucket(e.target.value)}
              data-testid="input-supabase-bucket"
            />
            <p className="text-xs text-muted-foreground">
              Current: <code className="bg-muted px-1 rounded">{currentBucket}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Armazenamento Padrao ao Criar Sessao</Label>
            <Select value={defaultProvider} onValueChange={(v) => setDefaultProvider(v as any)}>
              <SelectTrigger data-testid="select-default-storage-provider">
                <SelectValue placeholder={currentDefaultProvider} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supabase">Supabase</SelectItem>
                <SelectItem value="local">Local</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Current: <code className="bg-muted px-1 rounded">{currentDefaultProvider}</code>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Caminhos de Salvamento dos Takes (um por linha)</Label>
            <Textarea
              value={takesPaths}
              onChange={(e) => setTakesPaths(e.target.value)}
              placeholder={(currentPaths.length ? currentPaths : ["takes"]).join("\n")}
              data-testid="textarea-takes-paths"
            />
            <p className="text-xs text-muted-foreground">
              Current:{" "}
              <code className="bg-muted px-1 rounded">
                {(currentPaths.length ? currentPaths : ["takes"]).join(", ")}
              </code>
            </p>
          </div>

          <div className="space-y-2">
            <Label>Caminho Padrao</Label>
            <Select value={defaultTakesPath} onValueChange={setDefaultTakesPath}>
              <SelectTrigger data-testid="select-default-takes-path">
                <SelectValue placeholder={currentDefaultPath} />
              </SelectTrigger>
              <SelectContent>
                {(currentPaths.length ? currentPaths : ["takes"]).map((p: string) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Current: <code className="bg-muted px-1 rounded">{currentDefaultPath}</code>
            </p>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saveMut.isPending} className="gap-2" data-testid="button-save-settings">
        {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
        {saved ? "Salvo" : "Salvar Configuracoes"}
      </Button>
    </div>
  );
}

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [section, setSection] = useState<Section>("overview");

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => authFetch("/api/admin/stats") as Promise<Record<string, number>>,
    refetchInterval: 5000,
  });

  const pendingCount = stats?.pendingUsers ?? 0;

  if (!user) return null;

  if (user.role !== "platform_owner") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background space-y-4">
        <ShieldAlert className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground text-sm">Apenas proprietarios da plataforma podem acessar este painel.</p>
        <Button onClick={() => setLocation("/hub-dub/studios")} variant="outline">Ir para Estudios</Button>
      </div>
    );
  }

  const sectionMap: Record<Section, React.ReactNode> = {
    overview: <OverviewSection />,
    pending: <PendingUsersSection />,
    users: <UsersSection />,
    studios: <StudiosSection />,
    productions: <ProductionsSection />,
    sessions: <SessionsSection />,
    takes: <TakesSection />,
    logs: <LogsSection />,
    integrations: <IntegrationsSection />,
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 flex flex-col vhub-sidebar">
        <div className="px-4 py-5 border-b border-white/6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
            <span className="font-bold tracking-tight text-foreground">Painel Admin</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Proprietario da Plataforma</p>
          {pendingCount > 0 && (
            <button
              onClick={() => setSection("pending")}
              className="mt-2 w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-500/12 text-blue-400 text-xs font-medium border border-blue-500/25"
              data-testid="button-quick-pending"
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Pendentes: {pendingCount}
            </button>
          )}
        </div>
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              data-testid={`nav-${item.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 text-left ${
                section === item.id
                  ? "bg-gradient-to-r from-primary/20 to-accent/15 text-foreground border-l-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.id === "pending" && pendingCount > 0 && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0" data-testid="badge-nav-pending">
                  {pendingCount}
                </Badge>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-white/6">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={() => setLocation("/studios")} data-testid="button-exit-admin">
            <LogOut className="h-4 w-4" />
            Sair do Admin
          </Button>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto page-enter">
          {sectionMap[section]}
        </div>
      </main>
    </div>
  );
}

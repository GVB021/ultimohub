import { useEffect, useState, memo } from "react";
import { useSessions, useCreateSession } from "@studio/hooks/use-sessions";
import { useProductions } from "@studio/hooks/use-productions";
import { Button } from "@studio/components/ui/button";
import { Input } from "@studio/components/ui/input";
import { Calendar as CalendarIcon, Clock, Plus, Video, Film, Loader2, Trash2, Lock } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@studio/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@studio/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@studio/components/ui/tooltip";
import { format } from "date-fns";
import { useToast } from "@studio/hooks/use-toast";
import { useStudioRole } from "@studio/hooks/use-studio-role";
import { useAuth } from "@studio/hooks/use-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@studio/lib/auth-fetch";
import {
  PageSection, PageHeader, EmptyState, StatusBadge, FieldGroup
} from "@studio/components/ui/design-system";
import { pt } from "@studio/lib/i18n";
import { computeSessionStatus, sessionEntryAllowed, formatCountdownTime } from "@studio/lib/session-status";

const Sessions = memo(function Sessions({ studioId }: { studioId: string }) {
  const { data: sessions, isLoading } = useSessions(studioId);
  const { data: productions } = useProductions(studioId);
  const createSession = useCreateSession(studioId);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { canCreateSessions, hasMinRole } = useStudioRole(studioId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canDeleteSessions = user?.role === "platform_owner";
  const { data: storageOptions } = useQuery({
    queryKey: ["/api/storage/options"],
    queryFn: () => authFetch("/api/storage/options") as Promise<any>,
  });

  const search = useSearch();
  const searchParams = new URLSearchParams(search || "");
  const filterProductionId = searchParams.get("productionId") || null;

  const isRestrictedRole = !hasMinRole("diretor");

  const deleteSession = useMutation({
    mutationFn: (sessionId: string) =>
      authFetch(`/api/studios/${studioId}/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "sessions"] });
      toast({ title: "Sessao excluida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir sessao", description: err?.message || "Permissao negada", variant: "destructive" });
    },
  });

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [prodId, setProdId] = useState(filterProductionId || "");
  const [dateStr, setDateStr] = useState("");
  const storageProvider: "supabase" = "supabase";
  const [takesPath, setTakesPath] = useState("");

  useEffect(() => {
    if (!storageOptions) return;
    setTakesPath(String(storageOptions.defaultPath || storageOptions.paths?.[0] || "uploads"));
  }, [storageOptions]);

  const handleCreate = async () => {
    if (!title || !prodId || !dateStr) return;
    if (storageOptions && !storageOptions.supabaseOk) {
      toast({ title: "Supabase indisponivel", description: storageOptions.supabaseReason || "Verifique conexao", variant: "destructive" });
      return;
    }
    await createSession.mutateAsync({
      title,
      productionId: prodId,
      scheduledAt: new Date(dateStr).toISOString(),
      status: "scheduled",
      durationMinutes: 60,
      storageProvider: "supabase",
      takesPath,
    });
    setIsOpen(false);
    setTitle("");
    setProdId("");
    setDateStr("");
    toast({ title: "Sessao agendada" });
  };

  const filteredSessions = filterProductionId
    ? (sessions || []).filter(s => s.productionId === filterProductionId)
    : (sessions || []);

  const filterProduction = filterProductionId
    ? productions?.find(p => p.id === filterProductionId)
    : null;

  return (
    <PageSection>
      <PageHeader
        title={pt.sessions.title}
        subtitle={filterProduction ? `Sessoes de "${filterProduction.name}"` : "Agende e gerencie sessoes de gravacao"}
        action={
          <div className="flex items-center gap-2">
            {filterProductionId && (
              <Button size="sm" variant="outline" onClick={() => navigate(`/hub-dub/studio/${studioId}/sessions`)} className="gap-1.5 text-xs">
                Ver todas
              </Button>
            )}
            {canCreateSessions ? (
              <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5 press-effect">
                    <Plus className="w-3.5 h-3.5" />
                    {pt.sessions.schedule}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agendar Sessao</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <FieldGroup label={pt.sessions.sessionTitle}>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="ex: Ep 1 — Elenco Principal"
                        data-testid="input-session-title"
                      />
                    </FieldGroup>
                    <FieldGroup label={pt.dashboard.production}>
                      <Select value={prodId} onValueChange={setProdId}>
                        <SelectTrigger data-testid="select-production">
                          <SelectValue placeholder="Selecionar producao..." />
                        </SelectTrigger>
                        <SelectContent>
                          {productions?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                    <FieldGroup label={pt.sessions.dateTime}>
                      <Input
                        type="datetime-local"
                        value={dateStr}
                        onChange={(e) => setDateStr(e.target.value)}
                        data-testid="input-session-date"
                      />
                    </FieldGroup>
                    <FieldGroup label="Armazenamento dos Takes">
                      <Input value="Supabase" disabled data-testid="input-storage-provider" />
                      {storageOptions && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {storageOptions.supabaseOk ? "Conexao OK" : `Conexao falhou: ${storageOptions.supabaseReason || "—"}`}
                        </p>
                      )}
                    </FieldGroup>
                    <FieldGroup label="Caminho de Salvamento (Takes)">
                      <Select value={takesPath} onValueChange={setTakesPath}>
                        <SelectTrigger data-testid="select-takes-path">
                          <SelectValue placeholder="Selecionar..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(storageOptions?.paths || ["uploads"]).map((p: string) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldGroup>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleCreate}
                      disabled={!title || !prodId || !dateStr || !takesPath || createSession.isPending || (storageOptions && !storageOptions.supabaseOk)}
                      className="press-effect"
                      data-testid="button-schedule-session"
                    >
                      {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {createSession.isPending ? "Agendando..." : pt.sessions.schedule}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        }
      />

      <div className="space-y-3">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="vhub-card h-24 shimmer" />
            ))}
          </div>
        ) : filteredSessions.length ? filteredSessions.map((session) => {
          const production = productions?.find((p) => p.id === session.productionId);
          const computedStatus = computeSessionStatus(session.scheduledAt, session.durationMinutes ?? 60);
          const canEnter = !isRestrictedRole || sessionEntryAllowed(session.scheduledAt, 5);
          const countdown = !canEnter ? formatCountdownTime(session.scheduledAt, 5) : null;

          return (
            <div
              key={session.id}
              className="vhub-card-clickable overflow-hidden"
              data-testid={`card-session-${session.id}`}
              role="link"
              tabIndex={0}
              onClick={() => {
                if (canEnter) navigate(`/hub-dub/studio/${studioId}/sessions/${session.id}/room`);
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && canEnter) {
                  e.preventDefault();
                  navigate(`/hub-dub/studio/${studioId}/sessions/${session.id}/room`);
                }
              }}
            >
              <div className="flex flex-col sm:flex-row items-center gap-5 p-5">
                <div className="w-11 h-11 rounded-xl bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-5 h-5 text-primary" />
                </div>

                <div className="flex-1 text-center sm:text-left min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{session.title}</h3>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-1 vhub-caption">
                    <span className="flex items-center gap-1">
                      <Film className="w-3 h-3" />
                      {production?.name || "Producao desconhecida"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(session.scheduledAt), "PPp")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={computedStatus} />
                  {canDeleteSessions && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 h-8 text-xs relative z-10 text-red-500/70 hover:text-red-500"
                      data-testid={`button-delete-session-${session.id}`}
                      onClick={(e) => { e.stopPropagation(); deleteSession.mutate(session.id); }}
                      disabled={deleteSession.isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Excluir
                    </Button>
                  )}
                  {canEnter ? (
                    <Button
                      size="sm"
                      className="gap-1.5 press-effect h-8 text-xs relative z-10"
                      data-testid={`button-join-room-${session.id}`}
                      onClick={(e) => e.stopPropagation()}
                      asChild
                    >
                      <Link href={`/hub-dub/studio/${studioId}/sessions/${session.id}/room`}>
                        <Video className="w-3.5 h-3.5" />
                        {pt.sessions.join}
                      </Link>
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="sm"
                          className="gap-1.5 h-8 text-xs relative z-10 opacity-50 cursor-not-allowed"
                          data-testid={`button-join-room-${session.id}`}
                          onClick={(e) => e.stopPropagation()}
                          disabled
                        >
                          <Lock className="w-3.5 h-3.5" />
                          {pt.sessions.join}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Disponivel em {countdown}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            </div>
          );
        }) : (
          <EmptyState
            icon={<CalendarIcon className="w-5 h-5" />}
            title={pt.sessions.noSessions}
            description={filterProductionId ? "Nenhuma sessao para esta producao." : pt.sessions.noSessionsDesc}
          />
        )}
      </div>
    </PageSection>
  );
});

export default Sessions;

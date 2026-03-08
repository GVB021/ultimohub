import { useState, memo } from "react";
import { useSessions, useCreateSession } from "@/hooks/use-sessions";
import { useProductions } from "@/hooks/use-productions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Clock, Plus, Video, Film, Loader2, Trash2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useStudioRole } from "@/hooks/use-studio-role";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import {
  PageSection, PageHeader, EmptyState, StatusBadge, FieldGroup, GridSkeleton
} from "@/components/ui/design-system";
import { pt } from "@/lib/i18n";

const Sessions = memo(function Sessions({ studioId }: { studioId: string }) {
  const { data: sessions, isLoading } = useSessions(studioId);
  const { data: productions } = useProductions(studioId);
  const createSession = useCreateSession(studioId);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { canCreateSessions, hasMinRole } = useStudioRole(studioId);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStudioAdmin = hasMinRole("studio_admin");

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
  const [prodId, setProdId] = useState("");
  const [dateStr, setDateStr] = useState("");

  const handleCreate = async () => {
    if (!title || !prodId || !dateStr) return;
    await createSession.mutateAsync({
      title,
      productionId: prodId,
      scheduledAt: new Date(dateStr).toISOString(),
      status: "scheduled",
      durationMinutes: 60,
    });
    setIsOpen(false);
    setTitle("");
    setProdId("");
    setDateStr("");
    toast({ title: "Sessao agendada" });
  };

  return (
    <PageSection>
      <PageHeader
        title={pt.sessions.title}
        subtitle="Agende e gerencie sessoes de gravacao"
        action={canCreateSessions ? (
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
              </div>
              <DialogFooter>
                <Button
                  onClick={handleCreate}
                  disabled={!title || !prodId || !dateStr || createSession.isPending}
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
      />

      <div className="space-y-3">
        {isLoading ? (
          <div className="grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="vhub-card h-24 shimmer" />
            ))}
          </div>
        ) : sessions?.length ? sessions.map((session) => {
          const production = productions?.find((p) => p.id === session.productionId);
          return (
            <div
              key={session.id}
              className="vhub-card-clickable overflow-hidden"
              data-testid={`card-session-${session.id}`}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/studio/${studioId}/sessions/${session.id}/room`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate(`/studio/${studioId}/sessions/${session.id}/room`); } }}
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
                  <StatusBadge status={session.status} />
                  {(isStudioAdmin || (canCreateSessions && (session as any).createdBy === user?.id)) && (
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
                  <Button
                    size="sm"
                    className="gap-1.5 press-effect h-8 text-xs relative z-10"
                    data-testid={`button-join-room-${session.id}`}
                    onClick={(e) => e.stopPropagation()}
                    asChild
                  >
                    <Link href={`/studio/${studioId}/sessions/${session.id}/room`}>
                      <Video className="w-3.5 h-3.5" />
                      {pt.sessions.join}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        }) : (
          <EmptyState
            icon={<CalendarIcon className="w-5 h-5" />}
            title={pt.sessions.noSessions}
            description={pt.sessions.noSessionsDesc}
          />
        )}
      </div>
    </PageSection>
  );
});

export default Sessions;

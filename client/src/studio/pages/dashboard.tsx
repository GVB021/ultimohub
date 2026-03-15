import { memo, useState } from "react";
import { useProductions } from "@studio/hooks/use-productions";
import { useSessions } from "@studio/hooks/use-sessions";
import { useStudio } from "@studio/hooks/use-studios";
import { useStudioRole } from "@studio/hooks/use-studio-role";
import { SessionCard } from "@studio/components/dashboard/session-card";
import { PageSection } from "@studio/components/ui/design-system";
import { Button } from "@studio/components/ui/button";
import { Film, Calendar, Plus, Clock, PlayCircle, Mic, SlidersHorizontal, Waves, Wind, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { pt } from "@studio/lib/i18n";
import { isSessionVisibleOnDashboard } from "@studio/lib/session-status";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { ptBR } from "date-fns/locale";
import { ProductionBackgroundVideo } from "@studio/components/dashboard/production-background-video";

const Dashboard = memo(function Dashboard({ studioId }: { studioId: string }) {
  const studio = useStudio(studioId);
  const { data: productions } = useProductions(studioId);
  const { data: sessions } = useSessions(studioId);
  const { canCreateProductions, canCreateSessions } = useStudioRole(studioId);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const upcomingSessions = (sessions || []).filter(s =>
    isSessionVisibleOnDashboard(s.scheduledAt, s.durationMinutes ?? 60)
  ).sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  // Find current or next session
  const now = new Date();
  const currentOrNextSession = upcomingSessions.find(s => {
    const start = new Date(s.scheduledAt);
    const end = new Date(start.getTime() + (s.durationMinutes || 60) * 60000);
    return end > now;
  });

  // Find current production based on session
  const currentProduction = currentOrNextSession 
    ? productions?.find(p => p.id === currentOrNextSession.productionId)
    : null;

  const sessionsOnSelectedDate = upcomingSessions.filter(s => 
    selectedDate && new Date(s.scheduledAt).toDateString() === selectedDate.toDateString()
  );

  const tutorialSteps = [
    {
      id: "mic-env",
      title: "Microfone e ambiente",
      description: "Use ambiente silencioso, microfone em suporte estável e tratamento acústico básico.",
      icon: Mic,
    },
    {
      id: "gain-level",
      title: "Ganho e nível",
      description: "Ajuste o ganho para picos entre -12 dB e -6 dB, evitando clipping.",
      icon: SlidersHorizontal,
    },
    {
      id: "position",
      title: "Posicionamento",
      description: "Fique entre 12 e 20 cm do microfone com pop filter e ângulo leve lateral.",
      icon: Waves,
    },
    {
      id: "breath-diction",
      title: "Respiração e dicção",
      description: "Respire fora da frase, articule consoantes e mantenha ritmo natural.",
      icon: Wind,
    },
  ];

  return (
    <PageSection className="max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              {studio?.name || pt.dashboard.title}
            </h1>
            <p className="text-muted-foreground text-sm font-medium">
              {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          
          <div className="flex gap-2">
            {canCreateProductions && (
              <Button size="sm" className="gap-1.5 vhub-btn-sm vhub-btn-primary shadow-lg shadow-primary/20" asChild>
                <Link href={`/hub-dub/studio/${studioId}/productions`}>
                  <Plus className="h-3.5 w-3.5" /> {pt.dashboard.production}
                </Link>
              </Button>
            )}
            {canCreateSessions && (
              <Button size="sm" variant="outline" className="gap-1.5 border-border/70 hover:bg-muted/60" asChild>
                <Link href={`/hub-dub/studio/${studioId}/sessions`}>
                  <Clock className="h-3.5 w-3.5" /> {pt.dashboard.session}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card aspect-[16/9] lg:aspect-auto flex flex-col justify-end transition-all duration-300 hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/10 group">
            <ProductionBackgroundVideo
              videoUrl={currentProduction?.videoUrl}
              posterUrl={null}
            />
            {!currentProduction?.videoUrl && (
              <div className="absolute inset-0 bg-gradient-to-br from-muted to-card flex items-center justify-center">
                <Film className="w-24 h-24 text-muted-foreground/20" />
              </div>
            )}
            
            <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/60 to-transparent" />
            
            <div className="relative z-10 p-8 space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/20 backdrop-blur-md px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg">
                  Produção em Destaque
                </span>
              </div>
              
              <div className="space-y-1">
                {currentProduction ? (
                  <>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">
                      {currentProduction.name}
                    </h2>
                    {currentOrNextSession && (
                      <p className="text-muted-foreground text-lg font-medium">
                        {currentOrNextSession.title}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-3xl font-bold text-foreground">Sem produção ativa</h2>
                    <p className="text-muted-foreground">Nenhuma sessão agendada para hoje.</p>
                  </>
                )}
              </div>

              {currentOrNextSession && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-4 py-2 rounded-lg border border-border/70 text-foreground shadow-sm">
                    <Clock className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      {new Date(currentOrNextSession.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-4 py-2 rounded-lg border border-border/70 text-foreground shadow-sm">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      {new Date(currentOrNextSession.scheduledAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/70 p-6 flex flex-col md:flex-row gap-6 transition-all duration-300 hover:border-border">
            <div className="flex-shrink-0 mx-auto md:mx-0">
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                locale={ptBR}
                className="p-0 m-0"
                modifiers={{
                  hasSession: (date) => upcomingSessions.some(s => new Date(s.scheduledAt).toDateString() === date.toDateString())
                }}
                modifiersStyles={{
                  hasSession: { fontWeight: 'bold', color: 'hsl(var(--primary))', textDecoration: 'underline' }
                }}
                styles={{
                  caption: { color: 'hsl(var(--foreground))' },
                  head_cell: { color: 'hsl(var(--muted-foreground))' },
                  day: { color: 'hsl(var(--foreground))' },
                  nav_button: { color: 'hsl(var(--foreground))' },
                }}
              />
            </div>

            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between mb-4 border-b border-border/70 pb-2">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                  <PlayCircle className="w-5 h-5 text-primary" />
                  Sessões
                </h3>
              </div>

              <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[300px]">
                {sessionsOnSelectedDate.length > 0 ? (
                  sessionsOnSelectedDate.map(session => (
                    <SessionCard key={session.id} session={session} studioId={studioId} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-8 text-muted-foreground">
                    <Calendar className="w-10 h-10 mb-2 opacity-20" />
                    <p className="text-sm">Nenhuma sessão para este dia</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-foreground border-b border-border/70 pb-4">
            <Mic className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Mini Tutorial de Captação</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {tutorialSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <article
                  key={step.id}
                  className="rounded-xl border border-border/70 bg-background/80 p-4 shadow-sm transition-colors hover:bg-muted/30"
                >
                  <div className="mb-3 h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">Passo {index + 1}</p>
                  <h3 className="font-semibold text-foreground leading-tight mb-1">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </article>
              );
            })}
          </div>

          <div className="flex justify-end">
            <div className="space-y-3 text-right">
              <p className="text-sm text-muted-foreground">
                Aprimore o setup antes de iniciar cada sessão para reduzir retrabalho.
              </p>
              <Link href={`/hub-dub/studio/${studioId}/tutorial-audio`}>
                <Button variant="outline" className="gap-2 border-border/70 hover:bg-muted/40" data-testid="button-open-full-tutorial">
                  Ver tutorial completo <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageSection>
  );
});

export default Dashboard;

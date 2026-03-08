import { useState, useMemo, useCallback, memo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/hooks/use-auth";
import { useStudioRole } from "@/hooks/use-studio-role";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PageSection, PageHeader } from "@/components/ui/design-system";
import {
  ChevronDown, ChevronRight, Download, Play, Pause, Music,
  Building2, Film, Calendar, Loader2, ShieldAlert, Star, FileAudio,
  CheckSquare, Package
} from "lucide-react";

interface TakeDetail {
  id: string;
  sessionId: string;
  characterId: string;
  voiceActorId: string;
  lineIndex: number;
  audioUrl: string;
  durationSeconds: number;
  isPreferred: boolean;
  qualityScore: number | null;
  aiRecommended: boolean;
  createdAt: string;
  characterName: string | null;
  voiceActorName: string | null;
  sessionTitle: string;
  productionId: string;
  productionName: string;
  studioId: string;
  studioName: string;
}

interface GroupedData {
  studios: Map<string, {
    name: string;
    productions: Map<string, {
      name: string;
      sessions: Map<string, {
        title: string;
        takes: TakeDetail[];
      }>;
    }>;
  }>;
}

function formatTakeFilename(take: TakeDetail): string {
  const charName = (take.characterName || "PERSONAGEM").replace(/\s+/g, "");
  const actorName = (take.voiceActorName || "DUBLADOR").replace(/\s+/g, "");
  const d = new Date(take.createdAt);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${charName}_${actorName}_${hh}${mm}${ss}.WAV`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function groupTakes(takes: TakeDetail[]): GroupedData {
  const studios = new Map<string, {
    name: string;
    productions: Map<string, {
      name: string;
      sessions: Map<string, {
        title: string;
        takes: TakeDetail[];
      }>;
    }>;
  }>();

  for (const take of takes) {
    if (!studios.has(take.studioId)) {
      studios.set(take.studioId, { name: take.studioName, productions: new Map() });
    }
    const studio = studios.get(take.studioId)!;
    if (!studio.productions.has(take.productionId)) {
      studio.productions.set(take.productionId, { name: take.productionName, sessions: new Map() });
    }
    const production = studio.productions.get(take.productionId)!;
    if (!production.sessions.has(take.sessionId)) {
      production.sessions.set(take.sessionId, { title: take.sessionTitle, takes: [] });
    }
    production.sessions.get(take.sessionId)!.takes.push(take);
  }

  return { studios };
}

function AudioPlayer({ audioUrl, takeId }: { audioUrl: string; takeId: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }, [playing, audioUrl]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7"
      onClick={toggle}
      data-testid={`button-play-${takeId}`}
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
    </Button>
  );
}

function TakeRow({
  take,
  selected,
  onToggle,
}: {
  take: TakeDetail;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const filename = formatTakeFilename(take);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/takes/${take.id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Download falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.04] last:border-b-0"
      data-testid={`row-take-${take.id}`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggle(take.id)}
        data-testid={`checkbox-take-${take.id}`}
      />
      <AudioPlayer audioUrl={take.audioUrl} takeId={take.id} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-foreground truncate" data-testid={`text-filename-${take.id}`}>
            {filename}
          </span>
          {take.isPreferred && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500/40 text-amber-400 bg-amber-500/10">
              <Star className="h-2.5 w-2.5 mr-0.5 fill-amber-400" /> Preferido
            </Badge>
          )}
          {take.aiRecommended && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-500/40 text-blue-400 bg-blue-500/10">
              AI
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
          <span>Linha {take.lineIndex + 1}</span>
          <span>{formatDuration(take.durationSeconds)}</span>
          {take.qualityScore !== null && (
            <span>Qualidade: {Math.round(take.qualityScore)}%</span>
          )}
          <span>{new Date(take.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleDownload}
        disabled={downloading}
        data-testid={`button-download-${take.id}`}
      >
        {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function SessionGroup({
  sessionId,
  sessionTitle,
  takes,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  sessionId: string;
  sessionTitle: string;
  takes: TakeDetail[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const takeIds = takes.map(t => t.id);
  const allSelected = takeIds.every(id => selectedIds.has(id));

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/takes/download-all`, { credentials: "include" });
      if (!res.ok) throw new Error("Download falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sessionTitle.replace(/[^a-zA-Z0-9_\-]/g, "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="ml-4 mb-2" data-testid={`group-session-${sessionId}`}>
      <div className="flex items-center gap-2 py-2 px-3 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 min-w-0 text-left" data-testid={`toggle-session-${sessionId}`}>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">{sessionTitle}</span>
          <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{takes.length} takes</Badge>
        </button>
        <Checkbox
          checked={allSelected}
          onCheckedChange={(checked) => onToggleAll(takeIds, !!checked)}
          data-testid={`checkbox-session-${sessionId}`}
          className="shrink-0"
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={handleDownloadAll}
          disabled={downloading}
          data-testid={`button-download-session-${sessionId}`}
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
          Baixar Sessao
        </Button>
      </div>
      {open && (
        <div className="mt-1 ml-2 border-l border-white/[0.06]">
          {takes.map(take => (
            <TakeRow
              key={take.id}
              take={take}
              selected={selectedIds.has(take.id)}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductionGroup({
  productionId,
  productionName,
  sessionsMap,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  productionId: string;
  productionName: string;
  sessionsMap: Map<string, { title: string; takes: TakeDetail[] }>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const totalTakes = Array.from(sessionsMap.values()).reduce((sum, s) => sum + s.takes.length, 0);

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/productions/${productionId}/takes/download-all`, { credentials: "include" });
      if (!res.ok) throw new Error("Download falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${productionName.replace(/[^a-zA-Z0-9_\-]/g, "_")}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="mb-3" data-testid={`group-production-${productionId}`}>
      <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.06] transition-colors cursor-pointer">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 min-w-0 text-left" data-testid={`toggle-production-${productionId}`}>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
          <Film className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold truncate">{productionName}</span>
          <Badge variant="secondary" className="text-[10px] ml-1 shrink-0">{totalTakes} takes</Badge>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1 shrink-0"
          onClick={handleDownloadAll}
          disabled={downloading}
          data-testid={`button-download-production-${productionId}`}
        >
          {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
          Baixar Producao
        </Button>
      </div>
      {open && (
        <div className="mt-1">
          {Array.from(sessionsMap.entries()).map(([sessionId, { title, takes }]) => (
            <SessionGroup
              key={sessionId}
              sessionId={sessionId}
              sessionTitle={title}
              takes={takes}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StudioGroup({
  studioId,
  studioName,
  productionsMap,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  studioId: string;
  studioName: string;
  productionsMap: Map<string, { name: string; sessions: Map<string, { title: string; takes: TakeDetail[] }> }>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], select: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden" data-testid={`group-studio-${studioId}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
        data-testid={`toggle-studio-${studioId}`}
      >
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Building2 className="h-5 w-5 text-accent" />
        <span className="text-base font-bold">{studioName}</span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {Array.from(productionsMap.entries()).map(([productionId, { name, sessions }]) => (
            <ProductionGroup
              key={productionId}
              productionId={productionId}
              productionName={name}
              sessionsMap={sessions}
              selectedIds={selectedIds}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const Takes = memo(function Takes({ studioId }: { studioId: string }) {
  const { user } = useAuth();
  const { hasMinRole } = useStudioRole(studioId);
  const { toast } = useToast();
  const isPlatformOwner = user?.role === "platform_owner";
  const isStudioAdmin = hasMinRole("studio_admin");
  const hasAccess = isPlatformOwner || isStudioAdmin;

  const { data: takesRaw, isLoading } = useQuery<TakeDetail[]>({
    queryKey: ["/api/studios", studioId, "takes", "grouped"],
    queryFn: () => authFetch(`/api/studios/${studioId}/takes/grouped`),
    enabled: hasAccess,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const grouped = useMemo(() => takesRaw ? groupTakes(takesRaw) : null, [takesRaw]);
  const totalTakes = takesRaw?.length ?? 0;

  const handleToggle = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback((ids: string[], select: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (!takesRaw) return;
    if (selectedIds.size === totalTakes) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(takesRaw.map(t => t.id)));
    }
  }, [takesRaw, selectedIds.size, totalTakes]);

  const handleBulkDownload = async () => {
    if (selectedIds.size === 0) return;
    setBulkDownloading(true);
    try {
      const res = await fetch("/api/takes/download-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ takeIds: Array.from(selectedIds) }),
      });
      if (!res.ok) throw new Error("Download falhou");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "takes_selecionados.zip";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado", description: `${selectedIds.size} takes` });
    } catch (err: any) {
      toast({ title: "Erro no download", description: err?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setBulkDownloading(false);
    }
  };

  if (!hasAccess) {
    return (
      <PageSection>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShieldAlert className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground">Esta pagina e exclusiva para administradores do estudio e da plataforma.</p>
        </div>
      </PageSection>
    );
  }

  return (
    <PageSection>
      <PageHeader
        label="Biblioteca"
        title="Takes de Audio"
        subtitle={totalTakes > 0 ? `${totalTakes} takes gravados` : "Nenhum take gravado ainda"}
        action={
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button
                onClick={handleBulkDownload}
                disabled={bulkDownloading}
                size="sm"
                className="gap-1.5"
                data-testid="button-download-selected"
              >
                {bulkDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Baixar Selecionados ({selectedIds.size})
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="gap-1.5"
              data-testid="button-select-all"
            >
              <CheckSquare className="h-4 w-4" />
              {selectedIds.size === totalTakes && totalTakes > 0 ? "Desmarcar Todos" : "Selecionar Todos"}
            </Button>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && totalTakes === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileAudio className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhum take ainda</h3>
          <p className="text-sm text-muted-foreground">Os takes gravados nas sessoes aparecerão aqui organizados por estudio, producao e sessao.</p>
        </div>
      )}

      {!isLoading && grouped && (
        <div className="mt-6">
          {isPlatformOwner ? (
            Array.from(grouped.studios.entries()).map(([studioId, { name, productions }]) => (
              <StudioGroup
                key={studioId}
                studioId={studioId}
                studioName={name}
                productionsMap={productions}
                selectedIds={selectedIds}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
              />
            ))
          ) : (
            Array.from(grouped.studios.entries()).map(([, { productions }]) => (
              Array.from(productions.entries()).map(([productionId, { name, sessions }]) => (
                <ProductionGroup
                  key={productionId}
                  productionId={productionId}
                  productionName={name}
                  sessionsMap={sessions}
                  selectedIds={selectedIds}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                />
              ))
            ))
          )}
        </div>
      )}
    </PageSection>
  );
});

export default Takes;

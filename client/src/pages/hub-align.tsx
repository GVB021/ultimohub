import { useMemo, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, Upload, ChevronRight, FileAudio, Check, Download } from "lucide-react";
import { AppHeader } from "@/components/nav/AppHeader";
import { authFetch } from "@/lib/auth-fetch";
import { useAuth } from "@/hooks/use-auth";

// Hook para detectar mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
}

type HubAlignAccess = {
  allowed: boolean;
  username: string;
  expected: string;
  supabaseOk: boolean;
  supabaseReason: string | null;
};

type HubAlignProject = {
  id: string;
  name: string;
  description: string;
  fileCount: number;
  versionCount: number;
};

type HubAlignFile = {
  name: string;
  objectPath: string;
  size: number;
  updatedAt: string | null;
  streamUrl: string;
};

type TrackRow = {
  id: string;
  fileName: string;
  streamUrl: string;
  startSeconds: number;
  durationSeconds: number;
};

function formatSize(input: number) {
  if (!Number.isFinite(input) || input <= 0) return "0 B";
  if (input >= 1024 * 1024) return `${(input / (1024 * 1024)).toFixed(2)} MB`;
  if (input >= 1024) return `${(input / 1024).toFixed(1)} KB`;
  return `${Math.round(input)} B`;
}

export default function HubAlignPage() {
  const isMobile = useIsMobile();
  const [lang, setLang] = useState<"en" | "pt">("pt");
  const [, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedFileUrls, setSelectedFileUrls] = useState<string[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [hubDubSearch, setHubDubSearch] = useState("");
  const [isGeneratingTrack, setIsGeneratingTrack] = useState(false);
  const [trackReady, setTrackReady] = useState(false);

  const accessQuery = useQuery<HubAlignAccess>({
    queryKey: ["/api/hubalign/access"],
    queryFn: () => authFetch("/api/hubalign/access"),
    enabled: Boolean(user),
    retry: false,
  });

  const projectsQuery = useQuery<{ items: HubAlignProject[] }>({
    queryKey: ["/api/hubalign/projects"],
    queryFn: () => authFetch("/api/hubalign/projects"),
    enabled: Boolean(accessQuery.data?.allowed),
  });

  const filesQuery = useQuery<{ items: HubAlignFile[] }>({
    queryKey: ["/api/hubalign/projects", selectedProjectId, "files"],
    queryFn: () => authFetch(`/api/hubalign/projects/${selectedProjectId}/files`),
    enabled: Boolean(accessQuery.data?.allowed && selectedProjectId),
  });

  const hubDubTakesQuery = useQuery<{ items: any[] }>({
    queryKey: ["/api/hubalign/hubdub-takes", hubDubSearch],
    queryFn: () => authFetch(`/api/hubalign/hubdub-takes?search=${encodeURIComponent(hubDubSearch)}`),
    enabled: Boolean(accessQuery.data?.allowed),
  });

  const createProjectMutation = useMutation({
    mutationFn: () =>
      authFetch("/api/hubalign/projects", {
        method: "POST",
        body: JSON.stringify({ name: projectName, description: projectDescription }),
      }),
    onSuccess: (created: HubAlignProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hubalign/projects"] });
      setSelectedProjectId(created.id);
      setProjectName("");
      setProjectDescription("");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/hubalign/projects/${selectedProjectId}/upload`, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Falha no upload");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hubalign/projects", selectedProjectId, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hubalign/projects"] });
    },
  });

  const tracks = useMemo<TrackRow[]>(() => {
    const files = filesQuery.data?.items || [];
    let start = 0;
    return files
      .filter((f) => selectedFileUrls.includes(f.streamUrl))
      .map((file) => {
        const row = {
          id: `${file.objectPath}`,
          fileName: file.name,
          streamUrl: file.streamUrl,
          startSeconds: start,
          durationSeconds: 3,
        };
        start += row.durationSeconds;
        return row;
      });
  }, [filesQuery.data?.items, selectedFileUrls]);

  const saveVersionMutation = useMutation({
    mutationFn: () =>
      authFetch(`/api/hubalign/projects/${selectedProjectId}/tracks/version`, {
        method: "POST",
        body: JSON.stringify({
          tracks,
          playback: { previewFile: selectedPreview || null },
          note: "Versionamento manual via interface HubAlign",
        }),
      }),
  });

  const exportMutation = useMutation({
    mutationFn: () =>
      authFetch(`/api/hubalign/projects/${selectedProjectId}/export`, {
        method: "POST",
        body: JSON.stringify({
          selectedFiles: tracks.map((t) => t.fileName),
          timeline: tracks,
        }),
      }),
  });

  const dashboardMetrics = useMemo(() => {
    const projects = projectsQuery.data?.items || [];
    const files = filesQuery.data?.items || [];
    return {
      totalProjects: projects.length,
      totalFiles: files.length,
      selectedTracks: tracks.length,
      avgFileSize: files.length ? Math.round(files.reduce((acc, item) => acc + Number(item.size || 0), 0) / files.length) : 0,
    };
  }, [filesQuery.data?.items, projectsQuery.data?.items, tracks.length]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader lang={lang} setLang={setLang} />
        <main className="pt-28 max-w-4xl mx-auto px-6">
          <div className="rounded-2xl border border-border p-8 bg-card">
            <h1 className="text-2xl font-semibold mb-2">HubAlign - Acesso restrito</h1>
            <p className="text-muted-foreground mb-6">Faça login para acessar o ambiente de montagem e sincronização.</p>
            <button className="h-10 px-5 rounded-md bg-primary text-primary-foreground font-semibold" onClick={() => navigate("/hub-dub/login")}>
              Ir para login
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (accessQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!accessQuery.data?.allowed) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppHeader lang={lang} setLang={setLang} />
        <main className="pt-28 max-w-4xl mx-auto px-6">
          <div className="rounded-2xl border border-border p-8 bg-card">
            <h1 className="text-2xl font-semibold mb-2">Acesso não autorizado</h1>
            <p className="text-muted-foreground">A área HubAlign está liberada exclusivamente para o usuário borbaggabriel.</p>
          </div>
        </main>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <AppHeader lang={lang} setLang={setLang} />
        <main className="flex-1 pt-20 px-4 pb-10 space-y-6">
          <section className="space-y-4">
            <h1 className="text-xl font-bold">HubAlign Mobile</h1>
            <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
              <h2 className="text-sm font-semibold mb-3">Selecione o Projeto</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {(projectsQuery.data?.items || []).map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      setSelectedProjectId(project.id);
                      setTrackReady(false);
                    }}
                    className={`flex-shrink-0 px-4 py-2 rounded-xl border text-sm transition-all ${
                      selectedProjectId === project.id ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 border-border"
                    }`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {selectedProjectId && (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Seleção de Takes</h2>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">{selectedFileUrls.length} selecionados</span>
              </div>
              <div className="grid gap-3">
                {(hubDubTakesQuery.data?.items || []).map((take) => {
                  const isSelected = selectedFileUrls.includes(take.streamUrl);
                  return (
                    <button
                      key={take.id}
                      onClick={() => {
                        const next = isSelected
                          ? selectedFileUrls.filter((url) => url !== take.streamUrl)
                          : [...selectedFileUrls, take.streamUrl];
                        setSelectedFileUrls(next);
                        setTrackReady(false);
                      }}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left min-h-[56px] ${
                        isSelected ? "bg-primary/5 border-primary/30" : "bg-card border-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? "bg-primary border-primary text-primary-foreground" : "bg-muted/50 border-border"
                        }`}>
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold truncate max-w-[200px]">{take.characterName || "Sem personagem"}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{take.productionName}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground">{take.durationSeconds.toFixed(1)}s</span>
                    </button>
                  );
                })}
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-md border-t border-border/50 z-50">
                {!trackReady ? (
                  <button
                    disabled={selectedFileUrls.length === 0 || isGeneratingTrack}
                    onClick={() => {
                      setIsGeneratingTrack(true);
                      setTimeout(() => {
                        setIsGeneratingTrack(false);
                        setTrackReady(true);
                        if (selectedFileUrls[0]) setSelectedPreview(selectedFileUrls[0]);
                      }, 2000);
                    }}
                    className="vhub-btn-lg w-full bg-primary text-primary-foreground flex items-center justify-center gap-2 rounded-2xl"
                  >
                    {isGeneratingTrack ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <FileAudio className="w-4 h-4" />
                        Gerar Track
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                      <button
                        className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        onClick={() => {
                          const audio = document.getElementById("hubalign-audio-mobile") as HTMLAudioElement;
                          if (audio.paused) {
                            audio.play();
                            setIsPreviewPlaying(true);
                          } else {
                            audio.pause();
                            setIsPreviewPlaying(false);
                          }
                        }}
                      >
                        {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-xs font-bold truncate">Track Gerada • {selectedFileUrls.length} takes</p>
                        <audio id="hubalign-audio-mobile" src={selectedPreview} className="hidden" onPlay={() => setIsPreviewPlaying(true)} onPause={() => setIsPreviewPlaying(false)} />
                      </div>
                      <button 
                        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                        onClick={() => {
                          const link = document.createElement("a");
                          link.href = selectedPreview;
                          link.download = "track-final.wav";
                          link.click();
                        }}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                    <button onClick={() => setTrackReady(false)} className="w-full text-xs text-muted-foreground font-bold uppercase tracking-widest py-2">
                      Recomeçar
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader lang={lang} setLang={setLang} />
      <main className="pt-24 pb-16 max-w-[1400px] mx-auto px-6 space-y-6">
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Projetos</p>
            <p className="text-2xl font-bold">{dashboardMetrics.totalProjects}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Arquivos</p>
            <p className="text-2xl font-bold">{dashboardMetrics.totalFiles}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Tracks selecionadas</p>
            <p className="text-2xl font-bold">{dashboardMetrics.selectedTracks}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground uppercase">Média por arquivo</p>
            <p className="text-2xl font-bold">{formatSize(dashboardMetrics.avgFileSize)}</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">Projetos HubAlign</h2>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Nome do projeto" className="h-10 rounded-md border border-border px-3 bg-background" />
            <input value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} placeholder="Descrição técnica" className="h-10 rounded-md border border-border px-3 bg-background" />
            <button
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
              onClick={() => createProjectMutation.mutate()}
              disabled={createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? "Criando..." : "Criar projeto"}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(projectsQuery.data?.items || []).map((project) => (
              <button
                key={project.id}
                className={`text-left rounded-lg border p-4 ${selectedProjectId === project.id ? "border-primary" : "border-border"}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                <p className="font-semibold">{project.name}</p>
                <p className="text-sm text-muted-foreground">{project.description || "Sem descrição"}</p>
                <p className="text-xs text-muted-foreground mt-2">{project.fileCount} arquivos • {project.versionCount} versões</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Upload e gerenciamento de dublagens</h2>
            <label className="h-10 px-4 rounded-md border border-border inline-flex items-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              Upload
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                disabled={!selectedProjectId || uploadMutation.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && selectedProjectId) uploadMutation.mutate(file);
                }}
              />
            </label>
          </div>
          <div className="space-y-2">
            {(filesQuery.data?.items || []).map((file) => {
              const checked = selectedFileUrls.includes(file.streamUrl);
              return (
                <div key={file.objectPath} className="rounded-lg border border-border p-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedFileUrls, file.streamUrl]
                          : selectedFileUrls.filter((url) => url !== file.streamUrl);
                        setSelectedFileUrls(next);
                      }}
                    />
                    <div>
                      <p className="font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                    </div>
                  </div>
                  <button className="h-8 px-3 rounded-md border border-border text-sm" onClick={() => setSelectedPreview(file.streamUrl)}>
                    Prévia
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Takes dublados do HubDub</h2>
            <div className="flex items-center gap-2">
              <input 
                value={hubDubSearch} 
                onChange={(e) => setHubDubSearch(e.target.value)} 
                placeholder="Buscar produção, ator..." 
                className="h-9 w-64 rounded-md border border-border px-3 bg-background text-sm" 
              />
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
            {hubDubTakesQuery.isLoading && <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}
            {(hubDubTakesQuery.data?.items || []).map((take) => {
              const checked = selectedFileUrls.includes(take.streamUrl);
              return (
                <div key={take.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-4 bg-background/50 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...selectedFileUrls, take.streamUrl]
                          : selectedFileUrls.filter((url) => url !== take.streamUrl);
                        setSelectedFileUrls(next);
                      }}
                    />
                    <div>
                      <p className="font-medium text-sm">{take.characterName || "Sem personagem"} - {take.productionName}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{take.voiceActorName} • {take.sessionTitle} • {take.durationSeconds.toFixed(1)}s</p>
                    </div>
                  </div>
                  <button className="h-8 px-3 rounded-md border border-border text-sm hover:bg-background transition-colors" onClick={() => setSelectedPreview(take.streamUrl)}>
                    Prévia
                  </button>
                </div>
              );
            })}
            {!hubDubTakesQuery.isLoading && (hubDubTakesQuery.data?.items || []).length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">Nenhum take dublado encontrado.</p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">Montagem de tracks e timeline</h2>
          <div className="space-y-2">
            {tracks.map((track) => (
              <div key={track.id} className="grid grid-cols-[1fr_140px_140px] gap-3 rounded-md border border-border p-3">
                <div className="font-medium">{track.fileName}</div>
                <div className="text-sm text-muted-foreground">Start: {track.startSeconds.toFixed(2)}s</div>
                <div className="text-sm text-muted-foreground">Duração: {track.durationSeconds.toFixed(2)}s</div>
              </div>
            ))}
            {tracks.length === 0 && <p className="text-sm text-muted-foreground">Selecione arquivos para montar a timeline.</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="h-10 px-4 rounded-md border border-border disabled:opacity-50"
              disabled={!selectedProjectId || tracks.length === 0 || saveVersionMutation.isPending}
              onClick={() => saveVersionMutation.mutate()}
            >
              {saveVersionMutation.isPending ? "Salvando versão..." : "Salvar versão"}
            </button>
            <button
              className="h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold disabled:opacity-50"
              disabled={!selectedProjectId || tracks.length === 0 || exportMutation.isPending}
              onClick={() => exportMutation.mutate()}
            >
              {exportMutation.isPending ? "Exportando..." : "Exportar projeto"}
            </button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-lg font-semibold">Playback de pré-visualização</h2>
          <div className="flex items-center gap-3">
            <button
              className="h-10 w-10 rounded-full border border-border inline-flex items-center justify-center disabled:opacity-50"
              disabled={!selectedPreview}
              onClick={() => {
                const audio = document.getElementById("hubalign-audio-preview") as HTMLAudioElement | null;
                if (!audio) return;
                if (audio.paused) {
                  audio.play().catch(() => {});
                  setIsPreviewPlaying(true);
                } else {
                  audio.pause();
                  setIsPreviewPlaying(false);
                }
              }}
            >
              {isPreviewPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <p className="text-sm text-muted-foreground truncate">{selectedPreview ? decodeURIComponent(selectedPreview) : "Selecione um arquivo para ouvir a prévia."}</p>
          </div>
          <audio id="hubalign-audio-preview" src={selectedPreview} controls className="w-full" onPause={() => setIsPreviewPlaying(false)} onPlay={() => setIsPreviewPlaying(true)} />
        </section>
      </main>
    </div>
  );
}

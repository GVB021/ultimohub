import { useParams, Link } from "wouter";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { authFetch } from "@studio/lib/auth-fetch";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Save,
  ArrowLeft,
  Circle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Trash2,
  Headphones,
  AlertCircle,
  RotateCcw,
  RotateCw,
  Repeat,
  Settings,
  X,
  Monitor,
  User,
  Edit3,
  Download,
  Minimize2,
  Maximize2,
} from "lucide-react";
import { useToast } from "@studio/hooks/use-toast";
import { useAuth } from "@studio/hooks/use-auth";
import { formatTimecode, parseTimecode } from "@studio/lib/timecode";
import { cn } from "@studio/lib/utils";

import {
  requestMicrophone,
  releaseMicrophone,
  setGain,
  getAnalyserData,
  type MicrophoneState,
  type VoiceCaptureMode,
} from "@studio/lib/audio/microphoneManager";
import MonitorPanel from "@studio/components/audio/MonitorPanel";


import {
  startCapture,
  stopCapture,
  createPreviewUrl,
  revokePreviewUrl,
  playCountdownBeep,
  type RecordingStatus,
  type RecordingResult,
} from "@studio/lib/audio/recordingEngine";
import { encodeWav, wavToBlob, getDurationSeconds } from "@studio/lib/audio/wavEncoder";
import { analyzeTakeQuality, type QualityMetrics } from "@studio/lib/audio/qualityAnalysis";

function DailyMeetPanel({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [dailyUrl, setDailyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isOpen) return () => { cancelled = true; };

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await authFetch("/api/create-room", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        if (!cancelled && res?.url) {
          setDailyUrl(res.url);
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Erro ao criar sala");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId, isOpen]);

  const panelHeight = isCompact ? "200px" : "min(420px, calc(100vh - 180px))";

  return (
    <div className="fixed bottom-5 right-5 z-[80] flex flex-col items-end gap-3" data-testid="panel-daily">
      {isOpen && (
        <div
          className="rounded-2xl overflow-hidden glass-panel shadow-2xl"
          style={{ width: "min(380px, calc(100vw - 32px))" }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/20">
            <span className="text-[11px] font-medium flex items-center gap-1.5 text-muted-foreground">
              <Mic className="w-3 h-3 text-emerald-500" /> Chat de Voz
            </span>
            <div className="flex items-center gap-2">
              {!isCompact && (
                <button
                  onClick={() => setIsCompact(true)}
                  className="text-[11px] transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  data-testid="button-compact-daily"
                >
                  <Minimize2 className="w-3 h-3" /> Reduzir
                </button>
              )}
              {isCompact && (
                <button
                  onClick={() => setIsCompact(false)}
                  className="text-[11px] transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
                  data-testid="button-expand-daily"
                >
                  <Maximize2 className="w-3 h-3" /> Expandir
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-[11px] transition-colors flex items-center gap-1 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-daily"
              >
                <X className="w-3 h-3" /> Fechar
              </button>
            </div>
          </div>
          <div style={{ height: panelHeight, overflow: "hidden" }}>
            {loading && (
              <div className="flex items-center justify-center text-muted-foreground" style={{ height: panelHeight }}>
                <span className="text-xs">Criando sala de voz...</span>
              </div>
            )}
            {error && (
              <div className="flex items-center justify-center text-destructive" style={{ height: panelHeight }}>
                <span className="text-xs">{error}</span>
              </div>
            )}
            {dailyUrl && !loading && (
              <iframe
                src={dailyUrl}
                allow="camera; microphone; autoplay; display-capture"
                className="w-full"
                style={{ height: panelHeight, border: "none" }}
                data-testid="iframe-daily-meet"
                title="Daily.co Voice Chat"
              />
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="h-14 w-14 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-[0.98]"
        style={{
          background: isOpen ? "rgba(255,255,255,0.10)" : "hsl(var(--primary))",
          color: isOpen ? "rgba(255,255,255,0.80)" : "hsl(var(--primary-foreground))",
          border: "1px solid rgba(255,255,255,0.12)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        aria-label={isOpen ? "Fechar chat de voz" : "Abrir chat de voz"}
        data-testid="button-floating-voice-chat"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>
    </div>
  );
}

interface ScriptLine {
  character: string;
  start: number;
  text: string;
  end?: number;
}

interface RecordingProfile {
  voiceActorName: string;
  characterName: string;
  characterId: string;
  voiceActorId: string;
  userId: string;
  sessionId: string;
  productionId: string;
}

interface Shortcuts {
  playPause: string;
  record: string;
  stop: string;
  loop: string;
  back: string;
  forward: string;
}

const DEFAULT_SHORTCUTS: Shortcuts = {
  playPause: "Space",
  record: "KeyR",
  stop: "KeyS",
  loop: "KeyL",
  back: "ArrowLeft",
  forward: "ArrowRight",
};

const SHORTCUT_LABELS: Record<keyof Shortcuts, string> = {
  playPause: "Reproduzir / Pausar",
  record: "Gravar",
  stop: "Parar",
  loop: "Alternar Loop",
  back: "Voltar 2s",
  forward: "Avancar 2s",
};

function keyLabel(code: string): string {
  const map: Record<string, string> = {
    Space: "Space",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    Escape: "Esc",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

function CountdownOverlay({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center animate-in fade-in duration-200" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ border: "4px solid rgba(239,68,68,0.4)", boxShadow: "0 0 40px rgba(239,68,68,0.3), inset 0 0 20px rgba(239,68,68,0.1)" }}>
          <span className="text-6xl font-light font-mono tabular-nums" style={{ color: "hsl(0 72% 65%)", textShadow: "0 0 20px rgba(239,68,68,0.5)" }}>{count}</span>
        </div>
        <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.45)" }}>Gravando em...</span>
      </div>
    </div>
  );
}

function useSessionData(studioId: string, sessionId: string) {
  return useQuery({
    queryKey: ["/api/studios", studioId, "sessions", sessionId],
    queryFn: () => authFetch(`/api/studios/${studioId}/sessions/${sessionId}`),
    enabled: !!studioId && !!sessionId,
  });
}

function useProductionScript(studioId: string, productionId?: string) {
  return useQuery({
    queryKey: ["/api/studios", studioId, "productions", productionId],
    queryFn: () =>
      authFetch(`/api/studios/${studioId}/productions/${productionId}`),
    enabled: !!studioId && !!productionId,
  });
}

function useCharactersList(productionId?: string) {
  return useQuery({
    queryKey: ["/api/productions", productionId, "characters"],
    queryFn: () =>
      authFetch(`/api/productions/${productionId}/characters`) as Promise<
        Array<{ id: string; name: string; voiceActorId: string | null }>
      >,
    enabled: !!productionId,
  });
}

interface DeviceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  inputGain: number;
  monitorVolume: number;
  voiceCaptureMode: VoiceCaptureMode;
  force48k?: boolean;
  disableSystemProcessing?: boolean;
}

function DeviceSettingsPanel({
  open,
  onClose,
  settings,
  onSettingsChange,
  micState,
}: {
  open: boolean;
  onClose: () => void;
  settings: DeviceSettings;
  onSettingsChange: (s: DeviceSettings) => void;
  micState: MicrophoneState | null;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;

    const refreshDevices = () => {
      navigator.mediaDevices.enumerateDevices().then((devs) => {
        setDevices(devs);
        const hasLabels = devs.some((d) => d.label.length > 0);
        setPermissionGranted(hasLabels);
      });
    };

    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [open]);

  useEffect(() => {
    if (!open || !micState || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      const data = getAnalyserData(micState);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      const norm = Math.min(1, (avg / 128) * 1.5); 

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width * norm;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, "#10b981");
      gradient.addColorStop(0.6, "#f59e0b");
      gradient.addColorStop(1, "#ef4444");
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, canvas.height);

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [open, micState]);

  const requestPerms = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devs = await navigator.mediaDevices.enumerateDevices();
      setDevices(devs);
      setPermissionGranted(true);
    } catch (e) {
      console.error(e);
    }
  };

  const playTestSound = () => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      
      // @ts-ignore
      if (typeof ctx.setSinkId === 'function' && settings.outputDeviceId) {
          // @ts-ignore
          ctx.setSinkId(settings.outputDeviceId).catch(console.error);
      }
    } catch (e) {
      console.error("Audio test failed", e);
    }
  };

  if (!open) return null;

  const mics = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[480px] overflow-hidden glass-panel shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <span className="text-sm font-semibold text-foreground">Configuracoes de Dispositivo</span>
          <button
            onClick={onClose}
            className="transition-colors text-muted-foreground hover:text-foreground"
            data-testid="button-close-device-settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {!permissionGranted && (
          <div className="px-6 py-4 bg-yellow-500/10 border-b border-yellow-500/20">
            <p className="text-xs text-yellow-600 dark:text-yellow-200 mb-2">Permissao de microfone necessaria para listar dispositivos.</p>
            <button onClick={requestPerms} className="vhub-btn-xs vhub-btn-secondary">Conceder Permissao</button>
          </div>
        )}

        <div className="px-6 py-5 flex flex-col gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="vhub-label block">Microfone</label>
              {settings.inputDeviceId && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Ativo
                </span>
              )}
            </div>
            <select
              className="w-full h-9 rounded-lg px-3 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none"
              value={settings.inputDeviceId}
              onChange={(e) => onSettingsChange({ ...settings, inputDeviceId: e.target.value })}
              data-testid="select-microphone"
            >
              {mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microfone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            
            <div className="h-2 rounded-full overflow-hidden bg-muted border border-border relative">
              <canvas ref={canvasRef} width={430} height={8} className="w-full h-full block" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="vhub-label block">Alto-falante (Monitor)</label>
            <div className="flex gap-2">
              <select
                className="flex-1 h-9 rounded-lg px-3 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none"
                value={settings.outputDeviceId}
                onChange={(e) => onSettingsChange({ ...settings, outputDeviceId: e.target.value })}
                data-testid="select-speaker"
              >
                {speakers.length === 0 ? (
                  <option value="">Padrao do sistema</option>
                ) : (
                  speakers.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Alto-falante ${d.deviceId.slice(0, 8)}`}
                    </option>
                  ))
                )}
              </select>
              <button 
                onClick={playTestSound}
                className="h-9 px-3 rounded-lg bg-muted hover:bg-muted/80 border border-border transition-colors"
                title="Testar som"
              >
                <Volume2 className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="vhub-label">Ganho (Input)</label>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.inputGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={settings.inputGain}
                onChange={(e) =>
                  onSettingsChange({ ...settings, inputGain: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 accent-primary bg-muted rounded-full appearance-none cursor-pointer"
                data-testid="slider-input-gain"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="vhub-label">Volume (Output)</label>
                <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.monitorVolume * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.monitorVolume}
                onChange={(e) =>
                  onSettingsChange({ ...settings, monitorVolume: parseFloat(e.target.value) })
                }
                className="w-full h-1.5 accent-primary bg-muted rounded-full appearance-none cursor-pointer"
                data-testid="slider-monitor-volume"
              />
            </div>
          </div>

          <div>
            <label className="vhub-label mb-2 block">Modo de Captura</label>
            <select
              value={settings.voiceCaptureMode}
              onChange={(e) => onSettingsChange({ ...settings, voiceCaptureMode: e.target.value as VoiceCaptureMode })}
              className="w-full h-9 rounded-lg px-3 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none"
              data-testid="select-voice-capture-mode"
            >
              <option value="studio">Studio Mode (Processado)</option>
              <option value="original">Microfone Original</option>
              <option value="high-fidelity">High-End (Lossless 24-bit)</option>
            </select>
            <p className="text-[10px] mt-2 leading-relaxed text-muted-foreground">
              {settings.voiceCaptureMode === "studio"
                ? "Filtro passa-alta 80Hz + compressor + reducao de ruido. Ideal para ambientes ruidosos."
                : settings.voiceCaptureMode === "high-fidelity"
                ? "Captura RAW 24-bit via AudioWorklet. Desativa todo processamento do sistema. Requer interface de audio."
                : "Captura padrao do navegador sem efeitos adicionais."}
            </p>
          </div>

          {settings.voiceCaptureMode === "high-fidelity" && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex gap-3 items-start">
              <div className="mt-0.5 w-2 h-2 shrink-0 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
              <div>
                <p className="text-xs font-medium text-destructive">Controle Exclusivo de Hardware</p>
                <p className="text-[10px] text-destructive/70 leading-tight mt-0.5">
                  O sistema assumiu o controle do driver de audio para garantir 48kHz/24-bit com latencia zero.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="vhub-btn-sm vhub-btn-primary w-full sm:w-auto"
              data-testid="button-apply-device-settings"
            >
              Concluido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecordingProfilePanel({
  characters,
  user,
  sessionId,
  productionId,
  onSave,
  onClose,
  existingProfile,
}: {
  characters: Array<{ id: string; name: string; voiceActorId: string | null }>;
  user: any;
  sessionId: string;
  productionId: string;
  onSave: (profile: RecordingProfile) => void;
  onClose?: () => void;
  existingProfile?: RecordingProfile | null;
}) {
  const [actorName, setActorName] = useState(
    existingProfile?.voiceActorName || user?.displayName || user?.fullName || ""
  );
  const [selectedCharId, setSelectedCharId] = useState(
    existingProfile?.characterId || (characters.length > 0 ? characters[0].id : "")
  );
  const [freeCharName, setFreeCharName] = useState(existingProfile?.characterName || "");

  const { toast } = useToast();
  const selectedChar = characters.find((c) => c.id === selectedCharId);
  const hasCharacters = characters.length > 0;
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    if (!actorName.trim()) return;
    if (hasCharacters && selectedChar) {
      onSave({
        voiceActorName: actorName.trim(),
        characterName: selectedChar.name,
        characterId: selectedChar.id,
        voiceActorId: selectedChar.voiceActorId || user?.id || "",
        userId: user?.id || "",
        sessionId,
        productionId,
      });
    } else if (freeCharName.trim()) {
      setIsCreating(true);
      try {
        const created = await authFetch(`/api/productions/${productionId}/characters`, {
          method: "POST",
          body: JSON.stringify({ name: freeCharName.trim(), productionId }),
        });
        onSave({
          voiceActorName: actorName.trim(),
          characterName: freeCharName.trim(),
          characterId: created.id,
          voiceActorId: user?.id || "",
          userId: user?.id || "",
          sessionId,
          productionId,
        });
      } catch (err: any) {
        toast({ title: "Erro ao criar personagem", description: err?.message || "Tente novamente", variant: "destructive" });
      } finally {
        setIsCreating(false);
      }
    }
  };

  const canSubmit = !isCreating && actorName.trim() && (hasCharacters ? !!selectedCharId : freeCharName.trim());

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[440px] overflow-hidden glass-panel shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Perfil de Gravacao</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="transition-colors text-muted-foreground hover:text-foreground" data-testid="button-close-profile">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Configure seu perfil antes de gravar. Estes dados serao usados automaticamente em todos os takes.
          </p>

          <div>
            <label className="vhub-label mb-1.5 block">
              Nome do Dublador
            </label>
            <input
              type="text"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Seu nome artistico"
              className="w-full h-9 rounded-lg px-3 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none"
              data-testid="input-actor-name"
            />
          </div>

          <div>
            <label className="vhub-label mb-1.5 block">
              Personagem
            </label>
            {hasCharacters ? (
              <select
                value={selectedCharId}
                onChange={(e) => setSelectedCharId(e.target.value)}
                className="w-full h-9 rounded-lg px-3 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none"
                data-testid="select-character"
              >
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={freeCharName}
                onChange={(e) => setFreeCharName(e.target.value)}
                placeholder="Nome do personagem"
                className="w-full h-9 rounded-lg px-3 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none"
                data-testid="input-character-name"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="vhub-label mb-1 block">ID Usuario</label>
              <div className="h-8 rounded-lg px-3 flex items-center text-xs font-mono truncate bg-muted/30 text-muted-foreground" data-testid="text-user-id">
                {user?.id?.slice(0, 12)}...
              </div>
            </div>
            <div>
              <label className="vhub-label mb-1 block">Sessao</label>
              <div className="h-8 rounded-lg px-3 flex items-center text-xs font-mono truncate bg-muted/30 text-muted-foreground" data-testid="text-session-id">
                {sessionId?.slice(0, 12)}...
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 flex justify-end border-t border-border/50">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="vhub-btn-sm vhub-btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-save-profile"
          >
            {isCreating ? "Criando personagem..." : "Iniciar Gravacao"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecordingRoom() {
  const { studioId, sessionId } = useParams<{ studioId: string; sessionId: string }>();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [currentLine, setCurrentLine] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [loopSelectionMode, setLoopSelectionMode] = useState<"idle" | "selecting-start" | "selecting-end">("idle");
  const [customLoop, setCustomLoop] = useState<{ start: number; end: number } | null>(null);
  const [preRoll, setPreRoll] = useState(1);
  const [postRoll, setPostRoll] = useState(1);

  const [shortcuts, setShortcuts] = useState<Shortcuts>(() => {
    try {
      const saved = localStorage.getItem("vhub_shortcuts");
      return saved ? JSON.parse(saved) : DEFAULT_SHORTCUTS;
    } catch {
      return DEFAULT_SHORTCUTS;
    }
  });
  const [pendingShortcuts, setPendingShortcuts] = useState<Shortcuts>(shortcuts);
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [listeningFor, setListeningFor] = useState<keyof Shortcuts | null>(null);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [deviceSettings, setDeviceSettings] = useState<DeviceSettings>(() => {
    const defaults: DeviceSettings = { inputDeviceId: "", outputDeviceId: "", inputGain: 1, monitorVolume: 0.8, voiceCaptureMode: "original" };
    try {
      const saved = localStorage.getItem("vhub_device_settings");
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    } catch {
      return defaults;
    }
  });

  const [recordingProfile, setRecordingProfile] = useState<RecordingProfile | null>(() => {
    if (!sessionId) return null;
    try {
      const saved = localStorage.getItem(`vhub_rec_profile_${sessionId}`);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!parsed.characterId || !isValidUuid.test(parsed.characterId)) {
        localStorage.removeItem(`vhub_rec_profile_${sessionId}`);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
  const [showProfilePanel, setShowProfilePanel] = useState(false);

  const { data: session, isLoading: sessionLoading, isError: sessionError } = useSessionData(studioId, sessionId);
  const { data: production, isLoading: productionLoading } = useProductionScript(studioId, session?.productionId);
  const { data: charactersList } = useCharactersList(session?.productionId);

  const scriptLines: ScriptLine[] = (() => {
    if (!production?.scriptJson) return [];
    try {
      const parsed = JSON.parse(production.scriptJson);
      let rawLines: Array<any>;
      if (Array.isArray(parsed)) {
        rawLines = parsed;
      } else if (parsed.lines && Array.isArray(parsed.lines)) {
        rawLines = parsed.lines;
      } else {
        return [];
      }

      const normalized = rawLines.map((line: any) => ({
        character: line.character || line.personagem || line.char || "",
        start: line.start || line.tempo || line.timecode || line.tc || "00:00:00",
        text: line.text || line.fala || line.dialogue || line.dialog || "",
      }));

      const sorted = [...normalized]
        .map((line) => ({ ...line, start: parseTimecode(line.start) }))
        .sort((a, b) => a.start - b.start);
      return sorted.map((line, i) => ({
        ...line,
        end: Math.max(sorted[i + 1]?.start ?? (line.start + 10), line.start + 0.001),
      }));
    } catch (e) {
      console.error("[Room] Failed to parse scriptJson:", e);
      return [];
    }
  })();

  const { data: takesList = [], refetch: refetchTakes } = useQuery({
    queryKey: ["/api/sessions", sessionId, "takes"],
    queryFn: () => authFetch(`/api/sessions/${sessionId}/takes`),
    enabled: !!sessionId,
  });

  const deleteTakeMutation = useMutation({
    mutationFn: (takeId: string) =>
      authFetch(`/api/takes/${takeId}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchTakes();
      toast({ title: "Take excluido" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir take", description: err?.message || "Permissao negada", variant: "destructive" });
    },
  });

  const updateScriptLineMutation = useMutation({
    mutationFn: async ({ lineIndex, text }: { lineIndex: number; text: string }) => {
      if (!production?.id || !production?.scriptJson) throw new Error("Roteiro nao carregado");
      const target = scriptLines[lineIndex];
      if (!target) throw new Error("Linha invalida");

      const parsed = JSON.parse(production.scriptJson);
      const rawLines: Array<any> = Array.isArray(parsed) ? parsed : (parsed?.lines && Array.isArray(parsed.lines) ? parsed.lines : []);
      if (!rawLines.length) throw new Error("Formato de roteiro invalido");

      const idx = rawLines.findIndex((l: any) => {
        const st = parseTimecode(l.start || l.tempo || l.timecode || l.tc || "00:00:00");
        const ch = String(l.character || l.personagem || l.char || "");
        return st === target.start && ch.toLowerCase() === String(target.character || "").toLowerCase();
      });
      const targetIdx = idx >= 0 ? idx : lineIndex;
      if (!rawLines[targetIdx]) throw new Error("Linha nao encontrada no roteiro");

      const updatedLine = { ...rawLines[targetIdx] };
      if ("text" in updatedLine) {
        updatedLine.text = text;
      } else if ("fala" in updatedLine) {
        updatedLine.fala = text;
      } else {
        updatedLine.text = text;
      }

      const nextLines = [...rawLines];
      nextLines[targetIdx] = updatedLine;

      const nextScriptJson = Array.isArray(parsed)
        ? JSON.stringify(nextLines)
        : JSON.stringify({ ...parsed, lines: nextLines });

      return authFetch(`/api/studios/${studioId}/productions/${production.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scriptJson: nextScriptJson }),
      });
    },
    onSuccess: (_data, variables) => {
      setLineEdits((prev) => ({ ...prev, [variables.lineIndex]: variables.text }));
      setEditingLineIndex(null);
      setEditingLineText("");
      queryClient.invalidateQueries({ queryKey: ["/api/studios", studioId, "productions", production?.id] });
      toast({ title: "Linha atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar edicao", description: err?.message || "Falha", variant: "destructive" });
    },
  });

  const handleDownloadTake = useCallback(async (take: any) => {
    try {
      const res = await fetch(`/api/takes/${take.id}/download`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao baixar take");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = take.filename || `take_${take.id}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast({ title: "Falha ao baixar take", variant: "destructive" });
    }
  }, [toast]);

  const [savedTakes, setSavedTakes] = useState<Set<number>>(new Set());
  const [takeCount, setTakeCount] = useState(0);
  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [countdownValue, setCountdownValue] = useState(0);
  const [lastRecording, setLastRecording] = useState<RecordingResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [micState, setMicState] = useState<MicrophoneState | null>(null);
  const [micReady, setMicReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recordingStartTimecodeRef = useRef(0);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scriptViewportRef = useRef<HTMLDivElement | null>(null);
  const [scriptAutoFollow, setScriptAutoFollow] = useState(true);
  const scriptAutoFollowRef = useRef(true);
  const scriptProgrammaticScrollRef = useRef(false);
  const scriptUserScrollIntentRef = useRef(false);
  const scriptUserScrollIntentTimerRef = useRef<number | null>(null);
  const telepromptRafRef = useRef<number | null>(null);
  const telepromptLastTsRef = useRef<number | null>(null);
  const telepromptScriptRef = useRef<ScriptLine[]>([]);
  const telepromptVideoTimeRef = useRef(0);
  const telepromptCurrentLineRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isRemoteAction = useRef(false);
  const wsReconnectTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const doc = document as any;
    const exit = () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === "function") {
        try {
          doc.webkitExitFullscreen();
        } catch {}
      }
    };

    const onChange = () => {
      if (document.fullscreenElement || doc.webkitFullscreenElement) {
        exit();
      }
    };

    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
    };
  }, []);

  const [globalControlEnabled, setGlobalControlEnabled] = useState(false);
  const [controlPermissions, setControlPermissions] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`vhub_control_perm_${sessionId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const [controlMenuOpen, setControlMenuOpen] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<Array<{ userId: string; name: string; role?: string }>>([]);
  const [textControllerUserId, setTextControllerUserId] = useState<string | null>(null);
  const [takesPopupOpen, setTakesPopupOpen] = useState(false);
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingLineText, setEditingLineText] = useState("");
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({});
  const [takePreviewId, setTakePreviewId] = useState<string | null>(null);
  const takePreviewAudioRef = useRef<HTMLAudioElement | null>(null);

  const myStudioRole = useMemo(() => {
    const role = session?.participants?.find((p: any) => p.userId === user?.id)?.role;
    return String(role || "").toLowerCase();
  }, [session, user]);

  const isPrivileged = useMemo(() => {
    if (user?.role === "platform_owner") return true;
    const privilegedRoles = new Set([
      "studio_admin",
      "diretor",
      "engenheiro_audio",
      "owner",
      "director",
      "audio_engineer",
      "engineer",
      "admin",
    ]);
    return privilegedRoles.has(myStudioRole);
  }, [user?.role, myStudioRole]);

  const canControl = useMemo(() => {
    return isPrivileged || globalControlEnabled || controlPermissions.has(user?.id || "");
  }, [isPrivileged, globalControlEnabled, controlPermissions, user]);

  const canTextControl = useMemo(() => {
    if (isPrivileged) return true;
    return Boolean(textControllerUserId && user?.id && textControllerUserId === user.id);
  }, [isPrivileged, textControllerUserId, user?.id]);

  const emitTextControlEvent = useCallback(
    (type: string, payload: any) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type, ...payload }));
    },
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const state = await requestMicrophone(deviceSettings.voiceCaptureMode, deviceSettings.inputDeviceId);
        setGain(state, deviceSettings.inputGain);
        setMicState(state);
        setMicReady(true);
      } catch {
        toast({
          title: "Acesso ao microfone negado",
          description: "Permita o acesso ao microfone para gravar takes.",
          variant: "destructive",
        });
      }
    })();
    return () => {
      releaseMicrophone();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (micState) {
      setGain(micState, deviceSettings.inputGain);
    }
  }, [micState, deviceSettings.inputGain]);

  useEffect(() => {
    if (!sessionId || !user?.id) return;

    let destroyed = false;

    const connect = () => {
      if (destroyed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const role = encodeURIComponent(myStudioRole || String(user?.role || ""));
      const name = encodeURIComponent(String((user as any)?.fullName || (user as any)?.displayName || (user as any)?.email || "Usuario"));
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/video-sync?sessionId=${sessionId}&userId=${encodeURIComponent(user.id)}&role=${role}&name=${name}`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; currentTime?: number; lineIndex?: number; targetUserId?: string; permissions?: string[]; loopRange?: { start: number; end: number } | null; globalControl?: boolean; users?: Array<{ userId: string; name: string; role?: string }> };

          // Permission updates
          if (msg.type === "permission-sync" && Array.isArray(msg.permissions)) {
            isRemoteAction.current = true;
            setControlPermissions(new Set(msg.permissions));
            if (typeof msg.globalControl === "boolean") setGlobalControlEnabled(msg.globalControl);
            isRemoteAction.current = false;
            return;
          }
          if (msg.type === "presence-sync" && Array.isArray(msg.users)) {
            setPresenceUsers(msg.users);
            return;
          }
          if (msg.type === "text-control:state") {
            setTextControllerUserId((msg as any).controllerUserId ?? null);
            return;
          }
          if (msg.type === "text-control:update-line") {
            const idx = (msg as any).lineIndex;
            const text = (msg as any).text;
            if (typeof idx === "number" && typeof text === "string") {
              setLineEdits((prev) => ({ ...prev, [idx]: text }));
              if (editingLineIndex === idx) {
                setEditingLineIndex(null);
                setEditingLineText("");
              }
            }
            return;
          }
          if (msg.type === "permission-granted" || msg.type === "grant-permission") {
            if (msg.targetUserId) {
              setControlPermissions((prev) => {
                const next = new Set(prev);
                next.add(msg.targetUserId!);
                return next;
              });
            }
          } else if (msg.type === "permission-revoked" || msg.type === "revoke-permission") {
            if (msg.targetUserId) {
              setControlPermissions((prev) => {
                const next = new Set(prev);
                next.delete(msg.targetUserId!);
                return next;
              });
            }
          }

          if (msg.type === "sync-loop") {
            setCustomLoop(msg.loopRange ?? null);
            setIsLooping(!!msg.loopRange);
            return;
          }

          if (msg.type === "toggle-global-control") {
            setGlobalControlEnabled(!!msg.globalControl);
            if (msg.globalControl) {
              toast({ title: "Controle Livre", description: "Todos os participantes podem agora controlar o player e o roteiro." });
            } else {
              toast({ title: "Controle Restrito", description: "O controle global foi desativado." });
            }
            return;
          }

          if (msg.type === "revoke-all") {
            setControlPermissions(new Set());
            setGlobalControlEnabled(false);
            toast({ title: "Permissoes Revogadas", description: "Todas as permissoes temporarias foram removidas." });
            return;
          }

          const video = videoRef.current;
          if (!video) return;

          isRemoteAction.current = true;

          if (msg.type === "video-seek" || msg.type === "video-play" || msg.type === "video-pause") {
            if (typeof msg.currentTime === "number") video.currentTime = msg.currentTime;
          }

          if (msg.type === "video-play") {
            video.play().catch(() => {});
            setIsPlaying(true);
          } else if (msg.type === "video-pause") {
            video.pause();
            setIsPlaying(false);
          }

          if (msg.type === "video-seek" && msg.lineIndex !== undefined) {
            setCurrentLine(msg.lineIndex);
          }

          isRemoteAction.current = false;
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        if (!destroyed) {
          wsReconnectTimer.current = setTimeout(connect, 3000);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      destroyed = true;
      if (wsReconnectTimer.current) clearTimeout(wsReconnectTimer.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [sessionId, user?.id, user?.role, myStudioRole, toast]);

  useEffect(() => {
    localStorage.setItem("vhub_device_settings", JSON.stringify(deviceSettings));
  }, [deviceSettings]);

  useEffect(() => {
    try {
      localStorage.setItem(`vhub_control_perm_${sessionId}`, JSON.stringify(Array.from(controlPermissions)));
    } catch {
      // ignore storage errors
    }
  }, [controlPermissions, sessionId]);

  const prevSettingsRef = useRef({ mode: deviceSettings.voiceCaptureMode, deviceId: deviceSettings.inputDeviceId });

  useEffect(() => {
    const { voiceCaptureMode, inputDeviceId } = deviceSettings;
    const prev = prevSettingsRef.current;

    if (voiceCaptureMode === prev.mode && inputDeviceId === prev.deviceId) return;

    prevSettingsRef.current = { mode: voiceCaptureMode, deviceId: inputDeviceId };

    if (recordingStatus === "recording") return;

    (async () => {
      try {
        const state = await requestMicrophone(voiceCaptureMode, inputDeviceId);
        setGain(state, deviceSettings.inputGain);
        setMicState(state);
        setMicReady(true);
        
        if (voiceCaptureMode !== prev.mode) {
          toast({
            title: "Modo de captura alterado",
            description: voiceCaptureMode === "studio"
              ? "Studio Mode — filtros de voz ativados"
              : voiceCaptureMode === "high-fidelity" 
              ? "High-End Audio — Controle exclusivo" 
              : "Original Microphone — captura crua",
          });
        } else {
           toast({ title: "Dispositivo de entrada alterado" });
        }
      } catch (e) {
        console.error("Mic switch error", e);
        toast({
          title: "Erro ao acessar dispositivo",
          description: "Verifique se o microfone esta conectado e permitido.",
          variant: "destructive",
        });
        setMicReady(false);
      }
    })();
  }, [deviceSettings.voiceCaptureMode, deviceSettings.inputDeviceId, recordingStatus, deviceSettings.inputGain, toast]);

  

  const handleSaveProfile = useCallback((profile: RecordingProfile) => {
    setRecordingProfile(profile);
    localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(profile));
    setShowProfilePanel(false);
    toast({ title: "Perfil de gravacao definido", description: `${profile.voiceActorName} como ${profile.characterName}` });
  }, [sessionId, toast]);

  const handleChangeCharacter = useCallback((charId: string) => {
    if (!recordingProfile || !charactersList) return;
    const char = charactersList.find((c) => c.id === charId);
    if (!char) return;
    const updated: RecordingProfile = {
      ...recordingProfile,
      characterName: char.name,
      characterId: char.id,
      voiceActorId: char.voiceActorId || recordingProfile.userId,
    };
    setRecordingProfile(updated);
    localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(updated));
    toast({ title: "Personagem alterado", description: `Gravando como ${char.name}` });
  }, [recordingProfile, charactersList, sessionId, toast]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const t = video.currentTime;
      setVideoTime(t);

      const idx = scriptLines.findIndex(
        (line) => t >= line.start && t < (line.end ?? line.start + 1)
      );
      if (idx !== -1 && idx !== currentLine) {
        setCurrentLine(idx);
      }

      if (isLooping) {
        let loopStart = 0;
        let loopEnd = videoDuration;

        if (customLoop) {
          loopStart = customLoop.start;
          loopEnd = customLoop.end;
        } else if (idx !== -1) {
          const line = scriptLines[idx];
          loopStart = Math.max(0, line.start - preRoll);
          loopEnd = (line.end ?? line.start) + postRoll;
        }

        if (t >= loopEnd) {
          video.currentTime = loopStart;
        }
      }
    };

    const handleDurationChange = () => {
      if (!isNaN(video.duration)) setVideoDuration(video.duration);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
    };
  }, [scriptLines, currentLine, isLooping, preRoll, postRoll]);

  useEffect(() => {
    telepromptScriptRef.current = scriptLines;
  }, [scriptLines]);

  useEffect(() => {
    telepromptVideoTimeRef.current = videoTime;
  }, [videoTime]);

  useEffect(() => {
    telepromptCurrentLineRef.current = currentLine;
  }, [currentLine]);

  useEffect(() => {
    scriptAutoFollowRef.current = scriptAutoFollow;
  }, [scriptAutoFollow]);

  const markScriptUserScrollIntent = useCallback(() => {
    scriptUserScrollIntentRef.current = true;
    if (scriptUserScrollIntentTimerRef.current) {
      window.clearTimeout(scriptUserScrollIntentTimerRef.current);
    }
    scriptUserScrollIntentTimerRef.current = window.setTimeout(() => {
      scriptUserScrollIntentRef.current = false;
      scriptUserScrollIntentTimerRef.current = null;
    }, 160);
  }, []);

  const handleScriptViewportScroll = useCallback(() => {
    if (scriptProgrammaticScrollRef.current) return;
    if (!scriptUserScrollIntentRef.current) return;
    if (!scriptAutoFollowRef.current) return;
    setScriptAutoFollow(false);
  }, []);

  const scrollScriptToLine = useCallback((idx: number, behavior: ScrollBehavior) => {
    const viewport = scriptViewportRef.current;
    const el = lineRefs.current[idx] || null;
    if (!viewport || !el) return;
    const top = el.offsetTop - (viewport.clientHeight / 2) + (el.offsetHeight / 2);
    const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
    const target = Math.min(maxScroll, Math.max(0, top));
    scriptProgrammaticScrollRef.current = true;
    viewport.scrollTo({ top: target, behavior });
    queueMicrotask(() => {
      scriptProgrammaticScrollRef.current = false;
    });
  }, []);

  useEffect(() => {
    const viewport = scriptViewportRef.current;
    if (!viewport) return;

    if (!scriptAutoFollow) {
      if (telepromptRafRef.current) {
        cancelAnimationFrame(telepromptRafRef.current);
        telepromptRafRef.current = null;
      }
      telepromptLastTsRef.current = null;
      return;
    }

    if (telepromptRafRef.current) {
      cancelAnimationFrame(telepromptRafRef.current);
      telepromptRafRef.current = null;
    }

    telepromptLastTsRef.current = null;

    const ease = (t: number) => {
      const x = Math.max(0, Math.min(1, t));
      return x * x * x * (x * (x * 6 - 15) + 10);
    };

    const computeTarget = () => {
      const vp = scriptViewportRef.current;
      if (!vp) return null;

      const lines = telepromptScriptRef.current;
      if (!lines.length) return null;

      const t = telepromptVideoTimeRef.current;
      let idx = telepromptCurrentLineRef.current;

      let lo = 0;
      let hi = lines.length - 1;
      let ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if ((lines[mid]?.start ?? 0) <= t + 0.001) {
          ans = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      idx = Math.max(0, Math.min(lines.length - 1, ans));

      const nextIdx = Math.min(idx + 1, lines.length - 1);
      const el0 = lineRefs.current[idx] || lineRefs.current[telepromptCurrentLineRef.current] || null;
      if (!el0) return null;

      const el1 = lineRefs.current[nextIdx] || el0;
      const y0 = el0.offsetTop;
      const y1 = el1.offsetTop;
      const t0 = lines[idx]?.start ?? 0;
      const t1 = lines[nextIdx]?.start ?? (t0 + 0.5);
      const denom = Math.max(0.5, t1 - t0);
      const p = ease((t - t0) / denom);
      const y = y0 + (y1 - y0) * p;

      const focusY = (vp.clientHeight / 2) - (el0.offsetHeight / 2);
      const rawTarget = y - focusY;
      const maxScroll = Math.max(0, vp.scrollHeight - vp.clientHeight);
      return Math.min(maxScroll, Math.max(0, rawTarget));
    };

    const step = (ts: number) => {
      const vp = scriptViewportRef.current;
      if (!vp) return;

      const target = computeTarget();
      if (target === null) {
        telepromptRafRef.current = requestAnimationFrame(step);
        return;
      }

      const last = telepromptLastTsRef.current;
      const dt = last ? Math.max(0.001, Math.min(0.05, (ts - last) / 1000)) : 1 / 60;
      telepromptLastTsRef.current = ts;

      const tau = isPlaying ? 0.22 : 0.14;
      const alpha = 1 - Math.exp(-dt / tau);
      const current = vp.scrollTop;
      scriptProgrammaticScrollRef.current = true;
      vp.scrollTop = current + (target - current) * alpha;
      queueMicrotask(() => {
        scriptProgrammaticScrollRef.current = false;
      });

      telepromptRafRef.current = requestAnimationFrame(step);
    };

    telepromptRafRef.current = requestAnimationFrame(step);

    return () => {
      if (telepromptRafRef.current) {
        cancelAnimationFrame(telepromptRafRef.current);
        telepromptRafRef.current = null;
      }
      telepromptLastTsRef.current = null;
    };
  }, [isPlaying, scriptAutoFollow]);

  useEffect(() => {
    if (!listeningFor) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") {
        setListeningFor(null);
        return;
      }
      setPendingShortcuts((prev) => ({ ...prev, [listeningFor]: e.code }));
      setListeningFor(null);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [listeningFor]);

  const emitVideoEvent = useCallback((event: string, data: any) => {
    if (isRemoteAction.current) return;
    const ws = wsRef.current;
    if (ws && ws.readyState === 1) { // WebSocket.OPEN is 1
      ws.send(JSON.stringify({ type: event, ...data }));
    }
  }, []);

  const playVideo = useCallback(() => {
    if (!videoRef.current) return;
    setScriptAutoFollow(true);
    videoRef.current.play().catch(() => {});
    setIsPlaying(true);
    emitVideoEvent("video-play", { currentTime: videoRef.current.currentTime });
  }, [emitVideoEvent]);

  const pauseVideo = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
    emitVideoEvent("video-pause", { currentTime: videoRef.current.currentTime });
  }, [emitVideoEvent]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      pauseVideo();
    } else {
      playVideo();
    }
  }, [isPlaying, playVideo, pauseVideo]);

  const handleStopPlayback = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    const line = scriptLines[currentLine];
    const t = line?.start ?? 0;
    videoRef.current.currentTime = t;
    setIsPlaying(false);
    emitVideoEvent("video-seek", { currentTime: t, lineIndex: currentLine });
  }, [currentLine, scriptLines, emitVideoEvent]);

  const seek = useCallback((amount: number) => {
    if (!videoRef.current) return;
    const t = Math.max(0, videoRef.current.currentTime + amount);
    videoRef.current.currentTime = t;
    emitVideoEvent("video-seek", { currentTime: t });
  }, [emitVideoEvent]);

  const scrub = useCallback((fraction: number) => {
    if (!videoRef.current || !videoDuration || !canControl) return;
    const t = fraction * videoDuration;
    videoRef.current.currentTime = t;
    emitVideoEvent("video-seek", { currentTime: t });
  }, [videoDuration, emitVideoEvent, canControl]);

  const handleLineClick = useCallback((idx: number) => {
    if (!canTextControl) return;
    const line = scriptLines[idx];
    if (!line) return;
    setScriptAutoFollow(true);
    queueMicrotask(() => scrollScriptToLine(idx, "smooth"));

    if (loopSelectionMode === "selecting-start") {
      setCustomLoop({ start: line.start, end: line.end || line.start + 1 });
      setLoopSelectionMode("selecting-end");
      toast({ title: "Inicio do loop definido", description: "Clique agora na fala final do loop." });
    } else if (loopSelectionMode === "selecting-end") {
      if (customLoop) {
        const newLoop = { ...customLoop, end: line.end || line.start + 1 };
        setCustomLoop(newLoop);
        setLoopSelectionMode("idle");
        setIsLooping(true);
        if (videoRef.current) videoRef.current.currentTime = newLoop.start;
        emitVideoEvent("sync-loop", { loopRange: newLoop });
        toast({ title: "Loop definido", description: "O trecho selecionado sera repetido." });
      }
    } else {
      setCurrentLine(idx);
      if (videoRef.current) {
        videoRef.current.currentTime = line.start;
        emitVideoEvent("video-seek", { currentTime: line.start, lineIndex: idx });
      }
    }
  }, [canTextControl, scriptLines, loopSelectionMode, customLoop, toast, scrollScriptToLine, emitVideoEvent]);

  const cleanupPreview = useCallback(() => {
    if (previewUrl) {
      revokePreviewUrl(previewUrl);
      setPreviewUrl(null);
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    setLastRecording(null);
    setQualityMetrics(null);
    setRecordingStatus("idle");
  }, [previewUrl]);

  const startCountdown = useCallback(async () => {
    if (!recordingProfile) {
      setShowProfilePanel(true);
      toast({
        title: "Perfil de gravacao necessario",
        description: "Defina seu perfil antes de gravar.",
        variant: "destructive",
      });
      return;
    }
    if (!micState || !micReady) {
      toast({
        title: "Microfone nao esta pronto",
        description: "Permita o acesso ao microfone.",
        variant: "destructive",
      });
      return;
    }
    if (recordingStatus === "recording") {
      stopCapture(micState);
      pauseVideo();
      setRecordingStatus("idle");
      return;
    }
    if (recordingStatus === "recorded" || recordingStatus === "previewing") {
      cleanupPreview();
    }

    if (micState.audioContext.state === "suspended") {
      await micState.audioContext.resume();
      console.log("[Room] AudioContext resumed on user gesture");
    }

    setRecordingStatus("countdown");
    let remaining = 3;
    setCountdownValue(remaining);
    playCountdownBeep(micState.audioContext, 660, 0.12);

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdownValue(remaining);
        playCountdownBeep(micState.audioContext, 660, 0.12);
      } else {
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        playCountdownBeep(micState.audioContext, 1320, 0.2);
        setCountdownValue(0);
        recordingStartTimecodeRef.current = videoRef.current?.currentTime ?? 0;
        setRecordingStatus("recording");
        startCapture(micState);
        playVideo();
        console.log("[Room] Recording started — video playing, timecode:", recordingStartTimecodeRef.current);
      }
    }, 1000);
  }, [micState, micReady, recordingStatus, recordingProfile, cleanupPreview, toast, playVideo, pauseVideo]);

  const handleStopRecording = useCallback(() => {
    if (!micState || recordingStatus !== "recording") return;
    const result = stopCapture(micState);
    pauseVideo();
    console.log("[Room] Recording stopped — video paused:", {
      samples: result.samples.length,
      duration: result.durationSeconds,
    });

    if (result.samples.length === 0 || result.durationSeconds < 0.1) {
      toast({
        title: "Gravacao muito curta",
        description: "A gravacao esta vazia ou muito curta. Verifique se o microfone esta funcionando.",
        variant: "destructive",
      });
      setRecordingStatus("idle");
      return;
    }

    setLastRecording(result);
    const metrics = analyzeTakeQuality(result.samples);
    setQualityMetrics(metrics);
    const wavBuffer = encodeWav(result.samples);
    const blob = wavToBlob(wavBuffer);
    const url = createPreviewUrl(blob);
    setPreviewUrl(url);
    setRecordingStatus("recorded");
    toast({
      title: "Gravacao concluida",
      description: `${result.durationSeconds.toFixed(1)}s capturados. Clique no botao verde para salvar.`,
    });
  }, [micState, recordingStatus, toast, pauseVideo]);

  const handlePreview = useCallback(() => {
    if (!previewUrl) return;
    if (recordingStatus === "previewing" && previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setRecordingStatus("recorded");
      return;
    }
    const audio = new Audio(previewUrl);
    audio.onended = () => setRecordingStatus("recorded");
    audio.play().catch(() => {});
    previewAudioRef.current = audio;
    setRecordingStatus("previewing");
  }, [previewUrl, recordingStatus]);

  const handleSaveTake = useCallback(async () => {
    if (isSaving) return;

    if (!recordingProfile) {
      setShowProfilePanel(true);
      toast({
        title: "Perfil de gravacao necessario",
        description: "Defina seu perfil antes de salvar takes.",
        variant: "destructive",
      });
      return;
    }

    if (!lastRecording || !previewUrl) {
      toast({
        title: "Nenhuma gravacao disponivel",
        description: "Grave um take primeiro antes de salvar.",
        variant: "destructive",
      });
      return;
    }
    if (lastRecording.samples.length === 0) {
      toast({
        title: "Gravacao vazia",
        description: "A gravacao nao capturou audio. Verifique seu microfone.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let activeProfile = recordingProfile;
      const charExistsInProduction = charactersList?.some((c: any) => c.id === activeProfile.characterId);
      const needsCharCreation = !isValidUuid.test(activeProfile.characterId) || !charExistsInProduction;

      if (needsCharCreation) {
        if (!session?.productionId || !activeProfile.characterName?.trim()) {
          setShowProfilePanel(true);
          toast({ title: "Perfil invalido", description: "Reconfigure seu personagem antes de salvar.", variant: "destructive" });
          setIsSaving(false);
          return;
        }
        try {
          const created = await authFetch(`/api/productions/${session.productionId}/characters`, {
            method: "POST",
            body: JSON.stringify({ name: activeProfile.characterName.trim(), productionId: session.productionId }),
          });
          activeProfile = { ...activeProfile, characterId: created.id };
          setRecordingProfile(activeProfile);
          localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(activeProfile));
        } catch (err: any) {
          toast({ title: "Erro ao criar personagem", description: err?.message || "Tente novamente", variant: "destructive" });
          setIsSaving(false);
          return;
        }
      }

      const wavBuffer = encodeWav(lastRecording.samples);
      const blob = wavToBlob(wavBuffer);
      const durationSeconds = getDurationSeconds(lastRecording.samples);

      const tc = Math.max(0, recordingStartTimecodeRef.current);
      const tcMs = Math.round(tc * 1000);
      const hh = String(Math.floor(tcMs / 3600000)).padStart(2, "0");
      const mm = String(Math.floor((tcMs % 3600000) / 60000)).padStart(2, "0");
      const ss = String(Math.floor((tcMs % 60000) / 1000)).padStart(2, "0");
      const ms = String(tcMs % 1000).padStart(3, "0");
      const cleanName = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");
      const fileName = `${cleanName(activeProfile.characterName)}_${cleanName(activeProfile.voiceActorName)}_${hh}${mm}${ss}${ms}.wav`;

      console.log("[SaveTake] Saving with profile:", {
        character: activeProfile.characterName,
        actor: activeProfile.voiceActorName,
        lineIndex: currentLine,
        durationSeconds,
        fileName,
      });

      const formData = new FormData();
      formData.append("audio", blob, fileName);
      formData.append("characterId", activeProfile.characterId);
      formData.append("voiceActorId", activeProfile.voiceActorId);
      formData.append("voiceActorName", activeProfile.voiceActorName);
      formData.append("characterName", activeProfile.characterName);
      formData.append("lineIndex", String(currentLine));
      formData.append("timecode", `${hh}:${mm}:${ss}.${ms}`);
      formData.append("startTimeSeconds", String(tc));
      formData.append("durationSeconds", String(durationSeconds));
      formData.append("qualityScore", String(qualityMetrics?.score || 0));

      const response = await fetch(`/api/sessions/${sessionId}/takes`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Falha ao salvar take (${response.status}): ${errorBody}`);
      }

      await response.json();

      setSavedTakes((prev) => new Set(prev).add(currentLine));
      setTakeCount((prev) => prev + 1);
      cleanupPreview();
      refetchTakes();
      toast({
        title: `Take salvo`,
        description: `${recordingProfile.characterName} — Linha ${currentLine + 1} (${durationSeconds.toFixed(1)}s)`,
      });
    } catch (err: any) {
      console.error("[SaveTake] Error:", err);
      toast({
        title: "Falha ao salvar",
        description: err?.message || "Nao foi possivel salvar o take.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [lastRecording, previewUrl, isSaving, currentLine, sessionId, qualityMetrics, recordingProfile, cleanupPreview, refetchTakes, toast, charactersList, session]);

  const handleDiscard = useCallback(() => {
    cleanupPreview();
    toast({ title: "Take descartado" });
  }, [cleanupPreview, toast]);

  useEffect(() => {
    if (isCustomizing) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const code = e.code;
      const key = e.key;

      if (code === shortcuts.playPause || (shortcuts.playPause === "Space" && key === " ")) {
        e.preventDefault();
        if (recordingStatus === "recorded" || recordingStatus === "previewing") {
          handlePreview();
        } else {
          handlePlayPause();
        }
      } else if (code === shortcuts.record) {
        e.preventDefault();
        if (recordingStatus === "idle" || recordingStatus === "recorded") startCountdown();
      } else if (code === shortcuts.stop) {
        e.preventDefault();
        if (recordingStatus === "recording") {
          handleStopRecording();
        } else {
          handleStopPlayback();
        }
      } else if (code === shortcuts.loop) {
        e.preventDefault();
        setIsLooping((l) => !l);
      } else if (code === shortcuts.back) {
        e.preventDefault();
        seek(-2);
      } else if (code === shortcuts.forward) {
        e.preventDefault();
        seek(2);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts, isCustomizing, recordingStatus, handlePlayPause, handlePreview, startCountdown, handleStopRecording, handleStopPlayback, seek]);

  const currentScriptLine = scriptLines[currentLine];

  if (sessionLoading || (session && productionLoading)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full animate-spin border-2 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Carregando sala de gravacao...</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <p className="text-sm font-medium text-foreground">Erro ao carregar sessao</p>
          <p className="text-xs text-muted-foreground">Verifique se voce tem acesso a este estudio e sessao.</p>
          <Link href={`/hub-dub/studio/${studioId}/sessions`}>
            <button className="mt-2 vhub-btn-sm vhub-btn-primary" data-testid="button-back-sessions">
              Voltar para Sessoes
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col select-none relative bg-background text-foreground">
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background opacity-50"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat opacity-[0.02]"></div>
      </div>

      {recordingStatus === "countdown" && countdownValue > 0 && (
        <CountdownOverlay count={countdownValue} />
      )}

      {isCustomizing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[420px] overflow-hidden glass-panel shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
              <span className="text-sm font-semibold text-foreground">Atalhos de Teclado</span>
              <button
                onClick={() => { setIsCustomizing(false); setPendingShortcuts(shortcuts); setListeningFor(null); }}
                className="transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-close-shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-2">
              {(Object.keys(SHORTCUT_LABELS) as Array<keyof Shortcuts>).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.70)" }}>{SHORTCUT_LABELS[key]}</span>
                  <button
                    onClick={() => setListeningFor(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono min-w-[80px] text-center transition-all ${
                      listeningFor === key
                        ? "animate-pulse"
                        : ""
                    }`}
                    style={listeningFor === key
                      ? { border: "1px solid hsl(220 100% 55%)", background: "rgba(59,130,246,0.12)", color: "hsl(220 100% 65%)" }
                      : { border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.70)" }
                    }
                    data-testid={`shortcut-btn-${key}`}
                  >
                    {listeningFor === key ? "Pressione tecla\u2026" : keyLabel(pendingShortcuts[key])}
                  </button>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 flex justify-between gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button
                onClick={() => { setPendingShortcuts(DEFAULT_SHORTCUTS); setListeningFor(null); }}
                className="text-xs transition-colors" style={{ color: "rgba(255,255,255,0.40)" }}
                data-testid="button-reset-shortcuts"
              >
                Restaurar padroes
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShortcuts(pendingShortcuts); setIsCustomizing(false); toast({ title: "Atalhos atualizados (apenas nesta sessao)" }); }}
                  className="vhub-btn-xs vhub-btn-secondary"
                  data-testid="button-apply-shortcuts"
                >
                  Aplicar
                </button>
                <button
                  onClick={() => {
                    setShortcuts(pendingShortcuts);
                    localStorage.setItem("vhub_shortcuts", JSON.stringify(pendingShortcuts));
                    setIsCustomizing(false);
                    toast({ title: "Atalhos salvos como padrao" });
                  }}
                  className="vhub-btn-xs vhub-btn-primary"
                  data-testid="button-save-shortcuts"
                >
                  Salvar como Padrao
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DeviceSettingsPanel
        open={deviceSettingsOpen}
        onClose={() => setDeviceSettingsOpen(false)}
        settings={deviceSettings}
        onSettingsChange={setDeviceSettings}
        micState={micState}
      />

      {showProfilePanel && session?.productionId && (
        <RecordingProfilePanel
          characters={charactersList || []}
          user={user}
          sessionId={sessionId}
          productionId={session.productionId}
          onSave={handleSaveProfile}
          onClose={() => setShowProfilePanel(false)}
          existingProfile={recordingProfile}
        />
      )}

      {takesPopupOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[520px] overflow-hidden" style={{ background: "rgba(15,15,30,0.95)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 12px 48px rgba(0,0,0,0.5)" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span className="text-sm font-semibold" style={{ color: "hsl(210 40% 96%)" }}>Takes da Sessao</span>
              <button
                onClick={() => {
                  setTakesPopupOpen(false);
                  if (takePreviewAudioRef.current) {
                    takePreviewAudioRef.current.pause();
                    takePreviewAudioRef.current.currentTime = 0;
                  }
                  setTakePreviewId(null);
                }}
                className="transition-colors"
                style={{ color: "rgba(255,255,255,0.40)" }}
                data-testid="button-close-takes-popup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <audio ref={takePreviewAudioRef} preload="none" />
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {(isPrivileged ? takesList : takesList.filter((t: any) => t.voiceActorId === user?.id || t.userId === user?.id)).map((take: any) => (
                  <div key={take.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      onClick={() => {
                        const audio = takePreviewAudioRef.current;
                        if (!audio) return;
                        if (takePreviewId === take.id) {
                          audio.pause();
                          audio.currentTime = 0;
                          setTakePreviewId(null);
                          return;
                        }
                        setTakePreviewId(take.id);
                        audio.src = `/api/takes/${take.id}/stream`;
                        audio.play().catch(() => {});
                      }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.75)" }}
                      data-testid={`button-play-take-${take.id}`}
                    >
                      {takePreviewId === take.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono tabular-nums" style={{ color: "rgba(255,255,255,0.45)" }}>#{take.lineIndex}</span>
                        <span className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.80)" }}>{take.characterName || "Take"}</span>
                        <span className="ml-auto text-xs font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>{take.durationSeconds ? `${Number(take.durationSeconds).toFixed(1)}s` : ""}</span>
                      </div>
                      {isPrivileged && (
                        <div className="text-[10px] truncate mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
                          {take.voiceActorName || take.userName || take.userId || take.voiceActorId}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownloadTake(take)}
                      className="p-2 rounded-lg transition-colors"
                      style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.06)" }}
                      title="Baixar take"
                      data-testid={`button-download-take-popup-${take.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {takesList.length === 0 && (
                  <div className="text-sm text-center py-10" style={{ color: "rgba(255,255,255,0.40)" }}>
                    Nenhum take gravado nesta sessao
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between px-2 sm:px-5 py-2 sm:py-0 gap-2 sm:gap-0" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link href={`/hub-dub/studio/${studioId}/sessions`}>
            <button className="flex items-center gap-2 text-sm transition-colors" style={{ color: "rgba(255,255,255,0.45)" }} data-testid="button-exit-room">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </Link>
          <div className="hidden sm:block h-4 w-px" style={{ background: "rgba(255,255,255,0.10)" }} />
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-medium text-sm truncate max-w-[52vw] sm:max-w-none" style={{ color: "hsl(210 40% 96%)" }}>{production?.name || "Carregando\u2026"}</span>
            <span className="text-xs truncate max-w-[36vw] sm:max-w-none" style={{ color: "rgba(255,255,255,0.45)" }}>{session?.title}</span>
          </div>
          {recordingStatus === "recording" && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ color: "hsl(0 72% 65%)", background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
              <Circle className="w-2 h-2 fill-red-500 animate-pulse" /> REC
            </span>
          )}
          {recordingStatus === "recorded" && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full" style={{ color: "hsl(45 93% 55%)", background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.25)" }}>
              <AlertCircle className="w-3 h-3" /> Nao salvo
            </span>
          )}
        </div>

        <div className="relative -mx-2 px-2 sm:mx-0 sm:px-0 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" as any }}>
          <div className="flex items-center gap-3 text-xs whitespace-nowrap">
          {isPrivileged && (
            <>
              <button
                onClick={() => setControlMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 transition-colors"
                style={{ color: controlMenuOpen ? "hsl(220 100% 70%)" : "rgba(255,255,255,0.45)" }}
                data-testid="button-open-text-control"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Controle de Texto</span>
              </button>
              {controlMenuOpen && (
                <div
                  className="absolute right-0 top-[44px] z-50 w-[360px] rounded-xl overflow-hidden animate-in fade-in zoom-in-95"
                  style={{ background: "rgba(15,15,30,0.95)", border: "1px solid rgba(255,255,255,0.10)", boxShadow: "0 12px 48px rgba(0,0,0,0.5)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <span className="text-xs font-semibold" style={{ color: "hsl(210 40% 96%)" }}>Controle de Texto</span>
                    <button
                      onClick={() => setControlMenuOpen(false)}
                      className="transition-colors"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                      data-testid="button-close-text-control"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.40)" }}>Participantes</span>
                      <button
                        onClick={() => {
                          const ok = window.confirm("Limpar o controlador atual e revogar permissoes temporarias?");
                          if (!ok) return;
                          emitVideoEvent("revoke-all", {});
                          setControlPermissions(new Set());
                          setGlobalControlEnabled(false);
                          setTextControllerUserId(null);
                        }}
                        className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors uppercase font-bold"
                        data-testid="button-revoke-all-text-control"
                      >
                        Limpar
                      </button>
                    </div>
                    <div className="text-[11px] mb-2" style={{ color: "rgba(255,255,255,0.55)" }}>
                      Controlador atual:{" "}
                      <span style={{ color: "rgba(255,255,255,0.85)" }}>
                        {(() => {
                          const roster = presenceUsers.length
                            ? presenceUsers
                            : (session?.participants || []).map((p: any) => ({ userId: p.userId, name: p.user?.fullName || p.user?.displayName || p.user?.email || "Usuario", role: p.role }));
                          const name = roster.find((u: any) => u.userId === textControllerUserId)?.name;
                          return textControllerUserId ? (name || "Usuario") : "Nenhum";
                        })()}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                      {(presenceUsers.length
                        ? presenceUsers
                        : (session?.participants || []).map((p: any) => ({ userId: p.userId, name: p.user?.fullName || p.user?.displayName || p.user?.email || "Usuario", role: p.role }))
                      ).map((p: any) => {
                        const isSelected = Boolean(textControllerUserId && p.userId === textControllerUserId);
                        return (
                          <div
                            key={p.userId}
                            className="flex items-center justify-between text-xs rounded-lg px-2 py-1.5"
                            style={isSelected ? { background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.18)" } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold shrink-0" style={{ color: "hsl(220 100% 65%)" }}>
                                {String(p.name || "?")[0] || "?"}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate" style={{ color: "rgba(255,255,255,0.78)" }}>{p.name || "Usuario"}</span>
                                  {isSelected && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 uppercase shrink-0" style={{ color: "hsl(220 100% 75%)" }}>
                                      Controlador
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] uppercase" style={{ color: "rgba(255,255,255,0.30)" }}>
                                  {String(p.role || "").replace(/_/g, " ") || "participante"}
                                </div>
                              </div>
                            </div>

                            {p.userId !== user?.id && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const ok = window.confirm(`Transferir o controle de texto para ${p.name || "Usuario"}?`);
                                  if (!ok) return;
                                  setTextControllerUserId(p.userId);
                                  emitTextControlEvent("text-control:set-controller", { targetUserId: p.userId });
                                }}
                                className="text-[10px] px-2 py-0.5 rounded transition-colors shrink-0"
                                style={{ background: "rgba(59,130,246,0.15)", color: "hsl(220 100% 70%)" }}
                                data-testid={`button-set-text-controller-${p.userId}`}
                              >
                                Selecionar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
              <div className="hidden sm:block w-px h-4" style={{ background: "rgba(255,255,255,0.10)" }} />
            </>
          )}
          {!micReady && (
            <span className="flex items-center gap-1" style={{ color: "hsl(0 72% 65%)" }}>
              <MicOff className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Sem mic</span>
            </span>
          )}
          {micReady && (
            <span className="flex items-center gap-1" style={{ color: "hsl(160 84% 60%)" }}>
              <Mic className="w-3.5 h-3.5" /> <span className="hidden sm:inline">48kHz / 24bit</span>
            </span>
          )}
          <div className="hidden sm:block w-px h-4" style={{ background: "rgba(255,255,255,0.10)" }} />
          {recordingProfile ? (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" style={{ color: "hsl(220 100% 65%)" }} />
              <span className="font-medium" style={{ color: "rgba(255,255,255,0.80)" }}>{recordingProfile.voiceActorName}</span>
              <span style={{ color: "rgba(255,255,255,0.30)" }}>/</span>
              {charactersList && charactersList.length > 1 ? (
                <select
                  value={recordingProfile.characterId}
                  onChange={(e) => handleChangeCharacter(e.target.value)}
                  className="font-medium bg-transparent border-none text-xs cursor-pointer focus:outline-none pr-1"
                  style={{ color: "hsl(220 100% 65%)" }}
                  data-testid="select-active-character"
                >
                  {charactersList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <span className="font-medium" style={{ color: "hsl(220 100% 65%)" }} data-testid="text-active-character">{recordingProfile.characterName}</span>
              )}
              <button
                onClick={() => setShowProfilePanel(true)}
                className="ml-1 transition-colors" style={{ color: "rgba(255,255,255,0.40)" }}
                data-testid="button-edit-profile"
                title="Editar perfil"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowProfilePanel(true)}
              className="flex items-center gap-1.5 transition-colors" style={{ color: "hsl(45 93% 55%)" }}
              data-testid="button-setup-profile"
            >
              <User className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Definir Perfil</span>
            </button>
          )}
          <div className="hidden sm:block w-px h-4" style={{ background: "rgba(255,255,255,0.10)" }} />
          <button
            onClick={() => setTakesPopupOpen(true)}
            className="transition-colors"
            style={{ color: "rgba(255,255,255,0.45)" }}
            data-testid="button-open-takes-popup"
          >
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" style={{ color: "hsl(160 84% 60%)" }} />
            <span className="hidden sm:inline">{takeCount} take{takeCount !== 1 ? "s" : ""}</span>
          </button>
          <div className="hidden sm:block w-px h-4" style={{ background: "rgba(255,255,255,0.10)" }} />
          <button
            onClick={() => setDeviceSettingsOpen(true)}
            className="flex items-center gap-1.5 transition-colors" style={{ color: "rgba(255,255,255,0.45)" }}
            data-testid="button-open-device-settings"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dispositivos</span>
          </button>
          <div className="hidden sm:block w-px h-4" style={{ background: "rgba(255,255,255,0.10)" }} />
          <button
            onClick={() => { setIsCustomizing(true); setPendingShortcuts(shortcuts); }}
            className="flex items-center gap-1.5 transition-colors" style={{ color: "rgba(255,255,255,0.45)" }}
            data-testid="button-open-shortcuts"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Atalhos</span>
          </button>
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] overflow-hidden">
        <div className="flex flex-col min-h-0 lg:border-r lg:border-white/10">
          <div className="flex-1 min-h-[240px] relative overflow-hidden" style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)", margin: "4px 4px 0 4px", borderRadius: "12px" }}>
            {production?.videoUrl ? (
              <video
                ref={videoRef}
                src={production.videoUrl}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                muted={isMuted}
                playsInline
                disablePictureInPicture
                controls={false}
                controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ color: "rgba(255,255,255,0.35)" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <Play className="w-7 h-7" />
                </div>
                <p className="text-xs">Nenhum video anexado a esta producao</p>
              </div>
            )}

            {currentScriptLine && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-10 sm:pt-16 pb-3 sm:pb-5 px-4 sm:px-8">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-mono text-amber-300/90 bg-black/50 px-1.5 py-0.5 rounded">
                    {formatTimecode(currentScriptLine.start)}
                  </span>
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-widest">
                    {currentScriptLine.character}
                  </span>
                </div>
                <p className="text-white text-[15px] sm:text-lg font-light leading-snug">
                  {currentScriptLine.text}
                </p>
              </div>
            )}

            <button
              onClick={() => setIsMuted((m) => !m)}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/40 text-zinc-400 hover:text-white transition-all hover:bg-black/60"
              data-testid="button-mute"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {videoDuration > 0 && (
            <div className="px-3 sm:px-5 py-2" style={{ background: "rgba(255,255,255,0.03)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3 text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span>{formatTimecode(videoTime)}</span>
                <div className="flex-1 relative h-1.5 rounded-full cursor-pointer group" style={{ background: "rgba(255,255,255,0.10)" }} onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  scrub((e.clientX - rect.left) / rect.width);
                }}>
                  {scriptLines.map((line, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 rounded-sm transition-all ${
                        savedTakes.has(i) ? "bg-emerald-400/70" :
                        i === currentLine ? "bg-blue-400/70" :
                        ""
                      }`}
                      style={{
                        left: `${(line.start / videoDuration) * 100}%`,
                        width: `${Math.max(0.5, ((line.end! - line.start) / videoDuration) * 100)}%`,
                        ...(!savedTakes.has(i) && i !== currentLine ? { background: "rgba(255,255,255,0.15)" } : {}),
                      }}
                    />
                  ))}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md"
                    style={{ left: `${(videoTime / videoDuration) * 100}%`, transform: "translate(-50%,-50%)", background: "hsl(220 100% 55%)", border: "2px solid rgba(255,255,255,0.80)", boxShadow: "0 0 8px rgba(59,130,246,0.4)" }}
                  />
                </div>
                <span>{formatTimecode(videoDuration)}</span>
              </div>
            </div>
          )}

          <div className="shrink-0 px-3 sm:px-5 py-3 sm:py-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0" style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="w-full sm:w-56 shrink-0 flex flex-col justify-center gap-1 py-0 sm:py-3">
              <div className="flex items-center justify-between text-[10px] mb-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                <span className="uppercase tracking-wider">
                  {recordingStatus === "recording" ? "Ao Vivo" :
                    recordingStatus === "previewing" ? "Reproduzindo" :
                    recordingStatus === "recorded" ? "Gravado" :
                    micReady ? "Monitorando" : "Sem microfone"}
                </span>
                {recordingStatus === "recording" && (
                  <span className="flex items-center gap-1" style={{ color: "hsl(0 72% 65%)" }}>
                    <Circle className="w-1.5 h-1.5 fill-red-500 animate-pulse" /> REC
                  </span>
                )}
                {(recordingStatus === "recorded" || recordingStatus === "previewing") && lastRecording && (
                  <div className="flex items-center gap-2">
                    {qualityMetrics && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={
                        qualityMetrics.score > 80 ? { background: "rgba(16,185,129,0.12)", color: "hsl(160 84% 60%)", border: "1px solid rgba(16,185,129,0.25)" } :
                        qualityMetrics.score > 50 ? { background: "rgba(245,158,11,0.12)", color: "hsl(45 93% 55%)", border: "1px solid rgba(245,158,11,0.25)" } :
                        { background: "rgba(239,68,68,0.12)", color: "hsl(0 72% 65%)", border: "1px solid rgba(239,68,68,0.25)" }
                      }>
                        {qualityMetrics.score}
                      </span>
                    )}
                    <span className="font-mono" style={{ color: "hsl(45 93% 55%)" }}>{lastRecording.durationSeconds.toFixed(1)}s</span>
                  </div>
                )}
              </div>
              <MonitorPanel
                micState={micState}
                recordingStatus={recordingStatus}
                lastRecording={lastRecording}
                previewAudioRef={previewAudioRef}
                savedSamples={null}
              />
            </div>

            <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-2">
              <div className="w-full sm:w-auto flex items-center justify-center gap-2">
              <button
                onClick={() => seek(-2)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all" style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)" }}
                data-testid="button-back-2s"
                title={`Back 2s (${keyLabel(shortcuts.back)})`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handlePlayPause}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all" style={{ background: "rgba(255,255,255,0.08)", color: "hsl(210 40% 96%)", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
                data-testid="button-play-pause"
                title={`Play/Pause (${keyLabel(shortcuts.playPause)})`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={recordingStatus === "recording" ? handleStopRecording : handleStopPlayback}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all" style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)" }}
                data-testid="button-stop"
                title={`Stop (${keyLabel(shortcuts.stop)})`}
              >
                <Square className="w-4 h-4" />
              </button>

              <div className="hidden sm:block w-px h-8 mx-1" style={{ background: "rgba(255,255,255,0.10)" }} />
              </div>

              {recordingStatus === "idle" || recordingStatus === "countdown" ? (
                <button
                  onClick={startCountdown}
                  disabled={!micReady || recordingStatus === "countdown"}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-30"
                  style={recordingStatus === "countdown"
                    ? { background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.30)", cursor: "wait", color: "rgba(255,255,255,0.70)" }
                    : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.70)" }
                  }
                  data-testid="button-record"
                  title={`Record (${keyLabel(shortcuts.record)})`}
                >
                  <Mic className="w-5 h-5" />
                </button>
              ) : recordingStatus === "recording" ? (
                <button
                  onClick={handleStopRecording}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all"
                  style={{ background: "hsl(0 72% 55%)", boxShadow: "0 0 24px rgba(239,68,68,0.4), 0 4px 12px rgba(0,0,0,0.3)" }}
                  data-testid="button-stop-recording"
                  title={`Stop recording (${keyLabel(shortcuts.stop)})`}
                >
                  <Square className="w-5 h-5 text-white fill-white" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreview}
                    className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                    style={recordingStatus === "previewing"
                      ? { background: "hsl(220 100% 55%)", color: "white", boxShadow: "0 0 16px rgba(59,130,246,0.3)" }
                      : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.70)", border: "1px solid rgba(255,255,255,0.12)" }
                    }
                    data-testid="button-preview"
                  >
                    <Headphones className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveTake}
                    disabled={isSaving}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-50"
                    style={{ background: "hsl(160 84% 39%)", boxShadow: "0 0 16px rgba(16,185,129,0.3)" }}
                    data-testid="button-save-take"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDiscard}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all"
                    style={{ background: "rgba(239,68,68,0.08)", color: "rgba(239,68,68,0.60)", border: "1px solid rgba(239,68,68,0.15)" }}
                    data-testid="button-discard-take"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="hidden sm:block w-px h-8 mx-1" style={{ background: "rgba(255,255,255,0.10)" }} />

              <button
                onClick={() => seek(2)}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all" style={{ color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)" }}
                data-testid="button-forward-2s"
                title={`Forward 2s (${keyLabel(shortcuts.forward)})`}
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  if (loopSelectionMode === "idle") {
                    setLoopSelectionMode("selecting-start");
                    setIsLooping(true);
                    toast({ title: "Modo de Selecao de Loop", description: "Clique na primeira fala para iniciar o loop." });
                  } else {
                    setLoopSelectionMode("idle");
                    setCustomLoop(null);
                    setIsLooping(false);
                    emitVideoEvent("sync-loop", { loopRange: null });
                  }
                }}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                style={isLooping || loopSelectionMode !== "idle"
                  ? { background: "rgba(59,130,246,0.12)", color: "hsl(220 100% 65%)", boxShadow: "0 0 0 1px rgba(59,130,246,0.30)" }
                  : { color: "rgba(255,255,255,0.45)", background: "rgba(255,255,255,0.05)" }
                }
                data-testid="button-loop"
                title={`Toggle loop (${keyLabel(shortcuts.loop)})`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="w-full sm:w-44 shrink-0 flex flex-col items-start sm:items-end gap-1.5">
              {isLooping && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <span>Pre-roll</span>
                    <div className="flex gap-0.5">
                      {[0.5, 1, 2, 3].map((v) => (
                        <button
                          key={v}
                          onClick={() => setPreRoll(v)}
                          className="px-1.5 py-0.5 rounded text-[10px] transition-colors"
                          style={preRoll === v
                            ? { background: "rgba(59,130,246,0.12)", color: "hsl(220 100% 65%)", border: "1px solid rgba(59,130,246,0.25)" }
                            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.50)" }
                          }
                          data-testid={`preroll-${v}`}
                        >
                          {v}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    <span>Post-roll</span>
                    <div className="flex gap-0.5">
                      {[0.5, 1, 2, 3].map((v) => (
                        <button
                          key={v}
                          onClick={() => setPostRoll(v)}
                          className="px-1.5 py-0.5 rounded text-[10px] transition-colors"
                          style={postRoll === v
                            ? { background: "rgba(59,130,246,0.12)", color: "hsl(220 100% 65%)", border: "1px solid rgba(59,130,246,0.25)" }
                            : { background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.50)" }
                          }
                          data-testid={`postroll-${v}`}
                        >
                          {v}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.40)" }}>
                {savedTakes.size} / {scriptLines.length} linhas salvas
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col min-h-0 bg-white/[0.02]">
          <div className="h-11 shrink-0 px-5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.03)" }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.40)" }}>
              Roteiro
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setScriptAutoFollow(true); scrollScriptToLine(currentLine, "smooth"); }}
                className="text-[10px] px-2 py-1 rounded-full transition-colors"
                style={scriptAutoFollow
                  ? { background: "rgba(59,130,246,0.14)", color: "hsl(220 100% 70%)", border: "1px solid rgba(59,130,246,0.25)" }
                  : { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.55)", border: "1px solid rgba(255,255,255,0.10)" }
                }
                data-testid="button-script-follow"
                title={scriptAutoFollow ? "Seguindo automaticamente" : "Retomar sincronizacao"}
              >
                {scriptAutoFollow ? "AUTO" : "SEGUIR"}
              </button>
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.40)" }}>
                <span className="font-mono" style={{ color: "rgba(255,255,255,0.75)" }}>{currentLine + 1}</span>
                {" "}/{" "}
                {scriptLines.length}
              </span>
            </div>
          </div>

          <div
            ref={scriptViewportRef}
            className="flex-1 overflow-y-auto py-3 px-4 min-h-0 relative"
            style={{ scrollBehavior: "auto", WebkitOverflowScrolling: "touch" as any }}
            onScroll={handleScriptViewportScroll}
            onWheelCapture={markScriptUserScrollIntent}
            onTouchMoveCapture={markScriptUserScrollIntent}
            onPointerDownCapture={markScriptUserScrollIntent}
          >
            {!scriptAutoFollow && scriptLines.length > 0 && (
              <div className="sticky top-0 z-20 mb-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: "rgba(15,15,30,0.88)", border: "1px solid rgba(255,255,255,0.10)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
                  <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.65)" }}>
                    Rolagem livre
                  </span>
                  <button
                    type="button"
                    onClick={() => { setScriptAutoFollow(true); scrollScriptToLine(currentLine, "smooth"); }}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
                    style={{ background: "rgba(59,130,246,0.16)", color: "hsl(220 100% 70%)", border: "1px solid rgba(59,130,246,0.25)" }}
                    data-testid="button-script-resume-follow"
                  >
                    Voltar ao atual
                  </button>
                </div>
              </div>
            )}

            {scriptLines.length > 1 && (
              <div className="absolute right-1 top-3 bottom-3 w-[3px] rounded-full" style={{ background: "rgba(255,255,255,0.06)", pointerEvents: "none" }}>
                <div
                  className="absolute left-0 right-0 mx-auto w-full rounded-full"
                  style={{
                    height: 34,
                    top: `${(currentLine / Math.max(1, scriptLines.length - 1)) * 100}%`,
                    transform: "translateY(-50%)",
                    background: "rgba(59,130,246,0.65)",
                    boxShadow: "0 0 0 1px rgba(59,130,246,0.25)",
                  }}
                />
              </div>
            )}
            {scriptLines.length === 0 && !session && (
              <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: "rgba(255,255,255,0.40)" }}>
                <div className="w-10 h-10 rounded-full animate-spin" style={{ border: "2px solid rgba(255,255,255,0.10)", borderTopColor: "hsl(220 100% 55%)" }} />
                <p className="text-sm">Carregando sessao...</p>
              </div>
            )}
            {scriptLines.length === 0 && session && (
              <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: "rgba(255,255,255,0.40)" }}>
                <p className="text-sm">Nenhum roteiro carregado</p>
                <p className="text-xs">Adicione um roteiro a producao para ver as falas aqui</p>
              </div>
            )}
            {scriptLines.map((line, i) => {
              const isActive = i === currentLine;
              const isDone = savedTakes.has(i);
              const isInLoop = customLoop && line.start >= customLoop.start && (line.end || line.start) <= customLoop.end;
              const lineTakes = takesList.filter((t: any) => t.lineIndex === i);
              return (
                <div
                  key={i}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  onClick={canTextControl ? (() => handleLineClick(i)) : undefined}
                  className={`mb-3 px-5 py-4 lg:px-6 lg:py-5 rounded-xl transition-all duration-300 relative overflow-hidden ${canTextControl ? "cursor-pointer" : "cursor-default"}`}
                  style={{
                    background: isActive ? "rgba(59, 130, 246, 0.08)" : (isInLoop ? "rgba(59, 130, 246, 0.04)" : "transparent"),
                    ...(isActive ? { boxShadow: "0 0 0 1px rgba(59,130,246,0.25), 0 0 12px rgba(59,130,246,0.08)" } : {}),
                    ...(isInLoop && !isActive ? { boxShadow: "inset 0 0 0 1px rgba(59,130,246,0.15)" } : {}),
                    ...(canTextControl ? {} : { opacity: 0.92 }),
                  }}
                  data-testid={`script-line-${i}`}
                >
                  {isInLoop && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/40" />
                  )}
                  <div className="flex items-center gap-3 mb-2 lg:mb-3">
                    <span className="text-[16px] lg:text-[16px] font-mono tabular-nums" style={{ color: "rgba(255,255,255,0.40)" }}>
                      {formatTimecode(line.start)}
                    </span>
                    <span
                      className="text-[24px] lg:text-[32px] font-extrabold uppercase tracking-[0.5px] transition-colors leading-tight"
                      style={{ color: isActive ? "hsl(220 100% 65%)" : "rgba(255,255,255,0.35)" }}
                    >
                      {line.character}
                    </span>
                    {canTextControl && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLineIndex(i);
                          setEditingLineText(lineEdits[i] ?? line.text);
                        }}
                        className="ml-1 p-1 rounded transition-colors"
                        style={{ color: "rgba(255,255,255,0.40)" }}
                        title="Editar fala"
                        data-testid={`button-edit-line-${i}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isDone && (
                      <span className="ml-auto flex items-center gap-1.5 text-[16px] font-medium" style={{ color: "hsl(160 84% 60%)" }}>
                        <CheckCircle2 className="w-5 h-5" /> Salvo
                      </span>
                    )}
                    {lineTakes.length > 0 && !isDone && (
                      <span className="ml-auto text-[16px]" style={{ color: "rgba(255,255,255,0.40)" }}>
                        {lineTakes.length} take{lineTakes.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  {editingLineIndex === i ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={editingLineText}
                        onChange={(e) => setEditingLineText(e.target.value)}
                        className="w-full rounded-lg p-3 text-[16px] lg:text-[18px] leading-relaxed bg-black/30 border border-white/10 focus:border-blue-500 outline-none"
                        style={{ color: "hsl(210 40% 96%)" }}
                        rows={3}
                        data-testid={`textarea-edit-line-${i}`}
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={() => {
                            setEditingLineIndex(null);
                            setEditingLineText("");
                          }}
                          className="vhub-btn-xs vhub-btn-secondary"
                          data-testid={`button-cancel-edit-line-${i}`}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => {
                            if (!canTextControl) return;
                            const nextText = String(editingLineText || "");
                            setLineEdits((prev) => ({ ...prev, [i]: nextText }));
                            emitTextControlEvent("text-control:update-line", { lineIndex: i, text: nextText });
                            setEditingLineIndex(null);
                            setEditingLineText("");
                          }}
                          className="vhub-btn-xs vhub-btn-primary"
                          data-testid={`button-save-edit-line-${i}`}
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[22px] lg:text-[30px] leading-[1.7] transition-colors" style={{
                      color: isActive ? "hsl(210 40% 96%)" : "rgba(255,255,255,0.45)",
                      fontWeight: isActive ? 500 : 400,
                    }}>
                      {lineEdits[i] ?? line.text}
                    </p>
                  )}
                  {lineTakes.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {lineTakes.map((take: any) => (
                        <div key={take.id} className="flex items-center gap-2 text-[11px] px-2 py-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                          <span className="font-mono" style={{ color: "rgba(255,255,255,0.50)" }}>
                            {take.durationSeconds ? `${Number(take.durationSeconds).toFixed(1)}s` : ""}
                          </span>
                          <span className="truncate" style={{ color: "rgba(255,255,255,0.60)" }}>
                            {take.characterName || "Take"}
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadTake(take); }}
                              className="p-1 rounded transition-colors"
                              style={{ color: "rgba(255,255,255,0.40)" }}
                              title="Baixar take"
                              data-testid={`button-download-take-${take.id}`}
                            >
                              <Download className="w-3 h-3" />
                            </button>
                            {(take.userId === user?.id || take.voiceActorId === user?.id) && (
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteTakeMutation.mutate(take.id); }}
                                className="p-1 rounded transition-colors"
                                style={{ color: "rgba(239,68,68,0.60)" }}
                                title="Excluir take"
                                data-testid={`button-delete-take-${take.id}`}
                                disabled={deleteTakeMutation.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      <DailyMeetPanel sessionId={sessionId} />
    </div>
  );
}

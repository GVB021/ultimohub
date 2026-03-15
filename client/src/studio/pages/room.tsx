import { useParams, Link } from "wouter";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { Drawer } from "vaul";
import { authFetch } from "@studio/lib/auth-fetch";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/nav/ThemeToggle";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Save,
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
  Loader2,
  Menu,
  ChevronRight,
  LogOut,
  Building2,
  Users,
} from "lucide-react";
import { useToast } from "@studio/hooks/use-toast";
import { useAuth } from "@studio/hooks/use-auth";
import { formatTimecode, parseTimecode, parseUniversalTimecodeToSeconds } from "@studio/lib/timecode";
import { cn } from "@studio/lib/utils";
import {
  buildScrollAnchors,
  computeAdaptiveMaxSpeedPxPerSec,
  interpolateScrollTop,
  smoothScrollStep,
  type ScrollAnchor,
} from "@studio/lib/script-scroll-sync";

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
import { encodeWav, wavToBlob } from "@studio/lib/audio/wavEncoder";
import { analyzeTakeQuality, type QualityMetrics } from "@studio/lib/audio/qualityAnalysis";

function DailyMeetPanel({ sessionId }: { sessionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [dailyUrl, setDailyUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dragControls = useDragControls();
  const constraintsRef = useRef(null);

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

  const panelHeight = isCompact ? "120px" : "min(320px, calc(100vh - 220px))";

  return (
    <div ref={constraintsRef} className="fixed inset-0 z-[80] pointer-events-none overflow-hidden" data-testid="panel-daily">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragConstraints={constraintsRef}
            dragElastic={0.1}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, x: "calc(100vw - 320px)", y: "calc(100vh - 420px)" }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute rounded-2xl overflow-hidden glass-panel shadow-2xl border border-border/50 pointer-events-auto"
            style={{ width: "min(300px, 30vw)", minWidth: "200px" }}
          >
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/40 cursor-grab active:cursor-grabbing touch-none"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Mic className="w-3 h-3 text-emerald-500" /> Chat de Voz
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsCompact(!isCompact)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-foreground"
                  aria-label={isCompact ? "Expandir" : "Minimizar"}
                >
                  {isCompact ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-white/10 rounded transition-colors text-muted-foreground hover:text-foreground"
                  aria-label="Fechar"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div style={{ height: panelHeight }} className="relative bg-black/60 transition-all duration-300">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-[9px] uppercase font-bold tracking-widest">Iniciando...</span>
                </div>
              ) : error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive/50" />
                  <span className="text-[9px] text-muted-foreground">{error}</span>
                </div>
              ) : dailyUrl ? (
                <iframe
                  src={dailyUrl}
                  className="w-full h-full border-none"
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  title="Daily Video Chat"
                />
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="absolute bottom-20 right-5 h-12 w-12 rounded-full flex items-center justify-center shadow-lg pointer-events-auto z-[90]"
        style={{
          background: isOpen ? "rgba(255,255,255,0.05)" : "hsl(var(--primary))",
          color: isOpen ? "rgba(255,255,255,0.60)" : "hsl(var(--primary-foreground))",
          border: "1px solid rgba(255,255,255,0.1)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
        aria-label={isOpen ? "Fechar Chat de Voz" : "Abrir Chat de Voz"}
        data-testid="button-floating-voice-chat"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </motion.button>
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
  back: "Recuar 2s",
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

interface DeviceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  inputGain: number;
  monitorVolume: number;
  voiceCaptureMode: VoiceCaptureMode;
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

  useEffect(() => {
    if (open) {
      navigator.mediaDevices.enumerateDevices().then((d) => {
        setDevices(d.filter((x) => x.kind === "audioinput"));
      });
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="rounded-3xl w-[calc(100vw-32px)] max-w-[440px] overflow-hidden glass-panel shadow-2xl border border-white/10">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Configuracoes de Audio</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Entrada e Saida</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
            data-testid="button-close-device-settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="space-y-4">
            <div>
              <label className="vhub-label mb-2 block">Microfone</label>
              <select
                value={settings.inputDeviceId}
                onChange={(e) => onSettingsChange({ ...settings, inputDeviceId: e.target.value })}
                className="w-full h-11 rounded-xl px-4 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none transition-all"
                data-testid="select-input-device"
              >
                <option value="">Padrao do Sistema</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Microfone Externo"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="vhub-label">Ganho de Entrada</label>
                <span className="text-[10px] font-mono text-primary font-bold">{(settings.inputGain * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2}
                step={0.01}
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
                <label className="vhub-label">Volume do Monitor</label>
                <span className="text-[10px] font-mono text-primary font-bold">{(settings.monitorVolume * 100).toFixed(0)}%</span>
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
              className="w-full h-11 rounded-xl px-4 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none transition-all"
              data-testid="select-voice-capture-mode"
            >
              <option value="studio">Studio Mode (Processado)</option>
              <option value="original">Microfone Original</option>
              <option value="high-fidelity">High-End (Lossless 24-bit)</option>
            </select>
            <p className="text-[10px] mt-3 leading-relaxed text-muted-foreground font-medium italic">
              {settings.voiceCaptureMode === "studio"
                ? "Filtro passa-alta 80Hz + compressor + reducao de ruido. Ideal para ambientes ruidosos."
                : settings.voiceCaptureMode === "high-fidelity"
                ? "Captura RAW 24-bit via AudioWorklet. Desativa todo processamento do sistema. Requer interface de audio."
                : "Captura padrao do navegador sem efeitos adicionais."}
            </p>
          </div>

          {settings.voiceCaptureMode === "high-fidelity" && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex gap-3 items-start">
              <div className="mt-1 w-2 h-2 shrink-0 rounded-full bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
              <div>
                <p className="text-xs font-bold text-destructive">Controle Exclusivo de Hardware</p>
                <p className="text-[10px] text-destructive/70 leading-snug mt-1 font-medium">
                  O sistema assumiu o controle do driver de audio para garantir 48kHz/24-bit with zero latency.
                </p>
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            data-testid="button-apply-device-settings"
          >
            Concluido
          </button>
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
        const res = await authFetch(`/api/productions/${productionId}/characters`, {
          method: "POST",
          body: JSON.stringify({ name: freeCharName.trim() }),
        });
        onSave({
          voiceActorName: actorName.trim(),
          characterName: res.name,
          characterId: res.id,
          voiceActorId: user?.id || "",
          userId: user?.id || "",
          sessionId,
          productionId,
        });
      } catch (err: any) {
        toast({ title: "Erro ao criar personagem", description: err.message, variant: "destructive" });
      } finally {
        setIsCreating(false);
      }
    }
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="rounded-3xl w-[calc(100vw-32px)] max-w-[440px] overflow-hidden glass-panel shadow-2xl border border-white/10">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Perfil de Gravacao</h3>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Quem voce sera hoje?</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors text-muted-foreground hover:text-foreground"
              data-testid="button-close-profile"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="space-y-4">
            <div>
              <label className="vhub-label mb-2 block">Seu Nome Artistico</label>
              <input
                type="text"
                value={actorName}
                onChange={(e) => setActorName(e.target.value)}
                placeholder="Ex: Gabriel Borba"
                className="w-full h-11 rounded-xl px-4 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none transition-all"
                data-testid="input-actor-name"
              />
            </div>

            {hasCharacters ? (
              <div>
                <label className="vhub-label mb-2 block">Selecione seu Personagem</label>
                <select
                  value={selectedCharId}
                  onChange={(e) => setSelectedCharId(e.target.value)}
                  className="w-full h-11 rounded-xl px-4 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none transition-all"
                  data-testid="select-character"
                >
                  <option value="">Escolha um personagem...</option>
                  {characters.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="vhub-label mb-2 block">Nome do Personagem</label>
                <input
                  type="text"
                  value={freeCharName}
                  onChange={(e) => setFreeCharName(e.target.value)}
                  placeholder="Ex: Batman"
                  className="w-full h-11 rounded-xl px-4 text-sm bg-muted/50 border border-border text-foreground focus:border-primary outline-none transition-all"
                  data-testid="input-free-character"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!actorName.trim() || (!selectedCharId && !freeCharName.trim()) || isCreating}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
            data-testid="button-save-profile"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Comecar a Gravar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useSessionData(studioId: string, sessionId: string) {
  return useQuery({
    queryKey: ["/api/studios", studioId, "sessions", sessionId],
    queryFn: () => authFetch(`/api/studios/${studioId}/sessions/${sessionId}`),
    enabled: Boolean(studioId && sessionId),
  });
}

function useProductionScript(studioId: string, productionId?: string) {
  return useQuery({
    queryKey: ["/api/studios", studioId, "productions", productionId],
    queryFn: () => authFetch(`/api/studios/${studioId}/productions/${productionId}`),
    enabled: Boolean(studioId && productionId),
  });
}

function useCharactersList(productionId?: string) {
  return useQuery<Array<{ id: string; name: string; voiceActorId: string | null }>>({
    queryKey: ["/api/productions", productionId, "characters"],
    queryFn: () => authFetch(`/api/productions/${productionId}/characters`),
    enabled: Boolean(productionId),
  });
}

function useTakesList(sessionId: string) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "takes"],
    queryFn: () => authFetch(`/api/sessions/${sessionId}/takes`),
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
  });
}

export default function RecordingRoom() {
  const { studioId, sessionId } = useParams<{ studioId: string; sessionId: string }>();
  const [isMobile, setIsMobile] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const logAudioStep = useCallback((step: string, payload?: Record<string, unknown>) => {
    console.info(`[AudioPipeline][Room] ${step}`, payload || {});
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { toast } = useToast();
  const { user, logout } = useAuth();
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
      const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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

  const [volumeOverlay, setVolumeOverlay] = useState<number | null>(null);
  const [speedOverlay, setSpeedOverlay] = useState<number | null>(null);
  const [charSelectorOpen, setCharSelectorOpen] = useState(false);
  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleCharacterChange = (char: { id: string; name: string; voiceActorId: string | null }) => {
    if (!recordingProfile) return;
    const newProfile = {
      ...recordingProfile,
      characterId: char.id,
      characterName: char.name,
      voiceActorId: char.voiceActorId || user?.id || "",
    };
    setRecordingProfile(newProfile);
    localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(newProfile));
    setCharSelectorOpen(false);
    toast({ title: `Personagem alterado para ${char.name}` });
  };

  const handleVideoTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap - Cycle playback speed
      const video = videoRef.current;
      if (video) {
        const nextSpeed = video.playbackRate >= 2 ? 1 : video.playbackRate + 0.25;
        video.playbackRate = nextSpeed;
        setSpeedOverlay(nextSpeed);
        setTimeout(() => setSpeedOverlay(null), 1000);
      }
    }
    lastTapRef.current = now;
  };

  const handleVideoTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const deltaY = touchStartRef.current.y - touch.clientY;

    if (Math.abs(deltaY) > 20) {
      const video = videoRef.current;
      if (video) {
        const change = deltaY > 0 ? 0.05 : -0.05;
        const newVol = Math.max(0, Math.min(1, video.volume + change));
        video.volume = newVol;
        setIsMuted(newVol === 0);
        setVolumeOverlay(Math.round(newVol * 100));
        setTimeout(() => setVolumeOverlay(null), 1000);
      }
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  };

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

      const toSeconds3 = (seconds: number) => Math.round(seconds * 1000) / 1000;

      const normalized = rawLines.map((line: any) => {
        const character = line.character || line.personagem || line.char || "";
        const text = line.text || line.fala || line.dialogue || line.dialog || "";

        if (typeof line.tempoEmSegundos === "number" && Number.isFinite(line.tempoEmSegundos)) {
          return { character, start: toSeconds3(line.tempoEmSegundos), text };
        }

        const rawTime = line.tempo ?? line.start ?? line.timecode ?? line.tc ?? "00:00:00";
        try {
          return { character, start: toSeconds3(parseUniversalTimecodeToSeconds(rawTime, 24)), text };
        } catch {
          return { character, start: toSeconds3(parseTimecode(rawTime)), text };
        }
      });

      const sorted = [...normalized]
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

  const currentScriptLine = scriptLines[currentLine];

  const { data: takesList = [] } = useTakesList(sessionId);
  const takeCount = takesList.length;

  const savedTakes = useMemo(() => {
    const s = new Set<number>();
    takesList.forEach((t: any) => {
      if (t.isDone) s.add(t.lineIndex);
    });
    return s;
  }, [takesList]);

  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scriptViewportRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [scriptAutoFollow, setScriptAutoFollow] = useState(true);
  const userScrollIntentTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollAnchorsRef = useRef<ScrollAnchor[]>([]);
  const scrollSyncRafRef = useRef<number | null>(null);
  const scrollSyncLastTsRef = useRef<number | null>(null);
  const scrollSyncCurrentRef = useRef(0);
  const scrollSyncLastVideoTimeRef = useRef(0);

  const [micReady, setMicReady] = useState(false);
  const [micState, setMicState] = useState<MicrophoneState | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
  const [countdownValue, setCountdownValue] = useState(0);
  const [lastRecording, setLastRecording] = useState<RecordingResult | null>(null);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);

  const [takesPopupOpen, setTakesPopupOpen] = useState(false);
  const [takePreviewId, setTakePreviewId] = useState<string | null>(null);
  const takePreviewAudioRef = useRef<HTMLAudioElement>(null);

  const [textControlPopupOpen, setTextControlPopupOpen] = useState(false);
  const [lineEdits, setLineEdits] = useState<Record<number, string>>({});
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [editingLineText, setEditingLineText] = useState("");

  const [textControllerUserIds, setTextControllerUserIds] = useState<Set<string>>(new Set());
  const [pendingTextControllerUserIds, setPendingTextControllerUserIds] = useState<Set<string>>(new Set());
  const [controlPermissions, setControlPermissions] = useState<Set<string>>(new Set());
  const [globalControlEnabled, setGlobalControlEnabled] = useState(false);
  const [presenceUsers, setPresenceUsers] = useState<any[]>([]);
  const [prerollInitiatorUserId, setPrerollInitiatorUserId] = useState<string | null>(null);

  const isDirector = useMemo(() => {
    if (!user || !session?.participants) return false;
    if (user.role === "platform_owner") return true;
    const me = session.participants.find((p: any) => p.userId === user.id);
    return me?.role === "director" || me?.role === "diretor" || me?.role === "studio_admin";
  }, [user, session]);

  const isPrivileged = isDirector || user?.role === "platform_owner";

  const canTextControl = useMemo(() => {
    if (isPrivileged) return true;
    if (user && textControllerUserIds.has(user.id)) return true;
    return false;
  }, [isPrivileged, user, textControllerUserIds]);

  const wsRef = useRef<WebSocket | null>(null);

  const emitVideoEvent = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: `video:${type}`, ...data }));
    }
  }, []);

  const emitTextControlEvent = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...data }));
    }
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/api/sessions/${sessionId}/ws`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.type === "video:sync") {
        const video = videoRef.current;
        if (video) {
          const diff = Math.abs(video.currentTime - msg.currentTime);
          if (diff > 0.3) video.currentTime = msg.currentTime;
          if (msg.isPlaying && video.paused) video.play().catch(() => {});
          else if (!msg.isPlaying && !video.paused) video.pause();
        }
      } else if (msg.type === "video:seek") {
        if (videoRef.current) videoRef.current.currentTime = msg.currentTime;
      } else if (msg.type === "video:countdown") {
        setCountdownValue(msg.count);
        setPrerollInitiatorUserId(msg.initiatorUserId);
        if (msg.count > 0 && micState?.audioContext) {
          playCountdownBeep(micState.audioContext);
        }
      } else if (msg.type === "text-control:update-line") {
        setLineEdits((prev) => ({ ...prev, [msg.lineIndex]: msg.text }));
      } else if (msg.type === "text-control:set-controllers") {
        setTextControllerUserIds(new Set(msg.targetUserIds));
      } else if (msg.type === "presence:update") {
        setPresenceUsers(msg.users);
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  const rebuildScrollAnchors = useCallback(() => {
    const viewport = scriptViewportRef.current;
    if (!viewport || !scriptLines.length) return;
    const lineOffsets: number[] = [];
    const lineHeights: number[] = [];
    const lineStarts: number[] = [];
    for (let i = 0; i < scriptLines.length; i++) {
      const el = lineRefs.current[i];
      if (!el) continue;
      lineOffsets.push(el.offsetTop);
      lineHeights.push(el.offsetHeight || 1);
      lineStarts.push(scriptLines[i].start);
    }
    scrollAnchorsRef.current = buildScrollAnchors({
      lineStarts,
      lineOffsets,
      lineHeights,
      viewportHeight: viewport.clientHeight,
      maxScrollTop: viewport.scrollHeight - viewport.clientHeight,
    });
    scrollSyncCurrentRef.current = viewport.scrollTop;
  }, [scriptLines]);

  useEffect(() => {
    const viewport = scriptViewportRef.current;
    if (!viewport) return;
    rebuildScrollAnchors();
    const onResize = () => rebuildScrollAnchors();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [rebuildScrollAnchors]);

  const markScriptUserScrollIntent = useCallback(() => {
    setScriptAutoFollow(false);
    if (userScrollIntentTimeoutRef.current) clearTimeout(userScrollIntentTimeoutRef.current);
    userScrollIntentTimeoutRef.current = setTimeout(() => {
    }, 10000);
  }, []);

  const syncScrollToCurrentVideoTime = useCallback(() => {
    const viewport = scriptViewportRef.current;
    if (!viewport || !scrollAnchorsRef.current.length) return;
    const t = videoRef.current?.currentTime ?? 0;
    const target = interpolateScrollTop(scrollAnchorsRef.current, t);
    scrollSyncCurrentRef.current = target;
    viewport.scrollTop = target;
  }, []);

  useEffect(() => {
    const viewport = scriptViewportRef.current;
    const video = videoRef.current;
    if (!viewport || !video) return;
    if (!scriptAutoFollow) return;

    let mounted = true;
    const tick = (ts: number) => {
      if (!mounted) return;
      const dt = scrollSyncLastTsRef.current === null ? 1 / 60 : (ts - scrollSyncLastTsRef.current) / 1000;
      scrollSyncLastTsRef.current = ts;

      const currentVideoTime = video.currentTime;
      const previousVideoTime = scrollSyncLastVideoTimeRef.current;
      const seeking = Math.abs(currentVideoTime - previousVideoTime) > 0.9;
      scrollSyncLastVideoTimeRef.current = currentVideoTime;

      const target = interpolateScrollTop(scrollAnchorsRef.current, currentVideoTime);
      const maxSpeed = computeAdaptiveMaxSpeedPxPerSec({
        contentHeight: viewport.scrollHeight,
        viewportHeight: viewport.clientHeight,
        videoDuration: videoDuration || video.duration || 0,
        lineCount: scriptLines.length,
        seeking,
      });

      const next = smoothScrollStep({
        current: scrollSyncCurrentRef.current,
        target,
        dtSeconds: dt,
        maxSpeedPxPerSec: maxSpeed,
        response: video.paused ? 18 : 11,
      });
      scrollSyncCurrentRef.current = next;
      viewport.scrollTop = next;
      scrollSyncRafRef.current = window.requestAnimationFrame(tick);
    };

    scrollSyncRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      mounted = false;
      if (scrollSyncRafRef.current !== null) window.cancelAnimationFrame(scrollSyncRafRef.current);
      scrollSyncRafRef.current = null;
      scrollSyncLastTsRef.current = null;
    };
  }, [scriptAutoFollow, scriptLines.length, videoDuration]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const time = video.currentTime;
      setVideoTime(time);

      const lineIndex = scriptLines.findIndex((l, i) => {
        const nextStart = scriptLines[i + 1]?.start ?? Infinity;
        return time >= l.start && time < nextStart;
      });

      if (lineIndex !== -1 && lineIndex !== currentLine) {
        setCurrentLine(lineIndex);
      }

      if (isLooping) {
        const range = customLoop || (currentScriptLine ? { start: currentScriptLine.start - preRoll, end: (currentScriptLine.end || currentScriptLine.start + 2) + postRoll } : null);
        if (range && time >= range.end) {
          video.currentTime = Math.max(0, range.start);
        }
      }
    };

    const onDurationChange = () => setVideoDuration(video.duration);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, [scriptLines, currentLine, isLooping, customLoop, preRoll, postRoll, currentScriptLine]);

  useEffect(() => {
    if (deviceSettingsOpen) return;
    logAudioStep("microphone-request", {
      captureMode: deviceSettings.voiceCaptureMode,
      inputDeviceId: deviceSettings.inputDeviceId || "default",
      gain: deviceSettings.inputGain,
    });
    requestMicrophone(deviceSettings.voiceCaptureMode, deviceSettings.inputDeviceId)
      .then((state) => {
        setMicState(state);
        setMicReady(true);
        setGain(state, deviceSettings.inputGain);
        logAudioStep("microphone-ready", {
          sampleRate: state.audioContext.sampleRate,
          captureMode: state.captureMode,
        });
      })
      .catch((err) => {
        console.error("Mic error:", err);
        setMicReady(false);
        logAudioStep("microphone-error", { message: String(err?.message || err) });
        toast({ title: "Erro no microfone", description: "Nao foi possivel acessar o audio.", variant: "destructive" });
      });

    return () => {
      releaseMicrophone();
      setMicReady(false);
    };
  }, [deviceSettings.inputDeviceId, deviceSettings.voiceCaptureMode, deviceSettings.inputGain, deviceSettingsOpen, toast, logAudioStep]);

  const startCountdown = useCallback(() => {
    if (recordingStatus !== "idle" || !micState) return;
    logAudioStep("countdown-started", { initiatorUserId: user?.id });
    emitVideoEvent("countdown-start", { initiatorUserId: user?.id });
    
    let count = 3;
    setCountdownValue(count);
    setRecordingStatus("countdown");
    if (micState.audioContext) playCountdownBeep(micState.audioContext);

    const timer = setInterval(() => {
      count -= 1;
      emitVideoEvent("countdown-tick", { count, initiatorUserId: user?.id });
      if (count <= 0) {
        clearInterval(timer);
        setRecordingStatus("recording");
        setCountdownValue(0);
        logAudioStep("capture-starting", { currentLine });
        startCapture(micState);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
          emitVideoEvent("play", { currentTime: videoRef.current.currentTime });
        }
      } else {
        setCountdownValue(count);
        if (micState.audioContext) playCountdownBeep(micState.audioContext);
      }
    }, 1000);
  }, [recordingStatus, emitVideoEvent, user?.id, micState, logAudioStep, currentLine]);

  const handleStopRecording = useCallback(async () => {
    if (recordingStatus !== "recording" || !micState) return;
    logAudioStep("stop-requested", { captureMode: micState.captureMode });
    const result = await stopCapture(micState);
    if (!result.samples.length) {
      toast({ title: "Sem áudio capturado", description: "Nenhum sample foi registrado. Verifique microfone e ganho.", variant: "destructive" });
      setRecordingStatus("idle");
      setLastRecording(null);
      setQualityMetrics(null);
      logAudioStep("stop-empty-buffer");
      return;
    }
    setLastRecording(result);
    setRecordingStatus("recorded");
    if (videoRef.current) {
      videoRef.current.pause();
      emitVideoEvent("pause", { currentTime: videoRef.current.currentTime });
    }

    if (result) {
      const metrics = analyzeTakeQuality(result.samples);
      setQualityMetrics(metrics);
      logAudioStep("quality-analyzed", {
        score: metrics.score,
        clipping: metrics.clipping,
        loudness: metrics.loudness,
        noiseFloor: metrics.noiseFloor,
        sampleRate: result.sampleRate,
      });
    }
  }, [recordingStatus, emitVideoEvent, micState, logAudioStep, toast]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      emitVideoEvent("play", { currentTime: video.currentTime });
    } else {
      video.pause();
      emitVideoEvent("pause", { currentTime: video.currentTime });
    }
  }, [emitVideoEvent]);

  const handleStopPlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = currentScriptLine?.start || 0;
    emitVideoEvent("pause", { currentTime: video.currentTime });
  }, [currentScriptLine, emitVideoEvent]);

  const seek = useCallback((delta: number) => {
    const video = videoRef.current;
    if (!video) return;
    const next = Math.max(0, Math.min(video.duration, video.currentTime + delta));
    video.currentTime = next;
    emitVideoEvent("seek", { currentTime: next });
  }, [emitVideoEvent]);

  const scrub = useCallback((percent: number) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const next = video.duration * percent;
    video.currentTime = next;
    emitVideoEvent("seek", { currentTime: next });
  }, [emitVideoEvent]);

  const handleLineClick = useCallback((index: number) => {
    if (!canTextControl) return;
    const line = scriptLines[index];
    if (!line) return;

    if (loopSelectionMode === "selecting-start") {
      setCustomLoop({ start: line.start, end: line.end || (line.start + 2) });
      setLoopSelectionMode("selecting-end");
      toast({ title: "Inicio selecionado", description: "Clique na fala final do loop." });
    } else if (loopSelectionMode === "selecting-end") {
      setCustomLoop((prev) => ({ start: prev?.start || line.start, end: line.end || (line.start + 2) }));
      setLoopSelectionMode("idle");
      setIsLooping(true);
      toast({ title: "Loop definido", description: "Pressione L para desativar." });
      emitVideoEvent("sync-loop", { loopRange: customLoop });
    } else {
      const video = videoRef.current;
      if (video) {
        video.currentTime = line.start;
        emitVideoEvent("seek", { currentTime: line.start });
      }
      setCurrentLine(index);
    }
  }, [canTextControl, scriptLines, loopSelectionMode, toast, emitVideoEvent, customLoop]);

  const handlePreview = useCallback(() => {
    if (!lastRecording || !previewAudioRef.current) return;
    logAudioStep("preview-started", { sampleCount: lastRecording.samples.length, durationSeconds: lastRecording.durationSeconds });
    const wav = encodeWav(lastRecording.samples);
    const blob = wavToBlob(wav);
    const url = createPreviewUrl(blob);
    previewAudioRef.current.src = url;
    previewAudioRef.current.volume = deviceSettings.monitorVolume;
    previewAudioRef.current.play().catch((err) => {
      logAudioStep("preview-error", { message: String(err?.message || err) });
      toast({ title: "Falha na reprodução", description: "Não foi possível reproduzir o take gravado.", variant: "destructive" });
    });
    setRecordingStatus("previewing");
    
    previewAudioRef.current.onended = () => {
      setRecordingStatus("recorded");
      revokePreviewUrl(url);
      logAudioStep("preview-ended");
    };
  }, [lastRecording, deviceSettings.monitorVolume, logAudioStep, toast]);

  const handleDiscard = useCallback(() => {
    setLastRecording(null);
    setQualityMetrics(null);
    setRecordingStatus("idle");
  }, []);

  const handleSaveTake = useCallback(async () => {
    if (isSaving) return;
    if (!lastRecording) {
      toast({ title: "Nenhum take para salvar", description: "Grave um take antes de salvar.", variant: "destructive" });
      return;
    }
    if (!recordingProfile) {
      setShowProfilePanel(true);
      toast({ title: "Perfil de gravação pendente", description: "Defina ator e personagem antes de salvar.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      logAudioStep("encoding-wav", {
        sampleCount: lastRecording.samples.length,
        durationSeconds: lastRecording.durationSeconds,
      });
      const wav = encodeWav(lastRecording.samples);
      const blob = wavToBlob(wav);
      
      const formData = new FormData();
      formData.append("audio", blob, "take.wav");
      formData.append("characterId", recordingProfile.characterId);
      formData.append("characterName", recordingProfile.characterName);
      formData.append("lineIndex", String(currentLine));
      formData.append("durationSeconds", String(lastRecording.durationSeconds));
      formData.append("voiceActorId", recordingProfile.voiceActorId);
      formData.append("voiceActorName", recordingProfile.voiceActorName);
      formData.append("isDone", "true");
      formData.append("sampleRate", String(lastRecording.sampleRate || 48000));
      if (qualityMetrics?.score !== undefined && qualityMetrics?.score !== null) {
        formData.append("qualityScore", String(qualityMetrics.score));
      }
      if (currentScriptLine) {
        formData.append("startTimeSeconds", String(currentScriptLine.start));
        formData.append("timecode", formatTimecode(currentScriptLine.start));
      }

      const savedTake = await authFetch(`/api/sessions/${sessionId}/takes`, {
        method: "POST",
        body: formData,
      });
      logAudioStep("save-success", {
        takeId: savedTake?.id,
        lineIndex: currentLine,
        durationSeconds: lastRecording.durationSeconds,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "takes"] });
      toast({ title: "Take salvo com sucesso!" });
      handleDiscard();
    } catch (err: any) {
      logAudioStep("save-error", { message: err.message });
      toast({ title: "Erro ao salvar take", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [lastRecording, recordingProfile, currentLine, sessionId, queryClient, toast, handleDiscard, isSaving, qualityMetrics, currentScriptLine, logAudioStep]);

  const handleDownloadTake = useCallback(async (take: any) => {
    try {
      const response = await fetch(`/api/takes/${take.id}/stream`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Falha no download (${response.status})`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `take_${take.characterName}_${take.lineIndex}.wav`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      toast({ title: "Erro ao baixar take", variant: "destructive" });
    }
  }, [toast]);

  const handleChangeCharacter = (charId: string) => {
    const char = charactersList?.find((c) => c.id === charId);
    if (char && recordingProfile) {
      const next = { ...recordingProfile, characterId: char.id, characterName: char.name };
      setRecordingProfile(next);
      localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(next));
    }
  };

  const handleSaveProfile = (profile: RecordingProfile) => {
    setRecordingProfile(profile);
    localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(profile));
    setShowProfilePanel(false);
  };

  const deleteTakeMutation = useMutation({
    mutationFn: (takeId: string) => authFetch(`/api/takes/${takeId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "takes"] });
      toast({ title: "Take excluido" });
    },
    onError: (err: any) => toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const code = e.code;
      if (code === shortcuts.playPause) { e.preventDefault(); handlePlayPause(); }
      else if (code === shortcuts.record) { e.preventDefault(); if (recordingStatus === "idle") startCountdown(); }
      else if (code === shortcuts.stop) { e.preventDefault(); if (recordingStatus === "recording") handleStopRecording(); else handleStopPlayback(); }
      else if (code === shortcuts.back) { e.preventDefault(); seek(-2); }
      else if (code === shortcuts.forward) { e.preventDefault(); seek(2); }
      else if (code === shortcuts.loop) { e.preventDefault(); setIsLooping((v) => !v); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, handlePlayPause, handleStopRecording, handleStopPlayback, recordingStatus, startCountdown, seek, isLooping]);

  if (sessionLoading || productionLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Sincronizando estúdio...</p>
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
            <button className="mt-2 vhub-btn-sm vhub-btn-primary" data-testid="button-go-sessions">
              Ir para Sessoes
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
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat opacity-[0.02] dark:opacity-[0.05]"></div>
      </div>

      {countdownValue > 0 && (prerollInitiatorUserId === user?.id || isDirector) && (
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
                      ? { border: "1px solid hsl(var(--primary))", background: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }
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
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/70 backdrop-blur-md">
          <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[520px] overflow-hidden border border-border/70 bg-card/95 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
              <span className="text-sm font-semibold text-foreground">Takes da Sessao</span>
              <button
                onClick={() => {
                  setTakesPopupOpen(false);
                  if (takePreviewAudioRef.current) {
                    takePreviewAudioRef.current.pause();
                    takePreviewAudioRef.current.currentTime = 0;
                  }
                  setTakePreviewId(null);
                }}
                className="transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-close-takes-popup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <audio ref={takePreviewAudioRef} preload="none" />
              <div className="flex flex-col gap-2 max-h-[420px] overflow-y-auto pr-1">
                {(isPrivileged ? takesList : takesList.filter((t: any) => t.voiceActorId === user?.id || t.userId === user?.id)).map((take: any) => (
                  <div key={take.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/75 border border-border/70">
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
                        audio.volume = deviceSettings.monitorVolume;
                        audio.src = `/api/takes/${take.id}/stream`;
                        audio.play().catch((err) => {
                          logAudioStep("take-preview-error", { takeId: take.id, message: String(err?.message || err) });
                          toast({ title: "Falha ao reproduzir take", variant: "destructive" });
                          setTakePreviewId(null);
                        });
                        audio.onended = () => setTakePreviewId(null);
                      }}
                      className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors bg-muted/60 text-foreground hover:bg-muted"
                      data-testid={`button-play-take-${take.id}`}
                    >
                      {takePreviewId === take.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono tabular-nums text-muted-foreground">#{take.lineIndex}</span>
                        <span className="text-xs font-medium truncate text-foreground">{take.characterName || "Take"}</span>
                        <span className="ml-auto text-xs font-mono text-muted-foreground">{take.durationSeconds ? `${Number(take.durationSeconds).toFixed(1)}s` : ""}</span>
                      </div>
                      {isPrivileged && (
                        <div className="text-[10px] truncate mt-0.5 text-muted-foreground">
                          {take.voiceActorName || take.userName || take.userId || take.voiceActorId}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDownloadTake(take)}
                      className="p-2 rounded-lg transition-colors text-muted-foreground bg-muted/60 hover:text-foreground hover:bg-muted"
                      title="Baixar take"
                      data-testid={`button-download-take-popup-${take.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {takesList.length === 0 && (
                  <div className="text-sm text-center py-10 text-muted-foreground">
                    Nenhum take gravado nesta sessao
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {textControlPopupOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-sm">
          <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[520px] overflow-hidden bg-popover/95 backdrop-blur-xl border border-border/50 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/10">
              <span className="text-sm font-semibold text-foreground">Controle de Texto</span>
              <button
                onClick={() => setTextControlPopupOpen(false)}
                className="transition-colors text-muted-foreground hover:text-foreground"
                data-testid="button-close-text-control"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Autorizacao (Alunos / Dubladores)</span>
                <button
                  onClick={() => {
                    const ok = window.confirm("Revogar permissoes temporarias e remover autorizacoes de controle de texto?");
                    if (!ok) return;
                    emitVideoEvent("revoke-all", {});
                    emitTextControlEvent("text-control:set-controllers", { targetUserIds: [] });
                    setControlPermissions(new Set());
                    setGlobalControlEnabled(false);
                    setTextControllerUserIds(new Set());
                    setPendingTextControllerUserIds(new Set());
                    setTextControlPopupOpen(false);
                  }}
                  className="text-[9px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors uppercase font-bold"
                  data-testid="button-revoke-all-text-control"
                >
                  Revogar tudo
                </button>
              </div>

              <div className="text-[11px] mb-3 text-muted-foreground">
                Autorizados:{" "}
                <span className="text-foreground/80">
                  {(() => {
                    const roster = (presenceUsers.length
                      ? presenceUsers
                      : (session?.participants || []).map((p: any) => ({ userId: p.userId, name: p.user?.fullName || p.user?.displayName || p.user?.email || "Usuario", role: p.role }))
                    );
                    const names = roster
                      .filter((u: any) => pendingTextControllerUserIds.has(u.userId))
                      .map((u: any) => u.name || "Usuario");
                    return names.length ? names.join(", ") : "Nenhum";
                  })()}
                </span>
              </div>

              <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
                {(() => {
                  const roster = (presenceUsers.length
                    ? presenceUsers
                    : (session?.participants || []).map((p: any) => ({ userId: p.userId, name: p.user?.fullName || p.user?.displayName || p.user?.email || "Usuario", role: p.role }))
                  );
                  const eligible = roster.filter((p: any) => {
                    const r = String(p.role || "").toLowerCase();
                    return r === "aluno" || r === "dublador" || r === "voice_actor" || r === "student";
                  });
                  if (!eligible.length) {
                    return (
                      <div className="text-sm text-center py-10 text-muted-foreground/40">
                        Nenhum aluno ou dublador conectado
                      </div>
                    );
                  }
                  return eligible.map((p: any) => {
                    const checked = pendingTextControllerUserIds.has(p.userId);
                    return (
                      <label
                        key={p.userId}
                        className="flex items-center justify-between text-xs rounded-lg px-3 py-2 cursor-pointer bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-[10px] font-bold shrink-0 text-primary">
                            {String(p.name || "?")[0] || "?"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="truncate text-foreground/80">{p.name || "Usuario"}</span>
                              {checked && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/15 uppercase shrink-0 text-primary">
                                  Autorizado
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] uppercase text-muted-foreground/50">
                              {String(p.role || "").replace(/_/g, " ") || "participante"}
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setPendingTextControllerUserIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(p.userId)) next.delete(p.userId);
                              else next.add(p.userId);
                              return next;
                            });
                          }}
                          className="h-4 w-4 accent-primary"
                          data-testid={`checkbox-text-controller-${p.userId}`}
                        />
                      </label>
                    );
                  });
                })()}
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setTextControlPopupOpen(false)}
                  className="vhub-btn-xs vhub-btn-secondary"
                  data-testid="button-cancel-text-control"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    const targetUserIds = Array.from(pendingTextControllerUserIds);
                    setTextControllerUserIds(new Set(targetUserIds));
                    emitTextControlEvent("text-control:set-controllers", { targetUserIds });
                    setTextControlPopupOpen(false);
                  }}
                  className="vhub-btn-xs vhub-btn-primary"
                  data-testid="button-apply-text-control"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <audio ref={previewAudioRef} preload="none" />

      <header className="shrink-0 flex items-center justify-between px-3 h-12 sm:h-14 relative z-20" style={{ background: "hsl(var(--background) / 0.90)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", borderBottom: "1px solid hsl(var(--border) / 0.9)" }}>
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs sm:text-sm truncate text-foreground">{production?.name || "Sessao"}</span>
            <span className="text-[10px] text-muted-foreground truncate">{session?.title}</span>
          </div>
          
          {recordingProfile && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 ml-2 group cursor-pointer hover:bg-white/10 transition-all relative" onClick={() => setCharSelectorOpen(!charSelectorOpen)}>
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">
                {recordingProfile.characterName[0]}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-foreground leading-tight">{recordingProfile.characterName}</span>
                <span className="text-[9px] text-muted-foreground leading-tight">{recordingProfile.voiceActorName}</span>
              </div>
              <ChevronRight className={cn("w-3 h-3 text-muted-foreground transition-transform", charSelectorOpen && "rotate-90")} />
              
              <AnimatePresence>
                {charSelectorOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-full left-0 mt-2 w-56 rounded-2xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl p-2 z-[100]"
                  >
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground px-3 py-2 border-b border-border/50 mb-1">Trocar Personagem</div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {charactersList?.map((char) => (
                        <button
                          key={char.id}
                          onClick={(e) => { e.stopPropagation(); handleCharacterChange(char); }}
                          className={cn(
                            "w-full flex items-center gap-3 p-2 rounded-xl transition-all hover:bg-primary/10 text-left",
                            recordingProfile.characterId === char.id ? "bg-primary/10 border border-primary/20" : "border border-transparent"
                          )}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                            {char.name[0]}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-foreground truncate">{char.name}</span>
                            <span className="text-[10px] text-muted-foreground truncate">{char.voiceActorId ? "Ocupado" : "Disponivel"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          {recordingStatus === "recording" && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 animate-pulse">
              <Circle className="w-2 h-2 fill-current" /> <span className="hidden xs:inline">REC</span>
            </div>
          )}
          
          {isMobile ? (
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Menu principal"
            >
              <Menu className="w-5 h-5" />
            </button>
          ) : (
            <>
              <div className="flex items-center gap-1.5 border-r border-border/60 pr-3 mr-1">
                <Link href="/hub-dub/studios">
                  <button className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-white/5" data-testid="button-room-switch-studio">
                    <Building2 className="h-3 w-3" />
                    <span className="hidden lg:inline">Trocar Estúdio</span>
                  </button>
                </Link>
                <button 
                  onClick={() => logout()}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-red-500 transition-colors px-2 py-1 rounded-md hover:bg-red-500/5" 
                  data-testid="button-room-logout"
                >
                  <LogOut className="h-3 w-3" />
                  <span className="hidden lg:inline">Sair</span>
                </button>
              </div>
              <ThemeToggle />
              <button
                onClick={() => setDeviceSettingsOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Configurações de dispositivos"
                data-testid="button-open-device-settings"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setIsCustomizing(true); setPendingShortcuts(shortcuts); }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Atalhos de teclado"
                data-testid="button-open-shortcuts"
              >
                <Settings className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <div className={cn(
        "flex-1 grid overflow-hidden",
        isMobile ? "grid-cols-1" : "grid-cols-[1.25fr_0.75fr]"
      )}>
        <div className="flex flex-col min-h-0 relative">
          <div className="flex-1 flex flex-col min-h-0 bg-black/20">
          <div className={cn(
            "flex-1 min-h-[200px] relative overflow-hidden rounded-2xl border border-border/60 bg-background/80",
              isMobile ? "m-0 rounded-none border-none" : "m-2"
            )}>
              {production?.videoUrl ? (
                <video
                  ref={videoRef}
                  src={production.videoUrl}
                  className="w-full h-full object-contain touch-none"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTouchStart={handleVideoTouchStart}
                  onTouchMove={handleVideoTouchMove}
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

              <AnimatePresence>
                {volumeOverlay !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-black/60 backdrop-blur px-4 py-3 rounded-2xl border border-white/10 z-20 pointer-events-none"
                  >
                    <Volume2 className="w-6 h-6 text-primary" />
                    <span className="text-xs font-bold font-mono tracking-widest">{volumeOverlay}%</span>
                  </motion.div>
                )}
                {speedOverlay !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 bg-black/60 backdrop-blur px-4 py-3 rounded-2xl border border-white/10 z-20 pointer-events-none"
                  >
                    <Play className="w-6 h-6 text-primary" />
                    <span className="text-xs font-bold font-mono tracking-widest">{speedOverlay.toFixed(2)}x</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {currentScriptLine && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-10 sm:pt-16 pb-4 sm:pb-6 px-4 sm:px-8">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-mono text-blue-300/90 bg-black/50 px-1.5 py-0.5 rounded">
                      {formatTimecode(currentScriptLine.start)}
                    </span>
                    <span className="text-[11px] sm:text-xs font-semibold text-blue-300 uppercase tracking-widest">
                      {currentScriptLine.character}
                    </span>
                  </div>
                  <p className="text-white text-[16px] sm:text-lg font-light leading-snug max-w-[90%]">
                    {currentScriptLine.text}
                  </p>
                </div>
              )}

              <button
                onClick={() => setIsMuted((m) => !m)}
                className="absolute top-3 right-3 p-2 rounded-xl bg-background/80 text-muted-foreground hover:text-foreground transition-all hover:bg-background"
                aria-label={isMuted ? "Ativar som" : "Desativar som"}
                data-testid="button-mute"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>

            {videoDuration > 0 && (
              <div className="px-3 sm:px-5 py-2 bg-muted/30 border-t border-border/70">
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                  <span>{formatTimecode(videoTime)}</span>
                  <div className="flex-1 relative h-1.5 rounded-full cursor-pointer group bg-border/60" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    scrub((e.clientX - rect.left) / rect.width);
                  }}>
                    {scriptLines.map((line, i) => (
                      <div
                        key={i}
                        className={cn(
                          "absolute top-0 bottom-0 rounded-sm transition-all",
                          savedTakes.has(i) ? "bg-emerald-400/70" :
                          i === currentLine ? "bg-blue-400/70" :
                          "bg-white/15"
                        )}
                        style={{
                          left: `${(line.start / videoDuration) * 100}%`,
                          width: `${Math.max(0.5, ((line.end! - line.start) / videoDuration) * 100)}%`,
                        }}
                      />
                    ))}
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full shadow-md"
                      style={{ left: `${(videoTime / videoDuration) * 100}%`, transform: "translate(-50%,-50%)", background: "hsl(var(--primary))", border: "2px solid rgba(255,255,255,0.80)", boxShadow: "0 0 8px rgba(245,158,11,0.4)" }}
                    />
                  </div>
                  <span>{formatTimecode(videoDuration)}</span>
                </div>
              </div>
            )}

            <div className="shrink-0 px-3 sm:px-5 py-4 sm:py-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-0 bg-card/70 backdrop-blur-xl border-t border-border/70">
              <div className="hidden sm:flex w-56 shrink-0 flex-col justify-center gap-1 py-3">
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

              <div className="w-full flex items-center justify-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button
                    onClick={() => seek(-2)}
                    className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all bg-muted/60 text-muted-foreground hover:text-foreground"
                    aria-label="Recuar 2 segundos"
                    data-testid="button-back-2s"
                  >
                    <RotateCcw className="w-5 h-5" />
                  </button>

                  <button
                    onClick={handlePlayPause}
                    className="w-12 h-12 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all bg-primary text-primary-foreground shadow-lg"
                    aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                    data-testid="button-play-pause"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
                  </button>

                  <button
                    onClick={recordingStatus === "recording" ? handleStopRecording : handleStopPlayback}
                    className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all bg-muted/60 text-muted-foreground hover:text-foreground"
                    aria-label="Parar"
                    data-testid="button-stop"
                  >
                    <Square className="w-5 h-5" />
                  </button>
                </div>

                <div className="w-px h-8 bg-border/80" />

                {recordingStatus === "idle" || recordingStatus === "countdown" ? (
                  <button
                    onClick={startCountdown}
                    disabled={!micReady || recordingStatus === "countdown"}
                    className={cn(
                      "w-14 h-14 rounded-full flex items-center justify-center transition-all disabled:opacity-30",
                      recordingStatus === "countdown" ? "bg-amber-500/20 border border-amber-500/40 animate-pulse" : "bg-white/[0.08] border border-white/[0.15]"
                    )}
                    aria-label="Gravar"
                    data-testid="button-record"
                  >
                    <Mic className="w-6 h-6" />
                  </button>
                ) : recordingStatus === "recording" ? (
                  <button
                    onClick={handleStopRecording}
                    className="w-14 h-14 rounded-full flex items-center justify-center transition-all bg-red-500 shadow-[0_0_24px_rgba(239,68,68,0.4)]"
                    aria-label="Parar gravação"
                    data-testid="button-stop-recording"
                  >
                    <Square className="w-6 h-6 text-white fill-white" />
                  </button>
                ) : (
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button
                      onClick={handlePreview}
                      className={cn(
                        "w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all",
                        recordingStatus === "previewing" ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(245,158,11,0.3)]" : "bg-muted/60 border border-border/70 text-foreground"
                      )}
                      aria-label="Ouvir take"
                      data-testid="button-preview"
                    >
                      <Headphones className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleSaveTake}
                      disabled={isSaving}
                      className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-emerald-600 text-white shadow-[0_0_16px_rgba(16,185,129,0.3)] disabled:opacity-50"
                      aria-label="Salvar take"
                      data-testid="button-save-take"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleDiscard}
                      className="w-11 h-11 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-red-500/10 text-red-500/70 border border-red-500/20"
                      aria-label="Descartar take"
                      data-testid="button-discard-take"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {!isMobile && (
                  <>
                    <div className="w-px h-8 bg-white/[0.1]" />
                    <button
                      onClick={() => seek(2)}
                      className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-muted/60 text-muted-foreground hover:text-foreground"
                      aria-label="Avançar 2 segundos"
                      data-testid="button-forward-2s"
                    >
                      <RotateCw className="w-5 h-5" />
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
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                        isLooping || loopSelectionMode !== "idle" ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted/60 text-muted-foreground"
                      )}
                      aria-label="Alternar loop"
                      data-testid="button-loop"
                    >
                      <Repeat className="w-5 h-5" />
                    </button>
                  </>
                )}
              </div>

              {!isMobile && (
                <div className="w-44 shrink-0 flex flex-col items-end gap-1.5 py-3">
                  {isLooping && (
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1.5 text-[10px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                        <span>Pre-roll</span>
                        <div className="flex gap-0.5">
                          {[0.5, 1, 2, 3].map((v) => (
                            <button
                              key={v}
                              onClick={() => setPreRoll(v)}
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] transition-colors",
                                preRoll === v ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/[0.05] text-white/50"
                              )}
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
                              className={cn(
                                "px-1.5 py-0.5 rounded text-[10px] transition-colors",
                                postRoll === v ? "bg-primary/20 text-primary border border-primary/30" : "bg-white/[0.05] text-white/50"
                              )}
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
              )}
            </div>
          </div>
        </div>

        {!isMobile && (
          <div className="flex flex-col min-h-0 bg-card/40">
            <div className="h-11 shrink-0 px-5 flex items-center justify-between border-b border-border/70 bg-muted/30">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Roteiro
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setScriptAutoFollow(true); syncScrollToCurrentVideoTime(); }}
                  className={cn(
                    "text-[10px] px-2 py-1 rounded-full transition-colors border",
                    scriptAutoFollow ? "bg-primary/15 text-primary border-primary/25" : "bg-muted/60 text-muted-foreground border-border/70"
                  )}
                  data-testid="button-script-follow"
                >
                  {scriptAutoFollow ? "AUTO" : "SEGUIR"}
                </button>
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono text-foreground">{currentLine + 1}</span>
                  {" "}/{" "}
                  {scriptLines.length}
                </span>
              </div>
            </div>

            <div
              ref={scriptViewportRef}
              className="flex-1 overflow-y-auto py-3 px-4 min-h-0 relative"
              onWheelCapture={markScriptUserScrollIntent}
              onTouchMoveCapture={markScriptUserScrollIntent}
              onPointerDownCapture={markScriptUserScrollIntent}
              onScrollCapture={() => {
                scrollSyncCurrentRef.current = scriptViewportRef.current?.scrollTop || 0;
              }}
            >
              {scriptLines.map((line, i) => {
                const isActive = i === currentLine;
                const isDone = savedTakes.has(i);
                const isInLoop = customLoop && line.start >= customLoop.start && (line.end || line.start) <= customLoop.end;
                return (
                  <div
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    onClick={canTextControl ? (() => handleLineClick(i)) : undefined}
                    className={cn(
                      "mb-3 px-5 py-4 rounded-xl transition-all duration-300 relative overflow-hidden",
                      isActive ? "bg-background/85 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)] backdrop-blur-md" : (isInLoop ? "bg-primary/5 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.16)]" : "bg-transparent"),
                      canTextControl ? "cursor-pointer" : "cursor-default"
                    )}
                    data-testid={`script-line-${i}`}
                  >
                    {isInLoop && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500/40" />}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[16px] font-mono tabular-nums text-muted-foreground">{formatTimecode(line.start)}</span>
                      <span className={cn("text-[24px] font-extrabold uppercase tracking-tight", isActive ? "text-primary" : "text-muted-foreground")}>
                        {line.character}
                      </span>
                      {isDone && <CheckCircle2 className="ml-auto w-5 h-5 text-emerald-500" />}
                    </div>
                    <p className={cn("text-[22px] leading-relaxed", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {lineEdits[i] ?? line.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isMobile && (
          <>
            {/* Mobile Sidebar / Menu Drawer */}
            <Drawer.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" />
                <Drawer.Content className="bg-zinc-950 flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-[120] outline-none max-h-[90vh]">
                  <div className="p-6 pb-12 overflow-y-auto">
                    <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
                    <h2 className="text-xl font-bold mb-6">Menu do Estúdio</h2>
                    
                    <div className="space-y-4">
                      <button
                        onClick={() => { setDeviceSettingsOpen(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Monitor className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm">Dispositivos</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">Configurar Áudio</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>

                      <button
                        onClick={() => { setShowProfilePanel(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm">Perfil de Gravação</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">Ator & Personagem</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>

                      <button
                        onClick={() => { setTakesPopupOpen(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                            <Save className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm">Takes Salvos</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">{takesList.length} arquivos</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>

                      <div className="pt-4 mt-4 border-t border-white/[0.06]">
                        <button
                          onClick={() => setMobileMenuOpen(false)}
                          className="w-full p-4 rounded-xl bg-white/5 text-white/60 font-medium text-sm"
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  </div>
                </Drawer.Content>
              </Drawer.Portal>
            </Drawer.Root>

            {/* Script Toggle Button (Floating) */}
            <button
              onClick={() => setScriptOpen(true)}
              className="fixed bottom-20 left-5 h-12 w-12 rounded-full flex items-center justify-center shadow-lg z-[90] bg-zinc-900/80 backdrop-blur-md border border-white/10 text-white"
              aria-label="Abrir roteiro"
            >
              <Edit3 className="w-5 h-5" />
            </button>

            {/* Mobile Script Drawer */}
            <Drawer.Root open={scriptOpen} onOpenChange={setScriptOpen}>
              <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" />
                <Drawer.Content className="bg-zinc-950 flex flex-col rounded-t-[32px] h-[85vh] fixed bottom-0 left-0 right-0 z-[120] outline-none">
                  <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 mb-8" />
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">Roteiro</h2>
                      <button onClick={() => setScriptOpen(false)} className="p-2 rounded-full bg-white/5 text-white/40" aria-label="Fechar roteiro">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-20">
                      {scriptLines.map((line, i) => {
                        const isActive = i === currentLine;
                        const isDone = savedTakes.has(i);
                        return (
                          <div
                            key={i}
                            onClick={() => { handleLineClick(i); setScriptOpen(false); }}
                            className={cn(
                              "mb-4 px-6 py-5 rounded-2xl transition-all border",
                              isActive ? "bg-primary/10 border-primary/25 shadow-lg shadow-primary/5" : "bg-white/[0.03] border-white/[0.06]"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-[11px] font-mono text-white/30">{formatTimecode(line.start)}</span>
                              <span className={cn("text-sm font-bold uppercase tracking-widest", isActive ? "text-primary" : "text-white/40")}>
                                {line.character}
                              </span>
                              {isDone && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-500" />}
                            </div>
                            <p className={cn("text-[17px] leading-relaxed", isActive ? "text-white font-medium" : "text-white/50")}>
                              {lineEdits[i] ?? line.text}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Drawer.Content>
              </Drawer.Portal>
            </Drawer.Root>
          </>
        )}
      </AnimatePresence>

      <DailyMeetPanel sessionId={sessionId} />
    </div>
  );
}

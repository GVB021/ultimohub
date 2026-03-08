import { useParams, Link } from "wouter";
import { useState, useEffect, useRef, useCallback } from "react";
import { authFetch } from "@/lib/auth-fetch";
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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatTimecode, parseTimecode } from "@/lib/timecode";

import {
  requestMicrophone,
  releaseMicrophone,
  setGain,
  type MicrophoneState,
  type VoiceCaptureMode,
} from "@/lib/audio/microphoneManager";
import MonitorPanel from "@/components/audio/MonitorPanel";


import {
  startCapture,
  stopCapture,
  createPreviewUrl,
  revokePreviewUrl,
  playCountdownBeep,
  type RecordingStatus,
  type RecordingResult,
} from "@/lib/audio/recordingEngine";
import { encodeWav, wavToBlob, getDurationSeconds } from "@/lib/audio/wavEncoder";
import { analyzeTakeQuality, type QualityMetrics } from "@/lib/audio/qualityAnalysis";

function JitsiMeetPanel({ roomId, displayName }: { roomId: string; displayName: string }) {
  const [isOpen, setIsOpen] = useState(true);

  const jitsiRoom = `vhub-session-${roomId}`.replace(/[^a-zA-Z0-9-]/g, "-");
  const jitsiUrl = [
    `https://meet.jit.si/${jitsiRoom}`,
    `#config.startWithAudioMuted=false`,
    `&config.startWithVideoMuted=true`,
    `&config.prejoinPageEnabled=false`,
    `&config.disableDeepLinking=true`,
    `&config.enableWelcomePage=false`,
    `&config.toolbarButtons=["microphone","hangup","tileview","fullscreen"]`,
    `&userInfo.displayName="${encodeURIComponent(displayName)}"`,
  ].join("");

  return (
    <div className="mt-4 border border-zinc-200 rounded-xl overflow-hidden" data-testid="panel-jitsi">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-100 bg-zinc-50">
        <span className="text-xs font-medium text-zinc-600 flex items-center gap-1.5">
          <Mic className="w-3 h-3 text-green-500" /> Chat de Voz — Sala {jitsiRoom.slice(-6)}
        </span>
        <button
          onClick={() => setIsOpen(v => !v)}
          className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors flex items-center gap-1"
          data-testid="button-toggle-jitsi"
        >
          {isOpen ? <><X className="w-3 h-3" /> Minimizar</> : <><Mic className="w-3 h-3" /> Abrir</>}
        </button>
      </div>
      {isOpen && (
        <iframe
          src={jitsiUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          className="w-full"
          style={{ height: "360px", border: "none" }}
          data-testid="iframe-jitsi-meet"
          title="Jitsi Meet Voice Chat"
        />
      )}
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
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col items-center gap-4">
        <div className="w-24 h-24 rounded-full border-4 border-red-400/40 flex items-center justify-center">
          <span className="text-6xl font-light text-red-400 font-mono tabular-nums">{count}</span>
        </div>
        <span className="text-xs text-zinc-400 uppercase tracking-widest">Gravando em...</span>
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
}

function DeviceSettingsPanel({
  open,
  onClose,
  settings,
  onSettingsChange,
}: {
  open: boolean;
  onClose: () => void;
  settings: DeviceSettings;
  onSettingsChange: (s: DeviceSettings) => void;
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    if (!open) return;
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      setDevices(devs);
    });
  }, [open]);

  if (!open) return null;

  const mics = devices.filter((d) => d.kind === "audioinput");
  const speakers = devices.filter((d) => d.kind === "audiooutput");

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-[400px] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <span className="text-sm font-semibold text-zinc-900">Configuracoes de Dispositivo</span>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
            data-testid="button-close-device-settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-5">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2 block">Microfone</label>
            <select
              className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900"
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
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2 block">Alto-falante</label>
            <select
              className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900"
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
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Ganho de Entrada</label>
                <span className="text-xs text-zinc-500 font-mono">{Math.round(settings.inputGain * 100)}%</span>
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
                className="w-full h-1.5 accent-blue-600"
                data-testid="slider-input-gain"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">Volume do Monitor</label>
                <span className="text-xs text-zinc-500 font-mono">{Math.round(settings.monitorVolume * 100)}%</span>
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
                className="w-full h-1.5 accent-blue-600"
                data-testid="slider-monitor-volume"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-2 block">Modo de Captura de Voz</label>
            <select
              value={settings.voiceCaptureMode}
              onChange={(e) => onSettingsChange({ ...settings, voiceCaptureMode: e.target.value as VoiceCaptureMode })}
              className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900"
              data-testid="select-voice-capture-mode"
            >
              <option value="studio">Studio Mode (Isolamento de Voz)</option>
              <option value="original">Original Microphone (Som Natural)</option>
            </select>
            <p className="text-[10px] text-zinc-400 mt-1.5">
              {settings.voiceCaptureMode === "studio"
                ? "Filtro passa-alta 80Hz + compressor + reducao de ruido. Ideal para estudio."
                : "Captura crua sem processamento. Audio exatamente como o microfone capta."}
            </p>
          </div>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
              data-testid="button-apply-device-settings"
            >
              Aplicar
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

  const selectedChar = characters.find((c) => c.id === selectedCharId);
  const hasCharacters = characters.length > 0;

  const handleSubmit = () => {
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
      onSave({
        voiceActorName: actorName.trim(),
        characterName: freeCharName.trim(),
        characterId: "manual",
        voiceActorId: user?.id || "",
        userId: user?.id || "",
        sessionId,
        productionId,
      });
    }
  };

  const canSubmit = actorName.trim() && (hasCharacters ? !!selectedCharId : freeCharName.trim());

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-[440px] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-zinc-900">Perfil de Gravacao</span>
          </div>
          {onClose && (
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors" data-testid="button-close-profile">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <p className="text-xs text-zinc-500">
            Configure seu perfil antes de gravar. Estes dados serao usados automaticamente em todos os takes.
          </p>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-1.5 block">
              Nome do Dublador
            </label>
            <input
              type="text"
              value={actorName}
              onChange={(e) => setActorName(e.target.value)}
              placeholder="Seu nome artistico"
              className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              data-testid="input-actor-name"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500 mb-1.5 block">
              Personagem
            </label>
            {hasCharacters ? (
              <select
                value={selectedCharId}
                onChange={(e) => setSelectedCharId(e.target.value)}
                className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
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
                className="w-full h-9 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                data-testid="input-character-name"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1 block">ID Usuario</label>
              <div className="h-8 rounded-lg bg-zinc-100 px-3 flex items-center text-xs text-zinc-500 font-mono truncate" data-testid="text-user-id">
                {user?.id?.slice(0, 12)}...
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-400 mb-1 block">Sessao</label>
              <div className="h-8 rounded-lg bg-zinc-100 px-3 flex items-center text-xs text-zinc-500 font-mono truncate" data-testid="text-session-id">
                {sessionId?.slice(0, 12)}...
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-save-profile"
          >
            Iniciar Gravacao
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
      return saved ? JSON.parse(saved) : null;
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
        end: sorted[i + 1]?.start ?? line.start + 10,
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
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const state = await requestMicrophone(deviceSettings.voiceCaptureMode);
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
    localStorage.setItem("vhub_device_settings", JSON.stringify(deviceSettings));
  }, [deviceSettings]);

  const prevCaptureModeRef = useRef(deviceSettings.voiceCaptureMode);
  useEffect(() => {
    if (deviceSettings.voiceCaptureMode === prevCaptureModeRef.current) return;
    const previousMode = prevCaptureModeRef.current;
    prevCaptureModeRef.current = deviceSettings.voiceCaptureMode;
    if (recordingStatus === "recording") return;
    (async () => {
      try {
        const state = await requestMicrophone(deviceSettings.voiceCaptureMode);
        setGain(state, deviceSettings.inputGain);
        setMicState(state);
        setMicReady(true);
        toast({
          title: "Modo de captura alterado",
          description: deviceSettings.voiceCaptureMode === "studio"
            ? "Studio Mode — filtros de voz ativados"
            : "Original Microphone — captura crua",
        });
      } catch {
        prevCaptureModeRef.current = previousMode;
        try {
          const fallback = await requestMicrophone(previousMode);
          setGain(fallback, deviceSettings.inputGain);
          setMicState(fallback);
          setMicReady(true);
          setDeviceSettings((prev) => ({ ...prev, voiceCaptureMode: previousMode }));
          toast({
            title: "Erro ao trocar modo de captura",
            description: "Microfone restaurado no modo anterior.",
            variant: "destructive",
          });
        } catch {
          toast({
            title: "Erro critico no microfone",
            description: "Nao foi possivel reinicializar o microfone. Recarregue a pagina.",
            variant: "destructive",
          });
          setMicReady(false);
        }
      }
    })();
  }, [deviceSettings.voiceCaptureMode, recordingStatus, toast]);

  useEffect(() => {
    if (!recordingProfile && session?.productionId && !sessionLoading && !productionLoading) {
      setShowProfilePanel(true);
    }
  }, [recordingProfile, session?.productionId, sessionLoading, productionLoading]);

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

      if (isLooping && idx !== -1) {
        const line = scriptLines[idx];
        const loopStart = Math.max(0, line.start - preRoll);
        const loopEnd = (line.end ?? line.start) + postRoll;
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
    const el = lineRefs.current[currentLine];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [currentLine]);

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

  const emitVideoEvent = useCallback((_event: string, _data: any) => {
    // Video sync removed - using Jitsi Meet for communication
  }, []);

  const playVideo = useCallback(() => {
    if (!videoRef.current) return;
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
    if (!videoRef.current || !videoDuration) return;
    const t = fraction * videoDuration;
    videoRef.current.currentTime = t;
    emitVideoEvent("video-seek", { currentTime: t });
  }, [videoDuration, emitVideoEvent]);

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
        setRecordingStatus("recording");
        startCapture(micState);
        playVideo();
        console.log("[Room] Recording started — video playing");
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
      const wavBuffer = encodeWav(lastRecording.samples);
      const blob = wavToBlob(wavBuffer);
      const durationSeconds = getDurationSeconds(lastRecording.samples);
      const token = localStorage.getItem("vhub_token");

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      const cleanName = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "");
      const fileName = `${cleanName(recordingProfile.characterName)}_${cleanName(recordingProfile.voiceActorName)}_${hh}-${mm}-${ss}.wav`;

      console.log("[SaveTake] Saving with profile:", {
        character: recordingProfile.characterName,
        actor: recordingProfile.voiceActorName,
        lineIndex: currentLine,
        durationSeconds,
        fileName,
      });

      const formData = new FormData();
      formData.append("audio", blob, fileName);
      formData.append(
        "metadata",
        JSON.stringify({
          characterId: recordingProfile.characterId,
          voiceActorId: recordingProfile.voiceActorId,
          voiceActorName: recordingProfile.voiceActorName,
          characterName: recordingProfile.characterName,
          lineIndex: currentLine,
          durationSeconds,
          qualityScore: qualityMetrics?.score || 0,
        })
      );

      const response = await fetch(`/api/sessions/${sessionId}/takes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
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
  }, [lastRecording, previewUrl, isSaving, currentLine, sessionId, qualityMetrics, recordingProfile, cleanupPreview, refetchTakes, toast]);

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
      <div className="h-screen w-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-zinc-200 border-t-blue-500 animate-spin" />
          <p className="text-sm text-zinc-500">Carregando sala de gravacao...</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="h-screen w-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <AlertCircle className="w-12 h-12 text-red-400" />
          <p className="text-sm text-zinc-700 font-medium">Erro ao carregar sessao</p>
          <p className="text-xs text-zinc-400">Verifique se voce tem acesso a este estudio e sessao.</p>
          <Link href={`/studio/${studioId}/sessions`}>
            <button className="mt-2 px-4 py-2 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-500 transition-colors" data-testid="button-back-sessions">
              Voltar para Sessoes
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#f5f5f7] text-zinc-900 overflow-hidden flex flex-col select-none relative">
      {recordingStatus === "countdown" && countdownValue > 0 && (
        <CountdownOverlay count={countdownValue} />
      )}

      {isCustomizing && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-[420px] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <span className="text-sm font-semibold text-zinc-900">Atalhos de Teclado</span>
              <button
                onClick={() => { setIsCustomizing(false); setPendingShortcuts(shortcuts); setListeningFor(null); }}
                className="text-zinc-400 hover:text-zinc-700 transition-colors"
                data-testid="button-close-shortcuts"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 flex flex-col gap-2">
              {(Object.keys(SHORTCUT_LABELS) as Array<keyof Shortcuts>).map((key) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-600">{SHORTCUT_LABELS[key]}</span>
                  <button
                    onClick={() => setListeningFor(key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono min-w-[80px] text-center transition-all border ${
                      listeningFor === key
                        ? "border-blue-500 bg-blue-50 text-blue-600 animate-pulse"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300"
                    }`}
                    data-testid={`shortcut-btn-${key}`}
                  >
                    {listeningFor === key ? "Pressione tecla\u2026" : keyLabel(pendingShortcuts[key])}
                  </button>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-zinc-100 flex justify-between gap-3">
              <button
                onClick={() => { setPendingShortcuts(DEFAULT_SHORTCUTS); setListeningFor(null); }}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                data-testid="button-reset-shortcuts"
              >
                Restaurar padroes
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => { setShortcuts(pendingShortcuts); setIsCustomizing(false); toast({ title: "Atalhos atualizados (apenas nesta sessao)" }); }}
                  className="px-4 py-1.5 rounded-lg text-xs bg-zinc-100 hover:bg-zinc-200 text-zinc-700 transition-colors"
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
                  className="px-4 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-500 text-white transition-colors font-medium"
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
      />

      {showProfilePanel && session?.productionId && (
        <RecordingProfilePanel
          characters={charactersList || []}
          user={user}
          sessionId={sessionId}
          productionId={session.productionId}
          onSave={handleSaveProfile}
          onClose={recordingProfile ? () => setShowProfilePanel(false) : undefined}
          existingProfile={recordingProfile}
        />
      )}

      <header className="h-[52px] shrink-0 flex items-center justify-between px-5 border-b border-zinc-200/80 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <Link href={`/studio/${studioId}/sessions`}>
            <button className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 text-sm transition-colors" data-testid="button-exit-room">
              <ArrowLeft className="w-4 h-4" />
              Sair
            </button>
          </Link>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-sm text-zinc-900">{production?.name || "Carregando\u2026"}</span>
            <span className="text-xs text-zinc-400">{session?.title}</span>
          </div>
          {recordingStatus === "recording" && (
            <span className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
              <Circle className="w-2 h-2 fill-red-500 animate-pulse" /> REC
            </span>
          )}
          {recordingStatus === "recorded" && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" /> Nao salvo
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {!micReady && (
            <span className="text-red-500 flex items-center gap-1">
              <MicOff className="w-3.5 h-3.5" /> Sem mic
            </span>
          )}
          {micReady && (
            <span className="text-emerald-600 flex items-center gap-1">
              <Mic className="w-3.5 h-3.5" /> 48kHz / 24bit
            </span>
          )}
          <div className="w-px h-4 bg-zinc-200" />
          {recordingProfile ? (
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-zinc-700 font-medium">{recordingProfile.voiceActorName}</span>
              <span className="text-zinc-400">/</span>
              {charactersList && charactersList.length > 1 ? (
                <select
                  value={recordingProfile.characterId}
                  onChange={(e) => handleChangeCharacter(e.target.value)}
                  className="text-blue-600 font-medium bg-transparent border-none text-xs cursor-pointer focus:outline-none pr-1"
                  data-testid="select-active-character"
                >
                  {charactersList.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <span className="text-blue-600 font-medium" data-testid="text-active-character">{recordingProfile.characterName}</span>
              )}
              <button
                onClick={() => setShowProfilePanel(true)}
                className="ml-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                data-testid="button-edit-profile"
                title="Editar perfil"
              >
                <Edit3 className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowProfilePanel(true)}
              className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 transition-colors"
              data-testid="button-setup-profile"
            >
              <User className="w-3.5 h-3.5" />
              Definir Perfil
            </button>
          )}
          <div className="w-px h-4 bg-zinc-200" />
          <span className="text-zinc-400">
            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1 text-emerald-500" />
            {takeCount} take{takeCount !== 1 ? "s" : ""}
          </span>
          <div className="w-px h-4 bg-zinc-200" />
          <button
            onClick={() => setDeviceSettingsOpen(true)}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 transition-colors"
            data-testid="button-open-device-settings"
          >
            <Monitor className="w-3.5 h-3.5" />
            Dispositivos
          </button>
          <div className="w-px h-4 bg-zinc-200" />
          <button
            onClick={() => { setIsCustomizing(true); setPendingShortcuts(shortcuts); }}
            className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-700 transition-colors"
            data-testid="button-open-shortcuts"
          >
            <Settings className="w-3.5 h-3.5" />
            Atalhos
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex flex-col border-r border-zinc-200/80" style={{ width: "56%" }}>
          <div className="flex-1 bg-zinc-900 relative overflow-hidden rounded-none">
            {production?.videoUrl ? (
              <video
                ref={videoRef}
                src={production.videoUrl}
                className="w-full h-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                muted={isMuted}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
                <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                  <Play className="w-7 h-7" />
                </div>
                <p className="text-xs">Nenhum video anexado a esta producao</p>
              </div>
            )}

            {currentScriptLine && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-16 pb-5 px-8">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] font-mono text-amber-300/90 bg-black/50 px-1.5 py-0.5 rounded">
                    {formatTimecode(currentScriptLine.start)}
                  </span>
                  <span className="text-xs font-semibold text-blue-300 uppercase tracking-widest">
                    {currentScriptLine.character}
                  </span>
                </div>
                <p className="text-white text-lg font-light leading-snug">
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
            <div className="px-5 py-2 bg-white border-t border-zinc-200/80">
              <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400">
                <span>{formatTimecode(videoTime)}</span>
                <div className="flex-1 relative h-1.5 rounded-full bg-zinc-200 cursor-pointer group" onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  scrub((e.clientX - rect.left) / rect.width);
                }}>
                  {scriptLines.map((line, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 bottom-0 rounded-sm transition-all ${
                        savedTakes.has(i) ? "bg-emerald-400/70" :
                        i === currentLine ? "bg-blue-400/70" :
                        "bg-zinc-300"
                      }`}
                      style={{
                        left: `${(line.start / videoDuration) * 100}%`,
                        width: `${Math.max(0.5, ((line.end! - line.start) / videoDuration) * 100)}%`,
                      }}
                    />
                  ))}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-600 shadow-md border-2 border-white"
                    style={{ left: `${(videoTime / videoDuration) * 100}%`, transform: "translate(-50%,-50%)" }}
                  />
                </div>
                <span>{formatTimecode(videoDuration)}</span>
              </div>
            </div>
          )}

          <div className="h-24 shrink-0 bg-white border-t border-zinc-200/80 px-5 flex items-center justify-between">
            <div className="w-56 shrink-0 flex flex-col justify-center gap-1 h-full py-3">
              <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-0.5">
                <span className="uppercase tracking-wider">
                  {recordingStatus === "recording" ? "Ao Vivo" :
                    recordingStatus === "previewing" ? "Reproduzindo" :
                    recordingStatus === "recorded" ? "Gravado" :
                    micReady ? "Monitorando" : "Sem microfone"}
                </span>
                {recordingStatus === "recording" && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Circle className="w-1.5 h-1.5 fill-red-500 animate-pulse" /> REC
                  </span>
                )}
                {(recordingStatus === "recorded" || recordingStatus === "previewing") && lastRecording && (
                  <div className="flex items-center gap-2">
                    {qualityMetrics && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        qualityMetrics.score > 80 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        qualityMetrics.score > 50 ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        "bg-red-50 text-red-700 border border-red-200"
                      }`}>
                        {qualityMetrics.score}
                      </span>
                    )}
                    <span className="text-amber-600 font-mono">{lastRecording.durationSeconds.toFixed(1)}s</span>
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => seek(-2)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
                data-testid="button-back-2s"
                title={`Back 2s (${keyLabel(shortcuts.back)})`}
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={handlePlayPause}
                className="w-11 h-11 rounded-full flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 text-zinc-900 transition-all shadow-sm"
                data-testid="button-play-pause"
                title={`Play/Pause (${keyLabel(shortcuts.playPause)})`}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>

              <button
                onClick={recordingStatus === "recording" ? handleStopRecording : handleStopPlayback}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
                data-testid="button-stop"
                title={`Stop (${keyLabel(shortcuts.stop)})`}
              >
                <Square className="w-4 h-4" />
              </button>

              <div className="w-px h-8 bg-zinc-200 mx-1" />

              {recordingStatus === "idle" || recordingStatus === "countdown" ? (
                <button
                  onClick={startCountdown}
                  disabled={!micReady || recordingStatus === "countdown"}
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-sm ${
                    recordingStatus === "countdown"
                      ? "bg-amber-100 border border-amber-300 cursor-wait"
                      : "bg-zinc-100 hover:bg-red-50 hover:border-red-300 border border-zinc-200 disabled:opacity-30"
                  }`}
                  data-testid="button-record"
                  title={`Record (${keyLabel(shortcuts.record)})`}
                >
                  <Mic className="w-5 h-5 text-zinc-700" />
                </button>
              ) : recordingStatus === "recording" ? (
                <button
                  onClick={handleStopRecording}
                  className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-400 shadow-lg shadow-red-500/20 transition-all"
                  data-testid="button-stop-recording"
                  title={`Stop recording (${keyLabel(shortcuts.stop)})`}
                >
                  <Square className="w-5 h-5 text-white fill-white" />
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreview}
                    className={`w-11 h-11 rounded-full flex items-center justify-center transition-all shadow-sm ${
                      recordingStatus === "previewing" ? "bg-blue-600 hover:bg-blue-500 text-white" : "bg-zinc-100 hover:bg-blue-50 text-zinc-700 border border-zinc-200"
                    }`}
                    data-testid="button-preview"
                  >
                    <Headphones className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleSaveTake}
                    disabled={isSaving}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-emerald-500 hover:bg-emerald-400 text-white transition-all shadow-sm disabled:opacity-50"
                    data-testid="button-save-take"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDiscard}
                    className="w-9 h-9 rounded-xl flex items-center justify-center bg-zinc-100 hover:bg-red-50 text-zinc-400 hover:text-red-500 border border-zinc-200 transition-all"
                    data-testid="button-discard-take"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}

              <div className="w-px h-8 bg-zinc-200 mx-1" />

              <button
                onClick={() => seek(2)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 transition-all"
                data-testid="button-forward-2s"
                title={`Forward 2s (${keyLabel(shortcuts.forward)})`}
              >
                <RotateCw className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsLooping((l) => !l)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isLooping
                    ? "bg-blue-50 text-blue-600 ring-1 ring-blue-200"
                    : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
                data-testid="button-loop"
                title={`Toggle loop (${keyLabel(shortcuts.loop)})`}
              >
                <Repeat className="w-4 h-4" />
              </button>
            </div>

            <div className="w-44 shrink-0 flex flex-col items-end gap-1.5">
              {isLooping && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <span>Pre-roll</span>
                    <div className="flex gap-0.5">
                      {[0.5, 1, 2, 3].map((v) => (
                        <button
                          key={v}
                          onClick={() => setPreRoll(v)}
                          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                            preRoll === v ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-zinc-100 text-zinc-500 hover:text-zinc-700"
                          }`}
                          data-testid={`preroll-${v}`}
                        >
                          {v}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                    <span>Post-roll</span>
                    <div className="flex gap-0.5">
                      {[0.5, 1, 2, 3].map((v) => (
                        <button
                          key={v}
                          onClick={() => setPostRoll(v)}
                          className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                            postRoll === v ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-zinc-100 text-zinc-500 hover:text-zinc-700"
                          }`}
                          data-testid={`postroll-${v}`}
                        >
                          {v}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-zinc-400">
                {savedTakes.size} / {scriptLines.length} linhas salvas
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col bg-white" style={{ width: "44%" }}>
          <div className="h-11 shrink-0 px-5 flex items-center justify-between border-b border-zinc-200/80 bg-zinc-50/50">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">
              Roteiro
            </span>
            <span className="text-xs text-zinc-400">
              <span className="text-zinc-700 font-mono">{currentLine + 1}</span>
              {" "}/{" "}
              {scriptLines.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto py-3 px-4 min-h-0" style={{ scrollBehavior: "smooth" }}>
            {scriptLines.length === 0 && !session && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400">
                <div className="w-10 h-10 rounded-full border-2 border-zinc-200 border-t-blue-500 animate-spin" />
                <p className="text-sm">Carregando sessao...</p>
              </div>
            )}
            {scriptLines.length === 0 && session && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-400">
                <p className="text-sm">Nenhum roteiro carregado</p>
                <p className="text-xs">Adicione um roteiro a producao para ver as falas aqui</p>
              </div>
            )}
            {scriptLines.map((line, i) => {
              const isActive = i === currentLine;
              const isDone = savedTakes.has(i);
              const lineTakes = takesList.filter((t: any) => t.lineIndex === i);
              return (
                <div
                  key={i}
                  ref={(el) => { lineRefs.current[i] = el; }}
                  onClick={() => {
                    setCurrentLine(i);
                    if (videoRef.current) {
                      videoRef.current.currentTime = line.start;
                      emitVideoEvent("video-seek", { currentTime: line.start, lineIndex: i });
                    }
                  }}
                  className={`mb-3 px-5 py-4 lg:px-6 lg:py-5 rounded-xl cursor-pointer transition-all duration-300 ${
                    isActive ? "ring-1 ring-blue-300/50 shadow-sm" : ""
                  }`}
                  style={{
                    background: isActive ? "rgba(0, 113, 227, 0.06)" : "transparent",
                  }}
                  data-testid={`script-line-${i}`}
                >
                  <div className="flex items-center gap-3 mb-2 lg:mb-3">
                    <span className="text-[16px] lg:text-[16px] font-mono text-zinc-400 tabular-nums">
                      {formatTimecode(line.start)}
                    </span>
                    <span
                      className={`text-[24px] lg:text-[32px] font-extrabold uppercase tracking-[0.5px] transition-colors leading-tight ${
                        isActive ? "text-blue-600" : "text-zinc-400"
                      }`}
                    >
                      {line.character}
                    </span>
                    {isDone && (
                      <span className="ml-auto flex items-center gap-1.5 text-[16px] text-emerald-600 font-medium">
                        <CheckCircle2 className="w-5 h-5" /> Salvo
                      </span>
                    )}
                    {lineTakes.length > 0 && !isDone && (
                      <span className="ml-auto text-[16px] text-zinc-400">
                        {lineTakes.length} take{lineTakes.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                  <p className={`text-[22px] lg:text-[30px] leading-[1.7] transition-colors ${
                    isActive ? "text-zinc-900 font-medium" : "text-zinc-500"
                  }`}>
                    {line.text}
                  </p>
                </div>
              );
            })}
          </div>

          <JitsiMeetPanel
            roomId={sessionId}
            displayName={user?.fullName || user?.artistName || user?.displayName || user?.email || "Participante"}
          />
        </div>
      </div>
    </div>
  );
}

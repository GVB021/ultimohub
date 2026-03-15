import { useParams, Link } from "wouter";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Drawer } from "vaul";
import { authFetch } from "@studio/lib/auth-fetch";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Mic,
  Play,
  Pause,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronRight,
  Settings,
  X,
  Monitor,
  User,
  Edit3,
  Download,
  Loader2,
  Menu,
  Headphones,
  Search,
  Plus,
  Save,
  Repeat,
} from "lucide-react";
import { useToast } from "@studio/hooks/use-toast";
import { useAuth } from "@studio/hooks/use-auth";
import {
  requestMicrophone,
  releaseMicrophone,
  setGain,
  getEstimatedInputLatencyMs,
  type MicrophoneState,
  type VoiceCaptureMode,
} from "@studio/lib/audio/microphoneManager";

export type { MicrophoneState, VoiceCaptureMode };
import {
  startCapture,
  stopCapture,
  createPreviewUrl,
  revokePreviewUrl,
  playCountdownBeep,
} from "@studio/lib/audio/recordingEngine";
import {
  encodeWav,
  wavToBlob,
} from "@studio/lib/audio/wavEncoder";
import { analyzeTakeQuality } from "@studio/lib/audio/qualityAnalysis";
import MonitorPanel from "@studio/components/audio/MonitorPanel";
import { DeviceSettingsPanel } from "@studio/components/audio/DeviceSettingsPanel";
import { cn } from "@studio/lib/utils";
import {
  parseTimecode,
  formatTimecodeByFormat,
  type TimecodeFormat,
  parseUniversalTimecodeToSeconds,
} from "@studio/lib/timecode";
import {
  buildScrollAnchors,
  interpolateScrollTop,
  computeAdaptiveMaxSpeedPxPerSec,
  smoothScrollStep,
} from "@studio/lib/script-scroll-sync";

export interface ScriptLine {
  character: string;
  start: number;
  end: number;
  text: string;
}

export type RecordingStatus =
  | "idle"
  | "countdown"
  | "recording"
  | "recorded"
  | "previewing";

export interface RecordingResult {
  samples: Float32Array;
  durationSeconds: number;
  sampleRate: number;
}

export interface QualityMetrics {
  score: number;
  clipping: boolean;
  loudness: number;
  noiseFloor: number;
}

export interface DeviceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  inputGain: number;
  monitorVolume: number;
  voiceCaptureMode: VoiceCaptureMode;
}

export interface Shortcuts {
  playPause: string;
  record: string;
  stop: string;
  back: string;
  forward: string;
  loop: string;
}

export interface ScrollAnchor {
  time: number;
  scrollTop: number;
}

import { DailyMeetPanel } from "@studio/components/video/DailyMeetPanel";

const DEFAULT_SHORTCUTS: Shortcuts = {
  playPause: "Space",
  record: "KeyR",
  stop: "KeyS",
  back: "ArrowLeft",
  forward: "ArrowRight",
  loop: "KeyL",
};

const SHORTCUT_LABELS: Record<keyof Shortcuts, string> = {
  playPause: "Play / Pause",
  record: "Gravar",
  stop: "Parar",
  back: "Voltar 2s",
  forward: "Avancar 2s",
  loop: "Alternar Loop",
};

function keyLabel(code: string) {
  if (code === "Space") return "Espaco";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

interface RecordingProfile {
  actorName: string;
  characterId: string;
  characterName: string;
  voiceActorId: string;
  voiceActorName: string;
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
  const [actorName, setActorName] = useState(existingProfile?.actorName || user?.fullName || user?.displayName || "");
  const [selectedCharId, setSelectedCharId] = useState(existingProfile?.characterId || "");
  const [freeCharName, setFreeCharName] = useState(existingProfile?.characterName || "");
  const [isCreating, setIsCreating] = useState(false);

  const hasCharacters = characters.length > 0;

  const handleSubmit = async () => {
    setIsCreating(true);
    try {
      let charId = selectedCharId;
      let charName = "";

      if (hasCharacters) {
        const char = characters.find((c) => c.id === selectedCharId);
        charName = char?.name || "";
      } else {
        const resp = await authFetch(`/api/productions/${productionId}/characters`, {
          method: "POST",
          body: JSON.stringify({ name: freeCharName }),
        });
        charId = resp.id;
        charName = resp.name;
      }

      onSave({
        actorName,
        characterId: charId,
        characterName: charName,
        voiceActorId: user?.id || "",
        voiceActorName: actorName,
      });
    } catch (err) {
      console.error("Failed to setup profile:", err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[420px] overflow-hidden glass-panel shadow-2xl border border-border/50">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
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

function CountdownOverlay({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <motion.div
        key={count}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.5, opacity: 0 }}
        className="text-[120px] font-black text-primary drop-shadow-[0_0_30px_rgba(var(--primary),0.5)]"
      >
        {count}
      </motion.div>
    </div>
  );
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
  const [characterSearch, setCharacterSearch] = useState("");
  const [actorDraftName, setActorDraftName] = useState("");
  const [newCharacterName, setNewCharacterName] = useState("");
  const [approvalModalTakeId, setApprovalModalTakeId] = useState<string | null>(null);
  const [approvalFinalStep, setApprovalFinalStep] = useState(false);
  const [lastUploadedTakeId, setLastUploadedTakeId] = useState<string | null>(null);
  const [actorHistory, setActorHistory] = useState<string[]>([]);
  const [characterHistory, setCharacterHistory] = useState<string[]>([]);
  const [onlySelectedCharacter, setOnlySelectedCharacter] = useState(false);
  const [timecodeFormat, setTimecodeFormat] = useState<TimecodeFormat>("HH:MM:SS");
  const [loopAnchorIndex, setLoopAnchorIndex] = useState<number | null>(null);
  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

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

  useEffect(() => {
    if (!sessionId) return;
    try {
      const actorsRaw = localStorage.getItem(`vhub_actor_history_${sessionId}`);
      const charsRaw = localStorage.getItem(`vhub_character_history_${sessionId}`);
      setActorHistory(actorsRaw ? JSON.parse(actorsRaw) : []);
      setCharacterHistory(charsRaw ? JSON.parse(charsRaw) : []);
    } catch {
      setActorHistory([]);
      setCharacterHistory([]);
    }
  }, [sessionId]);

  useEffect(() => {
    setActorDraftName(recordingProfile?.voiceActorName || "");
  }, [recordingProfile?.voiceActorName]);

  const pushToHistory = useCallback((key: string, value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    try {
      const existingRaw = localStorage.getItem(key);
      const existing = existingRaw ? (JSON.parse(existingRaw) as string[]) : [];
      const next = [normalized, ...existing.filter((item) => item !== normalized)].slice(0, 12);
      localStorage.setItem(key, JSON.stringify(next));
      if (key.includes("actor_history")) setActorHistory(next);
      if (key.includes("character_history")) setCharacterHistory(next);
    } catch {}
  }, []);

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
  const { data: studioTimecode } = useQuery<{ format: TimecodeFormat }>({
    queryKey: ["/api/studios", studioId, "timecode-format"],
    queryFn: () => authFetch(`/api/studios/${studioId}/timecode-format`),
    enabled: Boolean(studioId),
  });
  const logFeatureAudit = useCallback(async (action: string, details?: Record<string, unknown>) => {
    try {
      await authFetch(`/api/sessions/${sessionId}/audit-events`, {
        method: "POST",
        body: JSON.stringify({ action, details: JSON.stringify(details || {}) }),
      });
    } catch {}
  }, [sessionId]);
  const handleQuickCreateCharacter = useCallback(async () => {
    if (!session?.productionId) return;
    const name = newCharacterName.trim();
    if (!name) return;
    try {
      const created = await authFetch(`/api/productions/${session.productionId}/characters`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/productions", session.productionId, "characters"] });
      pushToHistory(`vhub_character_history_${sessionId}`, name);
      setNewCharacterName("");
      toast({ title: `Personagem ${created.name} cadastrado` });
      await logFeatureAudit("room.character.created", { characterName: created.name });
    } catch (err: any) {
      toast({ title: "Falha ao cadastrar personagem", description: String(err?.message || err), variant: "destructive" });
    }
  }, [session, newCharacterName, queryClient, pushToHistory, sessionId, toast, logFeatureAudit]);

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
  const formatLiveTimecode = useCallback((seconds: number) => {
    return formatTimecodeByFormat(seconds, timecodeFormat, 24);
  }, [timecodeFormat]);

  const displayedScriptLines = useMemo(() => {
    return scriptLines
      .map((line, originalIndex) => ({ ...line, originalIndex }))
      .filter((line) => {
        if (!onlySelectedCharacter) return true;
        const selectedCharacter = recordingProfile?.characterName?.trim().toLowerCase();
        if (!selectedCharacter) return true;
        return line.character.trim().toLowerCase() === selectedCharacter;
      });
  }, [scriptLines, onlySelectedCharacter, recordingProfile?.characterName]);

  useEffect(() => {
    if (!studioTimecode?.format) return;
    setTimecodeFormat(studioTimecode.format);
  }, [studioTimecode?.format]);

  const { data: takesList = [] } = useTakesList(sessionId);
  const pendingApprovalTakes = useMemo(() => takesList.filter((take: any) => !take.isPreferred), [takesList]);

  const savedTakes = useMemo(() => {
    const s = new Set<number>();
    takesList.forEach((t: any) => {
      if (t.isDone || t.isPreferred) s.add(t.lineIndex);
    });
    return s;
  }, [takesList]);

  const handleApproveTake = useCallback(async (takeId: string) => {
    await authFetch(`/api/takes/${takeId}/prefer`, { method: "POST" });
    await queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "takes"] });
    await logFeatureAudit("room.take.approved", { takeId });
    toast({ title: "Take aprovado e salvo pelo diretor" });
    setApprovalModalTakeId(null);
    setApprovalFinalStep(false);
  }, [queryClient, sessionId, toast, logFeatureAudit]);

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
  }, [sessionId, micState]);

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
        const effectivePreRoll = isLooping ? 2 : preRoll;
        const effectivePostRoll = isLooping ? 2 : postRoll;
        const range = customLoop || (currentScriptLine ? { start: currentScriptLine.start - effectivePreRoll, end: (currentScriptLine.end || currentScriptLine.start + 2) + effectivePostRoll } : null);
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
        const latencyMs = getEstimatedInputLatencyMs(state);
        if (latencyMs > 10) {
          toast({
            title: "Latência de entrada acima da meta",
            description: `Latência atual ${latencyMs.toFixed(2)}ms. Use modo high-fidelity e feche apps de áudio.`,
            variant: "destructive",
          });
        }
        logAudioStep("microphone-ready", {
          sampleRate: state.audioContext.sampleRate,
          captureMode: state.captureMode,
          latencyMs,
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

  useEffect(() => {
    return () => {
      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, []);

  const uploadTakeForDirector = useCallback(async (result: RecordingResult, metrics: QualityMetrics | null) => {
    if (!recordingProfile) {
      throw new Error("Perfil de gravação não configurado.");
    }
    const wavBuffer = encodeWav(result.samples);
    const wavBlob = wavToBlob(wavBuffer);
    const formData = new FormData();
    formData.append("audio", wavBlob, `take_${sessionId}_${Date.now()}.wav`);
    formData.append("characterId", recordingProfile.characterId);
    formData.append("voiceActorId", recordingProfile.voiceActorId || user?.id || "");
    formData.append("lineIndex", String(currentLine));
    formData.append("durationSeconds", String(result.durationSeconds));
    formData.append("startTimeSeconds", String(videoRef.current?.currentTime || 0));
    if (metrics) {
      formData.append("qualityScore", String(metrics.score));
    }
    const take = await authFetch(`/api/sessions/${sessionId}/takes`, {
      method: "POST",
      body: formData,
    });
    setLastUploadedTakeId(take.id);
    await queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "takes"] });
    pushToHistory(`vhub_actor_history_${sessionId}`, recordingProfile.voiceActorName || actorDraftName);
    pushToHistory(`vhub_character_history_${sessionId}`, recordingProfile.characterName);
    return take;
  }, [recordingProfile, sessionId, user?.id, currentLine, queryClient, pushToHistory, actorDraftName]);

  const startCountdown = useCallback(() => {
    if (recordingStatus !== "idle" || !micState) return;
    const video = videoRef.current;
    if (!video) return;
    const loopPreroll = isLooping ? 3 : preRoll;
    const startFrom = isLooping && customLoop ? customLoop.start : (video.currentTime || 0);
    const prerollStart = Math.max(0, startFrom - loopPreroll);
    video.currentTime = prerollStart;
    emitVideoEvent("seek", { currentTime: prerollStart });
    logAudioStep("countdown-started", { initiatorUserId: user?.id, prerollStart, loopEnabled: isLooping });
    setCountdownValue(3);
    setRecordingStatus("recording");
    startCapture(micState);
    video.play().catch(() => {});
    emitVideoEvent("play", { currentTime: video.currentTime });
    emitVideoEvent("countdown-start", { initiatorUserId: user?.id, count: 3 });
    if (micState.audioContext) playCountdownBeep(micState.audioContext);
    if (countdownTimerRef.current) window.clearInterval(countdownTimerRef.current);
    let count = 3;
    countdownTimerRef.current = window.setInterval(() => {
      count -= 1;
      setCountdownValue(Math.max(0, count));
      emitVideoEvent("countdown-tick", { count: Math.max(0, count), initiatorUserId: user?.id });
      if (count > 0 && micState.audioContext) playCountdownBeep(micState.audioContext);
      if (count <= 0 && countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    }, 1000);
  }, [recordingStatus, micState, emitVideoEvent, logAudioStep, user?.id, isLooping, customLoop, preRoll]);

  const handleStopRecording = useCallback(async () => {
    if (recordingStatus !== "recording" || !micState) return;
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setCountdownValue(0);
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

    const metrics = analyzeTakeQuality(result.samples);
    setQualityMetrics(metrics);
    logAudioStep("quality-analyzed", {
      score: metrics.score,
      clipping: metrics.clipping,
      loudness: metrics.loudness,
      noiseFloor: metrics.noiseFloor,
      sampleRate: result.sampleRate,
    });
    try {
      setIsSaving(true);
      await uploadTakeForDirector(result, metrics);
      toast({ title: isDirector ? "Take recebido para aprovação" : "Take enviado para o diretor" });
    } catch (err: any) {
      toast({ title: "Erro ao enviar take", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [recordingStatus, emitVideoEvent, micState, logAudioStep, toast, uploadTakeForDirector, isDirector]);

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
      setLoopAnchorIndex(index);
      setLoopSelectionMode("selecting-end");
      toast({ title: "Inicio selecionado", description: "Clique na fala final do loop." });
    } else if (loopSelectionMode === "selecting-end") {
      const startIndex = loopAnchorIndex ?? index;
      const startLine = scriptLines[startIndex] || line;
      const start = Math.min(startLine.start, line.start);
      const end = Math.max(startLine.end || (startLine.start + 2), line.end || (line.start + 2));
      setCustomLoop({ start, end });
      setLoopSelectionMode("idle");
      setIsLooping(true);
      setPreRoll(2);
      setPostRoll(2);
      toast({ title: "Loop definido", description: "Trecho selecionado com pre/post-roll de 2 segundos." });
      emitVideoEvent("sync-loop", { loopRange: { start, end } });
      logFeatureAudit("room.loop.defined", { start, end, startLineIndex: startIndex, endLineIndex: index });
    } else {
      const video = videoRef.current;
      if (video) {
        video.currentTime = line.start;
        emitVideoEvent("seek", { currentTime: line.start });
      }
      setCurrentLine(index);
    }
  }, [canTextControl, scriptLines, loopSelectionMode, toast, emitVideoEvent, loopAnchorIndex, logFeatureAudit]);

  const handleLoopButton = useCallback(async () => {
    if (loopSelectionMode !== "idle") {
      setLoopSelectionMode("idle");
      setIsLooping(false);
      setCustomLoop(null);
      setLoopAnchorIndex(null);
      setPreRoll(1);
      setPostRoll(1);
      await logFeatureAudit("room.loop.cleared");
      return;
    }
    setLoopSelectionMode("selecting-start");
    setCustomLoop(null);
    setLoopAnchorIndex(null);
    await logFeatureAudit("room.loop.selection_started");
    toast({ title: "Selecione a primeira fala do loop" });
  }, [loopSelectionMode, logFeatureAudit, toast]);

  const handleDiscard = useCallback(() => {
    setLastRecording(null);
    setQualityMetrics(null);
    setRecordingStatus("idle");
  }, []);

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

  const handleSaveProfile = (profile: RecordingProfile) => {
    setRecordingProfile(profile);
    localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(profile));
    setShowProfilePanel(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const code = e.code;
      if (code === shortcuts.playPause) { e.preventDefault(); handlePlayPause(); }
      else if (code === shortcuts.record) { e.preventDefault(); if (recordingStatus === "idle") startCountdown(); }
      else if (code === shortcuts.stop) { e.preventDefault(); if (recordingStatus === "recording") handleStopRecording(); else handleStopPlayback(); }
      else if (code === shortcuts.back) { e.preventDefault(); seek(-2); }
      else if (code === shortcuts.forward) { e.preventDefault(); seek(2); }
      else if (code === shortcuts.loop) { e.preventDefault(); void handleLoopButton(); }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts, handlePlayPause, handleStopRecording, handleStopPlayback, recordingStatus, startCountdown, seek, handleLoopButton]);

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
    <div
      className="recording-room h-screen w-screen overflow-hidden flex flex-col select-none relative bg-background text-foreground dark"
      onClickCapture={(event) => {
        const target = event.target as HTMLElement | null;
        const button = target?.closest?.("button") as HTMLButtonElement | null;
        if (!button) return;
        button.classList.remove("rr-click-blink");
        void button.offsetWidth;
        button.classList.add("rr-click-blink");
        window.setTimeout(() => button.classList.remove("rr-click-blink"), 300);
      }}
    >
      {/* Cinematic Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-background to-background opacity-50"></div>
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] bg-repeat opacity-[0.05]"></div>
      </div>

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

      {takesPopupOpen && isDirector && (
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
                {pendingApprovalTakes.map((take: any) => (
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
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setApprovalModalTakeId(take.id)}
                        className="px-3 h-8 rounded-lg text-xs font-semibold bg-primary/20 text-primary hover:bg-primary/30 transition-colors flex items-center gap-1"
                        title="Aprovar e salvar take"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                      <button
                        onClick={() => handleDownloadTake(take)}
                        className="p-2 rounded-lg transition-colors text-muted-foreground bg-muted/60 hover:text-foreground hover:bg-muted"
                        title="Baixar take"
                        data-testid={`button-download-take-popup-${take.id}`}
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {pendingApprovalTakes.length === 0 && (
                  <div className="text-sm text-center py-10 text-muted-foreground">
                    Nenhum take pendente de aprovação
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {approvalModalTakeId && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-[calc(100vw-32px)] max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Confirmação de salvamento</h3>
            <p className="text-xs text-muted-foreground mt-2">
              {approvalFinalStep ? "Confirma definitivamente o salvamento deste take?" : "Aprovar este take para salvamento definitivo?"}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setApprovalModalTakeId(null); setApprovalFinalStep(false); }}
                className="h-9 px-3 rounded-lg bg-muted/70 text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!approvalFinalStep) {
                    setApprovalFinalStep(true);
                    return;
                  }
                  await handleApproveTake(approvalModalTakeId);
                }}
                className="h-9 px-3 rounded-lg bg-primary text-primary-foreground"
              >
                {approvalFinalStep ? "Confirmar salvamento" : "Continuar"}
              </button>
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
                    className="absolute top-full left-0 mt-2 w-72 rounded-2xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl p-2 z-[100]"
                  >
                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground px-3 py-2 border-b border-border/50 mb-1">Dublador e Personagem</div>
                    <div className="px-2 py-2 space-y-2 border-b border-border/50 mb-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={actorDraftName}
                          onChange={(e) => setActorDraftName(e.target.value)}
                          placeholder="Nome do dublador"
                          className="w-full h-8 pl-7 pr-2 rounded-lg bg-background/70 border border-border text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={characterSearch}
                          onChange={(e) => setCharacterSearch(e.target.value)}
                          placeholder="Buscar personagem"
                          className="w-full h-8 pl-7 pr-2 rounded-lg bg-background/70 border border-border text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          value={newCharacterName}
                          onChange={(e) => setNewCharacterName(e.target.value)}
                          placeholder="Cadastrar personagem"
                          className="flex-1 h-8 px-2 rounded-lg bg-background/70 border border-border text-xs"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleQuickCreateCharacter(); }}
                          className="h-8 px-2 rounded-lg bg-primary/20 text-primary hover:bg-primary/30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {actorHistory.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {actorHistory.slice(0, 4).map((name) => (
                            <button
                              key={name}
                              onClick={(e) => { e.stopPropagation(); setActorDraftName(name); }}
                              className="px-2 h-6 rounded-full text-[10px] bg-muted/70 text-muted-foreground hover:text-foreground"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                      {charactersList?.filter((char) => char.name.toLowerCase().includes(characterSearch.toLowerCase())).map((char) => (
                        <button
                          key={char.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCharacterChange(char);
                            if (recordingProfile && actorDraftName.trim()) {
                              const newProfile = { ...recordingProfile, voiceActorName: actorDraftName.trim() };
                              setRecordingProfile(newProfile);
                              localStorage.setItem(`vhub_rec_profile_${sessionId}`, JSON.stringify(newProfile));
                              pushToHistory(`vhub_actor_history_${sessionId}`, actorDraftName.trim());
                            }
                            pushToHistory(`vhub_character_history_${sessionId}`, char.name);
                          }}
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
                      {characterHistory.length > 0 && (
                        <div className="px-2 pt-2 text-[10px] text-muted-foreground">
                          Histórico: {characterHistory.slice(0, 3).join(" • ")}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {!recordingProfile && (
            <button
              onClick={() => setShowProfilePanel(true)}
              className="h-8 px-3 rounded-full bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25 transition-colors"
            >
              Cadastrar dublador/personagem
            </button>
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
              {isDirector && (
                <button
                  onClick={() => setTakesPopupOpen(true)}
                  className="h-9 px-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 flex items-center gap-1.5"
                  aria-label="Takes pendentes do diretor"
                >
                  <Headphones className="w-4 h-4" />
                  <span className="text-[11px] font-semibold">{pendingApprovalTakes.length}</span>
                </button>
              )}
              <Link href={`/hub-dub/studio/${studioId}/dashboard`}>
                <button
                  onClick={() => { logFeatureAudit("room.panel.redirect", { studioId }); }}
                  className="h-9 px-3 rounded-xl bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 text-[11px] font-semibold"
                  data-testid="button-room-panel"
                >
                  PAINEL
                </button>
              </Link>
              <button
                onClick={() => setDeviceSettingsOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Configurações de dispositivos"
                data-testid="button-open-device-settings"
              >
                <Monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsCustomizing(true)}
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
        isMobile ? "grid-cols-1" : "grid-cols-2"
      )}>
        <div className="flex flex-col min-h-0 relative border-r border-border/60">
          <div className="flex-1 flex flex-col min-h-0 bg-black/40 relative">
            <div className="flex-1 relative overflow-hidden bg-black flex items-center justify-center">
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

              {countdownValue > 0 && (
                <CountdownOverlay count={countdownValue} />
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
                <div className="absolute bottom-16 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-10 sm:pt-16 pb-4 sm:pb-6 px-4 sm:px-8 pointer-events-none">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] sm:text-[11px] font-mono text-blue-300/90 bg-black/50 px-1.5 py-0.5 rounded">
                      {formatLiveTimecode(currentScriptLine.start)}
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
                className="absolute top-3 right-3 p-2 rounded-xl bg-black/40 text-white/60 hover:text-white transition-all hover:bg-black/60 z-30"
                aria-label={isMuted ? "Ativar som" : "Desativar som"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/80 backdrop-blur-md border-t border-white/10 flex items-center px-4 gap-4 z-40">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => seek(-2)}
                    className="w-10 h-10 rounded-xl flex items-center justify-center transition-all bg-white/5 text-white/70 hover:text-white"
                    aria-label="Recuar 2 segundos"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all bg-primary text-primary-foreground shadow-lg"
                    aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                </div>

                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-white/50">
                    <span>{formatLiveTimecode(videoTime)}</span>
                    <span>{formatLiveTimecode(videoDuration)}</span>
                  </div>
                  <div className="relative h-1.5 rounded-full cursor-pointer group bg-white/10" onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    scrub((e.clientX - rect.left) / rect.width);
                  }}>
                    <div
                      className="absolute top-0 bottom-0 rounded-full bg-primary"
                      style={{ width: `${videoDuration > 0 ? (videoTime / videoDuration) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLoopButton}
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                      loopSelectionMode !== "idle" || isLooping
                        ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-300"
                        : "bg-white/5 border-white/10 text-white/70 hover:text-white"
                    )}
                    aria-label="Configurar loop"
                  >
                    <Repeat className="w-4 h-4" />
                  </button>
                  {recordingStatus === "idle" || recordingStatus === "recorded" ? (
                    <button
                      onClick={startCountdown}
                      disabled={!micReady || isSaving}
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                        isSaving ? "opacity-50 cursor-not-allowed bg-white/10 border border-white/20 text-white" : "bg-white/10 border border-white/20 text-white"
                      )}
                    >
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                    </button>
                  ) : (
                    <button
                      onClick={handleStopRecording}
                      className="w-11 h-11 rounded-full flex items-center justify-center transition-all bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse"
                    >
                      <Square className="w-5 h-5 text-white fill-white" />
                    </button>
                  )}
                </div>
              </div>
              {recordingStatus === "recorded" && (
                <div className="absolute bottom-20 left-3 right-3 h-9 rounded-lg bg-black/70 border border-white/10 flex items-center justify-between px-3 text-[11px] text-white/80">
                  {isDirector ? (
                    <>
                      <span>Take pronto para aprovação do diretor.</span>
                      <button
                        onClick={() => lastUploadedTakeId && setApprovalModalTakeId(lastUploadedTakeId)}
                        disabled={!lastUploadedTakeId}
                        className="h-7 px-2 rounded-md bg-primary/25 text-primary disabled:opacity-40 flex items-center gap-1"
                      >
                        <Headphones className="w-3.5 h-3.5" />
                        Aprovar
                      </button>
                    </>
                  ) : (
                    <span>Take enviado. Aguardando aprovação do diretor.</span>
                  )}
                </div>
              )}
              {(customLoop || loopSelectionMode !== "idle") && (
                <div className="absolute top-3 left-3 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/40 px-3 flex items-center text-[11px] text-indigo-100 z-30">
                  {loopSelectionMode === "selecting-start" && "Loop: selecione a primeira fala"}
                  {loopSelectionMode === "selecting-end" && "Loop: selecione a última fala"}
                  {loopSelectionMode === "idle" && customLoop && `Loop ativo ${formatLiveTimecode(customLoop.start)} - ${formatLiveTimecode(customLoop.end)}`}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col min-h-0 bg-background/40 relative">
          <div className="h-11 shrink-0 px-5 flex items-center justify-between border-b border-border/70 bg-muted/30">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Roteiro
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !scriptAutoFollow;
                  setScriptAutoFollow(next);
                  if (next) syncScrollToCurrentVideoTime();
                  logFeatureAudit("room.scroll.mode_changed", { mode: next ? "automatic" : "manual" });
                }}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full transition-colors border",
                  scriptAutoFollow ? "bg-primary/15 text-primary border-primary/25" : "bg-muted/60 text-muted-foreground border-border/70"
                )}
              >
                {scriptAutoFollow ? "ROLAGEM AUTOMÁTICA" : "ROLAGEM MANUAL"}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !onlySelectedCharacter;
                  setOnlySelectedCharacter(next);
                  logFeatureAudit("room.character_filter.toggled", { enabled: next, character: recordingProfile?.characterName || null });
                }}
                disabled={!recordingProfile}
                className={cn(
                  "text-[10px] px-2 py-1 rounded-full transition-colors border",
                  onlySelectedCharacter ? "bg-primary/15 text-primary border-primary/25" : "bg-muted/60 text-muted-foreground border-border/70",
                  !recordingProfile && "opacity-50 cursor-not-allowed"
                )}
              >
                APENAS PERSONAGEM
              </button>
              <span className="text-xs text-muted-foreground">
                <span className="font-mono text-foreground">{displayedScriptLines.length}</span>
                {" "}/{" "}
                {scriptLines.length}
              </span>
            </div>
          </div>

          <div
            ref={scriptViewportRef}
            className="flex-1 overflow-y-auto py-3 px-4 min-h-0 relative custom-scrollbar"
            onWheelCapture={markScriptUserScrollIntent}
            onTouchMoveCapture={markScriptUserScrollIntent}
            onPointerDownCapture={markScriptUserScrollIntent}
            onScrollCapture={() => {
              scrollSyncCurrentRef.current = scriptViewportRef.current?.scrollTop || 0;
            }}
          >
              {displayedScriptLines.map((line) => {
                const i = line.originalIndex;
                const isActive = i === currentLine;
                const isDone = savedTakes.has(i);
                const isInLoop = customLoop ? line.start >= customLoop.start && line.end <= customLoop.end : false;
                return (
                  <div
                    key={i}
                    ref={(el) => { lineRefs.current[i] = el; }}
                    onClick={canTextControl ? (() => handleLineClick(i)) : undefined}
                    className={cn(
                      "mb-3 px-5 py-4 rounded-xl transition-all duration-300 relative overflow-hidden",
                      isActive ? "bg-background/85 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)] backdrop-blur-md" : "bg-transparent",
                      isInLoop && "shadow-[inset_0_0_0_1px_rgba(129,140,248,0.45)] bg-indigo-500/10",
                      canTextControl ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[16px] font-mono tabular-nums text-muted-foreground">#{i + 1} · {formatLiveTimecode(line.start)}</span>
                      <span className={cn("text-[24px] font-extrabold uppercase tracking-tight", isActive ? "text-primary" : "text-muted-foreground")}>
                        {line.character}
                      </span>
                      {isDone && <CheckCircle2 className="w-5 h-5 ml-auto text-emerald-500" />}
                    </div>
                    <p className={cn("text-[22px] leading-relaxed", isActive ? "text-foreground font-medium" : "text-muted-foreground")}>
                      {lineEdits[i] ?? line.text}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      <AnimatePresence>
        {isMobile && (
          <>
            <Drawer.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" />
                <Drawer.Content className="bg-zinc-950 flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 z-[120] outline-none max-h-[90vh]">
                  <div className="p-6 pb-12 overflow-y-auto">
                    <div className="mx-auto w-12 h-1.5 rounded-full bg-zinc-800 mb-8" />
                    <h2 className="text-xl font-bold mb-6 text-white">Menu do Estúdio</h2>
                    <div className="space-y-4">
                      <button
                        onClick={() => { setDeviceSettingsOpen(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all min-h-[56px]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                            <Monitor className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-white">Dispositivos</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">Configurar Áudio</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>
                      <button
                        onClick={() => { setShowProfilePanel(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all min-h-[56px]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                            <User className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-white">Perfil de Gravação</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">Ator & Personagem</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>
                    </div>
                  </div>
                </Drawer.Content>
              </Drawer.Portal>
            </Drawer.Root>

            <button
              onClick={() => setScriptOpen(true)}
              className="fixed bottom-20 left-5 h-12 w-12 rounded-full flex items-center justify-center shadow-lg z-[90] bg-zinc-900/80 backdrop-blur-md border border-white/10 text-white"
            >
              <Edit3 className="w-5 h-5" />
            </button>

            <Drawer.Root open={scriptOpen} onOpenChange={setScriptOpen}>
              <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110]" />
                <Drawer.Content className="bg-zinc-950 flex flex-col rounded-t-[32px] h-[85vh] fixed bottom-0 left-0 right-0 z-[120] outline-none">
                  <div className="p-6 flex-1 flex flex-col overflow-hidden">
                    <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-zinc-800 mb-8" />
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold text-white">Roteiro</h2>
                      <button onClick={() => setScriptOpen(false)} className="p-2 rounded-full bg-white/5 text-white/40">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto pb-20">
                      {displayedScriptLines.map((line) => {
                        const i = line.originalIndex;
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
                              <span className="text-[11px] font-mono text-white/30">#{i + 1} · {formatLiveTimecode(line.start)}</span>
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

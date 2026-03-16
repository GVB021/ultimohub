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
  Check,
  Monitor,
  User,
  Plus,
  Minus,
  Users,
  Edit3,
  Download,
  Loader2,
  Menu,
  Save,
  Repeat,
  ListMusic,
  ArrowUpDown,
  UserCheck,
  MousePointer2,
  Video,
  ArrowLeft,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
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

type ScriptLineOverride = {
  character?: string;
  text?: string;
  start?: number;
};

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

type RecordingAvailabilityState = "available" | "loading" | "error";

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

const UI_LAYER_BASE = {
  playerControls: 160,
  floatingButtons: 180,
  chatPanel: 1150,
  modalOverlay: 1400,
  confirmationModal: 1500,
  mobileDrawerOverlay: 1450,
  mobileDrawerContent: 1500,
} as const;

function keyLabel(code: string) {
  if (code === "Space") return "Espaco";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Arrow")) return code.slice(5);
  return code;
}

function normalizeRoomRole(role: unknown) {
  const value = String(role || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (value === "director") return "diretor";
  if (value === "admin") return "studio_admin";
  if (value === "platformowner") return "platform_owner";
  if (value === "master") return "master";
  return value;
}

type UiRole = "viewer" | "text_controller" | "audio_controller" | "admin";
type UiPermission = "text_control" | "audio_control" | "presence_view" | "approve_take" | "dashboard_access";

const UI_ROLE_PERMISSIONS: Record<UiRole, UiPermission[]> = {
  viewer: [],
  text_controller: ["text_control", "presence_view"],
  audio_controller: ["audio_control", "approve_take", "dashboard_access", "presence_view"],
  admin: ["text_control", "audio_control", "approve_take", "dashboard_access", "presence_view"],
};

function resolveUiRole(role: unknown, controlledText: boolean): UiRole {
  const normalized = normalizeRoomRole(role);
  if (normalized === "platform_owner" || normalized === "master" || normalized === "studio_admin" || normalized === "diretor") return "admin";
  if (normalized === "editor" || normalized === "text_controller") return "text_controller";
  if (controlledText) return "text_controller";
  if (normalized === "dublador" || normalized === "aluno") return "audio_controller";
  return "viewer";
}

function hasUiPermission(role: UiRole, permission: UiPermission) {
  return UI_ROLE_PERMISSIONS[role].includes(permission);
}

function canReceiveTextControl(role: unknown) {
  const normalized = normalizeRoomRole(role);
  return normalized === "dublador" || normalized === "aluno";
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

type RecordingsQueryParams = {
  page: number;
  pageSize: number;
  search: string;
  userId?: string;
  from?: string;
  to?: string;
  sortBy: "createdAt" | "durationSeconds" | "lineIndex" | "characterName";
  sortDir: "asc" | "desc";
};

type RecordingsResponse = {
  items: any[];
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
};

function useRecordingsList(sessionId: string, params: RecordingsQueryParams) {
  const cacheKey = `vhub_recordings_cache_${sessionId}`;
  const query = useQuery({
    queryKey: ["/api/sessions", sessionId, "recordings", params],
    queryFn: async () => {
      console.debug("[Room][Recordings] iniciando leitura de takes", { sessionId });
      try {
        const queryString = new URLSearchParams();
        queryString.set("page", String(params.page || 1));
        queryString.set("pageSize", String(params.pageSize || 20));
        queryString.set("sortBy", params.sortBy);
        queryString.set("sortDir", params.sortDir);
        if (params.search) queryString.set("search", params.search);
        if (params.userId) queryString.set("userId", params.userId);
        if (params.from) queryString.set("from", params.from);
        if (params.to) queryString.set("to", params.to);
        const data = await authFetch(`/api/sessions/${sessionId}/recordings?${queryString.toString()}`);
        const normalized: RecordingsResponse = Array.isArray(data)
          ? { items: data, page: 1, pageSize: data.length || 20, total: data.length || 0, pageCount: 1 }
          : { items: Array.isArray(data?.items) ? data.items : [], page: Number(data?.page || 1), pageSize: Number(data?.pageSize || 20), total: Number(data?.total || 0), pageCount: Number(data?.pageCount || 1) };
        console.debug("[Room][Recordings] takes carregados", { sessionId, total: normalized.total });
        return normalized;
      } catch (error) {
        console.error("[Room][Recordings] falha ao carregar takes", { sessionId, error });
        throw error;
      }
    },
    enabled: Boolean(sessionId),
    refetchInterval: 5000,
    initialData: () => {
      try {
        const raw = localStorage.getItem(cacheKey);
        const items = raw ? JSON.parse(raw) : [];
        return { items, page: 1, pageSize: 20, total: Array.isArray(items) ? items.length : 0, pageCount: 1 };
      } catch {
        return { items: [], page: 1, pageSize: 20, total: 0, pageCount: 1 };
      }
    },
    staleTime: 1000,
  });
  useEffect(() => {
    if (!Array.isArray(query.data?.items)) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(query.data.items.slice(0, 120)));
    } catch {}
  }, [cacheKey, query.data?.items]);
  return query;
}

function CountdownOverlay({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <motion.div
        key={count}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.5, opacity: 0 }}
        className="text-9xl font-bold text-red-500 drop-shadow-[0_0_20px_rgba(255,0,0,0.5)]"
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
  const hasPersistedDeviceSettings = useMemo(() => {
    try {
      return Boolean(localStorage.getItem("vhub_device_settings"));
    } catch {
      return false;
    }
  }, []);

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
  const [charSelectorOpen, setCharSelectorOpen] = useState(false);
  const [lastUploadedTakeId, setLastUploadedTakeId] = useState<string | null>(null);
  const [recordingsOpen, setRecordingsOpen] = useState(false);
  const [dailyMeetOpen, setDailyMeetOpen] = useState(false);
  const [recordingsScope, setRecordingsScope] = useState<"mine" | "all">("mine");
  const [recordingsPage, setRecordingsPage] = useState(1);
  const [recordingsSearch, setRecordingsSearch] = useState("");
  const [recordingsSortBy, setRecordingsSortBy] = useState<"createdAt" | "durationSeconds" | "lineIndex" | "characterName">("createdAt");
  const [recordingsSortDir, setRecordingsSortDir] = useState<"asc" | "desc">("desc");
  const [recordingsDateFrom, setRecordingsDateFrom] = useState("");
  const [recordingsDateTo, setRecordingsDateTo] = useState("");
  const [discardModalTake, setDiscardModalTake] = useState<any | null>(null);
  const [discardFinalStep, setDiscardFinalStep] = useState(false);
  const [onlySelectedCharacter, setOnlySelectedCharacter] = useState(false);
  const [timecodeFormat, setTimecodeFormat] = useState<TimecodeFormat>("HH:MM:SS");
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(1);
  const [loopAnchorIndex, setLoopAnchorIndex] = useState<number | null>(null);

  // Novo sistema de preview de áudio antes do envio
  const [pendingTake, setPendingTake] = useState<{
    samples: Float32Array;
    durationSeconds: number;
    sampleRate: number;
    metrics: any;
    blob: Blob;
    url: string;
    lineIndex: number;
    startTimeSeconds: number;
  } | null>(null);

  const lastTapRef = useRef<number>(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const countdownTimerRef = useRef<number | null>(null);

  const handleCharacterChange = (char: { id: string; name: string; voiceActorId: string | null }) => {
    const baseProfile: RecordingProfile = recordingProfile || {
      actorName: user?.fullName || user?.displayName || "Dublador",
      characterId: char.id,
      characterName: char.name,
      voiceActorId: user?.id || "",
      voiceActorName: user?.fullName || user?.displayName || "Dublador",
    };
    const newProfile = {
      ...baseProfile,
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
    if (!isMobile) {
      setDailyMeetOpen(true);
    }
  }, [isMobile]);

  const handleVideoTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap - Cycle playback speed
      const video = videoRef.current;
      if (video) {
        video.playbackRate = 1;
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

  const [lineOverrides, setLineOverrides] = useState<Record<number, ScriptLineOverride>>({});
  const [lineEditHistory, setLineEditHistory] = useState<Record<number, Array<{
    id: string;
    field: "character" | "text" | "timecode";
    before: string;
    after: string;
    at: string;
    by: string;
  }>>>({});
  const [editingField, setEditingField] = useState<{ lineIndex: number; field: "character" | "text" | "timecode" } | null>(null);
  const [editingDraftValue, setEditingDraftValue] = useState("");
  const [recordingsPlayerOpenId, setRecordingsPlayerOpenId] = useState<string | null>(null);
  const [loopRangeMeta, setLoopRangeMeta] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const [loopPreparing, setLoopPreparing] = useState(false);
  const [loopSilenceActive, setLoopSilenceActive] = useState(false);
  const loopPreparationTimeoutRef = useRef<number | null>(null);
  const loopSilenceTimeoutRef = useRef<number | null>(null);
  const loopSilenceLockRef = useRef(false);

  const baseScriptLines: ScriptLine[] = useMemo(() => {
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
      const sorted = [...normalized].sort((a, b) => a.start - b.start);
      return sorted.map((line, i) => ({
        ...line,
        end: Math.max(sorted[i + 1]?.start ?? (line.start + 10), line.start + 0.001),
      }));
    } catch (e) {
      console.error("[Room] Failed to parse scriptJson:", e);
      return [];
    }
  }, [production?.scriptJson]);

  useEffect(() => {
    setLineOverrides({});
    setLineEditHistory({});
    setEditingField(null);
    setEditingDraftValue("");
  }, [production?.id, production?.scriptJson]);

  const scriptLines: ScriptLine[] = useMemo(() => {
    const merged = baseScriptLines.map((line, index) => {
      const override = lineOverrides[index];
      return {
        character: override?.character ?? line.character,
        text: override?.text ?? line.text,
        start: typeof override?.start === "number" ? override.start : line.start,
        end: line.end,
      };
    });
    return merged.map((line, index) => {
      const next = merged[index + 1];
      return {
        ...line,
        end: Math.max(next?.start ?? (line.start + 10), line.start + 0.001),
      };
    });
  }, [baseScriptLines, lineOverrides]);

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
  const {
    data: recordingsResponse,
    error: recordingsError,
    isError: hasRecordingsError,
  } = useRecordingsList(sessionId, {
    page: recordingsPage,
    pageSize: 20,
    search: recordingsSearch,
    userId: recordingsScope === "all" ? undefined : String(user?.id || ""),
    from: recordingsDateFrom || undefined,
    to: recordingsDateTo || undefined,
    sortBy: recordingsSortBy,
    sortDir: recordingsSortDir,
  });
  const recordingsList = recordingsResponse?.items || [];

  const savedTakes = useMemo(() => {
    const s = new Set<number>();
    takesList.forEach((t: any) => {
      if (t.isDone || t.isPreferred) s.add(t.lineIndex);
    });
    return s;
  }, [takesList]);
  useEffect(() => {
    if (!hasRecordingsError) return;
    toast({
      title: "Falha de conexão com o banco de áudio",
      description: String((recordingsError as any)?.message || "Não foi possível carregar os takes"),
      variant: "destructive",
    });
  }, [hasRecordingsError, recordingsError, toast]);

  const handleDiscardTake = useCallback(async (take: any) => {
    const takeId = String(take.id);
    const normalizedRole = normalizeRoomRole(user?.role);
    const canDeletePermanently = normalizedRole === "platform_owner" || normalizedRole === "master";
    const takesQueryKey = ["/api/sessions", sessionId, "takes"] as const;
    const recordingsQueryKey = ["/api/sessions", sessionId, "recordings"] as const;
    const previousTakes = queryClient.getQueryData(takesQueryKey);
    setOptimisticRemovingTakeIds((prev) => {
      const next = new Set(prev);
      next.add(takeId);
      return next;
    });
    queryClient.setQueryData(takesQueryKey, (current: any) =>
      Array.isArray(current) ? current.filter((item: any) => String(item?.id || "") !== takeId) : current
    );
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 260));
      if (canDeletePermanently) {
        await authFetch(`/api/takes/${takeId}`, { method: "DELETE" });
      } else {
        await authFetch(`/api/takes/${takeId}/discard`, {
          method: "POST",
          body: JSON.stringify({ confirm: true }),
        });
      }
      await queryClient.invalidateQueries({ queryKey: takesQueryKey });
      await queryClient.invalidateQueries({ queryKey: recordingsQueryKey, exact: false });
      await logFeatureAudit(canDeletePermanently ? "room.take.deleted" : "room.take.discarded", { takeId });
      toast({ title: canDeletePermanently ? "Take excluído permanentemente" : "Take descartado" });
      setDiscardModalTake(null);
      setDiscardFinalStep(false);
    } catch (error: any) {
      queryClient.setQueryData(takesQueryKey, previousTakes);
      toast({ title: canDeletePermanently ? "Falha ao excluir take" : "Falha ao descartar take", description: error?.message || "Tente novamente", variant: "destructive" });
    } finally {
      setOptimisticRemovingTakeIds((prev) => {
        const next = new Set(prev);
        next.delete(takeId);
        return next;
      });
    }
  }, [queryClient, sessionId, toast, logFeatureAudit, user?.role]);

  const [videoTime, setVideoTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const desktopVideoTextContainerRef = useRef<HTMLDivElement>(null);
  const scriptViewportRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [scriptAutoFollow, setScriptAutoFollow] = useState(() => {
    try {
      const saved = sessionStorage.getItem(`vhub_script_follow_${sessionId}`);
      return saved ? saved === "auto" : true;
    } catch {
      return true;
    }
  });
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
  const recordingsPreviewAudioRef = useRef<HTMLAudioElement>(null);
  const recordingRowAudioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const [recordingsPreviewId, setRecordingsPreviewId] = useState<string | null>(null);
  const [recordingsPlaybackRate, setRecordingsPlaybackRate] = useState(1);
  const [recordingsIsLoading, setRecordingsIsLoading] = useState<Set<string>>(new Set());
  const [desktopVideoTextSplit, setDesktopVideoTextSplit] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("vhub_desktop_video_text_split");
      // O roteiro não pode ocupar mais de 50% da altura da viewport.
      // Se scriptHeight = 100 - split, então 100 - split <= 50, logo split >= 50.
      const val = saved ? Number(saved) : 68;
      return Math.max(50, Math.min(80, val));
    } catch {
      return 68;
    }
  });
  const [isDraggingVideoTextSplit, setIsDraggingVideoTextSplit] = useState(false);

  const [sideScriptWidth, setSideScriptWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("vhub_side_script_width");
      const val = saved ? Number(saved) : 400;
      // Limites: 15% min, 50% max da largura da tela
      const min = Math.max(300, window.innerWidth * 0.15);
      const max = window.innerWidth * 0.5;
      return Math.max(min, Math.min(max, val));
    } catch {
      return 400;
    }
  });
  const [isDraggingSideScript, setIsDraggingSideScript] = useState(false);

  const [scriptFontSize, setScriptFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("vhub_script_font_size");
      const val = saved ? Number(saved) : 16;
      return Math.max(12, Math.min(24, val));
    } catch {
      return 16;
    }
  });

  const [optimisticRemovingTakeIds, setOptimisticRemovingTakeIds] = useState<Set<string>>(new Set());
  const [recordingAvailability, setRecordingAvailability] = useState<Record<string, RecordingAvailabilityState>>({});
  const [recordingPlayableUrls, setRecordingPlayableUrls] = useState<Record<string, string>>({});
  const cachedRecordingBlobUrlsRef = useRef<Record<string, string>>({});

  const [textControlPopupOpen, setTextControlPopupOpen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (!scriptAutoFollow || !scriptViewportRef.current || isPlaying === false) return;
    
    const viewport = scriptViewportRef.current;
    const scrollHeight = viewport.scrollHeight;
    const clientHeight = viewport.clientHeight;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll <= 0 || videoDuration <= 0) return;

    // Teleprompter: Rolagem suave contínua baseada no tempo do vídeo e velocidade ajustável
    const scrollPos = (videoTime / videoDuration) * maxScroll * teleprompterSpeed;
    console.log(`[Teleprompter] Scrolling to ${scrollPos} with speed ${teleprompterSpeed}`);
    
    viewport.scrollTo({
      top: scrollPos,
      behavior: "smooth"
    });
  }, [videoTime, videoDuration, scriptAutoFollow, teleprompterSpeed, isPlaying]);

  useEffect(() => {
    const handleActivity = () => {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      controlsTimeoutRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    };

    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("touchstart", handleActivity);
    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDraggingVideoTextSplit || isMobile) return;
    const handlePointerMove = (event: PointerEvent) => {
      const container = desktopVideoTextContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const localY = event.clientY - rect.top;
      const next = (localY / rect.height) * 100;
      // Script height = 100 - next. Se scriptHeight <= 50%, então next >= 50%.
      // Mínimo 20% para o roteiro, logo next <= 80%.
      const constrained = Math.max(50, Math.min(80, next));
      setDesktopVideoTextSplit(constrained);
      localStorage.setItem("vhub_desktop_video_text_split", String(constrained));
    };
    const handlePointerUp = () => setIsDraggingVideoTextSplit(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingVideoTextSplit, isMobile]);

  useEffect(() => {
    if (!isDraggingSideScript || isMobile) return;
    const handlePointerMove = (event: PointerEvent) => {
      // Limites: 15% min, 50% max da largura da tela
      const min = Math.max(300, window.innerWidth * 0.15);
      const max = window.innerWidth * 0.5;
      const nextWidth = window.innerWidth - event.clientX;
      const constrained = Math.max(min, Math.min(max, nextWidth));
      setSideScriptWidth(constrained);
      localStorage.setItem("vhub_side_script_width", String(constrained));
    };
    const handlePointerUp = () => setIsDraggingSideScript(false);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDraggingSideScript, isMobile]);

  const changeScriptFontSize = (delta: number) => {
    setScriptFontSize(prev => {
      const next = prev + delta;
      const constrained = Math.max(12, Math.min(24, next));
      localStorage.setItem("vhub_script_font_size", String(constrained));
      return constrained;
    });
  };

  const [textControllerUserIds, setTextControllerUserIds] = useState<Set<string>>(new Set());
  const [presenceUsers, setPresenceUsers] = useState<any[]>([]);

  const mySessionRole = useMemo(() => {
    const participantRole = session?.participants?.find((p: any) => p.userId === user?.id)?.role;
    if (participantRole) return normalizeRoomRole(participantRole);
    return normalizeRoomRole(user?.role);
  }, [session?.participants, user?.id, user?.role]);
  const uiRole = useMemo(() => resolveUiRole(mySessionRole, Boolean(user?.id && textControllerUserIds.has(user.id))), [mySessionRole, user?.id, textControllerUserIds]);
  const isPlatformOwner = useMemo(() => {
    const normalized = normalizeRoomRole(user?.role);
    return normalized === "platform_owner" || normalized === "master";
  }, [user?.role]);
  const canReleaseText = hasUiPermission(uiRole, "text_control");
  const canTextControl = hasUiPermission(uiRole, "text_control");
  const canViewOnlineUsers = hasUiPermission(uiRole, "presence_view");
  const canManageAudio = hasUiPermission(uiRole, "audio_control");
  const canApproveTake = hasUiPermission(uiRole, "approve_take");
  const canDiscardTake = isPlatformOwner;
  const canAccessDashboard = hasUiPermission(uiRole, "dashboard_access");
  const isPrivileged = canManageAudio || canTextControl;
  const scopedRecordings = useMemo(() => {
    const source = Array.isArray(recordingsList) ? recordingsList : [];
    return [...source].sort((a: any, b: any) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
  }, [recordingsList]);
  useEffect(() => {
    setRecordingAvailability((prev) => {
      const next: Record<string, RecordingAvailabilityState> = {};
      scopedRecordings.forEach((take: any) => {
        const id = String(take?.id || "");
        if (!id) return;
        next[id] = prev[id] || (take?.audioUrl || take?.id ? "loading" : "error");
      });
      return next;
    });
  }, [scopedRecordings]);
  useEffect(() => {
    setRecordingsPage(1);
  }, [recordingsScope, recordingsSearch, recordingsDateFrom, recordingsDateTo, recordingsSortBy, recordingsSortDir]);
  useEffect(() => {
    const currentId = String(recordingsPlayerOpenId || "");
    if (!currentId) return;
    const audio = recordingRowAudioRefs.current[currentId];
    if (!audio) return;
    audio.playbackRate = recordingsPlaybackRate;
  }, [recordingsPlayerOpenId, recordingsPlaybackRate]);
  useEffect(() => {
    return () => {
      Object.values(cachedRecordingBlobUrlsRef.current).forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {}
      });
      cachedRecordingBlobUrlsRef.current = {};
      
      // Limpar o cache de mídia do navegador se necessário (opcional, dependendo da política de cache)
      // caches.delete("vhub_audio_takes_v1");
    };
  }, []);

  const isApproverRole = useCallback((role: string | undefined | null) => {
    if (!role) return false;
    return hasUiPermission(resolveUiRole(role, false), "approve_take");
  }, []);
  const hasApproverPresent = useMemo(() => {
    return presenceUsers.some((p: any) => isApproverRole(p?.role) && p?.userId !== user?.id);
  }, [presenceUsers, isApproverRole, user?.id]);
  const onlineRosterForCurrentRole = useMemo(() => {
    if (!canViewOnlineUsers) return [];
    const map = new Map<string, any>();
    presenceUsers.forEach((presence) => {
      if (!presence?.userId) return;
      map.set(String(presence.userId), presence);
    });
    return Array.from(map.values());
  }, [presenceUsers, canViewOnlineUsers]);
  const textControlCandidates = useMemo(() => {
    return presenceUsers.filter((presence: any) => canReceiveTextControl(presence?.role));
  }, [presenceUsers]);

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

  const applyScriptLinePatch = useCallback((lineIndex: number, patch: ScriptLineOverride) => {
    if (!Number.isInteger(lineIndex) || lineIndex < 0) return;
    setLineOverrides((prev) => {
      const current = prev[lineIndex] || {};
      return {
        ...prev,
        [lineIndex]: { ...current, ...patch },
      };
    });
  }, []);

  const pushEditHistory = useCallback((lineIndex: number, field: "character" | "text" | "timecode", before: string, after: string, by: string) => {
    if (before === after) return;
    const entry = {
      id: `${lineIndex}_${field}_${Date.now()}`,
      field,
      before,
      after,
      at: new Date().toISOString(),
      by,
    };
    setLineEditHistory((prev) => {
      const list = prev[lineIndex] || [];
      return {
        ...prev,
        [lineIndex]: [entry, ...list].slice(0, 25),
      };
    });
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/video-sync?sessionId=${encodeURIComponent(sessionId)}`);
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
      } else if (msg.type === "video:play") {
        const video = videoRef.current;
        if (video) {
          if (typeof msg.currentTime === "number" && Number.isFinite(msg.currentTime)) {
            const drift = Math.abs(video.currentTime - msg.currentTime);
            if (drift > 0.12) video.currentTime = msg.currentTime;
          }
          if (video.paused) video.play().catch(() => {});
        }
      } else if (msg.type === "video:pause") {
        const video = videoRef.current;
        if (video) {
          if (typeof msg.currentTime === "number" && Number.isFinite(msg.currentTime)) {
            video.currentTime = msg.currentTime;
          }
          if (!video.paused) video.pause();
        }
      } else if (msg.type === "video:seek") {
        if (videoRef.current && typeof msg.currentTime === "number") {
          videoRef.current.currentTime = msg.currentTime;
        }
      } else if (msg.type === "video:countdown" || msg.type === "video:countdown-start" || msg.type === "video:countdown-tick") {
        setCountdownValue(msg.count);
        if (msg.count > 0 && micState?.audioContext) {
          playCountdownBeep(micState.audioContext);
        }
      } else if (msg.type === "video:loop-preparing") {
        setLoopPreparing(true);
        const delayMs = Number(msg.delayMs || 3000);
        window.setTimeout(() => setLoopPreparing(false), delayMs);
      } else if (msg.type === "video:loop-silence-window") {
        setLoopSilenceActive(true);
        const delayMs = Number(msg.delayMs || 3000);
        window.setTimeout(() => setLoopSilenceActive(false), delayMs);
      } else if (msg.type === "video:sync-loop") {
        if (msg.loopRange && typeof msg.loopRange.start === "number" && typeof msg.loopRange.end === "number") {
          setCustomLoop({ start: msg.loopRange.start, end: msg.loopRange.end });
          setIsLooping(true);
        } else {
          setCustomLoop(null);
          setIsLooping(false);
        }
      } else if (msg.type === "text-control:update-line") {
        const patch: ScriptLineOverride = {};
        if (typeof msg.text === "string") patch.text = msg.text;
        if (typeof msg.character === "string") patch.character = msg.character;
        if (typeof msg.start === "number" && Number.isFinite(msg.start)) patch.start = msg.start;
        applyScriptLinePatch(msg.lineIndex, patch);
        if (msg.history && typeof msg.history === "object") {
          pushEditHistory(
            msg.lineIndex,
            msg.history.field,
            String(msg.history.before ?? ""),
            String(msg.history.after ?? ""),
            String(msg.history.by || "Usuário")
          );
        }
      } else if (msg.type === "text-control:set-controllers" || msg.type === "text-control:state") {
        const ids = Array.isArray(msg.targetUserIds) ? msg.targetUserIds : msg.controllerUserIds;
        setTextControllerUserIds(new Set(ids || []));
      } else if (msg.type === "presence:update" || msg.type === "presence-sync") {
        setPresenceUsers(msg.users);
      } else if (msg.type === "video:take-status") {
        if (String(msg.targetUserId || "") !== String(user?.id || "")) return;
        if (msg.status === "deleted") {
          toast({ title: "Um take seu foi excluído pelo diretor", variant: "destructive" });
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [sessionId, micState, user?.id, toast, applyScriptLinePatch, pushEditHistory]);

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

  useEffect(() => {
    try {
      sessionStorage.setItem(`vhub_script_follow_${sessionId}`, scriptAutoFollow ? "auto" : "manual");
    } catch {}
  }, [scriptAutoFollow, sessionId]);

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

      if (isLooping && customLoop && !loopPreparing && !loopSilenceLockRef.current) {
        const range = { start: Math.max(0, customLoop.start), end: Math.max(customLoop.start, customLoop.end) };
        if (time >= range.end) {
          loopSilenceLockRef.current = true;
          setLoopSilenceActive(true);
          video.pause();
          emitVideoEvent("pause", { currentTime: video.currentTime });
          emitVideoEvent("loop-silence-window", { start: range.start, end: range.end, delayMs: 3000 });
          if (loopSilenceTimeoutRef.current) window.clearTimeout(loopSilenceTimeoutRef.current);
          loopSilenceTimeoutRef.current = window.setTimeout(() => {
            const node = videoRef.current;
            if (!node) return;
            node.currentTime = range.start;
            emitVideoEvent("seek", { currentTime: range.start });
            node.play().catch(() => {});
            emitVideoEvent("play", { currentTime: range.start });
            setLoopSilenceActive(false);
            loopSilenceLockRef.current = false;
          }, 3000);
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
  }, [scriptLines, currentLine, isLooping, customLoop, emitVideoEvent, loopPreparing]);

  useEffect(() => {
    try {
      localStorage.setItem("vhub_device_settings", JSON.stringify(deviceSettings));
    } catch {}
  }, [deviceSettings]);

  useEffect(() => {
    if (hasPersistedDeviceSettings) return;
    const ua = navigator.userAgent.toLowerCase();
    const mobileDetected = /iphone|ipad|ipod|android/.test(ua);
    if (!mobileDetected) return;
    if (deviceSettings.voiceCaptureMode !== "original") return;
    setDeviceSettings((prev) => ({ ...prev, voiceCaptureMode: "high-fidelity" }));
    toast({
      title: "Modo lossless ativado",
      description: "Captura em alta fidelidade habilitada por padrão no dispositivo móvel.",
    });
  }, [deviceSettings.voiceCaptureMode, hasPersistedDeviceSettings, toast]);

  useEffect(() => {
    const targetSinkId = String(deviceSettings.outputDeviceId || "").trim() || "default";
    const applySink = async () => {
      const mediaTargets = [
        previewAudioRef.current as HTMLMediaElement | null,
        recordingsPreviewAudioRef.current as HTMLMediaElement | null,
        videoRef.current as HTMLMediaElement | null,
      ];
      for (const media of mediaTargets) {
        if (!media) continue;
        const sinkCapable = media as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
        if (typeof sinkCapable.setSinkId !== "function") continue;
        try {
          await sinkCapable.setSinkId(targetSinkId);
        } catch (error) {
          logAudioStep("sink-apply-error", { message: String((error as any)?.message || error), outputDeviceId: targetSinkId });
          toast({
            title: "Saída de áudio não aplicada",
            description: "Seu navegador não permitiu selecionar este dispositivo de saída.",
            variant: "destructive",
          });
          break;
        }
      }
    };
    void applySink();
  }, [deviceSettings.outputDeviceId, logAudioStep, toast]);

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
        const message = String(err?.message || err);
        if (deviceSettings.voiceCaptureMode === "high-fidelity") {
          requestMicrophone("original", deviceSettings.inputDeviceId)
            .then((fallbackState) => {
              setMicState(fallbackState);
              setMicReady(true);
              setGain(fallbackState, deviceSettings.inputGain);
              setDeviceSettings((prev) => ({ ...prev, voiceCaptureMode: "original" }));
              logAudioStep("microphone-fallback-original", { message });
              toast({
                title: "Lossless indisponível neste dispositivo",
                description: "Aplicado fallback automático para modo padrão.",
                variant: "destructive",
              });
            })
            .catch((fallbackError) => {
              console.error("Mic fallback error:", fallbackError);
              setMicReady(false);
              logAudioStep("microphone-error", { message: String((fallbackError as any)?.message || fallbackError) });
              toast({ title: "Erro no microfone", description: "Nao foi possivel acessar o audio.", variant: "destructive" });
            });
          return;
        }
        console.error("Mic error:", err);
        setMicReady(false);
        logAudioStep("microphone-error", { message });
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

  const pendingUploadStorageKey = `vhub_pending_takes_${sessionId}`;

  const blobToBase64 = useCallback(async (blob: Blob) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao converter áudio para cache local"));
      reader.readAsDataURL(blob);
    });
  }, []);

  const dataUrlToBlob = useCallback((dataUrl: string) => {
    const [meta, base64] = String(dataUrl || "").split(",");
    const match = /data:(.*?);base64/.exec(meta || "");
    const mime = match?.[1] || "audio/wav";
    const binary = atob(base64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }, []);

  const enqueuePendingUpload = useCallback(async (input: {
    dataUrl: string;
    characterId: string;
    voiceActorId: string;
    lineIndex: number;
    durationSeconds: number;
    startTimeSeconds: number;
    qualityScore: number | null;
    isPreferred: boolean;
  }) => {
    try {
      const existingRaw = localStorage.getItem(pendingUploadStorageKey);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const next = [input, ...existing].slice(0, 20);
      localStorage.setItem(pendingUploadStorageKey, JSON.stringify(next));
    } catch {}
  }, [pendingUploadStorageKey]);

  const flushPendingUploads = useCallback(async () => {
    let pending: any[] = [];
    try {
      const raw = localStorage.getItem(pendingUploadStorageKey);
      pending = raw ? JSON.parse(raw) : [];
    } catch {
      pending = [];
    }
    if (!pending.length) return;
    const stillPending: any[] = [];
    for (const item of pending) {
      try {
        const formData = new FormData();
        formData.append("audio", dataUrlToBlob(item.dataUrl), `take_retry_${sessionId}_${Date.now()}.wav`);
        formData.append("characterId", String(item.characterId));
        formData.append("voiceActorId", String(item.voiceActorId));
        formData.append("lineIndex", String(item.lineIndex));
        formData.append("durationSeconds", String(item.durationSeconds));
        formData.append("startTimeSeconds", String(item.startTimeSeconds));
        formData.append("isPreferred", String(Boolean(item.isPreferred)));
        if (item.qualityScore !== null && item.qualityScore !== undefined) {
          formData.append("qualityScore", String(item.qualityScore));
        }
        await authFetch(`/api/sessions/${sessionId}/takes`, { method: "POST", body: formData });
      } catch {
        stillPending.push(item);
      }
    }
    try {
      localStorage.setItem(pendingUploadStorageKey, JSON.stringify(stillPending));
    } catch {}
    await queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "takes"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "recordings"] });
  }, [pendingUploadStorageKey, dataUrlToBlob, sessionId, queryClient]);

  useEffect(() => {
    flushPendingUploads().catch(() => {});
    const onOnline = () => { flushPendingUploads().catch(() => {}); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flushPendingUploads]);

  const uploadTakeForDirector = useCallback(async (input: {
    wavBlob: Blob;
    durationSeconds: number;
    qualityScore: number | null;
    autoApprove: boolean;
    lineIndex: number;
    startTimeSeconds: number;
  }) => {
    if (!recordingProfile) {
      throw new Error("Perfil de gravação não configurado.");
    }
    logAudioStep("upload-started", {
      lineIndex: input.lineIndex,
      durationSeconds: input.durationSeconds,
      autoApprove: input.autoApprove,
    });
    const formData = new FormData();
    formData.append("audio", input.wavBlob, `take_${sessionId}_${Date.now()}.wav`);
    formData.append("characterId", recordingProfile.characterId);
    formData.append("voiceActorId", user?.id || recordingProfile.voiceActorId || "");
    formData.append("lineIndex", String(input.lineIndex));
    formData.append("durationSeconds", String(input.durationSeconds));
    formData.append("startTimeSeconds", String(input.startTimeSeconds));
    if (input.qualityScore !== null && input.qualityScore !== undefined) {
      formData.append("qualityScore", String(input.qualityScore));
    }
    formData.append("isPreferred", String(input.autoApprove));
    const take = await authFetch(`/api/sessions/${sessionId}/takes`, {
      method: "POST",
      body: formData,
    });
    if (!take?.id || !take?.audioUrl) {
      throw new Error("Persistência inválida: resposta de take incompleta.");
    }
    setLastUploadedTakeId(take.id);
    logAudioStep("upload-created", { takeId: take.id, audioUrl: take.audioUrl, lineIndex: input.lineIndex });
    const localRecord = {
      ...take,
      characterName: recordingProfile.characterName || null,
      voiceActorName: recordingProfile.voiceActorName || user?.displayName || user?.fullName || null,
      status: "approved",
      takeVersion: 1,
      createdAt: take.createdAt || new Date().toISOString(),
    };
    queryClient.setQueryData(["/api/sessions", sessionId, "recordings"], (prev: any) => {
      const list = Array.isArray(prev) ? prev : [];
      const without = list.filter((item: any) => item.id !== localRecord.id);
      return [localRecord, ...without];
    });
    queryClient.setQueryData(["/api/sessions", sessionId, "takes"], (prev: any) => {
      const list = Array.isArray(prev) ? prev : [];
      const without = list.filter((item: any) => item.id !== take.id);
      return [take, ...without];
    });
    await queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "takes"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "recordings"] });
    const recordingsAfterSave = await authFetch(`/api/sessions/${sessionId}/recordings`);
    const persisted = Array.isArray(recordingsAfterSave) && recordingsAfterSave.some((item: any) => item.id === take.id);
    logAudioStep("upload-integrity-check", { takeId: take.id, persisted });
    if (!persisted) {
      throw new Error("Persistência inválida: take não encontrado na aba de gravações.");
    }
    setRecordingAvailability((prev) => ({ ...prev, [String(take.id || "")]: "available" }));
    return take;
  }, [recordingProfile, sessionId, user?.id, user?.displayName, user?.fullName, queryClient, logAudioStep]);

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
    
    if (isLooping && customLoop) {
      const expectedDuration = customLoop.end - Math.max(0, customLoop.start - 3);
      if (result.durationSeconds + 0.15 < expectedDuration) {
        toast({
          title: "Loop incompleto",
          description: "A última fala do loop não foi gravada por completo.",
          variant: "destructive",
        });
        setRecordingStatus("idle");
        setLastRecording(null);
        setQualityMetrics(null);
        return;
      }
    }

    // Gerar blob local para preview
    const wavBuffer = encodeWav(result.samples);
    const wavBlob = wavToBlob(wavBuffer);
    const objectUrl = URL.createObjectURL(wavBlob);

    setPendingTake({
      samples: result.samples,
      durationSeconds: result.durationSeconds,
      sampleRate: result.sampleRate,
      metrics,
      blob: wavBlob,
      url: objectUrl,
      lineIndex: currentLine,
      startTimeSeconds: Number(videoRef.current?.currentTime || 0),
    });

    setRecordingStatus("recorded");
    setLastRecording(result);
  }, [recordingStatus, micState, emitVideoEvent, logAudioStep, toast, isLooping, customLoop, currentLine]);

  const handleApproveTake = useCallback(async () => {
    if (!pendingTake) return;
    try {
      setIsSaving(true);
      const startedAt = performance.now();
      await uploadTakeForDirector({
        wavBlob: pendingTake.blob,
        durationSeconds: pendingTake.durationSeconds,
        qualityScore: pendingTake.metrics.score,
        autoApprove: true,
        lineIndex: pendingTake.lineIndex,
        startTimeSeconds: pendingTake.startTimeSeconds,
      });
      const elapsedMs = performance.now() - startedAt;
      if (elapsedMs > 3000) {
        toast({ title: "Salvamento acima da meta", description: `${Math.round(elapsedMs)}ms`, variant: "destructive" });
      }
      toast({ title: "Take gravado com sucesso" });
      await logFeatureAudit("room.take.auto_saved", { lineIndex: pendingTake.lineIndex });
      
      // Cleanup
      URL.revokeObjectURL(pendingTake.url);
      setPendingTake(null);
      setRecordingStatus("idle");
      setLastRecording(null);
      setQualityMetrics(null);
    } catch (err: any) {
      logAudioStep("upload-error", { message: String(err?.message || err) });
      try {
        await enqueuePendingUpload({
          dataUrl: await blobToBase64(pendingTake.blob),
          characterId: recordingProfile?.characterId || "",
          voiceActorId: user?.id || recordingProfile?.voiceActorId || "",
          lineIndex: pendingTake.lineIndex,
          durationSeconds: pendingTake.durationSeconds,
          startTimeSeconds: pendingTake.startTimeSeconds,
          qualityScore: pendingTake.metrics.score,
          isPreferred: !hasApproverPresent && !isPrivileged,
        });
        toast({ title: "Sem conexão. Take salvo no cache local para reenvio automático.", variant: "destructive" });
        
        URL.revokeObjectURL(pendingTake.url);
        setPendingTake(null);
        setRecordingStatus("idle");
        setLastRecording(null);
        setQualityMetrics(null);
      } catch {}
      toast({ title: "Erro ao enviar take", description: String(err?.message || err), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [pendingTake, uploadTakeForDirector, toast, logFeatureAudit, enqueuePendingUpload, blobToBase64, recordingProfile, user?.id, hasApproverPresent, isPrivileged, logAudioStep]);

  const handleRejectTake = useCallback(() => {
    if (!pendingTake) return;
    URL.revokeObjectURL(pendingTake.url);
    setPendingTake(null);
    setRecordingStatus("idle");
    setLastRecording(null);
    setQualityMetrics(null);
    toast({ title: "Take descartado" });
  }, [pendingTake, toast]);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (isLooping && customLoop) {
        const loopStart = Math.max(0, customLoop.start);
        video.pause();
        video.currentTime = loopStart;
        emitVideoEvent("seek", { currentTime: loopStart });
        if (loopPreparationTimeoutRef.current) window.clearTimeout(loopPreparationTimeoutRef.current);
        setLoopPreparing(true);
        emitVideoEvent("loop-preparing", { loopStart, delayMs: 3000 });
        loopPreparationTimeoutRef.current = window.setTimeout(() => {
          const node = videoRef.current;
          if (!node) return;
          node.currentTime = loopStart;
          emitVideoEvent("seek", { currentTime: loopStart });
          node.play().catch(() => {});
          emitVideoEvent("play", { currentTime: loopStart });
          setLoopPreparing(false);
        }, 3000);
        return;
      }
      video.play().catch(() => {});
      emitVideoEvent("play", { currentTime: video.currentTime });
    } else {
      video.pause();
      emitVideoEvent("pause", { currentTime: video.currentTime });
    }
  }, [emitVideoEvent, isLooping, customLoop]);

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
      const normalizedStartIndex = Math.min(startIndex, index);
      const normalizedEndIndex = Math.max(startIndex, index);
      const startLine = scriptLines[normalizedStartIndex] || line;
      const endLine = scriptLines[normalizedEndIndex] || line;
      const start = startLine.start;
      const baseEnd = endLine.end || (endLine.start + 2);
      const nextLine = scriptLines[normalizedEndIndex + 1];
      const secondNextLine = scriptLines[normalizedEndIndex + 2];
      const calculatedPostRoll = nextLine && secondNextLine
        ? Math.max(0.25, secondNextLine.start - nextLine.start)
        : 1;
      const end = baseEnd + calculatedPostRoll;
      setCustomLoop({ start, end });
      setLoopRangeMeta({ startIndex: normalizedStartIndex, endIndex: normalizedEndIndex });
      setLoopSelectionMode("idle");
      setIsLooping(true);
      setPreRoll(3);
      setPostRoll(calculatedPostRoll);
      toast({ title: "Loop definido", description: "Preroll de 3s e posroll adaptativo aplicados." });
      emitVideoEvent("sync-loop", { loopRange: { start, end } });
      logFeatureAudit("room.loop.defined", { start, end, startLineIndex: normalizedStartIndex, endLineIndex: normalizedEndIndex });
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
    if (loopSelectionMode !== "idle" || customLoop) {
      setLoopSelectionMode("idle");
      setIsLooping(false);
      setCustomLoop(null);
      setLoopRangeMeta(null);
      setLoopAnchorIndex(null);
      setPreRoll(1);
      setPostRoll(1);
      await logFeatureAudit("room.loop.cleared");
      return;
    }
    setLoopSelectionMode("selecting-start");
    setCustomLoop(null);
    setLoopRangeMeta(null);
    setLoopAnchorIndex(null);
    await logFeatureAudit("room.loop.selection_started");
    toast({ title: "Selecione a primeira fala do loop" });
  }, [loopSelectionMode, customLoop, logFeatureAudit, toast]);

  const handleDiscard = useCallback(() => {
    setLastRecording(null);
    setQualityMetrics(null);
    setRecordingStatus("idle");
  }, []);

  const startInlineEdit = useCallback((lineIndex: number, field: "character" | "text" | "timecode") => {
    const line = scriptLines[lineIndex];
    if (!line) return;
    const initial = field === "character" ? line.character : field === "text" ? line.text : formatTimecodeByFormat(line.start, "HH:MM:SS", 24);
    setEditingField({ lineIndex, field });
    setEditingDraftValue(initial);
  }, [scriptLines]);

  const cancelInlineEdit = useCallback(() => {
    setEditingField(null);
    setEditingDraftValue("");
  }, []);

  const saveInlineEdit = useCallback(() => {
    if (!editingField) return;
    const line = scriptLines[editingField.lineIndex];
    if (!line) return;
    const by = String(user?.displayName || user?.fullName || "Usuário");
    const patch: ScriptLineOverride = {};
    let before = "";
    let after = "";
    if (editingField.field === "character") {
      before = line.character;
      after = editingDraftValue.trim();
      if (!after) {
        toast({ title: "Nome do personagem inválido", variant: "destructive" });
        return;
      }
      patch.character = after;
    } else if (editingField.field === "text") {
      before = line.text;
      after = editingDraftValue.trim();
      if (!after) {
        toast({ title: "Texto da fala inválido", variant: "destructive" });
        return;
      }
      patch.text = after;
    } else {
      const candidate = editingDraftValue.trim();
      if (!/^\d{2}:[0-5]\d:[0-5]\d$/.test(candidate)) {
        toast({ title: "Timecode inválido", description: "Use o formato HH:MM:SS.", variant: "destructive" });
        return;
      }
      before = formatTimecodeByFormat(line.start, "HH:MM:SS", 24);
      after = candidate;
      patch.start = parseTimecode(candidate);
    }
    applyScriptLinePatch(editingField.lineIndex, patch);
    pushEditHistory(editingField.lineIndex, editingField.field, before, after, by);
    emitTextControlEvent("text-control:update-line", {
      lineIndex: editingField.lineIndex,
      ...patch,
      history: { field: editingField.field, before, after, by },
    });
    setEditingField(null);
    setEditingDraftValue("");
    toast({ title: "Alteração salva", description: `${editingField.field} atualizado com sucesso.` });
  }, [editingField, scriptLines, user?.displayName, user?.fullName, editingDraftValue, toast, applyScriptLinePatch, pushEditHistory, emitTextControlEvent]);

  const toggleUserTextControl = useCallback((targetUserId: string) => {
    if (!canReleaseText) return;
    const hasPermission = textControllerUserIds.has(targetUserId);
    emitTextControlEvent(hasPermission ? "text-control:revoke-controller" : "text-control:grant-controller", { targetUserId });
  }, [canReleaseText, textControllerUserIds, emitTextControlEvent]);

  const getTakeStreamUrl = useCallback((take: any) => {
    const takeId = String(take?.id || "").trim();
    if (!takeId) return "";
    return `/api/takes/${takeId}/stream`;
  }, []);

  const validateTakeAudioBlob = useCallback(async (take: any, blob: Blob) => {
    if (!blob || blob.size <= 0) {
      throw new Error("Arquivo vazio.");
    }
    const maxBytes = 100 * 1024 * 1024;
    if (blob.size > maxBytes) {
      throw new Error("Arquivo excede o limite de 100MB.");
    }
    const name = String(take?.fileName || take?.audioUrl || "").toLowerCase();
    const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
    const type = String(blob.type || "").toLowerCase();
    const validExt = [".mp3", ".wav", ".m4a"].includes(ext);
    const validType = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/mp4", "audio/m4a", "audio/x-m4a"].some((item) => type.startsWith(item));
    if (!validExt && !validType) {
      throw new Error("Formato de áudio não suportado.");
    }
    const duration = await new Promise<number>((resolve, reject) => {
      const probeUrl = URL.createObjectURL(blob);
      const probeAudio = new Audio();
      const timeout = window.setTimeout(() => {
        probeAudio.src = "";
        URL.revokeObjectURL(probeUrl);
        reject(new Error("Tempo limite ao validar metadados do áudio."));
      }, 12000);
      probeAudio.preload = "metadata";
      probeAudio.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        const value = Number(probeAudio.duration || 0);
        probeAudio.src = "";
        URL.revokeObjectURL(probeUrl);
        resolve(value);
      };
      probeAudio.onerror = () => {
        window.clearTimeout(timeout);
        probeAudio.src = "";
        URL.revokeObjectURL(probeUrl);
        reject(new Error("Arquivo de áudio corrompido ou inválido."));
      };
      probeAudio.src = probeUrl;
    });
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("Duração inválida do arquivo de áudio.");
    }
  }, []);

  const resolveTakePlayableUrl = useCallback(async (take: any, opts?: { prefetch?: boolean }) => {
    const takeId = String(take?.id || "");
    if (!takeId) throw new Error("Take inválido.");
    const inMemory = cachedRecordingBlobUrlsRef.current[takeId];
    if (inMemory) return inMemory;
    const streamUrl = getTakeStreamUrl(take);
    if (!streamUrl) throw new Error("URL de stream indisponível.");
    
    setRecordingsIsLoading(prev => {
      const next = new Set(prev);
      next.add(takeId);
      return next;
    });
    setRecordingAvailability((prev) => ({ ...prev, [takeId]: "loading" }));

    try {
      const cacheStorage = typeof window !== "undefined" && "caches" in window ? await caches.open("vhub_audio_takes_v1").catch(() => null) : null;
      const cacheRequest = new Request(streamUrl, { credentials: "include" });
      if (cacheStorage) {
        const cachedResponse = await cacheStorage.match(cacheRequest);
        if (cachedResponse?.ok) {
          const blob = await cachedResponse.blob();
          await validateTakeAudioBlob(take, blob);
          const objectUrl = URL.createObjectURL(blob);
          cachedRecordingBlobUrlsRef.current[takeId] = objectUrl;
          setRecordingPlayableUrls((prev) => ({ ...prev, [takeId]: objectUrl }));
          setRecordingAvailability((prev) => ({ ...prev, [takeId]: "available" }));
          return objectUrl;
        }
      }

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), opts?.prefetch ? 15000 : 30000);
      const startedAt = performance.now();
      try {
        const response = await fetch(streamUrl, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Arquivo inacessível (${response.status})`);
        }
        const blob = await response.blob();
        await validateTakeAudioBlob(take, blob);
        if (cacheStorage) {
          await cacheStorage.put(cacheRequest, new Response(blob, { headers: { "content-type": blob.type || "audio/wav" } })).catch(() => {});
        }
        const objectUrl = URL.createObjectURL(blob);
        cachedRecordingBlobUrlsRef.current[takeId] = objectUrl;
        setRecordingPlayableUrls((prev) => ({ ...prev, [takeId]: objectUrl }));
        setRecordingAvailability((prev) => ({ ...prev, [takeId]: "available" }));
        console.info("[Room][Audio] take carregado", {
          takeId,
          bytes: blob.size,
          contentType: blob.type || null,
          elapsedMs: Math.round(performance.now() - startedAt),
        });
        return objectUrl;
      } catch (error: any) {
        setRecordingAvailability((prev) => ({ ...prev, [takeId]: "error" }));
        throw new Error(error?.name === "AbortError" ? "Tempo limite ao carregar áudio." : String(error?.message || error));
      } finally {
        window.clearTimeout(timeout);
      }
    } finally {
      setRecordingsIsLoading(prev => {
        const next = new Set(prev);
        next.delete(takeId);
        return next;
      });
    }
  }, [getTakeStreamUrl, validateTakeAudioBlob]);

  useEffect(() => {
    if (!recordingsOpen) return;
    const targets = scopedRecordings.slice(0, 4);
    if (targets.length === 0) return;
    let cancelled = false;
    const run = async () => {
      for (const take of targets) {
        if (cancelled) break;
        const id = String(take?.id || "");
        const availability = recordingAvailability[id];
        if (!id || availability === "available" || availability === "loading" || availability === "error") continue;
        try {
          await resolveTakePlayableUrl(take, { prefetch: true });
        } catch {}
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [recordingsOpen, scopedRecordings, resolveTakePlayableUrl, recordingAvailability]);

  const handleDownloadTake = useCallback(async (take: any) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 45000);
    try {
      const takeId = String(take?.id || "");
      if (!takeId) throw new Error("Take inválido.");
      const response = await fetch(`/api/takes/${takeId}/download`, {
        credentials: "include",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Falha ao baixar take (${response.status})`);
      }
      const blob = await response.blob();
      if (!blob || blob.size <= 0) {
        throw new Error("Arquivo vazio ou indisponível.");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = take?.fileName || `take_${take.characterName}_${take.lineIndex}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      toast({ title: "Erro ao baixar take", description: String((err as any)?.message || err), variant: "destructive" });
      throw err;
    } finally {
      window.clearTimeout(timeout);
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

  useEffect(() => {
    if (isLooping) return;
    setLoopPreparing(false);
    setLoopSilenceActive(false);
    loopSilenceLockRef.current = false;
    if (loopPreparationTimeoutRef.current) {
      window.clearTimeout(loopPreparationTimeoutRef.current);
      loopPreparationTimeoutRef.current = null;
    }
    if (loopSilenceTimeoutRef.current) {
      window.clearTimeout(loopSilenceTimeoutRef.current);
      loopSilenceTimeoutRef.current = null;
    }
  }, [isLooping]);

  useEffect(() => {
    return () => {
      if (loopPreparationTimeoutRef.current) window.clearTimeout(loopPreparationTimeoutRef.current);
      if (loopSilenceTimeoutRef.current) window.clearTimeout(loopSilenceTimeoutRef.current);
      
      // Limpar todos os Object URLs criados para evitar memory leaks
      Object.values(cachedRecordingBlobUrlsRef.current).forEach(url => {
        try {
          URL.revokeObjectURL(url);
        } catch (e) {
          console.warn("[Room] Falha ao revogar URL no cleanup:", e);
        }
      });
      cachedRecordingBlobUrlsRef.current = {};
      
      if (pendingTake?.url) {
        URL.revokeObjectURL(pendingTake.url);
      }
    };
  }, [pendingTake?.url]);

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

      {textControlPopupOpen && canReleaseText && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-md" style={{ zIndex: UI_LAYER_BASE.modalOverlay }}>
          <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[620px] overflow-hidden border border-border/70 bg-card/95 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">Liberar Texto</span>
                <span className="text-[10px] px-2 py-1 rounded-full border bg-muted/60 text-muted-foreground">
                  {textControllerUserIds.size} autorizados
                </span>
              </div>
              <button onClick={() => setTextControlPopupOpen(false)} className="transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 max-h-[420px] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-12 text-[10px] uppercase text-muted-foreground tracking-wider pb-2 border-b border-border/60">
                <span className="col-span-5">Usuário</span>
                <span className="col-span-3">Perfil</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2 text-right">Permissão</span>
              </div>
              <div className="space-y-1 mt-2">
                {textControlCandidates.map((presence: any) => {
                  const allowed = textControllerUserIds.has(String(presence.userId || ""));
                  return (
                    <div key={presence.userId} className="grid grid-cols-12 items-center text-xs py-2 px-2 rounded-md hover:bg-muted/40">
                      <span className="col-span-5 truncate text-foreground">{presence.name || presence.userId}</span>
                      <span className="col-span-3 text-muted-foreground">{normalizeRoomRole(presence.role)}</span>
                      <span className="col-span-2 flex items-center gap-1 text-emerald-500">
                        <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        online
                      </span>
                      <div className="col-span-2 flex justify-end">
                        <button
                          onClick={() => toggleUserTextControl(String(presence.userId || ""))}
                          className={cn(
                            "h-7 px-2 rounded-md text-[11px] border transition-colors",
                            allowed
                              ? "bg-destructive/15 text-destructive border-destructive/30 hover:bg-destructive/25"
                              : "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25"
                          )}
                          data-testid={`button-toggle-text-control-${presence.userId}`}
                        >
                          {allowed ? "Revogar" : "Liberar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {textControlCandidates.length === 0 && (
                  <div className="text-sm text-center py-10 text-muted-foreground">
                    Nenhum dublador ou aluno online no momento
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {recordingsOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-md" style={{ zIndex: UI_LAYER_BASE.modalOverlay }}>
          <div className="rounded-2xl w-[calc(100vw-32px)] max-w-[720px] overflow-hidden border border-border/70 bg-card/95 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border/70">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">Gravações</span>
                {isPrivileged && (
                  <button
                    onClick={() => setRecordingsScope((v) => (v === "all" ? "mine" : "all"))}
                    className="text-[10px] px-2 py-1 rounded-full border bg-muted/60 text-muted-foreground"
                  >
                    {recordingsScope === "all" ? "Todas" : "Minhas"}
                  </button>
                )}
              </div>
              <button onClick={() => setRecordingsOpen(false)} className="transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            {canViewOnlineUsers && (
              <div className="px-6 pt-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-emerald-500 font-medium">Online agora:</span>
                  {onlineRosterForCurrentRole.map((presence: any) => (
                    <span key={presence.userId} className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {presence.name || presence.userId}
                    </span>
                  ))}
                  {onlineRosterForCurrentRole.length === 0 && <span>Nenhum usuário online</span>}
                </div>
              </div>
            )}
            <div className="px-6 pt-3 pb-2 border-b border-border/40">
              <div className="grid gap-2 md:grid-cols-5">
                <input
                  value={recordingsSearch}
                  onChange={(event) => setRecordingsSearch(event.target.value)}
                  placeholder="Buscar por personagem, usuário ou ID"
                  className="h-8 md:col-span-2 rounded-md border border-border bg-background px-2 text-xs"
                />
                <select
                  value={recordingsSortBy}
                  onChange={(event) => setRecordingsSortBy(event.target.value as any)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="createdAt">Data</option>
                  <option value="durationSeconds">Duração</option>
                  <option value="lineIndex">Linha</option>
                  <option value="characterName">Personagem</option>
                </select>
                <select
                  value={recordingsSortDir}
                  onChange={(event) => setRecordingsSortDir(event.target.value as any)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
                <select
                  value={String(recordingsPlaybackRate)}
                  onChange={(event) => setRecordingsPlaybackRate(Number(event.target.value))}
                  className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                >
                  <option value="0.75">0.75x</option>
                  <option value="1">1x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                  <option value="2">2x</option>
                </select>
              </div>
              <div className="grid gap-2 md:grid-cols-4 mt-2">
                <input type="date" value={recordingsDateFrom} onChange={(event) => setRecordingsDateFrom(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs" />
                <input type="date" value={recordingsDateTo} onChange={(event) => setRecordingsDateTo(event.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs" />
                <div className="md:col-span-2 text-[11px] text-muted-foreground flex items-center justify-end">
                  {recordingsResponse?.total || 0} gravações · página {recordingsResponse?.page || 1}/{recordingsResponse?.pageCount || 1}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 max-h-[420px] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-12 text-[10px] uppercase text-muted-foreground tracking-wider pb-2 border-b border-border/60">
                <span className="col-span-2">Linha</span>
                <span className="col-span-3">Personagem</span>
                <span className="col-span-2">Dublador</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-1 text-right">Duração</span>
                <span className="col-span-2 text-right">Ações</span>
              </div>
              <div className="space-y-1 mt-2">
                {scopedRecordings.map((take: any) => (
                  <div
                    key={take.id}
                    className={cn(
                      "rounded-md hover:bg-muted/40 px-2 py-2 transition-all duration-300",
                      optimisticRemovingTakeIds.has(String(take.id)) && "opacity-0 -translate-y-2 scale-[0.98] pointer-events-none"
                    )}
                  >
                    <div className="grid grid-cols-12 items-center text-xs">
                      <span className="col-span-2 font-mono text-muted-foreground">#{take.lineIndex}</span>
                      <span className="col-span-3 truncate">{take.characterName || "-"}</span>
                      <span className="col-span-2 font-mono">{take.voiceActorName || "N/A"}</span>
                      <span className={cn("col-span-2 flex items-center gap-1.5", "text-emerald-500")}>
                        <span>Salvo</span>
                        <span className={cn(
                          "inline-flex h-1.5 w-1.5 rounded-full",
                          recordingAvailability[String(take.id || "")] === "error"
                            ? "bg-red-500"
                            : recordingAvailability[String(take.id || "")] === "loading"
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        )} />
                        <span className={cn(
                          "text-[10px] inline-flex items-center gap-1",
                          recordingAvailability[String(take.id || "")] === "error"
                            ? "text-red-500"
                            : recordingAvailability[String(take.id || "")] === "loading"
                              ? "text-amber-500"
                              : "text-emerald-500"
                        )}>
                          {recordingAvailability[String(take.id || "")] === "loading" && <Loader2 className="w-3 h-3 animate-spin" />}
                          {recordingAvailability[String(take.id || "")] === "error"
                            ? "Mídia indisponível"
                            : recordingAvailability[String(take.id || "")] === "loading"
                              ? "Carregando mídia"
                              : "Mídia disponível"}
                        </span>
                      </span>
                      <span className="col-span-1 text-right font-mono text-muted-foreground">
                        {take.durationSeconds ? `${Number(take.durationSeconds).toFixed(1)}s` : "-"}
                      </span>
                      <div className="col-span-2 flex items-center justify-end gap-1.5">
                        <button
                          disabled={recordingsIsLoading.has(String(take.id))}
                          onClick={async () => {
                            const audio = recordingsPreviewAudioRef.current;
                            if (!audio) return;
                            const takeId = String(take?.id || "");
                            if (!takeId) return;
                            if (recordingsPreviewId === take.id && !audio.paused) {
                              audio.pause();
                              setRecordingsPreviewId(null);
                              setRecordingsPlayerOpenId(null);
                              return;
                            }
                            try {
                              const immediateUrl = recordingPlayableUrls[takeId];
                              if (immediateUrl) {
                                audio.src = immediateUrl;
                                await audio.play();
                                setRecordingsPreviewId(take.id);
                                setRecordingsPlayerOpenId(take.id);
                                return;
                              }

                              setRecordingAvailability((prev) => ({ ...prev, [takeId]: "loading" }));
                              const resolvedUrl = await resolveTakePlayableUrl(take);
                              if (recordingsPreviewAudioRef.current) {
                                recordingsPreviewAudioRef.current.src = resolvedUrl;
                                await recordingsPreviewAudioRef.current.play();
                                setRecordingsPreviewId(take.id);
                                setRecordingsPlayerOpenId(take.id);
                              }
                            } catch (err) {
                              setRecordingAvailability((prev) => ({ ...prev, [String(take.id || "")]: "error" }));
                              toast({ title: "Erro ao reproduzir take", description: String((err as any)?.message || err), variant: "destructive" });
                            }
                          }}
                          className="w-7 h-7 rounded-md bg-muted/70 text-foreground hover:bg-muted flex items-center justify-center disabled:opacity-50"
                          title="Reproduzir take"
                          data-testid={`button-play-recording-${take.id}`}
                        >
                          {recordingsIsLoading.has(String(take.id)) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : recordingsPreviewId === take.id ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5 ml-0.5" />
                          )}
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              await handleDownloadTake(take);
                              setRecordingAvailability((prev) => ({ ...prev, [String(take.id || "")]: "available" }));
                            } catch {
                              setRecordingAvailability((prev) => ({ ...prev, [String(take.id || "")]: "error" }));
                            }
                          }}
                          className="w-7 h-7 rounded-md bg-muted/70 text-foreground hover:bg-muted flex items-center justify-center"
                          title="Baixar take"
                          data-testid={`button-download-recording-${take.id}`}
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canDiscardTake && (
                          <button
                            onClick={() => { setDiscardModalTake(take); setDiscardFinalStep(false); }}
                            className="h-7 px-2 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 text-[10px]"
                            title="Excluir take"
                            data-testid={`button-discard-recording-${take.id}`}
                            disabled={optimisticRemovingTakeIds.has(String(take.id))}
                          >
                            Excluir
                          </button>
                        )}
                      </div>
                    </div>
                    {recordingsPlayerOpenId === take.id && (
                      <div className="mt-2 pl-[16.8%]">
                        <audio
                          ref={(node) => { recordingRowAudioRefs.current[String(take.id)] = node; }}
                          controls
                          className="w-full h-8"
                          src={recordingPlayableUrls[String(take.id)] || getTakeStreamUrl(take)}
                          preload="none"
                          onLoadedMetadata={(event) => {
                            event.currentTarget.playbackRate = recordingsPlaybackRate;
                            setRecordingAvailability((prev) => ({ ...prev, [String(take.id || "")]: "available" }));
                          }}
                          onError={() => {
                            setRecordingAvailability((prev) => ({ ...prev, [String(take.id || "")]: "error" }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
                {scopedRecordings.length === 0 && (
                  <div className="text-sm text-center py-10 text-muted-foreground">
                    Nenhuma gravação encontrada para este filtro
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setRecordingsPage((prev) => Math.max(1, prev - 1))}
                disabled={(recordingsResponse?.page || 1) <= 1}
                className="h-8 px-3 rounded-md border border-border bg-background text-xs disabled:opacity-40"
              >
                Página anterior
              </button>
              <button
                onClick={() => setRecordingsPage((prev) => Math.min(recordingsResponse?.pageCount || 1, prev + 1))}
                disabled={(recordingsResponse?.page || 1) >= (recordingsResponse?.pageCount || 1)}
                className="h-8 px-3 rounded-md border border-border bg-background text-xs disabled:opacity-40"
              >
                Próxima página
              </button>
            </div>
          </div>
        </div>
      )}

      {discardModalTake && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm" style={{ zIndex: UI_LAYER_BASE.confirmationModal }}>
          <div className="w-[calc(100vw-32px)] max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground">Excluir take</h3>
            <p className="text-xs text-muted-foreground mt-2">
              {discardFinalStep
                ? "Tem certeza que deseja excluir permanentemente este take? Esta ação não pode ser desfeita."
                : "Você está prestes a excluir este take da sessão."}
            </p>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => { setDiscardModalTake(null); setDiscardFinalStep(false); }}
                className="h-9 px-3 rounded-lg bg-muted/70 text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!discardFinalStep) {
                    setDiscardFinalStep(true);
                    return;
                  }
                  await handleDiscardTake(discardModalTake);
                  emitVideoEvent("take-status", { status: "deleted", takeId: discardModalTake.id, targetUserId: discardModalTake.voiceActorId });
                }}
                className={cn(
                  "h-9 px-3 rounded-lg text-white",
                  discardFinalStep ? "bg-destructive hover:bg-destructive/90" : "bg-amber-600 hover:bg-amber-500"
                )}
              >
                {discardFinalStep ? "Excluir permanentemente" : "Prosseguir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <audio ref={previewAudioRef} preload="none" />
      <audio
        ref={recordingsPreviewAudioRef}
        preload="none"
        onEnded={() => {
          setRecordingsPreviewId(null);
          setRecordingsPlayerOpenId(null);
        }}
      />

      <header 
        className={cn(
          "shrink-0 flex items-center px-4 h-16 relative z-20 transition-[grid-template-columns] duration-75",
          !isMobile ? "grid" : "justify-between"
        )} 
        style={{
          background: "hsl(var(--background) / 0.90)", 
          backdropFilter: "blur(16px)", 
          WebkitBackdropFilter: "blur(16px)", 
          borderBottom: "1px solid hsl(var(--border) / 0.9)",
          gridTemplateColumns: !isMobile ? `1fr ${sideScriptWidth}px` : undefined
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button 
            onClick={() => {
              if (recordingStatus === 'recording' && !window.confirm('Você tem uma gravação em andamento. Deseja realmente sair?')) {
                return;
              }
              window.location.href = '/dashboard';
            }}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-xs sm:text-sm truncate text-foreground">{production?.name || "Sessao"}</span>
            <span className="text-[10px] text-muted-foreground truncate">{session?.title}</span>
          </div>
          
          <div className="relative ml-2">
            <button
              onClick={() => setCharSelectorOpen((v) => !v)}
              className="h-7 px-2 rounded-md bg-white/5 border border-white/10 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center gap-1.5"
              data-testid="button-character-selector"
            >
              <User className="w-3.5 h-3.5" />
              <span className="max-w-[140px] truncate">{recordingProfile?.characterName || "Personagem"}</span>
              <ChevronRight className={cn("w-3 h-3 transition-transform", charSelectorOpen && "rotate-90")} />
            </button>
            <AnimatePresence>
              {charSelectorOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-popover/95 backdrop-blur-xl border border-border shadow-2xl p-2"
                  style={{ zIndex: UI_LAYER_BASE.chatPanel }}
                >
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5 border-b border-border/60 mb-1">Selecionar personagem</div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {(charactersList || []).map((char) => (
                      <button
                        key={char.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCharacterChange(char);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-2 rounded-md text-xs transition-colors",
                          recordingProfile?.characterId === char.id ? "bg-primary/12 text-primary" : "text-foreground hover:bg-muted/60"
                        )}
                      >
                        {char.name}
                      </button>
                    ))}
                    {(!charactersList || charactersList.length === 0) && (
                      <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum personagem cadastrado.</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !scriptAutoFollow;
                      setScriptAutoFollow(next);
                      if (next) syncScrollToCurrentVideoTime();
                      logFeatureAudit("room.scroll.mode_changed", { mode: next ? "automatic" : "manual" });
                    }}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all border",
                      scriptAutoFollow
                        ? "bg-primary/20 border-primary/30 text-primary"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                    )}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{scriptAutoFollow ? "Desativar Rolagem Automática" : "Ativar Rolagem Automática"}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !onlySelectedCharacter;
                      setOnlySelectedCharacter(next);
                      logFeatureAudit("room.character_filter.toggled", { enabled: next, character: recordingProfile?.characterName || null });
                    }}
                    disabled={!recordingProfile}
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all border",
                      onlySelectedCharacter
                        ? "bg-primary/20 border-primary/30 text-primary"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10",
                      !recordingProfile && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <UserCheck className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{onlySelectedCharacter ? "Mostrar Todos os Personagens" : "Apenas Meu Personagem"}</p>
                </TooltipContent>
              </Tooltip>

            </div>
          </TooltipProvider>
        </div>

        <div className={cn(
          "flex items-center gap-2",
          !isMobile && "justify-end px-4 border-l border-white/5"
        )}>          {recordingStatus === "recording" && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-500 animate-pulse">
              <Circle className="w-2 h-2 fill-current" /> <span className="hidden xs:inline">REC</span>
            </div>
          )}
          {canViewOnlineUsers && !isMobile && (
            <div
              className="h-7 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 flex items-center gap-1.5"
              title={onlineRosterForCurrentRole.map((presence: any) => presence.name || presence.userId).join(", ")}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{onlineRosterForCurrentRole.length} online</span>
            </div>
          )}
          
          {isMobile ? (
            <>
              <button
                onClick={() => (recordingStatus === 'recording' ? handleStopRecording() : startCountdown())}
                className={cn(
                  'w-14 h-14 flex items-center justify-center rounded-full transition-all',
                  recordingStatus === 'recording'
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 animate-pulse'
                    : 'bg-primary text-primary-foreground'
                )}
                aria-label={recordingStatus === 'recording' ? 'Parar Gravação' : 'Iniciar Gravação'}
              >
                {recordingStatus === 'recording' ? (
                  <Square className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Menu principal"
              >
                <Menu className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setRecordingsOpen(true)}
                className="h-7 px-2 rounded-md bg-white/5 border border-white/10 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center gap-1"
                data-testid="button-room-recordings"
              >
                <ListMusic className="w-3.5 h-3.5" />
                Gravações
              </button>
              {canReleaseText && (
                <button
                  onClick={() => setTextControlPopupOpen(true)}
                  className="h-7 px-2 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 hover:bg-indigo-500/20 flex items-center gap-1"
                  data-testid="button-room-release-text"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Liberar Texto
                </button>
              )}
              <button
                onClick={() => setDeviceSettingsOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Configurações de dispositivos"
                data-testid="button-open-device-settings"
              >
                <Monitor className="w-4 h-4" />
              </button>
              {canAccessDashboard && (
                <Link href={`/hub-dub/studio/${studioId}/dashboard`}>
                  <button
                    onClick={() => { logFeatureAudit("room.panel.redirect", { studioId }); }}
                    className="h-7 px-2 rounded-md bg-white/5 border border-white/10 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center gap-1"
                    data-testid="button-room-panel"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    PAINEL
                  </button>
                </Link>
              )}
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

      {isMobile && (
        <DailyMeetPanel
          sessionId={sessionId}
          zIndexBase={UI_LAYER_BASE.chatPanel}
          open={dailyMeetOpen}
          onOpenChange={setDailyMeetOpen}
          mode="floating"
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div 
          className={cn(
            "flex-1 grid overflow-hidden transition-[grid-template-columns] duration-75",
            isMobile ? "grid-cols-1" : "lg:grid-cols-[1fr_auto]"
          )}
          style={isMobile ? undefined : { gridTemplateColumns: `1fr ${sideScriptWidth}px` }}
        >
          {/* Coluna Principal: Video + Texto Sincronizado */}
          <div ref={desktopVideoTextContainerRef} className="flex flex-col min-h-0 relative bg-black/40">
            <div
              className="relative overflow-hidden bg-black flex items-center justify-center min-h-[220px]"
              style={isMobile ? { flex: 1 } : { height: `${desktopVideoTextSplit}%` }}
            >
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
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/30">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5">
                    <Play className="w-7 h-7" />
                  </div>
                  <p className="text-xs">Nenhum vídeo anexado a esta produção</p>
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

              </AnimatePresence>

              <button
                onClick={() => setIsMuted((m) => !m)}
                className="absolute top-4 right-4 p-2.5 rounded-xl bg-black/50 text-white/60 hover:text-white transition-all hover:bg-black/70 border border-white/10"
                style={{ zIndex: UI_LAYER_BASE.floatingButtons }}
                aria-label={isMuted ? "Ativar som" : "Desativar som"}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {(customLoop || loopSelectionMode !== "idle" || loopPreparing || loopSilenceActive) && (
                <div className="absolute top-4 left-4 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/40 px-4 flex items-center text-[11px] text-indigo-100 z-30 backdrop-blur-md">
                  {loopPreparing && "Preparando loop... (3s)"}
                  {!loopPreparing && loopSilenceActive && "Silêncio entre loops... (3s)"}
                  {loopSelectionMode === "selecting-start" && "Loop: selecione a primeira fala"}
                  {loopSelectionMode === "selecting-end" && "Loop: selecione a última fala"}
                  {!loopPreparing && !loopSilenceActive && loopSelectionMode === "idle" && customLoop && `Loop ativo ${formatLiveTimecode(customLoop.start)} - ${formatLiveTimecode(customLoop.end)}${loopRangeMeta ? ` · Linhas ${loopRangeMeta.startIndex + 1}-${loopRangeMeta.endIndex + 1}` : ""}`}
                </div>
              )}
            </div>

            {!isMobile && (
              <div className="shrink-0 h-20 bg-zinc-950/90 border-y border-white/10 flex items-center px-8 gap-6 z-40">
                <div className="flex items-center gap-2">
                  <button onClick={() => seek(-2)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/70 hover:text-white" title="Recuar 2s">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button onClick={handlePlayPause} disabled={loopPreparing || loopSilenceActive} className="w-11 h-11 rounded-full flex items-center justify-center bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50" title={isPlaying ? "Pausar" : "Reproduzir"}>
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <button onClick={() => seek(2)} className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-white/70 hover:text-white" title="Avançar 2s">
                    <RotateCcw className="w-4 h-4" style={{ transform: "scaleX(-1)" }} />
                  </button>
                </div>
                
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-mono text-white/30 uppercase tracking-tighter">
                    <span>{formatLiveTimecode(videoTime)}</span>
                    <span>{formatLiveTimecode(videoDuration)}</span>
                  </div>
                  <div className="relative h-1.5 rounded-full bg-white/10 cursor-pointer overflow-hidden" onClick={(e) => { const rect = e.currentTarget.getBoundingClientRect(); scrub((e.clientX - rect.left) / rect.width); }}>
                    <div className="absolute top-0 bottom-0 bg-primary transition-all duration-100" style={{ width: `${videoDuration > 0 ? (videoTime / videoDuration) * 100 : 0}%` }} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={handleLoopButton} className={cn("w-9 h-9 rounded-xl flex items-center justify-center border transition-all", isLooping ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300" : "bg-white/5 border-white/10 text-white/60 hover:text-white")} title="Configurar Loop">
                    <Repeat className="w-4 h-4" />
                  </button>
                  {recordingStatus === "idle" || recordingStatus === "recorded" ? (
                    <button onClick={startCountdown} disabled={!micReady || isSaving} className="w-11 h-11 rounded-full flex items-center justify-center bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-all" title="Gravar">
                      {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                    </button>
                  ) : (
                    <button onClick={handleStopRecording} className="w-11 h-11 rounded-full flex items-center justify-center bg-red-500 animate-pulse" title="Parar Gravação">
                      <Square className="w-5 h-5 text-white fill-white" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isMobile && (
              <div
                onPointerDown={() => setIsDraggingVideoTextSplit(true)}
                className={cn(
                  "h-2 w-full cursor-row-resize flex items-center justify-center transition-all group z-30 relative",
                  isDraggingVideoTextSplit ? "bg-primary" : "bg-zinc-800/80 hover:bg-primary/50"
                )}
                aria-label="Redimensionar roteiro (máx 50%)"
                data-testid="video-text-resizer"
              >
                <div className={cn(
                  "w-12 h-0.5 rounded-full transition-all",
                  isDraggingVideoTextSplit ? "bg-white" : "bg-zinc-600 group-hover:bg-white"
                )} />
                {isDraggingVideoTextSplit && (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                    {Math.round(100 - desktopVideoTextSplit)}%
                  </div>
                )}
              </div>
            )}
            {!isMobile && (
              <div
                className="border-t border-white/10 min-h-[220px] bg-zinc-950/90"
                style={{ height: `${100 - desktopVideoTextSplit}%` }}
              >
                <DailyMeetPanel
                  sessionId={sessionId}
                  open={dailyMeetOpen}
                  onOpenChange={setDailyMeetOpen}
                  mode="embedded"
                />
              </div>
            )}

          </div>

          {/* Coluna do Roteiro (Opcional/Lateral no Desktop) */}
          {!isMobile && (
            <div className="flex flex-col min-h-0 bg-background/40 border-l border-border/60 relative group/side">
              {/* Handle de redimensionamento horizontal */}
              <div
                onPointerDown={() => setIsDraggingSideScript(true)}
                className={cn(
                  "absolute top-0 bottom-0 -left-1 w-2 cursor-ew-resize transition-all z-50 flex items-center justify-center",
                  isDraggingSideScript ? "bg-primary/40" : "hover:bg-primary/20"
                )}
                aria-label="Redimensionar largura do roteiro (máx 50%)"
              >
                <div className={cn(
                  "w-0.5 h-8 rounded-full transition-all",
                  isDraggingSideScript ? "bg-white" : "bg-zinc-600 group-hover/side:bg-white"
                )} />
                {isDraggingSideScript && (
                  <div className="absolute top-1/2 -left-12 -translate-y-1/2 bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-lg">
                    {Math.round((sideScriptWidth / window.innerWidth) * 100)}%
                  </div>
                )}
              </div>

              <div className="h-11 shrink-0 px-4 flex items-center justify-between border-b border-border/70 bg-muted/30">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Roteiro Completo
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => changeScriptFontSize(-1)} disabled={scriptFontSize <= 12} className="w-7 h-7 rounded-md flex items-center justify-center bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 transition-all">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono w-6 text-center text-white/50">{scriptFontSize}</span>
                  <button onClick={() => changeScriptFontSize(1)} disabled={scriptFontSize >= 24} className="w-7 h-7 rounded-md flex items-center justify-center bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 transition-all">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div
                ref={scriptViewportRef}
                className="flex-1 overflow-y-auto p-4 min-h-0 relative custom-scrollbar"
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
                        "mb-4 px-5 py-4 rounded-xl transition-all duration-300 relative overflow-hidden",
                        isActive ? "bg-background/85 shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.22)] backdrop-blur-md" : "bg-transparent",
                        isInLoop && "shadow-[inset_0_0_0_1px_rgba(129,140,248,0.45)] bg-indigo-500/10",
                        canTextControl ? "cursor-pointer" : "cursor-default"
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-[13px] font-mono tabular-nums text-muted-foreground">#{i + 1} · {formatLiveTimecode(line.start)}</span>
                        <span className={cn("text-[16px] font-extrabold uppercase tracking-tight", isActive ? "text-primary" : "text-muted-foreground")}>
                          {line.character}
                        </span>
                        {isDone && <CheckCircle2 className="w-4 h-4 ml-auto text-emerald-500" />}
                      </div>
                      <p 
                        className={cn("leading-relaxed", isActive ? "text-foreground font-medium" : "text-muted-foreground")}
                        style={{ fontSize: `${scriptFontSize}px` }}
                      >
                        {line.text}
                      </p>
                      {canTextControl && (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              startInlineEdit(i, "character");
                            }}
                            className="h-7 px-2 rounded-md bg-muted/70 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Personagem
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              startInlineEdit(i, "text");
                            }}
                            className="h-7 px-2 rounded-md bg-muted/70 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Fala
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              startInlineEdit(i, "timecode");
                            }}
                            className="h-7 px-2 rounded-md bg-muted/70 text-[11px] text-muted-foreground hover:text-foreground"
                          >
                            Timecode
                          </button>
                        </div>
                      )}
                      {editingField?.lineIndex === i && (
                        <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3" onClick={(event) => event.stopPropagation()}>
                          {editingField.field === "text" ? (
                            <textarea
                              value={editingDraftValue}
                              onChange={(event) => setEditingDraftValue(event.target.value)}
                              className="w-full min-h-20 rounded-md border border-border/70 bg-background px-3 py-2 text-sm text-foreground outline-none"
                            />
                          ) : (
                            <input
                              value={editingDraftValue}
                              onChange={(event) => setEditingDraftValue(event.target.value)}
                              className="w-full h-9 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground outline-none"
                            />
                          )}
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={cancelInlineEdit}
                              className="h-7 px-2 rounded-md bg-muted/70 text-[11px] text-muted-foreground hover:text-foreground"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={saveInlineEdit}
                              className="h-7 px-2 rounded-md bg-primary/20 text-[11px] text-primary hover:bg-primary/30"
                            >
                              Salvar
                            </button>
                          </div>
                        </div>
                      )}
                      {lineEditHistory[i]?.[0] && (
                        <div className="mt-2 text-[11px] text-muted-foreground">
                          Última alteração: {lineEditHistory[i][0].field} por {lineEditHistory[i][0].by}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Novo Sistema de Preview de Áudio (Mobile & Desktop) */}
        <AnimatePresence>
          {pendingTake && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-x-0 bottom-24 z-[100] px-4 pb-4 flex justify-center pointer-events-none"
            >
              <div className="w-full max-w-lg bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] p-4 sm:p-6 pointer-events-auto flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <Mic className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Preview da Gravação</h3>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                        {pendingTake.durationSeconds.toFixed(2)}s • {pendingTake.metrics.score}% Qualidade
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRejectTake}
                      disabled={isSaving}
                      className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500/20 transition-all active:scale-90 disabled:opacity-50"
                      aria-label="Rejeitar take"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleApproveTake}
                      disabled={isSaving}
                      className="h-10 px-6 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                      {isSaving ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin rounded-full" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5" />
                      )}
                      {isSaving ? "Enviando..." : "Aprovar e Enviar"}
                    </button>
                  </div>
                </div>
                
                {/* Player de Audio Local */}
                <div className="bg-black/20 rounded-2xl p-3 border border-white/5 flex items-center gap-4">
                  <audio 
                    src={pendingTake.url} 
                    controls 
                    className="w-full h-10 accent-primary"
                    controlsList="nodownload noplaybackrate"
                  />
                </div>

                {/* Métricas Rápidas */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase font-bold">Loudness</p>
                    <p className="text-xs font-mono text-white">{(pendingTake.metrics.loudness * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase font-bold">Clipping</p>
                    <p className={cn("text-xs font-mono", pendingTake.metrics.clipping ? "text-red-400" : "text-green-400")}>
                      {pendingTake.metrics.clipping ? "SIM" : "NÃO"}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-white/40 uppercase font-bold">Noise</p>
                    <p className="text-xs font-mono text-white">{(pendingTake.metrics.noiseFloor * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rodapé de Controles (Apenas Mobile ou Fallback) */}
        {isMobile && (
          <footer
            className={cn(
              "h-24 bg-zinc-950/95 backdrop-blur-xl border-t border-white/10 flex flex-col sm:flex-row items-center px-6 gap-4 sm:gap-8 transition-all duration-300 ease-in-out z-50",
              !controlsVisible && "translate-y-full opacity-0 pointer-events-none"
            )}
            onMouseEnter={() => {
              setControlsVisible(true);
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
            }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => seek(-2)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                aria-label="Recuar 2 segundos"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
              <button
                onClick={handlePlayPause}
                disabled={loopPreparing || loopSilenceActive}
                className="w-14 h-14 rounded-full flex items-center justify-center transition-all bg-primary text-primary-foreground shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label={isPlaying ? "Pausar" : "Reproduzir"}
              >
                {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button
                onClick={() => seek(2)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all bg-white/5 text-white/70 hover:text-white hover:bg-white/10 border border-white/10"
                aria-label="Avançar 2 segundos"
              >
                <RotateCcw className="w-5 h-5 flip-horizontal" style={{ transform: "scaleX(-1)" }} />
              </button>
            </div>

            <div className="flex-1 w-full flex flex-col gap-2">
              <div className="flex items-center justify-between text-[11px] font-mono text-white/40 px-1">
                <span>{formatLiveTimecode(videoTime)}</span>
                <span>{formatLiveTimecode(videoDuration)}</span>
              </div>
              <div
                className="relative h-2 rounded-full cursor-pointer group bg-white/10 overflow-hidden"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  scrub((e.clientX - rect.left) / rect.width);
                }}
              >
                <div
                  className="absolute top-0 bottom-0 rounded-full bg-primary transition-all duration-100"
                  style={{ width: `${videoDuration > 0 ? (videoTime / videoDuration) * 100 : 0}%` }}
                />
                {customLoop && videoDuration > 0 && (
                  <>
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-indigo-400 z-10"
                      style={{ left: `${Math.max(0, Math.min(100, (customLoop.start / videoDuration) * 100))}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-indigo-400 z-10"
                      style={{ left: `${Math.max(0, Math.min(100, (customLoop.end / videoDuration) * 100))}%` }}
                    />
                    <div
                      className="absolute top-0 bottom-0 bg-indigo-500/20"
                      style={{
                        left: `${Math.max(0, Math.min(100, (customLoop.start / videoDuration) * 100))}%`,
                        width: `${Math.max(0, Math.min(100, ((customLoop.end - customLoop.start) / videoDuration) * 100))}%`
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={handleLoopButton}
                className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center transition-all border",
                  loopSelectionMode !== "idle" || isLooping
                    ? "bg-indigo-500/20 border-indigo-400/50 text-indigo-300"
                    : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10"
                )}
                aria-label="Configurar loop"
              >
                <Repeat className="w-5 h-5" />
              </button>

              {recordingStatus === "idle" || recordingStatus === "recorded" ? (
                <button
                  onClick={startCountdown}
                  disabled={!micReady || isSaving}
                  className={cn(
                    "w-14 h-14 rounded-full flex items-center justify-center transition-all border shadow-xl",
                    isSaving
                      ? "opacity-50 cursor-not-allowed bg-white/5 border-white/10 text-white/20"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20 hover:scale-105 active:scale-95"
                  )}
                >
                  {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
                </button>
              ) : (
                <button
                  onClick={handleStopRecording}
                  className="w-14 h-14 rounded-full flex items-center justify-center transition-all bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse hover:scale-105 active:scale-95"
                >
                  <Square className="w-6 h-6 text-white fill-white" />
                </button>
              )}
            </div>

            {/* Toast de Aprovação Integrado no Rodapé se necessário, ou overlay acima dele */}
            {recordingStatus === "recorded" && (
              <div className="absolute bottom-full left-0 right-0 mb-4 px-6 pointer-events-none">
                <div className="max-w-md mx-auto h-12 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl flex items-center justify-between px-4 text-xs text-white/90 pointer-events-auto backdrop-blur-xl">
                  <span>Take salvo automaticamente.</span>
                </div>
              </div>
            )}
          </footer>
        )}
        </div>

      <AnimatePresence>
        {isMobile && (
          <>
            <Drawer.Root open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm" style={{ zIndex: UI_LAYER_BASE.mobileDrawerOverlay }} />
                <Drawer.Content className="bg-zinc-950 flex flex-col rounded-t-[32px] fixed bottom-0 left-0 right-0 outline-none max-h-[90vh]" style={{ zIndex: UI_LAYER_BASE.mobileDrawerContent }}>
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
                      <button
                        onClick={() => { setRecordingsOpen(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all min-h-[56px]"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <ListMusic className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-white">Gravações</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">Takes da Sessão</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>
                      {canReleaseText && (
                        <button
                          onClick={() => { setTextControlPopupOpen(true); setMobileMenuOpen(false); }}
                          className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all min-h-[56px]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-300">
                              <Edit3 className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                              <div className="font-bold text-sm text-white">Liberar Texto</div>
                              <div className="text-[11px] text-white/40 uppercase tracking-wider">Permissões em tempo real</div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-white/20" />
                        </button>
                      )}
                      <button
                        onClick={() => { setIsCustomizing(true); setMobileMenuOpen(false); }}
                        className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all min-h-[56px]"
                        data-testid="button-mobile-open-shortcuts"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-300">
                            <Settings className="w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-sm text-white">Atalhos do Teclado</div>
                            <div className="text-[11px] text-white/40 uppercase tracking-wider">Configurações rápidas</div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-white/20" />
                      </button>
                      {canAccessDashboard && (
                        <Link href={`/hub-dub/studio/${studioId}/dashboard`}>
                          <button
                            onClick={() => { logFeatureAudit("room.panel.redirect", { studioId }); setMobileMenuOpen(false); }}
                            className="w-full flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all min-h-[56px]"
                            data-testid="button-mobile-room-panel"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-300">
                                <Monitor className="w-5 h-5" />
                              </div>
                              <div className="text-left">
                                <div className="font-bold text-sm text-white">Painel</div>
                                <div className="text-[11px] text-white/40 uppercase tracking-wider">Voltar ao dashboard</div>
                              </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-white/20" />
                          </button>
                        </Link>
                      )}
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
                              {line.text}
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

    </div>
  );
}

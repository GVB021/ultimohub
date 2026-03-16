import { useEffect, useMemo, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Minimize2, Maximize2, RefreshCw } from "lucide-react";
import { authFetch } from "@studio/lib/auth-fetch";

interface DailyMeetPanelProps {
  sessionId: string;
  zIndexBase?: number;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
}

export function DailyMeetPanel({ sessionId, zIndexBase = 1150, open, onOpenChange }: DailyMeetPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [status, setStatus] = useState<"conectando" | "conectado" | "desconectado">("conectando");
  const [roomUrl, setRoomUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const isOpen = open ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternalOpen(next);
  };

  useEffect(() => {
    const syncViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  useEffect(() => {
    let mounted = true;
    const setupDaily = async () => {
      try {
        setStatus("conectando");
        const room = await authFetch("/api/create-room", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
        if (!mounted) return;
        setRoomUrl(room.url);

        const frame = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "0" },
          showLeaveButton: false,
          showFullscreenButton: true,
        });
        callRef.current = frame;

        frame.on("joined-meeting", () => setStatus("conectado"));
        frame.on("left-meeting", () => setStatus("desconectado"));
        frame.on("error", (ev: any) => {
          setStatus("desconectado");
          setErrorMsg(ev?.errorMsg || "Falha na conexão Daily");
          if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            frame.join({ url: room.url }).catch(() => {});
          }, 2000);
        });

        await frame.join({ url: room.url });
      } catch (err: any) {
        if (!mounted) return;
        setStatus("desconectado");
        setErrorMsg(String(err?.message || err));
      }
    };

    setupDaily();
    return () => {
      mounted = false;
      if (reconnectTimeoutRef.current) window.clearTimeout(reconnectTimeoutRef.current);
      const call = callRef.current;
      callRef.current = null;
      if (call) {
        call.leave().catch(() => {});
        call.destroy().catch(() => {});
      }
    };
  }, [sessionId]);

  useEffect(() => {
    const call = callRef.current;
    if (!call) return;
    if (isMinimized) {
      call.setLocalVideo(false).catch(() => {});
      return;
    }
    if (!isVideoOff) {
      call.setLocalVideo(true).catch(() => {});
    }
  }, [isMinimized, isVideoOff]);

  const isLandscape = viewport.width > viewport.height;
  const isMobile = viewport.width < 1024;

  const panelSize = useMemo(() => {
    if (!isMobile) {
      return isMinimized ? { width: 360, height: 64 } : { width: Math.min(820, Math.max(620, Math.round(viewport.width * 0.64))), height: 390 };
    }
    const margin = 16;
    const maxWidth = Math.max(220, viewport.width - margin * 2);
    const width = isMinimized ? maxWidth : Math.max(220, Math.min(maxWidth, viewport.width * (isLandscape ? 0.8 : 0.94)));
    const targetHeightRatio = isLandscape ? 0.42 : 0.5;
    const expandedHeight = Math.max(260, Math.min(viewport.height * targetHeightRatio, viewport.height - margin * 3));
    return {
      width,
      height: isMinimized ? 64 : Math.round(expandedHeight),
    };
  }, [isLandscape, isMinimized, isMobile, viewport.height, viewport.width]);

  useEffect(() => {
    if (!isResizingSplit || isMobile) return;
    const onPointerMove = (event: PointerEvent) => {
      if (!panelRef.current) return;
      const rect = panelRef.current.getBoundingClientRect();
      const localX = event.clientX - rect.left;
      const next = (localX / rect.width) * 100;
      setSplitPercent(Math.max(32, Math.min(68, next)));
    };
    const onPointerUp = () => setIsResizingSplit(false);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isResizingSplit, isMobile]);

  return (
    <div className={`absolute top-full right-0 mt-2 ${isOpen ? "" : "pointer-events-none opacity-0"} transition-opacity duration-200`}>
      <div
        ref={panelRef}
        className={`bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-top-2 transition-all duration-200 ${isMinimized ? "rounded-2xl" : ""}`}
        style={{ width: panelSize.width, height: panelSize.height, zIndex: zIndexBase }}
        data-testid="daily-meet-popup"
      >
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90 backdrop-blur shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Voice & Video</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${
              status === "conectado" ? "bg-emerald-500/20 text-emerald-400" : status === "conectando" ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"
            }`}>
              {isMuted ? "mutado" : status}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                const call = callRef.current;
                if (call && roomUrl) call.join({ url: roomUrl }).catch(() => {});
              }}
              className="text-zinc-500 hover:text-white transition-colors p-1"
              data-testid="button-daily-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsMinimized((v) => !v)}
              className="text-zinc-500 hover:text-white transition-colors p-1"
              data-testid="button-daily-minimize"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-500 hover:text-white transition-colors p-1"
              data-testid="button-daily-close"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className={`flex-1 min-h-0 ${isMobile ? "flex flex-col" : "flex flex-row"}`}>
            <div
              className="bg-black relative min-h-0"
              style={isMobile ? { flex: 1 } : { width: `${splitPercent}%` }}
            >
              <div ref={containerRef} className="absolute inset-0" />
              {errorMsg && (
                <div className="absolute top-2 left-2 right-2 text-[10px] bg-red-500/20 text-red-200 rounded px-2 py-1 border border-red-500/20">
                  {errorMsg}
                </div>
              )}
            </div>

            {!isMobile && (
              <button
                onPointerDown={() => setIsResizingSplit(true)}
                className="w-2 cursor-col-resize bg-zinc-800/80 hover:bg-primary/50 transition-colors"
                aria-label="Redimensionar vídeo e texto"
                data-testid="daily-meet-resizer"
              />
            )}

            <div
              className="bg-zinc-950 p-4 border-zinc-800 min-h-0 overflow-y-auto"
              style={isMobile ? { borderTopWidth: 1, flex: 1 } : { width: `${100 - splitPercent}%`, borderLeftWidth: 1 }}
            >
              <div className="text-zinc-100 text-xl sm:text-2xl lg:text-3xl font-bold leading-tight">
                Comunicação em tempo real para direção e alinhamento de take
              </div>
              <div className="mt-3 text-sm sm:text-base text-zinc-300 leading-relaxed">
                Use este popup para coordenar entradas, revisar sincronia e orientar ajustes sem interromper a área principal de gravação.
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 text-xs text-zinc-400">
                <div>• Arraste o divisor para ajustar vídeo e texto em tempo real.</div>
                <div>• Minimize para manter áudio com menos distrações visuais.</div>
                <div>• O popup permanece ancorado no cabeçalho e não desloca o layout da sessão.</div>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 border-t border-zinc-800 flex items-center justify-center gap-2 shrink-0 bg-zinc-900/90">
          <button
            onClick={() => {
              const call = callRef.current;
              if (!call) return;
              call.setLocalAudio(isMuted).catch(() => {});
              setIsMuted((prev) => !prev);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isMuted ? "bg-red-500 text-white" : "bg-zinc-800/80 text-white hover:bg-zinc-700"
            }`}
            data-testid="button-daily-toggle-audio"
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button
            onClick={() => {
              const call = callRef.current;
              if (!call) return;
              call.setLocalVideo(isVideoOff).catch(() => {});
              setIsVideoOff((prev) => !prev);
            }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
              isVideoOff ? "bg-red-500 text-white" : "bg-zinc-800/80 text-white hover:bg-zinc-700"
            }`}
            data-testid="button-daily-toggle-video"
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
          {!isMobile && <span className="text-[10px] text-zinc-400 ml-1">Popup ancorado ao cabeçalho, sem ocupar a área principal.</span>}
        </div>
      </div>
    </div>
  );
}

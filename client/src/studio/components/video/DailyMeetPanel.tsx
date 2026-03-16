import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import DailyIframe from "@daily-co/daily-js";
import { Video, VideoOff, Mic, MicOff, PhoneOff, RefreshCw, ChevronUp, ChevronDown } from "lucide-react";
import { authFetch } from "@studio/lib/auth-fetch";
import { motion, AnimatePresence } from "framer-motion";

interface DailyMeetPanelProps {
  sessionId: string;
  zIndexBase?: number;
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  mode?: "floating" | "embedded";
}

export function DailyMeetPanel({ sessionId, zIndexBase = 1150, open, onOpenChange, mode = "floating" }: DailyMeetPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchLastYRef = useRef<number | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [splitPercent, setSplitPercent] = useState(50);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
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
    if (mode === "embedded") {
      return { width: 0, height: isMinimized ? 56 : 0 };
    }
    if (!isMobile) {
      return isMinimized ? { width: 400, height: 56 } : { width: Math.min(820, Math.max(620, Math.round(viewport.width * 0.64))), height: 420 };
    }
    const margin = 12;
    const maxWidth = Math.max(220, viewport.width - margin * 2);
    const width = isMinimized ? maxWidth : Math.max(220, Math.min(maxWidth, viewport.width * (isLandscape ? 0.8 : 0.94)));
    const targetHeightRatio = isLandscape ? 0.35 : 0.3;
    const expandedHeight = Math.max(300, Math.min(viewport.height * targetHeightRatio, viewport.height - margin * 4));
    return {
      width,
      height: isMinimized ? 56 : Math.round(expandedHeight),
    };
  }, [isLandscape, isMinimized, isMobile, mode, viewport.height, viewport.width]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const y = event.touches[0]?.clientY;
    if (typeof y !== "number") return;
    touchStartYRef.current = y;
    touchLastYRef.current = y;
  };

  const handleTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const y = event.touches[0]?.clientY;
    if (typeof y !== "number") return;
    touchLastYRef.current = y;
  };

  const handleTouchEnd = () => {
    if (!isMobile) return;
    const start = touchStartYRef.current;
    const end = touchLastYRef.current;
    touchStartYRef.current = null;
    touchLastYRef.current = null;
    if (typeof start !== "number" || typeof end !== "number") return;
    const delta = end - start;
    if (delta > 35) setIsMinimized(true);
    if (delta < -35) setIsMinimized(false);
  };

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className={mode === "embedded" ? "w-full h-full" : "fixed bottom-0 right-0 p-4 md:p-6"}
          style={mode === "embedded" ? undefined : { zIndex: zIndexBase }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <motion.div
            ref={panelRef}
            layout
            initial={false}
            animate={
              mode === "embedded"
                ? { width: "100%", height: isMinimized ? 56 : "100%" }
                : { width: panelSize.width, height: panelSize.height }
            }
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className={`bg-zinc-900 border border-zinc-800 ${mode === "embedded" ? "rounded-none h-full" : "rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"} flex flex-col overflow-hidden backdrop-blur-xl`}
            data-testid="daily-meet-popup"
          >
            {/* Header / Minimized Bar */}
            <div className="h-14 px-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    status === "conectado" ? "bg-emerald-500" : status === "conectando" ? "bg-amber-500" : "bg-red-500"
                  }`} />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    {isMinimized ? "Chat Ativo" : "Voice & Video Chat"}
                  </span>
                </div>
                {isMinimized && (
                  <div className="flex items-center gap-2 border-l border-zinc-800 pl-3">
                    <button
                      onClick={() => {
                        const call = callRef.current;
                        if (!call) return;
                        call.setLocalAudio(isMuted).catch(() => {});
                        setIsMuted((prev) => !prev);
                      }}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                        isMuted ? "text-red-400 bg-red-500/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => {
                        const call = callRef.current;
                        if (!call) return;
                        call.setLocalVideo(isVideoOff).catch(() => {});
                        setIsVideoOff((prev) => !prev);
                      }}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                        isVideoOff ? "text-red-400 bg-red-500/10" : "text-zinc-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {isVideoOff ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                {!isMinimized && (
                  <button
                    onClick={() => {
                      const call = callRef.current;
                      if (call && roomUrl) call.join({ url: roomUrl }).catch(() => {});
                    }}
                    className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
                    title="Recarregar conexão"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setIsMinimized((v) => !v)}
                  className="text-zinc-500 hover:text-white transition-colors p-1.5 rounded-md hover:bg-white/5"
                  title={isMinimized ? "Maximizar" : "Minimizar"}
                >
                  {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {mode !== "embedded" && (
                  <button
                    onClick={() => setOpen(false)}
                    className="text-red-500/70 hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-500/10"
                    title="Sair da chamada"
                  >
                    <PhoneOff className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Content Area */}
            {!isMinimized && (
              <div className={`flex-1 min-h-0 ${isMobile ? "flex flex-col" : "flex flex-row"}`}>
                <div
                  className="bg-black relative min-h-0"
                  style={isMobile ? { flex: 1 } : { width: `${splitPercent}%` }}
                >
                  <div ref={containerRef} className="absolute inset-0" />
                  {errorMsg && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-6 text-center z-50">
                      <div className="max-w-xs">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-red-500 mx-auto mb-4">
                          <PhoneOff className="w-6 h-6" />
                        </div>
                        <p className="text-sm text-red-200 font-medium mb-2">{errorMsg}</p>
                        <button 
                          onClick={() => {
                            const call = callRef.current;
                            if (call && roomUrl) call.join({ url: roomUrl }).catch(() => {});
                          }}
                          className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-all"
                        >
                          Tentar novamente
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isMobile && (
                  <button
                    onPointerDown={() => setIsResizingSplit(true)}
                    className="w-1.5 cursor-col-resize bg-zinc-800/80 hover:bg-primary/50 transition-colors z-10"
                    aria-label="Redimensionar vídeo e texto"
                  />
                )}

                <div
                  className="bg-zinc-950 p-6 border-zinc-800 min-h-0 overflow-y-auto"
                  style={isMobile ? { borderTopWidth: 1, flex: 1 } : { width: `${100 - splitPercent}%`, borderLeftWidth: 1 }}
                >
                  <div className="text-zinc-100 text-lg sm:text-xl font-bold leading-snug mb-3">
                    Colaboração em Tempo Real
                  </div>
                  <div className="text-sm text-zinc-400 leading-relaxed space-y-3">
                    <p>Use este painel para coordenar entradas, revisar sincronia e orientar ajustes com sua equipe.</p>
                    <div className="pt-4 space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <p>Arraste o divisor para ajustar o foco entre o vídeo e as orientações.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <p>Minimize para o rodapé para focar na gravação mantendo o áudio ativo.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Controls (Only when Expanded) */}
            {!isMinimized && (
              <div className="h-16 px-4 border-t border-zinc-800 flex items-center justify-center gap-3 bg-zinc-900/40 shrink-0">
                <button
                  onClick={() => {
                    const call = callRef.current;
                    if (!call) return;
                    call.setLocalAudio(isMuted).catch(() => {});
                    setIsMuted((prev) => !prev);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${
                    isMuted ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isMuted ? "Microfone Off" : "Microfone On"}
                </button>
                <button
                  onClick={() => {
                    const call = callRef.current;
                    if (!call) return;
                    call.setLocalVideo(isVideoOff).catch(() => {});
                    setIsVideoOff((prev) => !prev);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium text-sm ${
                    isVideoOff ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                  }`}
                >
                  {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  {isVideoOff ? "Câmera Off" : "Câmera On"}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

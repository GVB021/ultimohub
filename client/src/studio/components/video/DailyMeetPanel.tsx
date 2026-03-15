import { useEffect, useMemo, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Minimize2, Maximize2, RefreshCw } from "lucide-react";
import { authFetch } from "@studio/lib/auth-fetch";

interface DailyMeetPanelProps {
  sessionId: string;
  zIndexBase?: number;
}

export function DailyMeetPanel({ sessionId, zIndexBase = 1150 }: DailyMeetPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const [status, setStatus] = useState<"conectando" | "conectado" | "desconectado">("conectando");
  const [roomUrl, setRoomUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

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
      return isMinimized ? { width: 288, height: 64 } : { width: 320, height: 420 };
    }
    const margin = 16;
    const maxWidth = Math.max(220, viewport.width - margin * 2);
    const width = isMinimized ? 64 : Math.max(220, Math.min(maxWidth, viewport.width * (isLandscape ? 0.3 : 0.9)));
    const targetHeightRatio = isLandscape ? 0.3 : 0.25;
    const expandedHeight = Math.max(160, Math.min(viewport.height * targetHeightRatio, viewport.height - margin * 2));
    return {
      width,
      height: isMinimized ? 64 : expandedHeight,
    };
  }, [isLandscape, isMinimized, isMobile, viewport.height, viewport.width]);

  const panelPositionStyle = useMemo(() => {
    if (isMobile) {
      return { bottom: 16, right: 16 };
    }
    return { bottom: 20, right: 20 };
  }, [isMobile]);

  return (
    <>
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed h-14 w-14 rounded-full flex items-center justify-center shadow-lg bg-primary text-primary-foreground hover:scale-110 active:scale-95 transition-all z-[1200]"
          style={panelPositionStyle}
          title="Abrir chamada de vídeo"
        >
          <Video className="w-6 h-6" />
        </button>
      )}
      <div
        className={`fixed ${isVisible ? "" : "opacity-0 pointer-events-none"} bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 transition-all duration-300 ${isMinimized && isMobile ? "rounded-full" : ""}`}
        style={{ ...panelPositionStyle, width: panelSize.width, height: panelSize.height, zIndex: zIndexBase }}
      >
        {isMinimized && isMobile ? (
          <button
            onClick={() => setIsMinimized(false)}
            className="w-full h-full flex items-center justify-center text-primary"
          >
            <Video className="w-6 h-6" />
          </button>
        ) : (
          <>
            <div
              className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur shrink-0"
              onTouchStart={(event) => {
                touchStartYRef.current = event.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(event) => {
                const startY = touchStartYRef.current;
                const endY = event.changedTouches[0]?.clientY ?? null;
                touchStartYRef.current = null;
                if (startY === null || endY === null) return;
                const delta = endY - startY;
                if (delta > 35) setIsMinimized(true);
                if (delta < -35) setIsMinimized(false);
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Daily</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                  status === "conectado" ? "bg-emerald-500/20 text-emerald-400" : status === "conectando" ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"
                }`}>
                  {isMuted ? "mutado" : status}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => {
                  const call = callRef.current;
                  if (call && roomUrl) call.join({ url: roomUrl }).catch(() => {});
                }} className="text-zinc-500 hover:text-white transition-colors p-1">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => setIsMinimized((v) => !v)} className="text-zinc-500 hover:text-white transition-colors p-1">
                  {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setIsVisible(false)} className="text-zinc-500 hover:text-white transition-colors p-1">
                  <PhoneOff className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <div className="flex-1 bg-black relative min-h-0">
                <div ref={containerRef} className="absolute inset-0" />
                {errorMsg && (
                  <div className="absolute top-2 left-2 right-2 text-[10px] bg-red-500/20 text-red-200 rounded px-2 py-1 border border-red-500/20">
                    {errorMsg}
                  </div>
                )}
              </div>
            )}

            <div className="p-3 border-t border-zinc-800 flex items-center justify-center gap-2 shrink-0">
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
                >
                  {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
                {!isMobile && <span className="text-[10px] text-zinc-400 ml-1">Modo econômico ativo ao minimizar: vídeo pausado, áudio mantido.</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

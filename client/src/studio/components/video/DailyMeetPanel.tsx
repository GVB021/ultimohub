import { useEffect, useRef, useState } from "react";
import DailyIframe from "@daily-co/daily-js";
import { Video, VideoOff, Mic, MicOff, PhoneOff, Minimize2, Maximize2, RefreshCw } from "lucide-react";
import { authFetch } from "@studio/lib/auth-fetch";

interface DailyMeetPanelProps {
  sessionId: string;
}

export function DailyMeetPanel({ sessionId }: DailyMeetPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<any>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState<"conectando" | "conectado" | "desconectado">("conectando");
  const [roomUrl, setRoomUrl] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

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

  return (
    <>
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="fixed bottom-20 right-5 h-12 w-12 rounded-full flex items-center justify-center shadow-lg z-[90] bg-primary text-primary-foreground hover:scale-110 transition-all"
          title="Abrir chamada de vídeo"
        >
          <Video className="w-5 h-5" />
        </button>
      )}
      <div className={`fixed bottom-5 right-5 ${isVisible ? "" : "opacity-0 pointer-events-none"} ${isMinimized ? "w-72 h-16" : "w-80 h-[420px]"} bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl z-[100] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5`}>
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50 backdrop-blur">
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
        <div className="flex-1 bg-black relative">
          <div ref={containerRef} className="absolute inset-0" />
          {errorMsg && (
            <div className="absolute top-2 left-2 right-2 text-[10px] bg-red-500/20 text-red-200 rounded px-2 py-1 border border-red-500/20">
              {errorMsg}
            </div>
          )}
        </div>
      )}

      <div className="p-3 border-t border-zinc-800 flex items-center justify-center gap-2">
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
          <span className="text-[10px] text-zinc-400 ml-1">Modo econômico ativo ao minimizar: vídeo pausado, áudio mantido.</span>
      </div>
      </div>
    </>
  );
}

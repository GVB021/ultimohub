import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { computeMidVideoLoopWindow, isPlayableVideoUrl } from "@studio/lib/production-video";

interface ProductionBackgroundVideoProps {
  videoUrl?: string | null;
  posterUrl?: string | null;
  className?: string;
}

export const ProductionBackgroundVideo = memo(function ProductionBackgroundVideo({
  videoUrl,
  posterUrl,
  className = "",
}: ProductionBackgroundVideoProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [loopWindow, setLoopWindow] = useState(() => computeMidVideoLoopWindow(0));

  const hasPlayableVideo = useMemo(() => isPlayableVideoUrl(videoUrl), [videoUrl]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // Lazy loading do vídeo somente quando o card entra no viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "180px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVisible || !hasPlayableVideo) return;

    // Define o segmento central (5-10s) e reinicia em loop manualmente.
    const onLoadedMetadata = () => {
      const window = computeMidVideoLoopWindow(video.duration, 8);
      setLoopWindow(window);
      video.currentTime = window.startTime;
      video.playbackRate = 0.5;
      setIsLoading(false);
      void video.play().catch(() => {});
    };

    const onTimeUpdate = () => {
      if (video.currentTime >= loopWindow.endTime) {
        video.currentTime = loopWindow.startTime;
      }
    };

    const onError = () => {
      setHasVideoError(true);
      setIsLoading(false);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("error", onError);
    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("error", onError);
    };
  }, [hasPlayableVideo, isVisible, loopWindow.endTime, loopWindow.startTime]);

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className}`}>
      {!hasPlayableVideo || hasVideoError || !isVisible ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
        />
      ) : (
        <video
          ref={videoRef}
          src={videoUrl || undefined}
          muted
          playsInline
          autoPlay
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover scale-105 blur-[2px] opacity-35"
          data-testid="video-production-background"
        />
      )}

      {isVisible && hasPlayableVideo && isLoading && !hasVideoError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/35">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
});


export type VideoLoopWindow = {
  startTime: number;
  endTime: number;
  duration: number;
};

export function computeMidVideoLoopWindow(
  mediaDurationSeconds: number,
  clipDurationSeconds = 8,
): VideoLoopWindow {
  const safeDuration = Number.isFinite(mediaDurationSeconds) ? Math.max(0, mediaDurationSeconds) : 0;
  const requestedClip = Math.max(5, Math.min(10, clipDurationSeconds));
  if (safeDuration <= 0) {
    return { startTime: 0, endTime: requestedClip, duration: requestedClip };
  }

  const effectiveClip = Math.min(requestedClip, safeDuration);
  const middle = safeDuration / 2;
  const startTime = Math.max(0, middle - effectiveClip / 2);
  const endTime = Math.min(safeDuration, startTime + effectiveClip);
  return { startTime, endTime, duration: Math.max(0.1, endTime - startTime) };
}

export function isPlayableVideoUrl(url: unknown) {
  const value = String(url || "").trim();
  if (!value) return false;
  return /^https?:\/\//i.test(value) || value.startsWith("/") || value.startsWith("blob:");
}


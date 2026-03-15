export function parseTimecodeMs(tc: string | number, fps?: 24 | 25 | 30): number {
  if (typeof tc === "number") {
    const safe = Number.isFinite(tc) ? tc : 0;
    return Math.max(0, Math.round(safe * 1000));
  }

  const raw = String(tc || "").trim();
  if (!raw) return 0;

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && /^[+-]?\d+(\.\d+)?$/.test(raw)) {
    return Math.max(0, Math.round(numeric * 1000));
  }

  const normalized = raw
    .replace(/\s+/g, "")
    .replace(/;/g, ":")
    .replace(/-/g, ":");

  const match = normalized.match(
    /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:([:.,])(\d{1,6}))?$/
  );
  if (!match) return 0;

  const hh = Number(match[1] ?? 0) || 0;
  const mm = Number(match[2] ?? 0) || 0;
  const ss = Number(match[3] ?? 0) || 0;
  const sep = match[4] || "";
  const tail = match[5] || "";

  let subMs = 0;

  if (tail) {
    if (sep === ":" && tail.length <= 2) {
      const ff = Number(tail) || 0;
      const resolvedFps =
        fps ??
        (ff <= 23 ? 24 : ff <= 24 ? 25 : 30);
      subMs = Math.round((ff / resolvedFps) * 1000);
    } else {
      const digits = tail.replace(/\D/g, "");
      const frac = Number(digits) || 0;
      const scale = Math.pow(10, Math.max(0, digits.length - 3));
      subMs = Math.round(frac / scale);
    }
  }

  const totalMs = (((hh * 60 + mm) * 60 + ss) * 1000) + subMs;
  return Math.max(0, totalMs);
}

export function parseTimecode(tc: string | number): number {
  return parseTimecodeMs(tc) / 1000;
}

export function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type TimecodeFormat = "HH:MM:SS" | "HH:MM:SS:MMM" | "HH:MM:SS:FF";

export function formatTimecodeByFormat(
  seconds: number,
  format: TimecodeFormat,
  fps: number = 24
): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = Math.floor(safeSeconds % 60);
  const base = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  if (format === "HH:MM:SS") return base;
  if (format === "HH:MM:SS:MMM") {
    const ms = Math.floor((safeSeconds % 1) * 1000);
    return `${base}:${String(ms).padStart(3, "0")}`;
  }
  const resolvedFps = Number.isFinite(fps) && fps > 0 ? fps : 24;
  const ff = Math.floor((safeSeconds % 1) * resolvedFps);
  return `${base}:${String(ff).padStart(2, "0")}`;
}

export function formatTimecodeShort(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseUniversalTimecodeToSeconds(timeString: unknown, fps: number = 24): number {
  const raw = String(timeString ?? "").trim();
  if (!raw) {
    throw new Error("Timecode vazio");
  }

  const resolvedFps = Number(fps);
  if (!Number.isFinite(resolvedFps) || resolvedFps <= 0) {
    throw new Error("FPS inválido");
  }

  const input = raw.replace(/\s+/g, "");

  // Regex 1 — HH:MM:SS
  // - ^                 : início da string
  // - (\d{2,})          : horas com pelo menos 2 dígitos (ex.: 01, 001)
  // - :                 : separador literal
  // - ([0-5]\d)         : minutos 00–59
  // - :                 : separador literal
  // - ([0-5]\d)         : segundos 00–59
  // - $                 : fim da string
  const reHhMmSs = /^(\d{2,}):([0-5]\d):([0-5]\d)$/;

  // Regex 2 — SMPTE NDF (Non-Drop Frame): HH:MM:SS:FF
  // - Mesma base do HH:MM:SS, mas com frames no final
  // - ([:])             : separador de frames ":" (NDF)
  // - (\d{2})           : frames com 2 dígitos (00–99, validado depois pelo FPS)
  const reSmpteNdf = /^(\d{2,}):([0-5]\d):([0-5]\d):(\d{2})$/;

  // Regex 3 — SMPTE DF (Drop Frame): HH:MM:SS;FF
  // - Igual ao SMPTE NDF, mas usa ";" antes dos frames
  const reSmpteDf = /^(\d{2,}):([0-5]\d):([0-5]\d);(\d{2})$/;

  // Regex 4 — Curto MM:SS
  // - ^([0-5]?\d)       : minutos 0–59 (1 ou 2 dígitos)
  // - :                 : separador literal
  // - ([0-5]\d)         : segundos 00–59
  const reMmSs = /^([0-5]?\d):([0-5]\d)$/;

  // Regex 5 — Milissegundos SS.mmm
  // - ^(\d+)            : segundos inteiros (sem limite superior)
  // - \.                : ponto decimal literal
  // - (\d{1,6})         : fração de 1 a 6 dígitos (será normalizada para milissegundos)
  const reSsMmm = /^(\d+)\.(\d{1,6})$/;

  const toSeconds3 = (seconds: number) => {
    const ms = Math.round(seconds * 1000);
    return ms / 1000;
  };

  const toInt = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };

  const safeFrameToSeconds = (frames: number) => {
    if (frames < 0) throw new Error("Frames inválidos");
    if (frames >= resolvedFps) {
      throw new Error("Frames excedem o FPS");
    }
    return frames / resolvedFps;
  };

  const asHhMmSs = input.match(reHhMmSs);
  if (asHhMmSs) {
    const hh = toInt(asHhMmSs[1]);
    const mm = toInt(asHhMmSs[2]);
    const ss = toInt(asHhMmSs[3]);
    return toSeconds3((hh * 3600) + (mm * 60) + ss);
  }

  const asNdf = input.match(reSmpteNdf);
  if (asNdf) {
    const hh = toInt(asNdf[1]);
    const mm = toInt(asNdf[2]);
    const ss = toInt(asNdf[3]);
    const ff = toInt(asNdf[4]);
    const seconds = (hh * 3600) + (mm * 60) + ss + safeFrameToSeconds(ff);
    return toSeconds3(seconds);
  }

  const asDf = input.match(reSmpteDf);
  if (asDf) {
    const hh = toInt(asDf[1]);
    const mm = toInt(asDf[2]);
    const ss = toInt(asDf[3]);
    const ff = toInt(asDf[4]);

    const fpsCloseTo2997 = Math.abs(resolvedFps - 29.97) < 0.01;
    const fpsCloseTo5994 = Math.abs(resolvedFps - 59.94) < 0.01;
    const fpsNominal = fpsCloseTo5994 ? 60 : (fpsCloseTo2997 ? 30 : Math.round(resolvedFps));

    if (fpsNominal !== 30 && fpsNominal !== 60) {
      const seconds = (hh * 3600) + (mm * 60) + ss + safeFrameToSeconds(ff);
      return toSeconds3(seconds);
    }

    const dropFrames = Math.round(fpsNominal * 0.066666);
    if (ff < 0 || ff >= fpsNominal) throw new Error("Frames excedem o FPS nominal");

    const totalMinutes = (hh * 60) + mm;
    const frameNumber =
      (((hh * 3600) + (mm * 60) + ss) * fpsNominal + ff) -
      (dropFrames * (totalMinutes - Math.floor(totalMinutes / 10)));

    const actualFps = fpsNominal * 1000 / 1001;
    return toSeconds3(frameNumber / actualFps);
  }

  const asMmSs = input.match(reMmSs);
  if (asMmSs) {
    const mm = toInt(asMmSs[1]);
    const ss = toInt(asMmSs[2]);
    return toSeconds3((mm * 60) + ss);
  }

  const asSsMmm = input.match(reSsMmm);
  if (asSsMmm) {
    const baseSeconds = toInt(asSsMmm[1]);
    const fracDigits = asSsMmm[2];
    const fracAsNumber = Number(fracDigits);
    if (!Number.isFinite(fracAsNumber)) throw new Error("Milissegundos inválidos");

    const scale = Math.pow(10, fracDigits.length);
    const seconds = baseSeconds + (fracAsNumber / scale);
    return toSeconds3(seconds);
  }

  if (/^[+-]?\d+(\.\d+)?$/.test(input)) {
    const numeric = Number(input);
    if (!Number.isFinite(numeric)) throw new Error("Número inválido");
    return toSeconds3(numeric);
  }

  throw new Error("Formato de timecode inválido");
}

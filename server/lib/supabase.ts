import { logger } from "./logger";

let runtimeSupabaseUrl = process.env.SUPABASE_URL || "";
let runtimeSupabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function normalizeSupabaseBaseUrl(input: string) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/\/+(rest|auth)\/v1\/?$/i, "")
    .replace(/\/+$/g, "");
}

function getSupabaseBaseUrl() {
  return normalizeSupabaseBaseUrl(runtimeSupabaseUrl);
}

function supabaseHeaders(extra?: Record<string, string>) {
  return {
    authorization: `Bearer ${runtimeSupabaseServiceRoleKey}`,
    apikey: runtimeSupabaseServiceRoleKey,
    ...(extra || {}),
  };
}

function jitterDelay(ms: number) {
  const jitter = Math.floor(Math.random() * Math.min(250, ms));
  return ms + jitter;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function shouldRetry(status?: number) {
  if (!status) return true;
  if (status === 408) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  meta: { op: string; attemptHint?: string },
  opts: { retries?: number; baseDelayMs?: number } = {},
) {
  const retries = Math.max(0, opts.retries ?? 2);
  const baseDelayMs = Math.max(50, opts.baseDelayMs ?? 250);
  let lastErr: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const startedAt = Date.now();
      const res = await fetch(url, init);
      const elapsedMs = Date.now() - startedAt;
      if (res.ok || !shouldRetry(res.status) || attempt === retries) {
        if (!res.ok) {
      const text = await res.text().catch(() => "");
      logger.warn("[Supabase] Request failed", {
        op: meta.op,
        status: res.status,
        elapsedMs,
        attempt,
        attemptHint: meta.attemptHint || null,
        error: text.slice(0, 500),
      });
    } else {
      logger.debug("[Supabase] Request ok", { op: meta.op, status: res.status, elapsedMs, attempt });
    }
        return res;
      }
      logger.warn("[Supabase] Retryable response", { op: meta.op, status: res.status, elapsedMs, attempt });
      await sleep(jitterDelay(baseDelayMs * 2 ** attempt));
      continue;
    } catch (e) {
      lastErr = e;
      if (attempt === retries) break;
      logger.warn("[Supabase] Network error, retrying", {
        op: meta.op,
        attempt,
        message: (e as any)?.message || String(e),
      });
      await sleep(jitterDelay(baseDelayMs * 2 ** attempt));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Network error");
}

export function configureSupabase(config: { url?: string; serviceRoleKey?: string }) {
  const hadUrl = Boolean(getSupabaseBaseUrl());
  const hadKey = Boolean(String(runtimeSupabaseServiceRoleKey || "").trim());

  if (config.url !== undefined) runtimeSupabaseUrl = normalizeSupabaseBaseUrl(config.url || "");
  if (config.serviceRoleKey !== undefined) runtimeSupabaseServiceRoleKey = String(config.serviceRoleKey || "").trim();

  cachedStatus = null;

  const hasUrl = Boolean(getSupabaseBaseUrl());
  const hasKey = Boolean(String(runtimeSupabaseServiceRoleKey || "").trim());
  if (hadUrl !== hasUrl || hadKey !== hasKey) {
    const host = (() => {
      try {
        return new URL(getSupabaseBaseUrl()).host;
      } catch {
        return null;
      }
    })();
    logger.info("[Supabase] Configuration updated", { configured: hasUrl && hasKey, host });
  }
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseBaseUrl() && runtimeSupabaseServiceRoleKey);
}

type SupabaseStatus = { ok: boolean; reason?: string; checkedAt: number };
let cachedStatus: SupabaseStatus | null = null;

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }
}

function joinPath(...parts: string[]) {
  const cleaned = parts
    .filter(Boolean)
    .map((p) => String(p).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean);
  return cleaned.join("/");
}

export async function checkSupabaseConnection(force = false): Promise<SupabaseStatus> {
  const now = Date.now();
  if (!force && cachedStatus && now - cachedStatus.checkedAt < 30_000) {
    return cachedStatus;
  }

  if (!isSupabaseConfigured()) {
    cachedStatus = { ok: false, reason: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing", checkedAt: now };
    return cachedStatus;
  }

  try {
    const baseUrl = getSupabaseBaseUrl();
    const res = await fetchWithRetry(
      `${baseUrl}/storage/v1/bucket`,
      { headers: supabaseHeaders() },
      { op: "storage.bucket.list" },
      { retries: 2, baseDelayMs: 250 },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const snippet = text ? ` ${text.slice(0, 240)}` : "";
      cachedStatus = { ok: false, reason: `HTTP ${res.status}${snippet}`.trim(), checkedAt: now };
      return cachedStatus;
    }
    cachedStatus = { ok: true, checkedAt: now };
    return cachedStatus;
  } catch (e: any) {
    cachedStatus = { ok: false, reason: e?.message || "Network error", checkedAt: now };
    return cachedStatus;
  }
}

export async function uploadToSupabaseStorage(params: {
  bucket: string;
  path: string;
  buffer: Buffer;
  contentType: string;
}) {
  requireSupabase();

  const bucket = String(params.bucket || "").trim();
  if (!bucket) throw new Error("Supabase bucket is required");

  const objectPath = joinPath(params.path);
  if (!objectPath) throw new Error("Supabase object path is required");

  const baseUrl = getSupabaseBaseUrl();
  const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const res = await fetchWithRetry(
    url,
    {
    method: "POST",
      headers: supabaseHeaders({
        "content-type": params.contentType,
        "x-upsert": "true",
      }),
    body: new Uint8Array(params.buffer),
    },
    { op: "storage.object.upload", attemptHint: `${bucket}/${objectPath}` },
    { retries: 3, baseDelayMs: 300 },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Supabase upload failed: HTTP ${res.status} ${body}`.trim());
  }

  const publicUrl = `${baseUrl}/storage/v1/object/public/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  return publicUrl;
}

export async function uploadJsonToSupabaseStorage(params: {
  bucket: string;
  path: string;
  data: unknown;
}) {
  const body = Buffer.from(JSON.stringify(params.data ?? {}), "utf8");
  return uploadToSupabaseStorage({
    bucket: params.bucket,
    path: params.path,
    buffer: body,
    contentType: "application/json; charset=utf-8",
  });
}

export async function listSupabaseStorageObjects(params: {
  bucket: string;
  prefix?: string;
  limit?: number;
  offset?: number;
  sortBy?: { column: "name" | "updated_at" | "created_at" | "last_accessed_at"; order: "asc" | "desc" };
}) {
  requireSupabase();
  const bucket = String(params.bucket || "").trim();
  if (!bucket) throw new Error("Supabase bucket is required");

  const baseUrl = getSupabaseBaseUrl();
  const url = `${baseUrl}/storage/v1/object/list/${encodeURIComponent(bucket)}`;
  const payload = {
    prefix: String(params.prefix || "").replace(/^\/+/, ""),
    limit: Math.max(1, Math.min(500, Number(params.limit || 100))),
    offset: Math.max(0, Number(params.offset || 0)),
    sortBy: params.sortBy || { column: "name", order: "asc" },
  };

  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: supabaseHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(payload),
    },
    { op: "storage.object.list", attemptHint: `${bucket}/${payload.prefix}` },
    { retries: 2, baseDelayMs: 250 },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase list failed: HTTP ${res.status} ${text}`.trim());
  }
  const out = await res.json().catch(() => []);
  return Array.isArray(out) ? out : [];
}

export function parseSupabaseStorageUrl(input: string): { bucket: string; path: string } | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    const p = u.pathname.replace(/\/+$/g, "");
    const publicPrefix = "/storage/v1/object/public/";
    const objectPrefix = "/storage/v1/object/";
    const signPrefix = "/storage/v1/object/sign/";

    const fromPrefix = (prefix: string) => {
      if (!p.startsWith(prefix)) return null;
      const rest = p.slice(prefix.length);
      const idx = rest.indexOf("/");
      if (idx <= 0) return null;
      const bucket = decodeURIComponent(rest.slice(0, idx));
      const path = rest.slice(idx + 1).split("/").map(decodeURIComponent).join("/");
      if (!bucket || !path) return null;
      return { bucket, path };
    };

    return fromPrefix(publicPrefix) || fromPrefix(signPrefix) || fromPrefix(objectPrefix);
  } catch {
    return null;
  }
}

export async function downloadFromSupabaseStorage(
  params: { bucket: string; path: string },
  opts?: { range?: string },
) {
  requireSupabase();
  const bucket = String(params.bucket || "").trim();
  const objectPath = joinPath(params.path);
  if (!bucket) throw new Error("Supabase bucket is required");
  if (!objectPath) throw new Error("Supabase object path is required");

  const baseUrl = getSupabaseBaseUrl();
  const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const range = String(opts?.range || "").trim();
  const res = await fetchWithRetry(
    url,
    { method: "GET", headers: supabaseHeaders(range ? { range } : undefined) },
    { op: "storage.object.download", attemptHint: `${bucket}/${objectPath}` },
    { retries: 2, baseDelayMs: 250 },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const errorMsg = `Supabase download failed: HTTP ${res.status} ${text.slice(0, 500)}`.trim();
    logger.error("[Supabase] Download error", { bucket, objectPath, status: res.status, error: text });
    throw new Error(errorMsg);
  }

  return res;
}

export async function deleteFromSupabaseStorage(params: { bucket: string; path: string }) {
  requireSupabase();
  const bucket = String(params.bucket || "").trim();
  const objectPath = joinPath(params.path);
  if (!bucket) throw new Error("Supabase bucket is required");
  if (!objectPath) throw new Error("Supabase object path is required");

  const baseUrl = getSupabaseBaseUrl();
  const url = `${baseUrl}/storage/v1/object/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const res = await fetchWithRetry(
    url,
    { method: "DELETE", headers: supabaseHeaders() },
    { op: "storage.object.delete", attemptHint: `${bucket}/${objectPath}` },
    { retries: 2, baseDelayMs: 250 },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase delete failed: HTTP ${res.status} ${text}`.trim());
  }

  return true;
}

export async function downloadFromSupabaseStorageUrl(audioUrl: string, opts?: { range?: string }) {
  const parsed = parseSupabaseStorageUrl(audioUrl);
  if (!parsed) {
    throw new Error("Unsupported Supabase URL");
  }
  return downloadFromSupabaseStorage(parsed, opts);
}

export async function createSignedSupabaseUrlFromPublicUrl(audioUrl: string, expiresInSeconds: number) {
  requireSupabase();
  const parsed = parseSupabaseStorageUrl(audioUrl);
  if (!parsed) {
    throw new Error("Unsupported Supabase URL");
  }
  const baseUrl = getSupabaseBaseUrl();
  const bucket = String(parsed.bucket || "").trim();
  const objectPath = joinPath(parsed.path);
  if (!bucket || !objectPath) throw new Error("Invalid Supabase object reference");

  const signUrl = `${baseUrl}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${objectPath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  const res = await fetchWithRetry(
    signUrl,
    {
      method: "POST",
      headers: supabaseHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ expiresIn: Math.max(60, Math.floor(expiresInSeconds || 0)) }),
    },
    { op: "storage.object.sign", attemptHint: `${bucket}/${objectPath}` },
    { retries: 2, baseDelayMs: 250 },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase sign failed: HTTP ${res.status} ${text}`.trim());
  }
  const payload = await res.json().catch(() => ({} as any));
  const signedPath = String(payload?.signedURL || payload?.signedUrl || "").trim();
  if (!signedPath) {
    throw new Error("Supabase sign response missing signedURL");
  }
  if (/^https?:\/\//i.test(signedPath)) return signedPath;
  return `${baseUrl}${signedPath.startsWith("/") ? "" : "/"}${signedPath}`;
}

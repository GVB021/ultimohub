import type { Express, Request } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { requireAuth } from "./middleware/auth";
import { storage } from "./storage";
import { logger } from "./lib/logger";
import {
  checkSupabaseConnection,
  downloadFromSupabaseStorage,
  listSupabaseStorageObjects,
  uploadJsonToSupabaseStorage,
  uploadToSupabaseStorage,
} from "./lib/supabase";

export const HUBALIGN_OWNER_USERNAME = "borbaggabriel";
const upload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 1024 * 1024 * 100 } // Reduzi para 100MB conforme boas práticas de servidor
});

const ALLOWED_MIME_TYPES = [
  "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a"
];

type HubAlignProject = {
  id: string;
  name: string;
  description: string;
  status: "draft" | "editing" | "ready";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  versionCount: number;
};

function resolveHubAlignBucket(settings: Record<string, string>) {
  return String(settings.HUBALIGN_SUPABASE_BUCKET || settings.SUPABASE_BUCKET || "takes").trim();
}

export function getEmailUsername(input: unknown) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw.includes("@")) return raw;
  return raw.split("@")[0] || "";
}

export function isHubAlignOwner(user: any) {
  const byEmail = getEmailUsername(user?.email) === HUBALIGN_OWNER_USERNAME;
  const byDisplayName = String(user?.displayName || "").trim().toLowerCase() === HUBALIGN_OWNER_USERNAME;
  return byEmail || byDisplayName;
}

async function writeHubAlignAudit(req: Request, action: string, details: Record<string, unknown>) {
  const user = (req as any).user;
  await storage.createAuditLog({
    userId: user?.id || null,
    action,
    details: JSON.stringify({
      ...details,
      username: getEmailUsername(user?.email),
      ip: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
      at: new Date().toISOString(),
    }),
  });
}

async function requireHubAlignOwner(req: Request, res: any, next: any) {
  const user = (req as any).user;
  if (!isHubAlignOwner(user)) {
    await writeHubAlignAudit(req, "HUBALIGN_FORBIDDEN_ACCESS", { path: req.path, method: req.method });
    return res.status(403).json({ message: "Acesso exclusivo para borbaggabriel" });
  }
  return next();
}

function projectPath(projectId: string, suffix: string) {
  const safeId = String(projectId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  if (!safeId) throw new Error("projectId invalido");
  return `hubalign/projects/${safeId}/${suffix}`.replace(/\/+/g, "/");
}

async function saveProjectBackup(bucket: string, projectId: string, data: unknown) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await uploadJsonToSupabaseStorage({
    bucket,
    path: projectPath(projectId, `backups/${stamp}_${randomUUID()}.json`),
    data,
  });
}

export function registerHubAlignRoutes(app: Express) {
  app.get("/api/hubalign/access", requireAuth, async (req, res) => {
    const user = (req as any).user;
    const allowed = isHubAlignOwner(user);
    const supabase = await checkSupabaseConnection(false);
    if (allowed) {
      await writeHubAlignAudit(req, "HUBALIGN_ACCESS_GRANTED", { path: req.path });
    }
    return res.status(200).json({
      allowed,
      username: getEmailUsername(user?.email),
      expected: HUBALIGN_OWNER_USERNAME,
      supabaseOk: supabase.ok,
      supabaseReason: supabase.reason || null,
    });
  });

  app.get("/api/hubalign/projects", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      const rows = await listSupabaseStorageObjects({
        bucket,
        prefix: "hubalign/projects/",
        limit: 500,
        offset: 0,
        sortBy: { column: "updated_at", order: "desc" },
      });

      const projectIds = new Set<string>();
      for (const row of rows as any[]) {
        const name = String(row?.name || "");
        const match = name.match(/^hubalign\/projects\/([^/]+)\//);
        if (match?.[1]) projectIds.add(match[1]);
      }

      const projects: HubAlignProject[] = [];
      for (const id of Array.from(projectIds)) {
        projects.push({
          id,
          name: `Projeto ${id.slice(0, 8).toUpperCase()}`,
          description: "Projeto HubAlign",
          status: "editing",
          createdBy: HUBALIGN_OWNER_USERNAME,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fileCount: rows.filter((r: any) => String(r?.name || "").startsWith(`hubalign/projects/${id}/files/`)).length,
          versionCount: rows.filter((r: any) => String(r?.name || "").startsWith(`hubalign/projects/${id}/versions/`)).length,
        });
      }

      await writeHubAlignAudit(req, "HUBALIGN_PROJECTS_LISTED", { count: projects.length });
      return res.status(200).json({ items: projects });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao listar projetos HubAlign" });
    }
  });

  app.post("/api/hubalign/projects", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const user = (req as any).user;
      const name = String(req.body?.name || "").trim() || `Projeto ${new Date().toLocaleDateString("pt-BR")}`;
      const description = String(req.body?.description || "").trim();
      const projectId = randomUUID().replace(/-/g, "").slice(0, 16);
      const now = new Date().toISOString();
      const project: HubAlignProject = {
        id: projectId,
        name,
        description,
        status: "draft",
        createdBy: String(user?.id || ""),
        createdAt: now,
        updatedAt: now,
        fileCount: 0,
        versionCount: 0,
      };

      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      await uploadJsonToSupabaseStorage({
        bucket,
        path: projectPath(projectId, "project.json"),
        data: project,
      });
      await saveProjectBackup(bucket, projectId, { type: "project_created", payload: project });
      await writeHubAlignAudit(req, "HUBALIGN_PROJECT_CREATED", { projectId });
      return res.status(201).json(project);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao criar projeto HubAlign" });
    }
  });

  app.post("/api/hubalign/projects/:projectId/upload", requireAuth, requireHubAlignOwner, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Arquivo nao enviado" });
      
      // Validação de tipo de arquivo
      if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          message: `Formato de arquivo nao suportado (${req.file.mimetype}). Use WAV, MP3 ou M4A.` 
        });
      }

      const projectId = String(req.params.projectId || "").trim();
      const cleanName = String(req.file.originalname || "arquivo.wav").replace(/[^a-zA-Z0-9_.-]/g, "_");
      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      const publicUrl = await uploadToSupabaseStorage({
        bucket,
        path: projectPath(projectId, `files/${Date.now()}_${cleanName}`),
        buffer: req.file.buffer,
        contentType: req.file.mimetype || "application/octet-stream",
      });
      await saveProjectBackup(bucket, projectId, {
        type: "file_uploaded",
        fileName: cleanName,
        publicUrl,
        at: new Date().toISOString(),
      });
      await writeHubAlignAudit(req, "HUBALIGN_FILE_UPLOADED", { projectId, fileName: cleanName, size: req.file.size });
      return res.status(201).json({ publicUrl, fileName: cleanName, size: req.file.size });
    } catch (err: any) {
      console.error("[HubAlign] Upload error:", err);
      return res.status(500).json({ message: err?.message || "Falha no upload de arquivo" });
    }
  });

  app.get("/api/hubalign/hubdub-takes", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const { search, character, studioId } = req.query;
      let allTakes = await storage.getAllTakesGrouped();
      
      // Filtros básicos
      if (studioId) {
        allTakes = allTakes.filter(t => t.studioId === studioId);
      }
      if (character) {
        allTakes = allTakes.filter(t => 
          String(t.characterName || "").toLowerCase().includes(String(character).toLowerCase())
        );
      }
      if (search) {
        const s = String(search).toLowerCase();
        allTakes = allTakes.filter(t => 
          String(t.productionName || "").toLowerCase().includes(s) ||
          String(t.sessionTitle || "").toLowerCase().includes(s) ||
          String(t.voiceActorName || "").toLowerCase().includes(s)
        );
      }

      // Adicionar streamUrl para o HubAlign
      const items = allTakes.map(t => ({
        ...t,
        streamUrl: `/api/hubalign/files/stream?path=${encodeURIComponent(t.audioUrl)}`
      }));

      await writeHubAlignAudit(req, "HUBALIGN_HUBDUB_TAKES_LISTED", { count: items.length });
      return res.status(200).json({ items });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao buscar takes do HubDub" });
    }
  });

  app.get("/api/hubalign/projects/:projectId/files", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const projectId = String(req.params.projectId || "").trim();
      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      const rows = await listSupabaseStorageObjects({
        bucket,
        prefix: projectPath(projectId, "files/"),
        limit: 300,
        offset: 0,
        sortBy: { column: "name", order: "asc" },
      });
      const files = (rows as any[]).map((row) => {
        const objectPath = String(row?.name || "");
        const encodedPath = encodeURIComponent(objectPath);
        return {
          name: objectPath.split("/").pop() || objectPath,
          objectPath,
          size: Number(row?.metadata?.size || row?.metadata?.contentLength || 0),
          updatedAt: row?.updated_at || null,
          streamUrl: `/api/hubalign/files/stream?path=${encodedPath}`,
        };
      });
      return res.status(200).json({ items: files });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao listar arquivos do projeto" });
    }
  });

  app.get("/api/hubalign/files/stream", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      // Express decodifica req.query automaticamente.
      // Removemos o decodeURIComponent redundante que causava falha se o caminho contivesse caracteres especiais ou '%'
      const rawPath = String(req.query.path || "").trim();
      const pathOrUrl = rawPath.replace(/^\/+/, "");
      
      if (!pathOrUrl) {
        return res.status(400).json({ message: "Caminho ou URL ausente" });
      }

      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      const range = String(req.headers.range || "").trim();

      let response;
      if (pathOrUrl.startsWith("http")) {
        const { downloadFromSupabaseStorageUrl } = await import("./lib/supabase");
        response = await downloadFromSupabaseStorageUrl(pathOrUrl, { range });
      } else {
        response = await downloadFromSupabaseStorage({ bucket, path: pathOrUrl }, range ? { range } : undefined);
      }

      // Definimos o status retornado pelo upstream (200 ou 206)
      res.status(response.status);

      res.setHeader("content-type", response.headers.get("content-type") || "audio/wav");
      res.setHeader("accept-ranges", "bytes");
      
      const contentRange = response.headers.get("content-range");
      if (contentRange) res.setHeader("content-range", contentRange);
      
      const contentLength = response.headers.get("content-length");
      if (contentLength) res.setHeader("content-length", contentLength);

      const body = response.body;
      if (!body) return res.status(204).end();

      const { Readable } = await import("stream");
      Readable.fromWeb(body as any).pipe(res);
    } catch (err: any) {
      logger.error("[HubAlign] Stream error:", {
        path: req.query.path,
        message: err?.message,
        stack: err?.stack,
      });
      return res.status(500).json({ message: err?.message || "Falha ao transmitir arquivo" });
    }
  });

  app.post("/api/hubalign/projects/:projectId/tracks/version", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const projectId = String(req.params.projectId || "").trim();
      const versionData = {
        id: randomUUID(),
        projectId,
        createdAt: new Date().toISOString(),
        tracks: Array.isArray(req.body?.tracks) ? req.body.tracks : [],
        playback: req.body?.playback || {},
        note: String(req.body?.note || "").trim(),
      };
      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      const versionPath = projectPath(projectId, `versions/${Date.now()}_${versionData.id}.json`);
      await uploadJsonToSupabaseStorage({ bucket, path: versionPath, data: versionData });
      await uploadJsonToSupabaseStorage({
        bucket,
        path: projectPath(projectId, "tracks/latest.json"),
        data: versionData,
      });
      await saveProjectBackup(bucket, projectId, { type: "version_saved", versionPath, versionData });
      await writeHubAlignAudit(req, "HUBALIGN_TRACK_VERSION_SAVED", { projectId, versionPath });
      return res.status(201).json(versionData);
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao versionar tracks" });
    }
  });

  app.post("/api/hubalign/projects/:projectId/export", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const projectId = String(req.params.projectId || "").trim();
      const exportPayload = {
        id: randomUUID(),
        projectId,
        createdAt: new Date().toISOString(),
        selectedFiles: Array.isArray(req.body?.selectedFiles) ? req.body.selectedFiles : [],
        timeline: Array.isArray(req.body?.timeline) ? req.body.timeline : [],
      };
      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      const path = projectPath(projectId, `exports/${Date.now()}_${exportPayload.id}.json`);
      const publicUrl = await uploadJsonToSupabaseStorage({ bucket, path, data: exportPayload });
      await saveProjectBackup(bucket, projectId, { type: "project_exported", exportPath: path });
      await writeHubAlignAudit(req, "HUBALIGN_PROJECT_EXPORTED", { projectId, path });
      return res.status(201).json({ exportId: exportPayload.id, publicUrl });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao exportar projeto" });
    }
  });
}

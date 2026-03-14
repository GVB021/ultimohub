import type { Express, Request, Response } from "express";

declare module "express" {
  interface Request {
    params: Record<string, string>;
  }
}
import type { Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { db } from "./db";
import { eq, and } from "drizzle-orm";
import {
  productions, characters, takes, users, studios, sessions, studioMemberships, userStudioRoles,
  type Production, type Session,
  insertProductionSchema, insertCharacterSchema, insertTakeSchema, insertSessionSchema,
} from "@shared/schema";
import { normalizePlatformRole } from "@shared/roles";
import { requireAuth, requireAdmin, requireStudioAccess, requireStudioRole } from "./middleware/auth";
import { logger } from "./lib/logger";
import { spawn } from "child_process";
import { randomUUID } from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { Readable } from "stream";
import {
  checkSupabaseConnection,
  configureSupabase,
  deleteFromSupabaseStorage,
  downloadFromSupabaseStorageUrl,
  isSupabaseConfigured,
  parseSupabaseStorageUrl,
  uploadToSupabaseStorage,
} from "./lib/supabase";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const mediaJobsDir = path.join(process.cwd(), "public", "media-jobs");
fs.mkdirSync(mediaJobsDir, { recursive: true });

const mediaUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const original = file.originalname || "media";
      const safe = original.replace(/[^a-zA-Z0-9_.\-]/g, "");
      const ext = path.extname(safe);
      const base = safe.slice(0, Math.max(0, safe.length - ext.length));
      cb(null, `${base || "media"}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
});

function safeAudioPath(audioUrl: string): string | null {
  const normalized = audioUrl.replace(/^\/+/, "");
  const resolved = path.resolve(process.cwd(), "public", normalized);
  const uploadsBase = path.resolve(process.cwd(), "public", "uploads");
  if (!resolved.startsWith(uploadsBase)) return null;
  return resolved;
}

function isHttpUrl(input: string) {
  return /^https?:\/\//i.test(String(input || ""));
}

function filenameFromAudioUrl(audioUrl: string, fallback = "take.wav") {
  const raw = String(audioUrl || "").trim();
  if (!raw) return fallback;
  if (!isHttpUrl(raw)) {
    const base = path.basename(raw);
    return base || fallback;
  }
  try {
    const u = new URL(raw);
    const base = path.basename(u.pathname);
    return base || fallback;
  } catch {
    const parts = raw.split("/");
    return parts[parts.length - 1] || fallback;
  }
}

function toNodeReadable(body: any) {
  if (!body) return null;
  try {
    return Readable.fromWeb(body);
  } catch {
    return null;
  }
}

function sendFileWithRange(req: Request, res: Response, filePath: string, contentType = "audio/wav") {
  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = String(req.headers.range || "");
  res.setHeader("Accept-Ranges", "bytes");

  if (!range) {
    res.status(200);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", String(total));
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const m = range.match(/bytes=(\d+)-(\d+)?/);
  if (!m) {
    res.status(416);
    res.setHeader("Content-Range", `bytes */${total}`);
    res.end();
    return;
  }

  const start = Math.min(total - 1, Math.max(0, Number(m[1] || 0)));
  const endRaw = m[2] ? Number(m[2]) : total - 1;
  const end = Math.min(total - 1, Math.max(start, endRaw));
  const chunkSize = end - start + 1;

  res.status(206);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", String(chunkSize));
  fs.createReadStream(filePath, { start, end }).pipe(res);
}

async function fetchAudioResponse(audioUrl: string, range?: string) {
  if (isSupabaseConfigured() && parseSupabaseStorageUrl(audioUrl)) {
    return await downloadFromSupabaseStorageUrl(audioUrl, { range });
  }
  const res = await fetch(audioUrl, { headers: range ? { range } : undefined });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${text}`.trim());
  }
  return res;
}

function safeJobId(jobId: string): string | null {
  const cleaned = jobId.replace(/[^a-zA-Z0-9_\-]/g, "");
  if (!cleaned || cleaned.length < 8) return null;
  return cleaned;
}

function normalizeSegment(input: string) {
  const raw = (input || "").trim() || "sem_nome";
  const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const snake = noAccents
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return snake || "sem_nome";
}

function normalizeTokenUpper(input: string) {
  const raw = (input || "").trim() || "SEM_NOME";
  const noAccents = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const token = noAccents
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return token || "SEM_NOME";
}

function normalizeTimecodeToken(input: string) {
  const digits = String(input || "").replace(/\D/g, "");
  return digits || "000000000";
}

function secondsToTimecodeToken(seconds: number) {
  const totalMs = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const hh = String(Math.floor(totalMs / 3600000)).padStart(2, "0");
  const mm = String(Math.floor((totalMs % 3600000) / 60000)).padStart(2, "0");
  const ss = String(Math.floor((totalMs % 60000) / 1000)).padStart(2, "0");
  const ms = String(totalMs % 1000).padStart(3, "0");
  return `${hh}${mm}${ss}${ms}`;
}

function jobStatusPath(jobId: string): string {
  return path.join(mediaJobsDir, jobId, "status.json");
}

function ensureJobDir(jobId: string): string {
  const dir = path.join(mediaJobsDir, jobId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function logAdminAction(req: Request, action: string, details?: string) {
  try {
    const userId = (req as any).user?.id;
    await storage.createAuditLog({ userId, action, details });
  } catch {}
}

async function verifyProductionAccess(req: Request, res: Response, productionId: string): Promise<Production | null> {
  const prod = await storage.getProduction(productionId);
  if (!prod) { res.status(404).json({ message: "Producao nao encontrada" }); return null; }
  const user = (req as any).user!;
  if (user.role === "platform_owner") return prod;
  const hasAccess = await storage.verifyUserStudioAccess(user.id, prod.studioId);
  if (!hasAccess) { res.status(403).json({ message: "Acesso negado" }); return null; }
  return prod;
}

async function verifySessionAccess(req: Request, res: Response, sessionId: string): Promise<Session | null> {
  const session = await storage.getSession(sessionId);
  if (!session) { res.status(404).json({ message: "Sessao nao encontrada" }); return null; }
  const user = (req as any).user!;
  if (user.role === "platform_owner") return session;
  const hasAccess = await storage.verifyUserStudioAccess(user.id, session.studioId);
  if (!hasAccess) { res.status(403).json({ message: "Acesso negado" }); return null; }
  return session;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // NOTIFICATIONS
  app.get("/api/notifications", requireAuth, async (req, res) => {
    const userId = (req as any).user!.id;
    const notifs = await storage.getNotifications(userId);
    res.status(200).json(notifs);
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    const userId = (req as any).user!.id;
    const count = await storage.getUnreadNotificationCount(userId);
    res.status(200).json({ count });
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    await storage.markNotificationRead(req.params.id);
    res.status(200).json({ ok: true });
  });

  app.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
    const userId = (req as any).user!.id;
    const notifs = await storage.getNotifications(userId);
    await Promise.all(notifs.map(n => storage.markNotificationRead(n.id)));
    res.status(200).json({ ok: true });
  });

  // PROFILE
  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).user!.id;
      const allowed = ["firstName", "lastName", "displayName", "artistName", "phone", "city", "state", "bio", "experience", "specialty", "mainLanguage", "portfolioUrl"];
      const updates: Record<string, any> = {};
      for (const field of allowed) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }
      const updated = await storage.updateUser(userId, updates);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Falha ao atualizar perfil" });
    }
  });

  app.post("/api/media-jobs", mediaUpload.single("media"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Arquivo não enviado" });

      const filename = path.basename(req.file.path);
      const publicRel = `/uploads/${filename}`;
      const inputPath = safeAudioPath(publicRel);
      if (!inputPath || !fs.existsSync(inputPath)) {
        return res.status(400).json({ message: "Falha ao salvar arquivo" });
      }

      const jobId = randomUUID();
      ensureJobDir(jobId);

      const initialStatus = {
        job_id: jobId,
        status: "queued",
        step: "queued",
        progress: 0,
        message: null,
        error: null,
        outputs: null,
      };
      fs.writeFileSync(jobStatusPath(jobId), JSON.stringify(initialStatus, null, 2));

      const workerScript = path.join(process.cwd(), "services", "media-pipeline", "worker.py");
      const venvPython = path.join(process.cwd(), "services", "media-pipeline", ".venv", "bin", "python");
      const python = process.env.PYTHON_BIN || (fs.existsSync(venvPython) ? venvPython : "python3");
      const bundledFfmpeg = path.join(process.cwd(), "services", "media-pipeline", "bin", "ffmpeg");
      const ffmpegPath = process.env.FFMPEG_PATH || (fs.existsSync(bundledFfmpeg) ? bundledFfmpeg : "ffmpeg");
      const jobDir = ensureJobDir(jobId);
      const outLogPath = path.join(jobDir, "worker.log");
      const errLogPath = path.join(jobDir, "worker.err.log");
      const outFd = fs.openSync(outLogPath, "a");
      const errFd = fs.openSync(errLogPath, "a");
      const child = spawn(
        python,
        [workerScript, "--job-id", jobId, "--input", publicRel],
        {
          detached: true,
          stdio: ["ignore", outFd, errFd],
          env: {
            ...process.env,
            VHUB_REPO_ROOT: process.cwd(),
            VHUB_PUBLIC_DIR: path.join(process.cwd(), "public"),
            VHUB_MEDIA_JOBS_DIR: path.join(process.cwd(), "public", "media-jobs"),
            VHUB_UPLOADS_DIR: path.join(process.cwd(), "public", "uploads"),
            VHUB_PIPELINE_STRICT: "1",
            FFMPEG_PATH: ffmpegPath,
          },
        },
      );
      try { fs.closeSync(outFd); } catch {}
      try { fs.closeSync(errFd); } catch {}
      child.on("error", (e: any) => {
        try {
          const failed = {
            job_id: jobId,
            status: "failed",
            step: "error",
            progress: 1,
            message: null,
            error: e?.message || "Falha ao iniciar worker",
            outputs: null,
          };
          fs.writeFileSync(jobStatusPath(jobId), JSON.stringify(failed, null, 2));
        } catch {}
      });
      child.unref();

      res.status(201).json({ jobId, input: publicRel, statusUrl: `/api/media-jobs/${jobId}` });
    } catch (err: any) {
      logger.error("[Media Pipeline] Create job error", { message: err?.message });
      res.status(500).json({ message: err?.message || "Erro ao criar job" });
    }
  });

  app.get("/api/media-jobs/:jobId", async (req, res) => {
    try {
      const jobId = safeJobId(req.params.jobId);
      if (!jobId) return res.status(400).json({ message: "Job inválido" });
      const p = jobStatusPath(jobId);
      if (!fs.existsSync(p)) return res.status(404).json({ message: "Job não encontrado" });
      const raw = fs.readFileSync(p, "utf-8");
      res.status(200).json(JSON.parse(raw));
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao consultar job" });
    }
  });

  // STUDIOS
  app.get("/api/studios", requireAuth, async (req, res) => {
    const user = (req as any).user!;
    if (normalizePlatformRole(user.role) === "platform_owner") {
      const allStudios = await storage.getStudios();
      const studiosWithRoles = await Promise.all(
        allStudios.map(async (s) => ({ ...s, userRoles: ["platform_owner"] }))
      );
      return res.status(200).json(studiosWithRoles);
    }
    const userStudios = await storage.getStudiosForUser(user.id);
    const studiosWithRoles = await Promise.all(
      userStudios.map(async (s) => {
        const roles = await storage.getUserRolesInStudio(user.id, s.id);
        return { ...s, userRoles: roles };
      })
    );
    res.status(200).json(studiosWithRoles);
  });

  app.get("/api/studios/:studioId", requireAuth, requireStudioAccess, async (req, res) => {
    const studio = await storage.getStudio(req.params.studioId);
    if (!studio) return res.status(404).json({ message: "Estudio nao encontrado" });
    res.status(200).json(studio);
  });

  const studioProfilePatchSchema = z.object({
    data: z.record(z.any()),
  }).strict();

  app.get("/api/studios/:studioId/profile", requireAuth, requireStudioAccess, async (req, res) => {
    try {
      const profile = await storage.getStudioProfile(req.params.studioId);
      return res.status(200).json({ profile });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Erro ao buscar perfil do estudio" });
    }
  });

  app.patch("/api/studios/:studioId/profile", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const parsed = studioProfilePatchSchema.parse(req.body || {});
      const profile = await storage.upsertStudioProfile(req.params.studioId, parsed.data || {});
      return res.status(200).json({ profile });
    } catch (err: any) {
      if (err?.errors) {
        return res.status(400).json({ message: err.errors?.[0]?.message || "Dados invalidos" });
      }
      return res.status(500).json({ message: err?.message || "Erro ao atualizar perfil do estudio" });
    }
  });

  app.post("/api/studios", requireAuth, requireAdmin, async (req, res) => {
    try {
      const body = req.body;
      const name = body.name;
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({ message: "Nome do estudio e obrigatorio" });
      }
      const studioAdminUserId = body.studioAdminUserId || null;
      if (studioAdminUserId) {
        const adminUser = await storage.getUser(studioAdminUserId);
        if (!adminUser) return res.status(400).json({ message: "Usuario admin nao encontrado" });
      }
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
      const ownerId = (req as any).user.id;
      const studioData: any = { name, slug, ownerId };
      const studio = await storage.createStudio(studioData, ownerId, studioAdminUserId || undefined);

      const profileKeys = [
        "tradeName",
        "cnpj",
        "legalRepresentative",
        "email",
        "phone",
        "altPhone",
        "street",
        "addressNumber",
        "complement",
        "neighborhood",
        "city",
        "state",
        "zipCode",
        "country",
        "recordingRooms",
        "studioType",
        "website",
        "instagram",
        "linkedin",
        "description",
        "foundedYear",
        "employeeCount",
      ] as const;

      const profilePatch: Record<string, any> = {};
      for (const k of profileKeys) {
        const v = (body as any)[k];
        if (typeof v === "string") {
          const trimmed = v.trim();
          if (trimmed) profilePatch[k] = trimmed;
        } else if (typeof v === "number" && Number.isFinite(v)) {
          profilePatch[k] = v;
        } else if (v !== null && v !== undefined && v !== "") {
          profilePatch[k] = v;
        }
      }
      if (Object.keys(profilePatch).length) {
        await storage.upsertStudioProfile(studio.id, profilePatch);
      }
      if (studioAdminUserId) {
        await storage.createNotification({
          userId: studioAdminUserId,
          type: "membership_approved",
          title: "Novo Estudio",
          message: `Voce foi designado como Admin do estudio "${name}".`,
          isRead: false,
          relatedId: studio.id,
        });
      }
      await logAdminAction(req, "CREATE_STUDIO", `Criou estudio "${name}"`);
      res.status(201).json(studio);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.get("/api/studios/:studioId/my-role", requireAuth, requireStudioAccess, async (req, res) => {
    res.status(200).json({ role: req.studioRole || null, roles: req.studioRoles || [] });
  });

  // STUDIO MEMBERS
  app.get("/api/studios/:studioId/members", requireAuth, requireStudioAccess, async (req, res) => {
    const members = await storage.getStudioMemberships(req.params.studioId);
    res.status(200).json(members);
  });

  app.post("/api/studios/:studioId/members/:membershipId/approve", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const validRoles = z.enum(["studio_admin", "diretor", "dublador", "engenheiro_audio", "aluno"]);
      const body = z.object({
        role: validRoles.optional(),
        roles: z.array(validRoles).optional(),
      }).parse(req.body);
      const roles = body.roles || (body.role ? [body.role] : []);
      if (roles.length === 0) return res.status(400).json({ message: "Pelo menos um papel e obrigatorio" });
      const membership = await storage.getMembership(req.params.membershipId);
      if (!membership || membership.studioId !== req.params.studioId) {
        return res.status(404).json({ message: "Membro nao encontrado" });
      }
      const updated = await storage.updateMembershipStatus(req.params.membershipId, "approved", roles[0]);
      await storage.setUserStudioRoles(req.params.membershipId, roles);
      await storage.updateUserStatus(membership.userId, "approved");
      await storage.createNotification({
        userId: membership.userId,
        type: "membership_approved",
        title: "Membro aprovado",
        message: `Sua solicitacao de adesao ao estudio foi aprovada com papeis: ${roles.join(", ")}.`,
        isRead: false,
        relatedId: req.params.studioId,
      });
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.post("/api/studios/:studioId/members/:membershipId/reject", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    const membership = await storage.getMembership(req.params.membershipId);
    if (!membership || membership.studioId !== req.params.studioId) {
      return res.status(404).json({ message: "Membro nao encontrado" });
    }
    const updated = await storage.updateMembershipStatus(req.params.membershipId, "rejected");
    await storage.updateUserStatus(membership.userId, "rejected");
    await storage.createNotification({
      userId: membership.userId,
      type: "membership_rejected",
      title: "Solicitacao rejeitada",
      message: "Sua solicitacao de adesao ao estudio foi rejeitada.",
      isRead: false,
      relatedId: req.params.studioId,
    });
    res.status(200).json(updated);
  });

  // MEMBERS - UPDATE ROLES
  app.put("/api/studios/:studioId/members/:membershipId/roles", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const { roles } = req.body;
      if (!Array.isArray(roles) || roles.length === 0) {
        return res.status(400).json({ message: "Papeis invalidos" });
      }
      const membership = await storage.getMembership(req.params.membershipId);
      if (!membership || membership.studioId !== req.params.studioId) {
        return res.status(404).json({ message: "Membro nao encontrado" });
      }
      await storage.setUserStudioRoles(req.params.membershipId, roles);
      await storage.updateMembershipStatus(req.params.membershipId, "approved", roles[0]);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao atualizar papeis" });
    }
  });

  // MEMBERS - REMOVE
  app.delete("/api/studios/:studioId/members/:membershipId", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const membership = await storage.getMembership(req.params.membershipId);
      if (!membership || membership.studioId !== req.params.studioId) {
        return res.status(404).json({ message: "Membro nao encontrado" });
      }
      await db.delete(userStudioRoles).where(eq(userStudioRoles.membershipId, req.params.membershipId));
      await db.delete(studioMemberships).where(eq(studioMemberships.id, req.params.membershipId));
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao remover membro" });
    }
  });

  app.post("/api/studios/:studioId/join", requireAuth, async (req, res) => {
    const user = (req as any).user!;
    const existing = await storage.getMembershipsByUser(user.id);
    const alreadyMember = existing.some(m => m.studioId === req.params.studioId);
    if (alreadyMember) return res.status(409).json({ message: "Voce ja e membro deste estudio" });
    const membership = await storage.createMembership({
      userId: user.id,
      studioId: req.params.studioId,
      role: "pending",
      status: "pending",
    });
    const studioAdmins = await storage.getStudioMemberships(req.params.studioId);
    for (const m of studioAdmins) {
      if (m.role === "studio_admin" || (req.studioRoles || []).includes("studio_admin")) {
        await storage.createNotification({
          userId: m.userId,
          type: "join_request",
          title: "Nova solicitacao de membro",
          message: `Um usuario solicitou adesao ao estudio.`,
          isRead: false,
          relatedId: req.params.studioId,
        });
      }
    }
    res.status(201).json(membership);
  });

  // STUDIO STATS
  app.get("/api/studios/:studioId/stats", requireAuth, requireStudioAccess, async (req, res) => {
    try {
      const stats = await storage.getStudioStats(req.params.studioId);
      res.status(200).json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao buscar stats" });
    }
  });

  // STUDIO PENDING MEMBERS
  app.get("/api/studios/:studioId/pending-members", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const pending = await storage.getPendingMembersForStudio(req.params.studioId);
      res.status(200).json(pending);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Erro ao buscar membros pendentes" });
    }
  });

  // PRODUCTIONS
  app.get("/api/studios/:studioId/productions", requireAuth, requireStudioAccess, async (req, res) => {
    const prods = await storage.getProductions(req.params.studioId);
    res.status(200).json(prods);
  });

  app.get("/api/studios/:studioId/productions/:id", requireAuth, requireStudioAccess, async (req, res) => {
    const prod = await storage.getProduction(req.params.id);
    if (!prod) return res.status(404).json({ message: "Production not found" });
    if (prod.studioId !== req.params.studioId) return res.status(403).json({ message: "Acesso negado" });
    res.status(200).json(prod);
  });

  app.post("/api/studios/:studioId/productions", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const input = insertProductionSchema.parse({ ...req.body, studioId: req.params.studioId });
      const prod = await storage.createProduction(input);
      res.status(201).json(prod);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  app.patch("/api/studios/:studioId/productions/:id", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const prod = await storage.getProduction(req.params.id);
      if (!prod) return res.status(404).json({ message: "Producao nao encontrada" });
      if (prod.studioId !== req.params.studioId) return res.status(403).json({ message: "Acesso negado" });
      const [updated] = await db.update(productions).set(req.body).where(eq(productions.id, req.params.id)).returning();
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  app.delete("/api/studios/:studioId/productions/:id", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const prod = await storage.getProduction(req.params.id);
      if (!prod) return res.status(404).json({ message: "Producao nao encontrada" });
      if (prod.studioId !== req.params.studioId) return res.status(403).json({ message: "Acesso negado" });
      await storage.deleteProduction(req.params.id);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Falha ao excluir producao" });
    }
  });

  // CHARACTERS
  app.get("/api/productions/:productionId/characters", requireAuth, async (req, res) => {
    const prod = await verifyProductionAccess(req, res, req.params.productionId);
    if (!prod) return;
    const chars = await storage.getCharacters(req.params.productionId);
    res.status(200).json(chars);
  });

  app.post("/api/productions/:productionId/characters", requireAuth, async (req, res) => {
    try {
      const prod = await verifyProductionAccess(req, res, req.params.productionId);
      if (!prod) return;
      const input = insertCharacterSchema.parse({ ...req.body, productionId: req.params.productionId });
      const char = await storage.createCharacter(input);
      res.status(201).json(char);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  app.patch("/api/productions/:productionId/characters/:id", requireAuth, async (req, res) => {
    try {
      const charId = String(req.params.id);
      const [charRecord] = await db.select().from(characters).where(eq(characters.id, charId));
      if (!charRecord) return res.status(404).json({ message: "Personagem nao encontrado" });
      const prod = await verifyProductionAccess(req, res, charRecord.productionId);
      if (!prod) return;
      const [updated] = await db.update(characters).set(req.body).where(eq(characters.id, charId)).returning();
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  // SESSIONS
  app.get("/api/studios/:studioId/sessions", requireAuth, requireStudioAccess, async (req, res) => {
    const sessionsList = await storage.getSessions(req.params.studioId);
    res.status(200).json(sessionsList);
  });

  app.get("/api/studios/:studioId/sessions/:id", requireAuth, requireStudioAccess, async (req, res) => {
    const session = await storage.getSession(req.params.id);
    if (!session) return res.status(404).json({ message: "Sessao nao encontrada" });
    if (session.studioId !== req.params.studioId) return res.status(403).json({ message: "Acesso negado" });
    res.status(200).json(session);
  });

  app.post("/api/studios/:studioId/sessions", requireAuth, requireStudioRole("studio_admin", "diretor"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      const settings = await storage.getAllSettings();
      const storageProvider = "supabase";
      const takesPath = String(req.body.takesPath || settings.DEFAULT_TAKES_PATH || "uploads");

      const allowedPaths: string[] = (() => {
        try {
          const raw = settings.TAKES_SAVE_PATHS || "[]";
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
          return [];
        } catch {
          return [];
        }
      })();

      if (allowedPaths.length > 0 && !allowedPaths.includes(takesPath)) {
        return res.status(400).json({ message: "Caminho de salvamento invalido" });
      }

      const status = await checkSupabaseConnection(false);
      if (!isSupabaseConfigured() || !status.ok) {
        return res.status(400).json({ message: "Supabase indisponivel" });
      }

      const input = insertSessionSchema.parse({
        title: req.body.title,
        productionId: req.body.productionId,
        studioId: req.params.studioId,
        scheduledAt: new Date(req.body.scheduledAt),
        durationMinutes: req.body.durationMinutes ?? 60,
        status: req.body.status ?? "scheduled",
        storageProvider,
        takesPath,
        createdBy: userId,
      });
      const session = await storage.createSession(input);
      res.status(201).json(session);
    } catch (err: any) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  app.delete("/api/studios/:studioId/sessions/:id", requireAuth, requireStudioRole("studio_admin", "diretor"), async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session || session.studioId !== req.params.studioId) return res.status(404).json({ message: "Sessao nao encontrada" });
      const userId = (req.user as any)?.id;
      const userRole = (req.user as any)?.role;
      const studioRole = (req as any).studioRole;
      const isAdmin = userRole === "platform_owner" || studioRole === "studio_admin";
      if (!isAdmin && session.createdBy !== userId) {
        return res.status(403).json({ message: "Voce so pode excluir sessoes criadas por voce" });
      }
      await storage.deleteSession(req.params.id);
      res.status(200).json({ message: "Sessao excluida" });
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir sessao" });
    }
  });

  app.patch("/api/studios/:studioId/sessions/:id", requireAuth, requireStudioRole("studio_admin", "diretor"), async (req, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session || session.studioId !== req.params.studioId) return res.status(404).json({ message: "Sessao nao encontrada" });
      const updated = await storage.updateSession(req.params.id, req.body);
      res.status(200).json(updated);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  // SESSION PARTICIPANTS
  app.get("/api/sessions/:sessionId/participants", requireAuth, async (req, res) => {
    const session = await verifySessionAccess(req, res, req.params.sessionId);
    if (!session) return;
    const participants = await storage.getSessionParticipants(req.params.sessionId);
    res.status(200).json(participants);
  });

  app.post("/api/sessions/:sessionId/participants", requireAuth, async (req, res) => {
    try {
      const session = await verifySessionAccess(req, res, req.params.sessionId);
      if (!session) return;
      const participant = await storage.addSessionParticipant({
        sessionId: req.params.sessionId,
        userId: req.body.userId || (req as any).user!.id,
        role: req.body.role || "dublador",
      });
      res.status(201).json(participant);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  // TAKES
  app.post("/api/sessions/:sessionId/takes", requireAuth, upload.single("audio"), async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const body = z.object({
        characterId: z.string().min(1),
        voiceActorId: z.string().min(1),
        lineIndex: z.coerce.number().int().min(0),
        durationSeconds: z.coerce.number().min(0).optional(),
        qualityScore: z.coerce.number().min(0).max(100).nullable().optional(),
        audioUrl: z.string().optional(),
        timecode: z.string().optional(),
        startTimeSeconds: z.coerce.number().min(0).optional(),
      }).parse(req.body);

      const sessionCheck = await verifySessionAccess(req, res, sessionId);
      if (!sessionCheck) return;

      const settings = await storage.getAllSettings();
      const storageProvider = (sessionCheck as any).storageProvider || settings.DEFAULT_STORAGE_PROVIDER || "supabase";
      const takesPath = (sessionCheck as any).takesPath || settings.DEFAULT_TAKES_PATH || "uploads";
      const supabaseBucket = settings.SUPABASE_BUCKET || "takes";

      let audioUrl = body.audioUrl || "";
      let contentType = "audio/wav";

      if (req.file) {
        const originalName = req.file.originalname || "";
        const safeName = originalName.replace(/[^a-zA-Z0-9_.\-]/g, "");
        const ext = path.extname(safeName || "") || ".wav";
        const filename = `take_${sessionId}_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, req.file.buffer);
        audioUrl = `/uploads/${filename}`;
        contentType = req.file.mimetype || contentType;
      }

      if (!audioUrl) {
        return res.status(400).json({ message: "Audio nao enviado" });
      }

      const takeInput = insertTakeSchema.parse({
        sessionId,
        characterId: body.characterId,
        voiceActorId: body.voiceActorId,
        lineIndex: body.lineIndex,
        audioUrl,
        durationSeconds: body.durationSeconds ?? 0,
        qualityScore: body.qualityScore ?? null,
      });
      const take = await storage.createTake(takeInput);

      if (req.file && storageProvider === "supabase" && isSupabaseConfigured()) {
        try {
          const status = await checkSupabaseConnection(false);
          if (!status.ok) throw new Error(status.reason || "Supabase indisponivel");
          const timecodeToken =
            normalizeTimecodeToken(body.timecode || "") !== "000000000"
              ? normalizeTimecodeToken(body.timecode || "")
              : secondsToTimecodeToken(body.startTimeSeconds || 0);

          const studioId = String((sessionCheck as any).studioId || "");
          const productionId = String((sessionCheck as any).productionId || "");

          const [[studioRow], [productionRow], [characterRow], [actorRow]] = await Promise.all([
            studioId
              ? db.select({ name: studios.name }).from(studios).where(eq(studios.id, studioId))
              : Promise.resolve([]),
            productionId
              ? db.select({ name: productions.name }).from(productions).where(eq(productions.id, productionId))
              : Promise.resolve([]),
            db.select({ name: characters.name }).from(characters).where(eq(characters.id, String(body.characterId))),
            db.select({ artistName: users.artistName, displayName: users.displayName, fullName: users.fullName, firstName: users.firstName, lastName: users.lastName, email: users.email })
              .from(users)
              .where(eq(users.id, String(body.voiceActorId))),
          ]);

          const studioName = normalizeSegment(studioRow?.name || "");
          const productionName = normalizeSegment(productionRow?.name || "");
          const actorNameRaw =
            actorRow?.artistName ||
            actorRow?.displayName ||
            actorRow?.fullName ||
            `${actorRow?.firstName || ""} ${actorRow?.lastName || ""}`.trim() ||
            actorRow?.email ||
            "";
          const actorFolder = normalizeSegment(actorNameRaw);
          const characterFolder = normalizeSegment(characterRow?.name || "");

          const actorToken = normalizeTokenUpper(actorNameRaw);
          const characterToken = normalizeTokenUpper(characterRow?.name || "");
          const filename = `${characterToken}_${actorToken}_${timecodeToken}.wav`;

          const baseFolder = normalizeSegment(String(takesPath || "uploads"));
          const pathSegments =
            String(supabaseBucket || "").trim().toLowerCase() === baseFolder
              ? [studioName, productionName, actorFolder, characterFolder, filename]
              : [baseFolder, studioName, productionName, actorFolder, characterFolder, filename];
          const objectPath = pathSegments.filter(Boolean).join("/");
          const publicUrl = await uploadToSupabaseStorage({
            bucket: supabaseBucket,
            path: objectPath,
            buffer: req.file.buffer,
            contentType,
          });
          await storage.updateTakeAudioUrl(take.id, publicUrl);
          (take as any).audioUrl = publicUrl;
        } catch (e: any) {
          logger.error("[Take Upload] Supabase upload failed", { takeId: take.id, message: e?.message });
        }
      }

      res.status(201).json(take);
    } catch (err: any) {
      logger.error("[Take Upload] Create error", { message: err?.message });
      res.status(400).json({ message: err?.message || "Dados invalidos" });
    }
  });

  app.get("/api/sessions/:sessionId/takes", requireAuth, async (req, res) => {
    const session = await verifySessionAccess(req, res, req.params.sessionId);
    if (!session) return;
    const takesList = await storage.getTakes(req.params.sessionId);
    res.status(200).json(takesList);
  });

  app.post("/api/takes/:id/prefer", requireAuth, async (req, res) => {
    try {
      const [takeRecord] = await db.select().from(takes).where(eq(takes.id, req.params.id));
      if (!takeRecord) return res.status(404).json({ message: "Take nao encontrado" });
      const session = await verifySessionAccess(req, res, takeRecord.sessionId);
      if (!session) return;
      const take = await storage.setPreferredTake(req.params.id);
      res.status(200).json(take);
    } catch (err) {
      res.status(404).json({ message: "Take nao encontrado" });
    }
  });

  app.delete("/api/takes/:id", requireAuth, async (req, res) => {
    try {
      const [takeRecord] = await db.select().from(takes).where(eq(takes.id, req.params.id));
      if (!takeRecord) return res.status(404).json({ message: "Take nao encontrado" });
      const userId = (req.user as any)?.id;
      const userRole = (req.user as any)?.role;
      const isAdmin = userRole === "platform_owner" || userRole === "studio_admin";
      if (!isAdmin && takeRecord.voiceActorId !== userId) {
        return res.status(403).json({ message: "Voce so pode excluir seus proprios takes" });
      }
      await storage.deleteTake(req.params.id);
      res.status(200).json({ message: "Take excluido" });
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir take" });
    }
  });

  // TAKES - GROUPED LISTING (for Takes de Audio page)
  app.get("/api/studios/:studioId/takes/grouped", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user!;
      const studioId = req.params.studioId;
      if (user.role === "platform_owner") {
        const allTakes = await storage.getAllTakesGrouped();
        return res.status(200).json(allTakes);
      }
      const roles = await storage.getUserRolesInStudio(user.id, studioId);
      if (!roles.includes("studio_admin")) {
        return res.status(403).json({ message: "Acesso restrito a administradores" });
      }
      const studioTakes = await storage.getStudioTakesGrouped(studioId);
      res.status(200).json(studioTakes);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao buscar takes" });
    }
  });

  // TAKES - INDIVIDUAL DOWNLOAD
  app.get("/api/takes/:id/download", requireAuth, async (req, res) => {
    try {
      const takeList = await storage.getTakesByIds([req.params.id]);
      if (takeList.length === 0) return res.status(404).json({ message: "Take nao encontrado" });
      const take = takeList[0];
      const user = (req as any).user!;
      if (user.role !== "platform_owner") {
        const isOwner = String(take.voiceActorId || "") === String(user.id || "");
        if (!isOwner) {
          const roles = await storage.getUserRolesInStudio(user.id, take.studioId);
          if (!roles.includes("studio_admin")) {
            return res.status(403).json({ message: "Acesso negado" });
          }
        }
      }
      const filename = filenameFromAudioUrl(take.audioUrl, "take.wav").replace(/[^a-zA-Z0-9_.\-]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const filePath = safeAudioPath(take.audioUrl);
      if (filePath && fs.existsSync(filePath)) {
        res.setHeader("Content-Type", "audio/wav");
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      if (isHttpUrl(take.audioUrl)) {
        const upstream = await fetchAudioResponse(take.audioUrl);
        const contentType = upstream.headers.get("content-type") || "application/octet-stream";
        res.setHeader("Content-Type", contentType);
        const stream = toNodeReadable(upstream.body);
        if (!stream) return res.status(500).json({ message: "Falha ao obter stream" });
        stream.pipe(res);
        return;
      }

      return res.status(404).json({ message: "Arquivo nao encontrado" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao baixar take" });
    }
  });

  app.get("/api/takes/:id/stream", requireAuth, async (req, res) => {
    try {
      const takeList = await storage.getTakesByIds([req.params.id]);
      if (takeList.length === 0) return res.status(404).json({ message: "Take nao encontrado" });
      const take = takeList[0];
      const user = (req as any).user!;
      if (user.role !== "platform_owner") {
        const isOwner = String(take.voiceActorId || "") === String(user.id || "");
        if (!isOwner) {
          const roles = await storage.getUserRolesInStudio(user.id, take.studioId);
          if (!roles.includes("studio_admin")) {
            return res.status(403).json({ message: "Acesso negado" });
          }
        }
      }

      const filePath = safeAudioPath(take.audioUrl);
      if (filePath && fs.existsSync(filePath)) {
        sendFileWithRange(req, res, filePath, "audio/wav");
        return;
      }

      if (isHttpUrl(take.audioUrl)) {
        const range = String(req.headers.range || "");
        const upstream = await fetchAudioResponse(take.audioUrl, range);
        const contentType = upstream.headers.get("content-type") || "application/octet-stream";
        res.status(upstream.status);
        res.setHeader("Content-Type", contentType);
        const contentLength = upstream.headers.get("content-length");
        if (contentLength) res.setHeader("Content-Length", contentLength);
        const acceptRanges = upstream.headers.get("accept-ranges");
        if (acceptRanges) res.setHeader("Accept-Ranges", acceptRanges);
        const contentRange = upstream.headers.get("content-range");
        if (contentRange) res.setHeader("Content-Range", contentRange);
        const stream = toNodeReadable(upstream.body);
        if (!stream) return res.status(500).json({ message: "Falha ao obter stream" });
        stream.pipe(res);
        return;
      }

      return res.status(404).json({ message: "Arquivo nao encontrado" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Erro ao reproduzir take" });
    }
  });

  // TAKES - BULK DOWNLOAD (selected takes)
  app.post("/api/takes/download-bulk", requireAuth, async (req, res) => {
    try {
      const { takeIds } = req.body;
      if (!Array.isArray(takeIds) || takeIds.length === 0) {
        return res.status(400).json({ message: "Nenhum take selecionado" });
      }
      const takeList = await storage.getTakesByIds(takeIds);
      if (takeList.length === 0) return res.status(404).json({ message: "Takes nao encontrados" });
      const user = (req as any).user!;
      if (user.role !== "platform_owner") {
        const studioIds: string[] = [];
        const seen: Record<string, true> = {};
        for (const take of takeList as any[]) {
          const sid = String(take.studioId ?? "");
          if (!sid) continue;
          if (seen[sid]) continue;
          seen[sid] = true;
          studioIds.push(sid);
        }
        for (const sid of studioIds) {
          const roles = await storage.getUserRolesInStudio(user.id, sid as string);
          if (!roles.includes("studio_admin")) {
            return res.status(403).json({ message: "Acesso negado a takes de outro estudio" });
          }
        }
      }
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 5 } });
      res.setHeader("Content-Disposition", 'attachment; filename="takes_selecionados.zip"');
      res.setHeader("Content-Type", "application/zip");
      archive.pipe(res);
      for (const take of takeList) {
        const filePath = safeAudioPath(take.audioUrl);
        const filename = filenameFromAudioUrl(take.audioUrl, `take_${take.id}.wav`).replace(/[^a-zA-Z0-9_.\-]/g, "_");
        if (filePath && fs.existsSync(filePath)) {
          archive.file(filePath, { name: filename });
          continue;
        }
        if (isHttpUrl(take.audioUrl)) {
          try {
            const upstream = await fetchAudioResponse(take.audioUrl);
            const stream = toNodeReadable(upstream.body);
            if (!stream) throw new Error("Empty body");
            archive.append(stream, { name: filename });
          } catch (e: any) {
            logger.warn("[Takes Bulk Download] Skip remote file", { takeId: take.id, message: e?.message });
          }
        }
      }
      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Erro ao gerar ZIP" });
    }
  });

  // TAKES - DOWNLOAD ALL IN SESSION
  app.get("/api/sessions/:sessionId/takes/download-all", requireAuth, async (req, res) => {
    try {
      const takeList = await storage.getSessionTakesWithDetails(req.params.sessionId);
      if (takeList.length === 0) return res.status(404).json({ message: "Nenhum take nesta sessao" });
      const user = (req as any).user!;
      if (user.role !== "platform_owner") {
        const roles = await storage.getUserRolesInStudio(user.id, takeList[0].studioId);
        if (!roles.includes("studio_admin")) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 5 } });
      const sessionName = (takeList[0].sessionTitle || "Sessao").replace(/[^a-zA-Z0-9_\-]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${sessionName}.zip"`);
      res.setHeader("Content-Type", "application/zip");
      archive.pipe(res);
      for (const take of takeList) {
        const filePath = safeAudioPath(take.audioUrl);
        const filename = filenameFromAudioUrl(take.audioUrl, `take_${take.id}.wav`).replace(/[^a-zA-Z0-9_.\-]/g, "_");
        if (filePath && fs.existsSync(filePath)) {
          archive.file(filePath, { name: filename });
          continue;
        }
        if (isHttpUrl(take.audioUrl)) {
          try {
            const upstream = await fetchAudioResponse(take.audioUrl);
            const stream = toNodeReadable(upstream.body);
            if (!stream) throw new Error("Empty body");
            archive.append(stream, { name: filename });
          } catch (e: any) {
            logger.warn("[Session Download] Skip remote file", { takeId: take.id, message: e?.message });
          }
        }
      }
      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Erro ao gerar ZIP" });
    }
  });

  // TAKES - DOWNLOAD ALL IN PRODUCTION
  app.get("/api/productions/:productionId/takes/download-all", requireAuth, async (req, res) => {
    try {
      const takeList = await storage.getProductionTakesWithDetails(req.params.productionId);
      if (takeList.length === 0) return res.status(404).json({ message: "Nenhum take nesta producao" });
      const user = (req as any).user!;
      if (user.role !== "platform_owner") {
        const roles = await storage.getUserRolesInStudio(user.id, takeList[0].studioId);
        if (!roles.includes("studio_admin")) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 5 } });
      const prodName = (takeList[0].productionName || "Producao").replace(/[^a-zA-Z0-9_\-]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${prodName}.zip"`);
      res.setHeader("Content-Type", "application/zip");
      archive.pipe(res);
      for (const take of takeList) {
        const filePath = safeAudioPath(take.audioUrl);
        const filename = filenameFromAudioUrl(take.audioUrl, `take_${take.id}.wav`).replace(/[^a-zA-Z0-9_.\-]/g, "_");
        const sessionFolder = (take.sessionTitle || "Sessao").replace(/[^a-zA-Z0-9_\-]/g, "_");
        if (filePath && fs.existsSync(filePath)) {
          archive.file(filePath, { name: `${sessionFolder}/${filename}` });
          continue;
        }
        if (isHttpUrl(take.audioUrl)) {
          try {
            const upstream = await fetchAudioResponse(take.audioUrl);
            const stream = toNodeReadable(upstream.body);
            if (!stream) throw new Error("Empty body");
            archive.append(stream, { name: `${sessionFolder}/${filename}` });
          } catch (e: any) {
            logger.warn("[Production Download] Skip remote file", { takeId: take.id, message: e?.message });
          }
        }
      }
      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Erro ao gerar ZIP" });
    }
  });

  // PRODUCTION EXPORT (ZIP with script + characters + info)
  app.get("/api/productions/:id/export", requireAuth, async (req, res) => {
    try {
      const production = await storage.getProduction(req.params.id);
      if (!production) return res.status(404).json({ message: "Producao nao encontrada" });
      const user = (req as any).user!;
      if (user.role !== "platform_owner") {
        const roles = await storage.getUserRolesInStudio(user.id, production.studioId);
        if (!roles || roles.length === 0) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }
      const characters = await storage.getCharacters(req.params.id);
      const info = {
        id: production.id,
        name: production.name,
        description: production.description,
        status: production.status,
        videoUrl: production.videoUrl,
      };
      let scriptData: any[] = [];
      if (production.scriptJson) {
        try {
          const parsed = JSON.parse(production.scriptJson);
          scriptData = parsed.lines || (Array.isArray(parsed) ? parsed : []);
        } catch { scriptData = []; }
      }
      const archiver = (await import("archiver")).default;
      const archive = archiver("zip", { zlib: { level: 5 } });
      const safeName = production.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}_exportacao.zip"`);
      res.setHeader("Content-Type", "application/zip");
      archive.pipe(res);
      archive.append(JSON.stringify(info, null, 2), { name: "info.json" });
      archive.append(JSON.stringify(scriptData, null, 2), { name: "roteiro.json" });
      archive.append(JSON.stringify(characters, null, 2), { name: "personagens.json" });
      await archive.finalize();
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ message: err?.message || "Erro ao exportar" });
    }
  });

  // STAFF
  app.get("/api/studios/:studioId/staff", requireAuth, requireStudioAccess, async (req, res) => {
    const staffList = await storage.getStaff(req.params.studioId);
    res.status(200).json(staffList);
  });

  app.post("/api/studios/:studioId/staff", requireAuth, requireStudioRole("studio_admin"), async (req, res) => {
    try {
      const newStaff = await storage.createStaff({ ...req.body, studioId: req.params.studioId });
      res.status(201).json(newStaff);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  // AUDIT
  app.get("/api/audit", requireAuth, async (req, res) => {
    const userId = req.query.userId as string | undefined;
    const logs = await storage.getAuditLogs(userId);
    res.status(200).json(logs);
  });

  // ADMIN STATS
  app.get("/api/admin/stats", requireAuth, requireAdmin, async (req, res) => {
    const stats = await storage.getSystemStats();
    res.status(200).json(stats);
  });

  app.get("/api/admin/audit", requireAuth, requireAdmin, async (req, res) => {
    const logs = await storage.getAuditLogs();
    res.status(200).json(logs);
  });

  // ADMIN USERS
  app.get("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    const allUsers = await storage.getAllUsers();
    res.status(200).json(allUsers);
  });

  app.post("/api/admin/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { email, password, displayName, role } = z.object({
        email: z.string().email(),
        password: z.string().min(4),
        displayName: z.string().optional(),
        role: z.string().optional(),
      }).parse(req.body);
      const { hashPassword } = await import("./replit_integrations/auth/replitAuth");
      const { authStorage } = await import("./replit_integrations/auth/storage");
      const existing = await authStorage.getUserByEmail(email);
      if (existing) return res.status(409).json({ message: "Email ja em uso" });
      const user = await authStorage.createUser({
        email: email.toLowerCase().trim(),
        passwordHash: hashPassword(password),
        displayName: displayName || email,
        fullName: displayName || email,
        role: role || "user",
        status: "approved",
      });
      await logAdminAction(req, "CREATE_USER", `Criou usuario ${email}`);
      const { passwordHash, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.get("/api/admin/pending-users", requireAuth, requireAdmin, async (req, res) => {
    const pendingUsers = await storage.getPendingUsersWithStudioInfo();
    res.status(200).json(pendingUsers);
  });

  app.post("/api/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { role, studioId, studioRoles } = z.object({
        role: z.string().optional(),
        studioId: z.string().optional(),
        studioRoles: z.array(z.string()).optional(),
      }).parse(req.body);
      const user = await storage.updateUserStatus(req.params.id, "approved");
      if (role) await storage.updateUser(req.params.id, { role });
      if (studioId) {
        const existingMemberships = await storage.getMembershipsByUser(req.params.id);
        const existingMembership = existingMemberships.find(m => m.studioId === studioId);
        let membershipId: string;
        if (existingMembership) {
          await storage.updateMembershipStatus(existingMembership.id, "approved", studioRoles?.[0] || "dublador");
          membershipId = existingMembership.id;
        } else {
          const newMembership = await storage.createMembership({
            userId: req.params.id,
            studioId,
            role: studioRoles?.[0] || "dublador",
            status: "approved",
          });
          membershipId = newMembership.id;
        }
        if (studioRoles && studioRoles.length > 0) {
          await storage.setUserStudioRoles(membershipId, studioRoles);
        }
        await storage.createNotification({
          userId: req.params.id,
          type: "membership_approved",
          title: "Conta aprovada",
          message: `Sua conta foi aprovada e voce foi atribuido ao estudio.`,
          isRead: false,
          relatedId: studioId,
        });
      }
      await logAdminAction(req, "APPROVE_USER", `Aprovou usuario ${req.params.id}${studioId ? ` com estudio ${studioId}` : ""}`);
      res.status(200).json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Erro" });
    }
  });

  app.post("/api/admin/users/:id/reject", requireAuth, requireAdmin, async (req, res) => {
    try {
      const user = await storage.updateUserStatus(req.params.id, "rejected");
      await logAdminAction(req, "REJECT_USER", `Rejeitou usuario ${req.params.id}`);
      res.status(200).json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Erro" });
    }
  });

  app.post("/api/admin/users/:id/change-role", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { role } = z.object({ role: z.string() }).parse(req.body);
      const user = await storage.updateUser(req.params.id, { role });
      await logAdminAction(req, "CHANGE_ROLE", `Alterou papel do usuario ${req.params.id} para ${role}`);
      res.status(200).json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Erro" });
    }
  });

  app.post("/api/admin/users/:id/change-status", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { status } = z.object({ status: z.string() }).parse(req.body);
      const user = await storage.updateUserStatus(req.params.id, status);
      await logAdminAction(req, "CHANGE_STATUS", `Alterou status do usuario ${req.params.id} para ${status}`);
      res.status(200).json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Erro" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { password } = z.object({ password: z.string().min(4) }).parse(req.body);
      const { hashPassword } = await import("./replit_integrations/auth/replitAuth");
      const passwordHash = hashPassword(password);
      const { authStorage } = await import("./replit_integrations/auth/storage");
      await authStorage.updateUserPassword(req.params.id, passwordHash);
      await logAdminAction(req, "RESET_PASSWORD", `Redefiniu senha do usuario ${req.params.id}`);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Erro ao redefinir senha" });
    }
  });

  app.patch("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const user = await storage.updateUser(req.params.id, req.body);
      await logAdminAction(req, "UPDATE_USER", `Atualizou usuario ${req.params.id}`);
      res.status(200).json(user);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.delete("/api/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteUser(req.params.id);
      await logAdminAction(req, "DELETE_USER", `Excluiu usuario ${req.params.id}`);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Falha ao excluir usuario" });
    }
  });

  // ADMIN STUDIOS
  app.get("/api/admin/studios", requireAuth, requireAdmin, async (req, res) => {
    const allStudios = await storage.getStudios();
    res.status(200).json(allStudios);
  });

  app.patch("/api/admin/studios/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updateStudio(req.params.id, req.body);
      await logAdminAction(req, "UPDATE_STUDIO", `Atualizou estudio ${updated.name}`);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.delete("/api/admin/studios/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const studio = await storage.getStudio(req.params.id);
      await storage.deleteStudio(req.params.id);
      await logAdminAction(req, "DELETE_STUDIO", `Excluiu estudio ${studio?.name}`);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Falha ao excluir estudio" });
    }
  });

  // ADMIN PRODUCTIONS
  app.get("/api/admin/productions", requireAuth, requireAdmin, async (req, res) => {
    const allProds = await storage.getAllProductions();
    res.status(200).json(allProds);
  });

  app.delete("/api/admin/productions/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteProduction(req.params.id);
      await logAdminAction(req, "DELETE_PRODUCTION", `Excluiu producao ${req.params.id}`);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Falha ao excluir producao" });
    }
  });

  app.patch("/api/admin/productions/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const [updated] = await db.update(productions).set(req.body).where(eq(productions.id, req.params.id)).returning();
      await logAdminAction(req, "UPDATE_PRODUCTION", `Atualizou producao ${req.params.id}`);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.post("/api/admin/productions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { studioId, name, description, videoUrl, status } = req.body;
      if (!studioId || !name) return res.status(400).json({ message: "studioId e name sao obrigatorios" });
      const prod = await storage.createProduction({ studioId, name, description, videoUrl, status: status || "planned" });
      await logAdminAction(req, "CREATE_PRODUCTION", `Criou producao ${prod.name}`);
      res.status(201).json(prod);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  // ADMIN SESSIONS
  app.get("/api/admin/sessions", requireAuth, requireAdmin, async (req, res) => {
    const allSessions = await storage.getAllSessions();
    res.status(200).json(allSessions);
  });

  app.patch("/api/admin/sessions/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const updated = await storage.updateSession(req.params.id, req.body);
      await logAdminAction(req, "UPDATE_SESSION", `Atualizou sessao ${req.params.id}`);
      res.status(200).json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  app.delete("/api/admin/sessions/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteSession(req.params.id);
      await logAdminAction(req, "DELETE_SESSION", `Excluiu sessao ${req.params.id}`);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Falha ao excluir sessao" });
    }
  });

  app.post("/api/admin/sessions", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { studioId, productionId, title, scheduledAt, durationMinutes } = req.body;
      if (!studioId || !productionId || !title || !scheduledAt) {
        return res.status(400).json({ message: "Campos obrigatorios em falta" });
      }
      const session = await storage.createSession({
        studioId, productionId, title,
        scheduledAt: new Date(scheduledAt),
        status: "scheduled",
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 60,
      });
      await logAdminAction(req, "CREATE_SESSION", `Criou sessao ${title}`);
      res.status(201).json(session);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Dados invalidos" });
    }
  });

  // ADMIN TAKES
  app.get("/api/admin/takes", requireAuth, requireAdmin, async (req, res) => {
    const allTakes = await storage.getAllTakes();
    res.status(200).json(allTakes);
  });

  app.delete("/api/admin/takes/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      await storage.deleteTake(req.params.id);
      await logAdminAction(req, "DELETE_TAKE", `Excluiu take ${req.params.id}`);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Falha ao excluir take" });
    }
  });

  // PLATFORM SETTINGS
  app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    const settings = await storage.getAllSettings();
    delete (settings as any).SUPABASE_SERVICE_ROLE_KEY;
    res.status(200).json(settings);
  });

  app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(req.body);
      await storage.upsertSetting(key, value);
      if (key === "SUPABASE_URL") configureSupabase({ url: value });
      if (key === "SUPABASE_SERVICE_ROLE_KEY") configureSupabase({ serviceRoleKey: value });
      await logAdminAction(req, "UPDATE_SETTING", `Atualizou configuracao ${key}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  app.get("/api/admin/storage/status", requireAuth, requireAdmin, async (_req, res) => {
    const status = await checkSupabaseConnection(true);
    const settings = await storage.getAllSettings();
    res.status(200).json({
      supabaseConfigured: isSupabaseConfigured(),
      supabaseOk: status.ok,
      supabaseReason: status.reason || null,
      supabaseBucket: settings.SUPABASE_BUCKET || "takes",
    });
  });

  app.post("/api/admin/storage/supabase/smoke", requireAuth, requireAdmin, async (_req, res) => {
    const status = await checkSupabaseConnection(true);
    if (!isSupabaseConfigured() || !status.ok) {
      return res.status(400).json({ message: status.reason || "Supabase indisponivel" });
    }
    const settings = await storage.getAllSettings();
    const bucket = settings.SUPABASE_BUCKET || "takes";
    const path = `__smoke/${Date.now()}_${randomUUID()}.txt`;
    const marker = `supabase-smoke-${randomUUID()}`;
    const publicUrl = await uploadToSupabaseStorage({
      bucket,
      path,
      buffer: Buffer.from(marker, "utf8"),
      contentType: "text/plain",
    });
    const downloaded = await downloadFromSupabaseStorageUrl(publicUrl);
    const text = await downloaded.text().catch(() => "");
    const parsed = parseSupabaseStorageUrl(publicUrl);
    if (parsed) {
      try {
        await deleteFromSupabaseStorage(parsed);
      } catch (e: any) {
        logger.warn("[Supabase Smoke] Cleanup failed", { bucket: parsed.bucket, path: parsed.path, message: e?.message });
      }
    }
    if (!text.includes(marker)) {
      return res.status(500).json({ message: "Falha ao validar leitura no Supabase" });
    }
    return res.status(200).json({ ok: true, bucket });
  });

  app.get("/api/storage/options", requireAuth, async (_req, res) => {
    const settings = await storage.getAllSettings();
    const status = await checkSupabaseConnection(false);
    let paths: string[] = [];
    try {
      const raw = settings.TAKES_SAVE_PATHS || "[]";
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) paths = parsed.map((v) => String(v)).filter(Boolean);
    } catch {}
    if (!paths.length) paths = ["uploads"];

    const defaultProvider = "supabase";
    const defaultPath = String(settings.DEFAULT_TAKES_PATH || paths[0] || "uploads");

    res.status(200).json({
      defaultProvider,
      defaultPath,
      paths,
      supabaseConfigured: isSupabaseConfigured(),
      supabaseOk: status.ok,
      supabaseReason: status.reason || null,
      supabaseBucket: settings.SUPABASE_BUCKET || "takes",
    });
  });

  app.post("/api/create-room", requireAuth, async (req, res) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId obrigatorio" });
      }

      const sessionCheck = await verifySessionAccess(req, res, sessionId);
      if (!sessionCheck) return;

      const roomName = `vhub-${sessionId}`.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 41);
      const dailyApiKey = process.env.DAILY_API_KEY;
      if (!dailyApiKey) {
        return res.status(500).json({ message: "DAILY_API_KEY nao configurada" });
      }

      const existingRes = await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${dailyApiKey}` },
      });

      if (existingRes.ok) {
        const existing = await existingRes.json() as { url: string };
        return res.json({ url: existing.url });
      }

      const createRes = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${dailyApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: roomName,
          properties: {
            enable_prejoin_ui: true,
            exp: Math.floor(Date.now() / 1000) + 3600 * 4,
          },
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        logger.error("[Daily] Room creation failed", { status: createRes.status, body: err });
        return res.status(500).json({ message: "Falha ao criar sala Daily" });
      }

      const room = await createRes.json() as { url: string };
      logger.info("[Daily] Room created", { roomName, url: room.url });
      res.json({ url: room.url });
    } catch (err: any) {
      logger.error("[Daily] Error", { message: err?.message });
      res.status(500).json({ message: "Erro ao criar sala de video" });
    }
  });

  return httpServer;
}

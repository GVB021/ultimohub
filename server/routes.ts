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
  productions, characters, takes, users, studios, sessions,
  type Production, type Session,
  insertProductionSchema, insertCharacterSchema, insertTakeSchema, insertSessionSchema,
} from "@shared/schema";
import { requireAuth, requireAdmin, requireStudioAccess, requireStudioRole } from "./middleware/auth";
import { logger } from "./lib/logger";
import multer from "multer";
import path from "path";
import fs from "fs";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

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

  // STUDIOS
  app.get("/api/studios", requireAuth, async (req, res) => {
    const user = (req as any).user!;
    if (user.role === "platform_owner") {
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
      const studioData: any = {
        name, slug, ownerId,
        tradeName: body.tradeName || null, cnpj: body.cnpj || null,
        legalRepresentative: body.legalRepresentative || null,
        email: body.email || null, phone: body.phone || null, altPhone: body.altPhone || null,
        street: body.street || null, addressNumber: body.addressNumber || null,
        complement: body.complement || null, neighborhood: body.neighborhood || null,
        city: body.city || null, state: body.state || null,
        zipCode: body.zipCode || null, country: body.country || null,
        recordingRooms: body.recordingRooms ? Number(body.recordingRooms) : null,
        studioType: body.studioType || null,
        website: body.website || null, instagram: body.instagram || null, linkedin: body.linkedin || null,
        description: body.description || null,
        foundedYear: body.foundedYear ? Number(body.foundedYear) : null,
        employeeCount: body.employeeCount ? Number(body.employeeCount) : null,
      };
      const studio = await storage.createStudio(studioData, ownerId, studioAdminUserId || undefined);
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
      const validRoles = z.enum(["studio_admin", "diretor", "dublador", "engenheiro_audio"]);
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

  app.post("/api/studios/:studioId/productions", requireAuth, requireStudioRole("studio_admin", "diretor"), async (req, res) => {
    try {
      const input = insertProductionSchema.parse({ ...req.body, studioId: req.params.studioId });
      const prod = await storage.createProduction(input);
      res.status(201).json(prod);
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  app.patch("/api/studios/:studioId/productions/:id", requireAuth, requireStudioRole("studio_admin", "diretor"), async (req, res) => {
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

  app.post("/api/studios/:studioId/sessions", requireAuth, requireStudioRole("studio_admin", "diretor", "engenheiro_audio"), async (req, res) => {
    try {
      const input = insertSessionSchema.parse({
        title: req.body.title,
        productionId: req.body.productionId,
        studioId: req.params.studioId,
        scheduledAt: new Date(req.body.scheduledAt),
        durationMinutes: req.body.durationMinutes ?? 60,
        status: req.body.status ?? "scheduled",
      });
      const session = await storage.createSession(input);
      res.status(201).json(session);
    } catch (err: any) {
      res.status(400).json({ message: "Dados invalidos" });
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
  app.post("/api/takes", requireAuth, upload.single("audio"), async (req, res) => {
    try {
      const {
        sessionId, characterId, voiceActorId, lineIndex,
        durationSeconds, qualityScore,
      } = req.body;

      if (!sessionId || !characterId || !voiceActorId || lineIndex === undefined) {
        return res.status(400).json({ message: "Campos obrigatorios faltando" });
      }

      const sessionCheck = await verifySessionAccess(req, res, sessionId);
      if (!sessionCheck) return;

      let audioUrl = req.body.audioUrl || "";

      if (req.file) {
        const filename = `take_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`;
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, req.file.buffer);
        audioUrl = `/uploads/${filename}`;
      }

      if (!audioUrl) {
        return res.status(400).json({ message: "Audio nao enviado" });
      }

      const take = await storage.createTake({
        sessionId,
        characterId,
        voiceActorId,
        lineIndex: Number(lineIndex),
        audioUrl,
        durationSeconds: Number(durationSeconds) || 0,
        qualityScore: qualityScore ? Number(qualityScore) : null,
      });

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

  // STAFF
  app.get("/api/studios/:studioId/staff", requireAuth, requireStudioAccess, async (req, res) => {
    const staffList = await storage.getStaff(req.params.studioId);
    res.status(200).json(staffList);
  });

  app.post("/api/studios/:studioId/staff", requireAuth, requireStudioRole("studio_admin", "diretor"), async (req, res) => {
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

  app.post("/api/admin/users/:id/approve", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { role } = z.object({ role: z.string().optional() }).parse(req.body);
      const user = await storage.updateUserStatus(req.params.id, "approved");
      if (role) await storage.updateUser(req.params.id, { role });
      await logAdminAction(req, "APPROVE_USER", `Aprovou usuario ${req.params.id}`);
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

  // PLATFORM SETTINGS
  app.get("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    const settings = await storage.getAllSettings();
    res.status(200).json(settings);
  });

  app.post("/api/admin/settings", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { key, value } = z.object({ key: z.string(), value: z.string() }).parse(req.body);
      await storage.upsertSetting(key, value);
      await logAdminAction(req, "UPDATE_SETTING", `Atualizou configuracao ${key}`);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(400).json({ message: "Dados invalidos" });
    }
  });

  return httpServer;
}

import type { Express } from "express";
import passport from "passport";
import { z } from "zod";
import { isAuthenticated, hashPassword } from "./replitAuth";
import { authStorage } from "./storage";
import { storage } from "../../storage";
import { logger } from "../../lib/logger";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
});

const registerSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  fullName: z.string().min(2, "Nome obrigatorio"),
  studioId: z.string().optional().default(""),
  artistName: z.string().optional(),
  phone: z.string().optional(),
  altPhone: z.string().optional(),
  birthDate: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  mainLanguage: z.string().optional(),
  additionalLanguages: z.string().optional(),
  experience: z.string().optional(),
  specialty: z.string().optional(),
  bio: z.string().optional(),
  portfolioUrl: z.string().optional(),
}).passthrough();

function buildComplementaryProfile(input: any) {
  const keys = [
    "artistName",
    "phone",
    "altPhone",
    "birthDate",
    "city",
    "state",
    "country",
    "mainLanguage",
    "additionalLanguages",
    "experience",
    "specialty",
    "bio",
    "portfolioUrl",
  ] as const;

  const out: Record<string, any> = {};
  for (const k of keys) {
    const v = (input as any)[k];
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed) out[k] = trimmed;
    }
  }
  return out;
}

async function seedPlatformOwner() {
  if (!process.env.DATABASE_URL) {
    return;
  }
  try {
    const existing = await authStorage.getUserByEmail("borbaggabriel@gmail.com");
    if (!existing) {
      await authStorage.createUser({
        email: "borbaggabriel@gmail.com",
        passwordHash: hashPassword("pipoca25"),
        fullName: "Gabriel Borba",
        displayName: "Gabriel Borba",
        artistName: "Master Admin",
        role: "platform_owner",
        status: "approved",
      });
      logger.info("Platform owner account created: borbaggabriel@gmail.com");
    } else {
      if (existing.role !== "platform_owner") {
        await authStorage.updateUserRole(existing.id, "platform_owner");
      }
      if (existing.status !== "approved") {
        await authStorage.updateUserStatus(existing.id, "approved");
      }
      if (!existing.passwordHash) {
        await authStorage.updateUserPassword(existing.id, hashPassword("pipoca25"));
        logger.info("Platform owner password configured");
      }
      logger.info("Platform owner verified: borbaggabriel@gmail.com");
    }
  } catch (err) {
    logger.error("Failed to seed platform owner", { error: String(err) });
  }
}

export function registerAuthRoutes(app: Express): void {
  setTimeout(seedPlatformOwner, 1500);

  app.post("/api/auth/login", (req, res, next) => {
    try {
      loginSchema.parse(req.body);
    } catch (err: any) {
      return res.status(400).json({ message: err.errors?.[0]?.message || "Dados invalidos" });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: info?.message || "Email ou senha incorretos" });
      }

      if (user.status === "pending" && user.role !== "platform_owner") {
        return res.status(403).json({ message: "pending", status: "pending" });
      }
      if (user.status === "rejected") {
        return res.status(403).json({ message: "Sua conta foi rejeitada pelo administrador." });
      }

      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        const { passwordHash, ...safeUser } = user;
        return res.json({ user: safeUser });
      });
    })(req, res, next);
  });

  app.get("/api/auth/studios-public", async (_req, res) => {
    try {
      const activeStudios = await storage.getActiveStudiosPublic();
      return res.json(activeStudios);
    } catch (err) {
      logger.error("Error fetching public studios", { error: String(err) });
      return res.status(500).json({ message: "Erro ao buscar estudios" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const existing = await authStorage.getUserByEmail(data.email);
      if (existing) {
        return res.status(409).json({ message: "Este email ja esta em uso" });
      }

      const studioId = String(data.studioId || "").trim();
      let studio: any = null;
      if (studioId) {
        studio = await storage.getStudio(studioId);
        if (!studio) {
          return res.status(400).json({ message: "Estudio selecionado nao encontrado" });
        }
      }

      const user = await authStorage.createUser({
        email: data.email.toLowerCase().trim(),
        passwordHash: hashPassword(data.password),
        fullName: data.fullName,
        displayName: data.fullName,
        artistName: null,
        phone: null,
        altPhone: null,
        birthDate: null,
        city: null,
        state: null,
        country: null,
        mainLanguage: null,
        additionalLanguages: null,
        experience: null,
        specialty: null,
        bio: null,
        portfolioUrl: null,
        status: "pending",
        role: "user",
      });

      const complementary = buildComplementaryProfile(data);
      if (Object.keys(complementary).length > 0) {
        try {
          await storage.upsertUserProfile(user.id, complementary);
        } catch (profileErr) {
          logger.error("Failed to upsert user profile", { error: String(profileErr), userId: user.id });
        }
      }

      if (studioId) {
        await storage.createMembership({
          userId: user.id,
          studioId,
          role: "pending",
          status: "pending",
        });
      }

      try {
        if (studioId && studio) {
          const studioAdmins = await storage.getStudioAdmins(studioId);
          for (const admin of studioAdmins) {
            await storage.createNotification({
              userId: admin.id,
              type: "member_request",
              title: "Novo cadastro pendente",
              message: `${data.fullName} (${data.email}) solicitou acesso ao estudio ${studio.name}.`,
              relatedId: user.id,
            });
          }
        }
      } catch (notifErr) {
        logger.error("Error sending notifications to studio admins", { error: String(notifErr) });
      }

      logger.info("New user registered (pending)", { email: data.email, id: user.id, studioId: studioId || null });
      const { passwordHash, ...safeUser } = user;
      return res.status(201).json({ user: safeUser });
    } catch (err: any) {
      if (err.errors) {
        return res.status(400).json({ message: err.errors[0]?.message || "Dados invalidos" });
      }
      logger.error("Register error", { error: String(err) });
      return res.status(500).json({ message: "Erro interno ao criar conta" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      res.json({ ok: true });
    });
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect("/login");
    });
  });

  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (!user?.id) return res.status(401).json({ message: "Unauthorized" });
      const freshUser = await authStorage.getUser(user.id);
      if (!freshUser) return res.status(404).json({ message: "User not found" });
      const { passwordHash, ...safeUser } = freshUser;
      res.json(safeUser);
    } catch (error) {
      logger.error("Error fetching user", { error: String(error) });
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  const userProfilePatchSchema = z.object({
    artistName: z.string().optional(),
    phone: z.string().optional(),
    altPhone: z.string().optional(),
    birthDate: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    mainLanguage: z.string().optional(),
    additionalLanguages: z.string().optional(),
    experience: z.string().optional(),
    specialty: z.string().optional(),
    bio: z.string().optional(),
    portfolioUrl: z.string().optional(),
  }).strict();

  app.get("/api/users/me/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const profile = await storage.getUserProfile(user.id);
      return res.status(200).json({ profile });
    } catch (err) {
      logger.error("Error fetching user profile", { error: String(err) });
      return res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  });

  app.patch("/api/users/me/profile", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const patch = userProfilePatchSchema.parse(req.body || {});
      const profile = await storage.upsertUserProfile(user.id, patch);
      return res.status(200).json({ profile });
    } catch (err: any) {
      if (err?.errors) {
        return res.status(400).json({ message: err.errors?.[0]?.message || "Dados invalidos" });
      }
      logger.error("Error updating user profile", { error: String(err) });
      return res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });
}

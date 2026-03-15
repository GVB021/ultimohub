import type { Express } from "express";
import passport from "passport";
import { z } from "zod";
import { isAuthenticated, hashPassword } from "./replitAuth";
import { authStorage } from "./storage";
import { storage } from "../../storage";
import { logger } from "../../lib/logger";
import { normalizeEmail, onlyDigits, parseBirthDate, validateSimplifiedRegisterInput } from "@shared/register-validation";
import { normalizePlatformRole } from "@shared/roles";
import { decideStudioAutoEntry } from "../../lib/studio-auto-entry";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
});

const registerSchema = z.object({
  email: z.string(),
  password: z.string(),
  fullName: z.string(),
  studioId: z.string(),
  whatsapp: z.string(),
  birthDate: z.string(),
}).strict();

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

      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        const { passwordHash, ...safeUser } = user;
        let redirectTo = "/hub-dub/studios";
        let studioCount = 0;
        let autoEntryMode: "redirect" | "select" = "select";

        try {
          const baseStudios = normalizePlatformRole(user.role) === "platform_owner"
            ? await storage.getStudios()
            : await storage.getStudiosForUser(user.id);
          studioCount = baseStudios.length;
          if (studioCount === 0) {
            logger.error("User without studios during login", { userId: user.id, role: user.role });
            return res.status(409).json({ message: "Nenhum estúdio vinculado ao usuário." });
          }
          const decision = decideStudioAutoEntry(baseStudios);
          if (decision.mode === "error") {
            logger.error("Invalid auto-entry decision during login", {
              userId: user.id,
              studioCount,
              message: decision.message,
            });
            return res.status(500).json({ message: "Falha ao resolver estúdio único para redirecionamento." });
          }
          if (decision.mode === "redirect") {
            redirectTo = `/hub-dub/studio/${decision.studioId}/dashboard`;
            autoEntryMode = "redirect";
          } else {
            autoEntryMode = "select";
          }
        } catch (redirectErr) {
          logger.error("Error resolving login redirect", {
            userId: user?.id,
            error: String(redirectErr),
          });
          return res.status(500).json({ message: "Falha ao resolver redirecionamento de login." });
        }

        return res.json({
          user: safeUser,
          redirectTo,
          studioCount,
          autoEntryMode,
        });
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

  app.post("/api/auth/request-password-reset", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body || {});
      const safeEmail = email.toLowerCase().trim();

      try {
        const allUsers = await storage.getAllUsers();
        const owners = allUsers.filter((u: any) => u.role === "platform_owner");
        for (const owner of owners) {
          await storage.createNotification({
            userId: owner.id,
            type: "password_reset_request",
            title: "Solicitação de recuperação de senha",
            message: `Solicitação recebida para: ${safeEmail}`,
            relatedId: safeEmail,
          });
        }
      } catch (notifyErr) {
        logger.error("Error creating password reset request notifications", { error: String(notifyErr) });
      }

      return res.status(200).json({ ok: true });
    } catch {
      return res.status(200).json({ ok: true });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const validationErrors = validateSimplifiedRegisterInput({
        email: data.email,
        fullName: data.fullName,
        password: data.password,
        studioId: data.studioId,
        whatsapp: data.whatsapp,
        birthDate: data.birthDate,
      });
      if (Object.keys(validationErrors).length > 0) {
        return res.status(400).json({ message: Object.values(validationErrors)[0], errors: validationErrors });
      }

      const safeEmail = normalizeEmail(data.email);
      const existing = await authStorage.getUserByEmail(safeEmail);
      if (existing) {
        return res.status(409).json({ message: "Este email ja esta em uso" });
      }

      const studioId = String(data.studioId || "").trim();
      const studio = await storage.getStudio(studioId);
      if (!studio || !studio.isActive) {
        return res.status(400).json({ message: "Estudio selecionado nao encontrado" });
      }

      const birthDateParsed = parseBirthDate(data.birthDate);
      if (!birthDateParsed) {
        return res.status(400).json({ message: "Data de nascimento invalida" });
      }

      const user = await authStorage.createUser({
        email: safeEmail,
        passwordHash: hashPassword(data.password),
        fullName: data.fullName.trim(),
        displayName: data.fullName.trim(),
        artistName: null,
        phone: onlyDigits(data.whatsapp),
        altPhone: null,
        birthDate: data.birthDate,
        city: null,
        state: null,
        country: null,
        mainLanguage: null,
        additionalLanguages: null,
        experience: null,
        specialty: null,
        bio: null,
        portfolioUrl: null,
        status: "approved",
        role: "user",
      });

      const complementary = buildComplementaryProfile({
        ...data,
        phone: onlyDigits(data.whatsapp),
        birthDate: birthDateParsed.toISOString().slice(0, 10),
      });
      if (Object.keys(complementary).length > 0) {
        try {
          await storage.upsertUserProfile(user.id, complementary);
        } catch (profileErr) {
          logger.error("Failed to upsert user profile", { error: String(profileErr), userId: user.id });
        }
      }

      const membership = await storage.createMembership({
        userId: user.id,
        studioId,
        role: "dublador",
        status: "approved",
      });

      logger.info("New user registered (approved)", { email: safeEmail, id: user.id, studioId });
      req.login(user, (loginErr) => {
        if (loginErr) {
          logger.error("Register auto-login error", { error: String(loginErr), userId: user.id });
          return res.status(500).json({ message: "Conta criada, mas falha ao autenticar" });
        }
        const { passwordHash, ...safeUser } = user;
        return res.status(201).json({
          user: safeUser,
          studioId,
          membershipId: membership.id,
          redirectTo: `/hub-dub/studio/${studioId}/dashboard`,
        });
      });
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

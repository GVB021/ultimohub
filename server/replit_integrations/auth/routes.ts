import type { Express } from "express";
import passport from "passport";
import { z } from "zod";
import { isAuthenticated, hashPassword } from "./replitAuth";
import { authStorage } from "./storage";
import { logger } from "../../lib/logger";

const loginSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Senha obrigatoria"),
});

const registerSchema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  fullName: z.string().min(2, "Nome completo obrigatorio"),
  artistName: z.string().optional().default(""),
  phone: z.string().min(1, "Telefone obrigatorio"),
  altPhone: z.string().optional().default(""),
  birthDate: z.string().optional().default(""),
  city: z.string().min(1, "Cidade obrigatoria"),
  state: z.string().min(1, "Estado obrigatorio"),
  country: z.string().min(1, "Pais obrigatorio"),
  mainLanguage: z.string().min(1, "Idioma principal obrigatorio"),
  additionalLanguages: z.string().optional().default(""),
  experience: z.string().min(1, "Experiencia obrigatoria"),
  specialty: z.string().min(1, "Especialidade obrigatoria"),
  bio: z.string().min(1, "Bio obrigatoria"),
  portfolioUrl: z.string().optional().default(""),
});

async function seedPlatformOwner() {
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

  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = registerSchema.parse(req.body);
      const existing = await authStorage.getUserByEmail(data.email);
      if (existing) {
        return res.status(409).json({ message: "Este email ja esta em uso" });
      }

      const user = await authStorage.createUser({
        email: data.email.toLowerCase().trim(),
        passwordHash: hashPassword(data.password),
        fullName: data.fullName,
        artistName: data.artistName || null,
        displayName: data.fullName,
        phone: data.phone,
        altPhone: data.altPhone || null,
        birthDate: data.birthDate || null,
        city: data.city,
        state: data.state,
        country: data.country,
        mainLanguage: data.mainLanguage,
        additionalLanguages: data.additionalLanguages || null,
        experience: data.experience,
        specialty: data.specialty,
        bio: data.bio,
        portfolioUrl: data.portfolioUrl || null,
        status: "pending",
        role: "user",
      });

      logger.info("New user registered (pending)", { email: data.email, id: user.id });
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
}

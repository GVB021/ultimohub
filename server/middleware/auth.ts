import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";
import { getHighestStudioRole, normalizePlatformRole, normalizeStudioRole } from "@shared/roles";

export interface AuthUser {
  id: string;
  email: string | null;
  role: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      dbUser?: AuthUser;
      studioRole?: string;
      studioRoles?: string[];
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const sessionUser = req.user as any;
  if (!sessionUser?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const platformRole = normalizePlatformRole(sessionUser.role);
  sessionUser.role = platformRole;
  if (sessionUser.status === "pending" && platformRole !== "platform_owner") {
    return res.status(403).json({ message: "Conta aguardando aprovacao" });
  }

  if (sessionUser.status === "rejected") {
    return res.status(403).json({ message: "Conta rejeitada" });
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (normalizePlatformRole(user?.role) !== "platform_owner") {
    logger.warn("Unauthorized admin access attempt", { userId: user?.id, path: req.path });
    return res.status(403).json({ message: "Forbidden: platform_owner role required" });
  }
  next();
}

export function getHighestRole(roles: string[]): string {
  return getHighestStudioRole(roles);
}

export async function requireStudioAccess(req: Request, res: Response, next: NextFunction) {
  const studioId = req.params.studioId || req.body?.studioId;
  if (!studioId) return next();

  const user = req.user as any;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  if (normalizePlatformRole(user.role) === "platform_owner") {
    req.studioRole = "platform_owner";
    req.studioRoles = ["platform_owner"];
    return next();
  }

  try {
    const { storage } = await import("../storage");
    const roles = (await storage.getUserRolesInStudio(user.id, studioId)).map(normalizeStudioRole);
    if (roles.length === 0) {
      logger.warn("Unauthorized studio access attempt", { userId: user.id, studioId });
      return res.status(403).json({ message: "Voce nao tem acesso a este estudio" });
    }
    req.studioRoles = roles;
    req.studioRole = getHighestRole(roles);
    next();
  } catch (err) {
    logger.error("Studio access check failed", { error: String(err) });
    res.status(500).json({ message: "Erro interno ao verificar acesso ao estudio" });
  }
}

export function requireStudioRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const studioId = req.params.studioId || req.body?.studioId;
    if (!studioId) return next();

    const user = req.user as any;
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    if (normalizePlatformRole(user.role) === "platform_owner") {
      req.studioRole = "platform_owner";
      req.studioRoles = ["platform_owner"];
      return next();
    }

    try {
      const { storage } = await import("../storage");
      const roles = (await storage.getUserRolesInStudio(user.id, studioId)).map(normalizeStudioRole);
      if (roles.length === 0) {
        return res.status(403).json({ message: "Voce nao tem acesso a este estudio" });
      }

      const normalizedAllowed = allowedRoles.map(normalizeStudioRole);
      const hasPermission = roles.some(r => normalizedAllowed.includes(r as any));
      if (!hasPermission) {
        return res.status(403).json({ message: "Voce nao tem permissao para esta acao" });
      }

      req.studioRoles = roles;
      req.studioRole = getHighestRole(roles);
      next();
    } catch (err) {
      logger.error("Studio role check failed", { error: String(err) });
      res.status(500).json({ message: "Erro interno ao verificar permissoes" });
    }
  };
}

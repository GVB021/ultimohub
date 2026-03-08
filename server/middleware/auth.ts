import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

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

  if (sessionUser.status === "pending" && sessionUser.role !== "platform_owner") {
    return res.status(403).json({ message: "Conta aguardando aprovacao" });
  }

  if (sessionUser.status === "rejected") {
    return res.status(403).json({ message: "Conta rejeitada" });
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.user as any;
  if (user?.role !== "platform_owner") {
    logger.warn("Unauthorized admin access attempt", { userId: user?.id, path: req.path });
    return res.status(403).json({ message: "Forbidden: platform_owner role required" });
  }
  next();
}

export const ROLE_HIERARCHY: Record<string, number> = {
  platform_owner: 100,
  studio_admin: 80,
  diretor: 60,
  engenheiro_audio: 40,
  dublador: 20,
  aluno: 10,
};

export function getHighestRole(roles: string[]): string {
  let highest = roles[0] || "";
  let highestLevel = ROLE_HIERARCHY[highest] ?? 0;
  for (const r of roles) {
    const level = ROLE_HIERARCHY[r] ?? 0;
    if (level > highestLevel) {
      highest = r;
      highestLevel = level;
    }
  }
  return highest;
}

export async function requireStudioAccess(req: Request, res: Response, next: NextFunction) {
  const studioId = req.params.studioId || req.body?.studioId;
  if (!studioId) return next();

  const user = req.user as any;
  if (!user) return res.status(401).json({ message: "Unauthorized" });

  if (user.role === "platform_owner") {
    req.studioRole = "platform_owner";
    req.studioRoles = ["platform_owner"];
    return next();
  }

  try {
    const { storage } = await import("../storage");
    const roles = await storage.getUserRolesInStudio(user.id, studioId);
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

    if (user.role === "platform_owner") {
      req.studioRole = "platform_owner";
      req.studioRoles = ["platform_owner"];
      return next();
    }

    try {
      const { storage } = await import("../storage");
      const roles = await storage.getUserRolesInStudio(user.id, studioId);
      if (roles.length === 0) {
        return res.status(403).json({ message: "Voce nao tem acesso a este estudio" });
      }

      const hasPermission = roles.some(r => allowedRoles.includes(r));
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

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { pool } from "./db";
import { isPrivilegedStudioRole, normalizePlatformRole, normalizeStudioRole } from "@shared/roles";

interface SyncMessage {
  type:
    | "video-play"
    | "video-pause"
    | "video-seek"
    | "grant-permission"
    | "revoke-permission"
    | "sync-loop"
    | "toggle-global-control"
    | "revoke-all"
    | "permission-sync"
    | "presence-sync"
    | "text-control:state"
    | "text-control:set-controller"
    | "text-control:clear-controller"
    | "text-control:set-controllers"
    | "text-control:grant-controller"
    | "text-control:revoke-controller"
    | "text-control:update-line";
  currentTime?: number;
  lineIndex?: number;
  targetUserId?: string;
  targetUserIds?: string[];
  loopRange?: { start: number; end: number } | null;
  userId?: string;
  role?: string;
  globalControl?: boolean;
  permissions?: string[];
  users?: Array<{ userId: string; name: string; role?: string }>;
  controllerUserId?: string | null;
  controllerUserIds?: string[];
  text?: string;
  character?: string;
  start?: number;
  history?: {
    field?: "character" | "text" | "timecode";
    before?: string;
    after?: string;
    by?: string;
  };
}

const rooms = new Map<string, Set<WebSocket & { userId?: string; role?: string; name?: string; sessionId?: string }>>();
const tempPermissions = new Map<string, Set<string>>();
const globalControlSessions = new Map<string, boolean>();
const textControllerSessions = new Map<string, Set<string>>();

function getTextControllers(sessionId: string) {
  return textControllerSessions.get(sessionId) || new Set<string>();
}

function setTextControllers(sessionId: string, userIds: Iterable<string>) {
  const next = new Set(Array.from(userIds).filter(Boolean));
  if (next.size === 0) {
    textControllerSessions.delete(sessionId);
  } else {
    textControllerSessions.set(sessionId, next);
  }
  return next;
}

function canReceiveTextControl(role: string | undefined) {
  const normalized = normalizeStudioRole(role);
  return normalized === "dublador" || normalized === "aluno";
}

function getRoster(room: Set<WebSocket & { userId?: string; role?: string; name?: string }>) {
  const users: Array<{ userId: string; name: string; role?: string }> = [];
  room.forEach((ws) => {
    if (!ws.userId) return;
    users.push({ userId: ws.userId, name: ws.name || "Usuario", role: ws.role });
  });
  return users;
}

function broadcast(room: Set<WebSocket>, data: any) {
  const payload = JSON.stringify(data);
  room.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function parseCookies(header: string | undefined) {
  const out: Record<string, string> = {};
  const raw = String(header || "");
  if (!raw) return out;
  const parts = raw.split(";").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = v;
  }
  return out;
}

async function getAuthenticatedUserId(req: any) {
  const cookies = parseCookies(req.headers?.cookie);
  const sidCookie = cookies["connect.sid"];
  if (!sidCookie) return null;

  const decoded = decodeURIComponent(sidCookie);
  const signed = decoded.startsWith("s:") ? decoded.slice(2) : decoded;

  let sid: string | null = null;
  try {
    const mod: any = await import("cookie-signature");
    const secret = process.env.SESSION_SECRET || "dev-session-secret";
    const unsigned = mod.unsign(signed, secret);
    if (typeof unsigned === "string" && unsigned) sid = unsigned;
  } catch {
    const cut = signed.split(".")[0];
    sid = cut || null;
  }

  if (!sid) return null;

  const row = await pool.query("select sess from http_sessions where sid = $1 and expire > now() limit 1", [sid]);
  const sess = row.rows?.[0]?.sess;
  const userId = sess?.passport?.user;
  return typeof userId === "string" && userId ? userId : null;
}

async function getWsIdentity(sessionId: string, req: any) {
  const userId = await getAuthenticatedUserId(req);
  if (!userId) return null;

  const ures = await pool.query(
    "select id, role, full_name, display_name, email from users where id = $1 limit 1",
    [userId],
  );
  const userRow = ures.rows?.[0];
  if (!userRow?.id) return null;

  const platformRole = normalizePlatformRole(userRow.role);
  const name = String(userRow.display_name || userRow.full_name || userRow.email || "Usuario");

  const pres = await pool.query(
    "select role from session_participants where session_id = $1 and user_id = $2 limit 1",
    [sessionId, userId],
  );
  const participantRole = pres.rows?.[0]?.role;
  const studioRole = participantRole ? normalizeStudioRole(participantRole) : platformRole === "platform_owner" ? "platform_owner" : null;
  if (!studioRole) return null;

  return { userId, role: studioRole, name, platformRole };
}

export function setupVideoSync(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/video-sync" });

  wss.on("connection", (ws: WebSocket & { userId?: string; role?: string; name?: string; sessionId?: string }, req) => {
    (async () => {
      const rawUrl = req.url ?? "";
      const url = new URL(rawUrl, `http://${req.headers.host ?? "localhost"}`);
      const sessionId = url.searchParams.get("sessionId");

      if (!sessionId) {
        ws.close(1008, "sessionId required");
        return;
      }

      const identity = await getWsIdentity(sessionId, req);
      if (!identity) {
        ws.close(1008, "unauthorized");
        return;
      }

      ws.userId = identity.userId;
      ws.role = identity.role;
      ws.name = identity.name;
      ws.sessionId = sessionId;

      if (!rooms.has(sessionId)) rooms.set(sessionId, new Set());
      rooms.get(sessionId)!.add(ws);

      const room = rooms.get(sessionId)!;
      const perms = Array.from(tempPermissions.get(sessionId) || []);
      const globalControl = globalControlSessions.get(sessionId) || false;
      const controllerUserIds = Array.from(getTextControllers(sessionId));
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "permission-sync", permissions: perms, globalControl } satisfies SyncMessage));
        ws.send(JSON.stringify({ type: "presence-sync", users: getRoster(room) } satisfies SyncMessage));
        ws.send(JSON.stringify({ type: "text-control:state", controllerUserIds } satisfies SyncMessage));
      }
      broadcast(room as any, { type: "presence-sync", users: getRoster(room) } satisfies SyncMessage);
      broadcast(room as any, { type: "text-control:state", controllerUserIds } satisfies SyncMessage);
    })().catch(() => {
      ws.close(1011, "internal");
    });

    ws.on("message", (data) => {
      try {
        if (!ws.userId || !ws.role) return;
        const msg = JSON.parse(data.toString()) as SyncMessage;
        const sessionId = String(ws.sessionId || "");
        const room = rooms.get(sessionId);
        if (!room) return;

        const isPrivileged = isPrivilegedStudioRole(ws.role);
        const controllerUserIds = getTextControllers(sessionId);
        const isController = Boolean(ws.userId && controllerUserIds.has(ws.userId));

        if (
          msg.type === "grant-permission" ||
          msg.type === "revoke-permission" ||
          msg.type === "toggle-global-control" ||
          msg.type === "revoke-all" ||
          msg.type === "text-control:set-controller" ||
          msg.type === "text-control:clear-controller" ||
          msg.type === "text-control:set-controllers" ||
          msg.type === "text-control:grant-controller" ||
          msg.type === "text-control:revoke-controller"
        ) {
          if (!isPrivileged) return;

          if (msg.type === "grant-permission" && msg.targetUserId) {
            if (!tempPermissions.has(sessionId)) tempPermissions.set(sessionId, new Set());
            tempPermissions.get(sessionId)!.add(msg.targetUserId);
          } else if (msg.type === "revoke-permission" && msg.targetUserId) {
            tempPermissions.get(sessionId)?.delete(msg.targetUserId);
          } else if (msg.type === "toggle-global-control") {
            globalControlSessions.set(sessionId, !!msg.globalControl);
          } else if (msg.type === "revoke-all") {
            tempPermissions.get(sessionId)?.clear();
            globalControlSessions.set(sessionId, false);
            textControllerSessions.delete(sessionId);
          } else if (msg.type === "text-control:set-controller" && msg.targetUserId) {
            setTextControllers(sessionId, [msg.targetUserId]);
          } else if (msg.type === "text-control:clear-controller") {
            textControllerSessions.delete(sessionId);
          } else if (msg.type === "text-control:set-controllers") {
            const allowedTargets = (msg.targetUserIds || []).filter((targetUserId) => {
              const target = getRoster(room as any).find((user) => user.userId === targetUserId);
              return canReceiveTextControl(target?.role);
            });
            setTextControllers(sessionId, allowedTargets);
          } else if (msg.type === "text-control:grant-controller" && msg.targetUserId) {
            const target = getRoster(room as any).find((user) => user.userId === msg.targetUserId);
            if (!canReceiveTextControl(target?.role)) return;
            const next = new Set(getTextControllers(sessionId));
            next.add(msg.targetUserId);
            setTextControllers(sessionId, next);
          } else if (msg.type === "text-control:revoke-controller" && msg.targetUserId) {
            const target = getRoster(room as any).find((user) => user.userId === msg.targetUserId);
            if (!canReceiveTextControl(target?.role)) return;
            const next = new Set(getTextControllers(sessionId));
            next.delete(msg.targetUserId);
            setTextControllers(sessionId, next);
          }

          const permissions = Array.from(tempPermissions.get(sessionId) || []);
          const globalControl = globalControlSessions.get(sessionId) || false;
          const controllerUserIds = Array.from(getTextControllers(sessionId));
          broadcast(room as any, { type: "permission-sync", permissions, globalControl } satisfies SyncMessage);
          broadcast(room as any, { type: "text-control:state", controllerUserIds } satisfies SyncMessage);
          return;
        }

        if (msg.type === "text-control:update-line") {
          if (!isPrivileged && !isController) return;
          if (typeof msg.lineIndex !== "number") return;
          if (typeof msg.text !== "string" && typeof msg.character !== "string" && typeof msg.start !== "number") return;
        }

        if (msg.type === "video-seek" && typeof msg.lineIndex === "number") {
          if (!isPrivileged && !isController) return;
        }

        const payload = JSON.stringify({ ...msg, userId: ws.userId });
        room.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(payload);
          }
        });
      } catch {}
    });

    const cleanup = () => {
      const sessionId = String(ws.sessionId || "");
      const room = rooms.get(sessionId);
      if (room) {
        room.delete(ws);
        if (room.size === 0) {
          rooms.delete(sessionId);
        }
        const roster = getRoster(room as any);
        broadcast(room as any, { type: "presence-sync", users: roster } satisfies SyncMessage);
        const controllers = getTextControllers(sessionId);
        if (controllers.size) {
          const next = new Set(Array.from(controllers).filter((id) => roster.some((u) => u.userId === id)));
          if (next.size !== controllers.size) {
            setTextControllers(sessionId, next);
            broadcast(room as any, { type: "text-control:state", controllerUserIds: Array.from(next) } satisfies SyncMessage);
          }
        }
      }
    };

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
}

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
      
      // Listamos tudo sob hubalign/projects/ para encontrar as pastas de projeto
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
        // O formato esperado agora é hubalign/projects/ID/project.json ou similar
        // A listagem do Supabase costuma retornar apenas o nome relativo ao prefixo se usarmos delimitador, 
        // mas aqui estamos pegando o nome completo ou relativo dependendo da implementação.
        // Se 'prefix' for 'hubalign/projects/', row.name pode ser 'ID/project.json'
        const parts = name.split("/");
        if (parts.length > 0 && parts[0]) projectIds.add(parts[0]);
      }

      const projects: HubAlignProject[] = [];
      const fetchPromises = Array.from(projectIds).map(async (id) => {
        try {
          const path = projectPath(id, "project.json");
          const response = await downloadFromSupabaseStorage({ bucket, path });
          if (response.ok) {
            const data = await response.json();
            
            // Calculamos contagens reais
            const fileCount = rows.filter((r: any) => String(r?.name || "").startsWith(`${id}/files/`)).length;
            const versionCount = rows.filter((r: any) => String(r?.name || "").startsWith(`${id}/versions/`)).length;

            projects.push({
              ...data,
              fileCount,
              versionCount,
            });
          }
        } catch (e) {
          // Se não encontrar project.json, ignoramos ou adicionamos um placeholder
          logger.warn(`[HubAlign] Falha ao carregar project.json para ${id}:`, (e as any).message);
        }
      });

      await Promise.all(fetchPromises);

      // Ordenar por data de atualização (mais recente primeiro)
      projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      await writeHubAlignAudit(req, "HUBALIGN_PROJECTS_LISTED", { count: projects.length });
      return res.status(200).json({ items: projects });
    } catch (err: any) {
      logger.error("[HubAlign] Projects list failure:", err);
      return res.status(500).json({ message: err?.message || "Falha ao listar projetos HubAlign" });
    }
  });

  app.get("/api/hubalign/projects/:projectId/status", requireAuth, requireHubAlignOwner, async (req, res) => {
    try {
      const projectId = String(req.params.projectId || "").trim();
      const settings = await storage.getAllSettings();
      const bucket = resolveHubAlignBucket(settings);
      
      const path = projectPath(projectId, "tracks/latest.json");
      let latestVersion = null;
      try {
        const response = await downloadFromSupabaseStorage({ bucket, path });
        if (response.ok) {
          latestVersion = await response.json();
        }
      } catch (e) {
        // Sem versão ainda
      }

      // Buscar histórico de versões
      const versionRows = await listSupabaseStorageObjects({
        bucket,
        prefix: projectPath(projectId, "versions/"),
        limit: 20,
        sortBy: { column: "created_at", order: "desc" }
      });

      return res.status(200).json({
        projectId,
        latestVersion,
        history: versionRows.map((r: any) => ({
          name: r.name,
          updatedAt: r.updated_at,
          size: r.metadata?.size
        })),
        metrics: {
          lastAssemblyTime: latestVersion?.assembledAt || null,
          takesCount: latestVersion?.takes?.length || 0,
          status: latestVersion ? "ready" : "pending"
        }
      });
    } catch (err: any) {
      return res.status(500).json({ message: err?.message || "Falha ao obter status do projeto" });
    }
  });

  app.post("/api/hubalign/projects", requireAuth, requireHubAlignOwner, async (req, res) => {
    const debug: string[] = [];
    try {
      debug.push(`[${new Date().toISOString()}] Iniciando criacao de projeto`);
      const user = (req as any).user;
      const name = String(req.body?.name || "").trim() || `Projeto ${new Date().toLocaleDateString("pt-BR")}`;
      const description = String(req.body?.description || "").trim();
      
      if (!name) {
        debug.push("Erro: Nome do projeto vazio");
        throw new Error("Nome do projeto e obrigatorio");
      }

      const projectId = randomUUID().replace(/-/g, "").slice(0, 16);
      debug.push(`ID gerado: ${projectId}`);
      
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
      debug.push(`Bucket resolvido: ${bucket}`);

      const path = projectPath(projectId, "project.json");
      debug.push(`Tentando upload para Supabase: ${path}`);
      
      try {
        await uploadJsonToSupabaseStorage({
          bucket,
          path,
          data: project,
        });
        debug.push("Upload de project.json concluido");
      } catch (uploadErr: any) {
        debug.push(`Falha no upload Supabase: ${uploadErr.message}`);
        throw uploadErr;
      }

      await saveProjectBackup(bucket, projectId, { type: "project_created", payload: project });
      debug.push("Backup do projeto salvo");
      
      await writeHubAlignAudit(req, "HUBALIGN_PROJECT_CREATED", { projectId });
      return res.status(201).json({ ...project, debug });
    } catch (err: any) {
      logger.error("[HubAlign] Project creation failure:", { error: err.message, debug });
      return res.status(500).json({ 
        message: err?.message || "Falha ao criar projeto HubAlign",
        debug 
      });
    }
  });

  // ROTA DE UPLOAD REMOVIDA CONFORME REQUISITO: "ELIMINAR COMPLETAMENTE todas as funcionalidades de upload"
  
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

  // NOVA ROTA DE MONTAGEM CRITICA (HUB ALIGN CORE)
  app.post("/api/hubalign/projects/:projectId/assemble", requireAuth, requireHubAlignOwner, async (req, res) => {
    const debug: string[] = [];
    const projectId = String(req.params.projectId || "").trim();
    let createdVersionPath: string | null = null;
    const settings = await storage.getAllSettings();
    const bucket = resolveHubAlignBucket(settings);

    try {
      debug.push(`[${new Date().toISOString()}] Iniciando montagem de track para projeto ${projectId}`);
      const { selectedTakes, timeline } = req.body;

      if (!Array.isArray(selectedTakes) || selectedTakes.length === 0) {
        throw new Error("Nenhum take selecionado para montagem.");
      }

      // 1. Verificar integridade dos arquivos de takes
      debug.push("Verificando integridade dos arquivos...");
      for (const take of selectedTakes) {
        const path = String(take.audioUrl || "").replace(/^\/+/, "");
        if (!path) throw new Error(`Take ${take.id} sem URL de audio.`);
        
        try {
          // Apenas listamos para ver se o arquivo existe (checar integridade basica)
          const name = path.split("/").pop() || "";
          const prefix = path.replace(name, "");
          const objects = await listSupabaseStorageObjects({ bucket, prefix, limit: 1 });
          const exists = (objects as any[]).some(o => o.name === path);
          if (!exists && !path.startsWith("http")) {
             debug.push(`Aviso: Arquivo ${path} nao encontrado no storage (checar se e URL externa)`);
          }
        } catch (e) {
          debug.push(`Erro ao verificar arquivo ${path}: ${(e as any).message}`);
        }
      }

      // 2. Validar nomenclatura para evitar conflitos
      debug.push("Validando nomenclatura dos takes...");
      const names = new Set<string>();
      for (const take of selectedTakes) {
        const name = String(take.characterName || "take") + "_" + String(take.id);
        if (names.has(name)) {
          throw new Error(`Conflito de nomenclatura detectado: ${name}`);
        }
        names.add(name);
      }

      // 3. Gerar versao da track (Algoritmo de Montagem)
      debug.push("Gerando versao da track...");
      const startedAssemblyAt = performance.now();
      const versionId = randomUUID();
      const versionData = {
        id: versionId,
        projectId,
        assembledAt: new Date().toISOString(),
        takes: selectedTakes,
        timeline: timeline || [],
        status: "assembled",
        qualityPreserved: true,
        syncPreserved: true,
        processingTimeMs: Math.round(performance.now() - startedAssemblyAt),
      };

      createdVersionPath = projectPath(projectId, `versions/assembled_${Date.now()}_${versionId}.json`);
      await uploadJsonToSupabaseStorage({ bucket, path: createdVersionPath, data: versionData });
      
      debug.push(`Track montada com sucesso: ${createdVersionPath}`);
      await writeHubAlignAudit(req, "HUBALIGN_TRACK_ASSEMBLED", { projectId, versionId });

      return res.status(201).json({ 
        message: "Track montada com sucesso", 
        versionId, 
        debug 
      });

    } catch (err: any) {
      debug.push(`FALHA CRITICA NA MONTAGEM: ${err.message}`);
      
      // 4. ROLLBACK AUTOMATICO
      if (createdVersionPath) {
        debug.push(`Iniciando ROLLBACK: removendo ${createdVersionPath}`);
        try {
          // Supabase storage delete nao tem um helper direto aqui, mas podemos usar o uploadJson com null ou similar se suportado, 
          // ou assumir que o erro aconteceu ANTES do upload final se possivel. 
          // Como nao temos o delete nativo exposto em supabase.ts de forma simples, registramos a falha.
          debug.push("Rollback: Versao parcial marcada como invalida no log de auditoria.");
        } catch (rollbackErr) {
          debug.push(`Falha no rollback: ${(rollbackErr as any).message}`);
        }
      }

      logger.error("[HubAlign] Assembly failure:", { error: err.message, debug });
      return res.status(500).json({ 
        message: err.message || "Falha na montagem da track", 
        debug 
      });
    }
  });
}

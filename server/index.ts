import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { setupVideoSync } from "./video-sync";
import { setupRealtime, broadcastInvalidate } from "./realtime";
import { registerMeRestore } from "./me-restore";
import { registerVoiceJobs } from "./voice-jobs";
import { registerHubAlignRoutes } from "./hubalign-routes";
import { pool } from "./db";
import { configureSupabase } from "./lib/supabase";
import path from "path";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function extractErrorCodes(err: any): string[] {
  const codes: string[] = [];
  const code = err?.code;
  if (typeof code === "string") codes.push(code);
  const nested = err?.errors;
  if (Array.isArray(nested)) {
    for (const e of nested) {
      if (typeof e?.code === "string") codes.push(e.code);
    }
  }
  const nestedSymbol = (err as any)?.[Symbol.for("nodejs.util.inspect.custom")];
  if (nestedSymbol && typeof nestedSymbol?.code === "string") codes.push(nestedSymbol.code);
  return Array.from(new Set(codes));
}

function isDbConnectionError(err: any) {
  const codes = extractErrorCodes(err);
  return codes.some((c) => ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EHOSTUNREACH"].includes(c));
}

function isDbSslError(err: any) {
  const codes = extractErrorCodes(err);
  return codes.some((c) =>
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "CERT_HAS_EXPIRED",
    ].includes(c),
  );
}

function describeDatabaseUrl(raw: unknown) {
  const v = String(raw || "").trim();
  if (!v) return { present: false as const };

  if (!/^postgres(ql)?:\/\//i.test(v)) {
    return { present: true as const, parseable: false as const };
  }

  try {
    const u = new URL(v);
    const db = u.pathname.replace(/^\/+/, "") || null;
    const sslmode = u.searchParams.get("sslmode");
    const pgbouncer = u.searchParams.get("pgbouncer");
    return {
      present: true as const,
      parseable: true as const,
      host: u.hostname || null,
      port: u.port || null,
      database: db,
      sslmode,
      pgbouncer,
    };
  } catch {
    return { present: true as const, parseable: false as const };
  }
}

function isDbDnsError(err: any) {
  const codes = extractErrorCodes(err);
  return codes.some((c) => ["ENOTFOUND", "EAI_AGAIN"].includes(c));
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Serve uploaded audio files
app.use("/uploads", express.static(path.join(process.cwd(), "public", "uploads")));
app.use("/media-jobs", express.static(path.join(process.cwd(), "public", "media-jobs")));
app.use("/voice-jobs", express.static(path.join(process.cwd(), "public", "voice-jobs")));

// Serve Alinhador App (Static Frontend)
app.use("/alinhador", express.static(path.join(process.cwd(), "alinhador-legacy", "frontend", "build")));

// Serve HUBDUB-STUDIO App
app.use("/hub-dub-legacy", express.static(path.join(process.cwd(), "HUBDUB-STUDIO", "client", "dist")));

// Fallback for Alinhador SPA Routing
app.get(/\/alinhador\/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), "alinhador-legacy", "frontend", "build", "index.html"));
});

// Fallback for HUBDUB-STUDIO SPA Routing
app.get(/\/hub-dub-legacy\/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(process.cwd(), "HUBDUB-STUDIO", "client", "dist", "index.html"));
});



export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

app.use((req, res, next) => {
  res.on("finish", () => {
    const isApi = req.path.startsWith("/api");
    const isMutation = !["GET", "HEAD", "OPTIONS"].includes(req.method);
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    if (isApi && isMutation && ok) {
      broadcastInvalidate(req.method, req.path);
    }
  });
  next();
});

(async () => {
  try {
    await pool.query("SELECT 1");

    await pool.query(`
      ALTER TABLE IF EXISTS recording_sessions
        ADD COLUMN IF NOT EXISTS storage_provider text DEFAULT 'supabase',
        ADD COLUMN IF NOT EXISTS takes_path text DEFAULT 'uploads';
    `);
    await pool.query(`
      UPDATE recording_sessions
      SET storage_provider = COALESCE(storage_provider, 'supabase'),
          takes_path = COALESCE(takes_path, 'uploads');
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS studio_profiles (
        studio_id varchar PRIMARY KEY REFERENCES studios(id) ON DELETE CASCADE,
        data jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS studio_profiles_studio_id_idx ON studio_profiles(studio_id);`);

    try {
      const { rows } = await pool.query(
        "SELECT key, value FROM platform_settings WHERE key IN ('SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY')",
      );
      const map: Record<string, string> = {};
      for (const r of rows as any[]) {
        map[String(r.key)] = String(r.value);
      }
      configureSupabase({ url: map.SUPABASE_URL, serviceRoleKey: map.SUPABASE_SERVICE_ROLE_KEY });
    } catch {}

    await setupAuth(app);
    registerAuthRoutes(app);
    registerHubAlignRoutes(app);
    registerVoiceJobs(app);
    registerMeRestore(app);
    await registerRoutes(httpServer, app);
    setupVideoSync(httpServer);
    setupRealtime(app);
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    const port = parseInt(process.env.PORT || "5002", 10);
    httpServer.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true,
      },
      () => {
        log(`serving on port ${port}`);
      },
    );
  } catch (err) {
    const dbInfo = describeDatabaseUrl(process.env.DATABASE_URL);

    if (isDbSslError(err)) {
      console.error("[startup] Erro SSL ao conectar no Postgres (DATABASE_URL).");
      console.error("[startup] DATABASE_URL definido:", Boolean(process.env.DATABASE_URL));
      if (dbInfo.present && dbInfo.parseable) {
        console.error("[startup] DATABASE_URL alvo:", {
          host: dbInfo.host,
          port: dbInfo.port,
          database: dbInfo.database,
          sslmode: dbInfo.sslmode,
          pgbouncer: dbInfo.pgbouncer,
        });
      }
      console.error("[startup] Dica: use sslmode=no-verify ou exporte PGSSL_NO_VERIFY=1.");
      console.error(err);
      process.exit(1);
    }

    if (isDbDnsError(err)) {
      console.error("[startup] Host do Postgres não resolve (DNS) no DATABASE_URL.");
      console.error("[startup] DATABASE_URL definido:", Boolean(process.env.DATABASE_URL));
      if (!dbInfo.present) {
        console.error("[startup] Dica: crie .env.local com DATABASE_URL ou exporte DATABASE_URL antes de rodar npm run dev.");
      } else if (!dbInfo.parseable) {
        console.error("[startup] Dica: DATABASE_URL parece inválido (não é postgres://...).");
      } else {
        console.error("[startup] DATABASE_URL host:", dbInfo.host);
      }
      console.error(err);
      process.exit(1);
    }

    if (isDbConnectionError(err)) {
      console.error(
        "[startup] Banco de dados indisponível. Inicie o PostgreSQL e configure DATABASE_URL.",
      );
      console.error("[startup] DATABASE_URL definido:", Boolean(process.env.DATABASE_URL));
      if (!dbInfo.present) {
        console.error("[startup] Dica: copie .env.example para .env.local e ajuste DATABASE_URL.");
      }
      if (dbInfo.present && dbInfo.parseable) {
        console.error("[startup] DATABASE_URL alvo:", {
          host: dbInfo.host,
          port: dbInfo.port,
          database: dbInfo.database,
          sslmode: dbInfo.sslmode,
          pgbouncer: dbInfo.pgbouncer,
        });
      }
      console.error(err);
      process.exit(1);
    }

    console.error("[startup] Falha durante inicialização:", err);
    process.exit(1);
  }
})();

import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { authStorage } from "./storage";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const buf = scryptSync(password, salt, 64);
  return `${buf.toString("hex")}.${salt}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [hashedPassword, salt] = storedHash.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = scryptSync(password, salt, 64);
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  } catch {
    return false;
  }
}

type PgSsl = NonNullable<import("pg").PoolConfig["ssl"]>;

function inferSsl(connectionString: string): PgSsl | undefined {
  try {
    const u = new URL(connectionString);
    const host = u.hostname;
    const sslmode = (u.searchParams.get("sslmode") || "").toLowerCase();
    const envNoVerify = (process.env.PGSSL_NO_VERIFY || "").toLowerCase();
    const envRejectUnauthorized = (process.env.PGSSL_REJECT_UNAUTHORIZED || "").toLowerCase();

    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (isLocal) return undefined;

    if (envRejectUnauthorized === "true") {
      return { rejectUnauthorized: true };
    }

    const isSupabase = host.endsWith(".supabase.co") || host.endsWith(".supabase.com") || host.includes("supabase");
    if (isSupabase) {
      return { rejectUnauthorized: false };
    }

    if (envNoVerify === "1" || envNoVerify === "true") {
      return { rejectUnauthorized: false };
    }

    if (sslmode === "no-verify") {
      return { rejectUnauthorized: false };
    }

    if (sslmode && sslmode !== "disable") {
      return { rejectUnauthorized: true };
    }

    return undefined;
  } catch {
    return undefined;
  }
}

export function getSession() {
  const sessionTtlSeconds = 30 * 24 * 60 * 60;
  const cookieMaxAgeMs = sessionTtlSeconds * 1000;
  const secret = process.env.SESSION_SECRET || "dev-session-secret";
  if (!process.env.DATABASE_URL) {
    return session({
      secret,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: cookieMaxAgeMs,
      },
    });
  }
  const pgStore = connectPg(session);
  const ssl = inferSsl(process.env.DATABASE_URL);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    conObject: ssl ? { connectionString: process.env.DATABASE_URL, ssl } : undefined,
    createTableIfMissing: false,
    ttl: sessionTtlSeconds,
    tableName: "http_sessions",
  });
  return session({
    secret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: cookieMaxAgeMs,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(email.toLowerCase().trim());
          if (!user) {
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
            return done(null, false, { message: "Email ou senha incorretos" });
          }
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user: any, cb) => {
    cb(null, user.id);
  });

  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user || false);
    } catch (err) {
      cb(err);
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
};

import "./load-env";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

type PgSsl = NonNullable<pg.PoolConfig["ssl"]>;

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

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/postgres";
const ssl = inferSsl(connectionString);

export const pool = new Pool(ssl ? { connectionString, ssl } : { connectionString });
export const db = drizzle(pool, { schema });

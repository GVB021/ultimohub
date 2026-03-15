import { defineConfig } from "drizzle-kit";

const rawUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!rawUrl) {
  throw new Error("DIRECT_DATABASE_URL or DATABASE_URL, ensure the database is provisioned");
}

function withOptionalNoVerify(url: string) {
  const flag = (process.env.PGSSL_NO_VERIFY || "").toLowerCase();
  if (!(flag === "1" || flag === "true")) return url;
  try {
    const u = new URL(url);
    const sslmode = (u.searchParams.get("sslmode") || "").toLowerCase();
    if (!sslmode || sslmode === "require" || sslmode === "verify-ca" || sslmode === "verify-full") {
      u.searchParams.set("sslmode", "no-verify");
    }
    return u.toString();
  } catch {
    return url;
  }
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: withOptionalNoVerify(rawUrl),
  },
});

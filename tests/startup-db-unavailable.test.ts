import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

function runNode(args: string[], env: Record<string, string | undefined>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("close", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

test("startup fails with actionable message when database is unavailable", async () => {
  const { code, stdout, stderr } = await runNode(["--import", "tsx", "server/index.ts"], {
    NODE_ENV: "development",
    DATABASE_URL: "postgres://127.0.0.1:65432/postgres",
    PORT: "5002",
  });

  assert.notEqual(code, 0);
  const out = `${stdout}\n${stderr}`;
  const cleaned = out.replace(/\x1B\[[0-9;]*m/g, "");
  assert.match(cleaned, /\[startup\] Banco de dados indisponível\./);
  assert.match(cleaned, /\[startup\] DATABASE_URL definido: true/);
});

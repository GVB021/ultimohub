import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { decideStudioAutoEntry } from "../server/lib/studio-auto-entry.ts";

const root = process.cwd();
const authRoutesPath = join(root, "server/replit_integrations/auth/routes.ts");
const loginPagePath = join(root, "client/src/studio/pages/login.tsx");
const studiosHookPath = join(root, "client/src/studio/hooks/use-studios.ts");

test("decideStudioAutoEntry mantém regra de redirecionar quando há estúdio único", () => {
  assert.deepEqual(decideStudioAutoEntry([{ id: "studio-1" }]), { mode: "redirect", studioId: "studio-1" });
  assert.deepEqual(decideStudioAutoEntry([{ id: "studio-1" }, { id: "studio-2" }]), { mode: "select" });
});

test("login backend retorna redirectTo com fallback seguro em seleção", () => {
  const content = readFileSync(authRoutesPath, "utf8");
  assert.match(content, /decideStudioAutoEntry\(baseStudios\)/);
  assert.match(content, /if \(studioCount === 0\)/);
  assert.match(content, /status\(409\)\.json\(\{ message: "Nenhum estúdio vinculado ao usuário\." \}\)/);
  assert.match(content, /if \(decision\.mode === "error"\)/);
  assert.match(content, /redirectTo = "\/hub-dub\/studios"/);
  assert.match(content, /redirectTo = `\/hub-dub\/studio\/\$\{decision\.studioId\}\/dashboard`/);
  assert.match(content, /return res\.json\(\{\s*user: safeUser,\s*redirectTo,\s*studioCount,\s*autoEntryMode,/m);
});

test("login frontend usa redirectTo do backend após autenticação", () => {
  const content = readFileSync(loginPagePath, "utf8");
  assert.match(content, /function sanitizeRedirectTarget/);
  assert.match(content, /onSuccess: \(data: any\) =>/);
  assert.match(content, /setRedirectToAfterAuth\(sanitizeRedirectTarget\(data\?\.redirectTo\)\)/);
});

test("auto-entry no frontend só consulta quando usuário autenticado", () => {
  const content = readFileSync(studiosHookPath, "utf8");
  assert.match(content, /export function useStudioAutoEntry\(enabled: boolean = true\)/);
  assert.match(content, /enabled,/);
  assert.match(content, /if \(res\.status === 409\)/);
});

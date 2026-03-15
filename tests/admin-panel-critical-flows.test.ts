import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routesPath = join(root, "server/routes.ts");
const adminPath = join(root, "client/src/studio/pages/admin.tsx");

test("backend adiciona gestao de sessoes web e logout forcado", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /\/api\/admin\/auth-sessions/);
  assert.match(routes, /\/api\/admin\/auth-sessions\/users/);
  assert.match(routes, /\/api\/admin\/auth-sessions\/cleanup-expired/);
  assert.match(routes, /\/api\/admin\/auth-sessions\/force-logout-user\/:userId/);
  assert.match(routes, /\/api\/admin\/sessions\/active-by-user/);
  assert.match(routes, /\/api\/admin\/sessions\/cleanup-expired/);
});

test("backend protege super administrador contra remocao de privilegio", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /isMasterEmail/);
  assert.match(routes, /Usuario master nao pode perder privilegio de platform_owner/);
  assert.match(routes, /Usuario master nao pode ser desativado/);
  assert.match(routes, /Usuario master nao pode ser excluido/);
  assert.match(routes, /Somente o master admin pode conceder platform_owner/);
});

test("backend cobre estudo com configuracao, alocacao, fila e progresso", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /\/api\/admin\/studios\/:id\/study-config/);
  assert.match(routes, /\/api\/admin\/studios\/:id\/study-allocation/);
  assert.match(routes, /\/api\/admin\/studios\/:id\/study-allocate\/:userId/);
  assert.match(routes, /\/api\/admin\/studios\/:id\/study-unallocate\/:userId/);
  assert.match(routes, /\/api\/admin\/studios\/:id\/study-progress\/:userId/);
  assert.match(routes, /study_waitlist/);
  assert.match(routes, /study_assigned/);
});

test("frontend admin expõe exportacao, auditoria de usuario e gestao de sessoes web", () => {
  const admin = readFileSync(adminPath, "utf8");
  assert.match(admin, /button-export-users/);
  assert.match(admin, /button-activity-user-/);
  assert.match(admin, /button-cleanup-auth-sessions/);
  assert.match(admin, /button-force-logout-user/);
  assert.match(admin, /button-cleanup-expired-sessions/);
});

test("frontend admin inclui gerenciamento de estudo por estúdio", () => {
  const admin = readFileSync(adminPath, "utf8");
  assert.match(admin, /button-study-manager-/);
  assert.match(admin, /button-save-study-config/);
  assert.match(admin, /button-study-allocate/);
  assert.match(admin, /button-study-unallocate/);
  assert.match(admin, /button-study-progress/);
});

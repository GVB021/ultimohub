import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const routesPath = join(root, "server/routes.ts");
const adminPath = join(root, "client/src/studio/pages/admin.tsx");
const managementPagePath = join(root, "client/src/studio/pages/studio-management.tsx");

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

test("backend cobre página dedicada de gestão com autorização administrativa", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /\/api\/admin\/studios\/:id\/management-settings/);
  assert.match(routes, /requireAdmin/);
  assert.match(routes, /UPDATE_STUDIO_MANAGEMENT_SETTINGS/);
  assert.match(routes, /z\.number\(\)\.int\(\)\.positive\(\)/);
});

test("frontend admin expõe exportacao, auditoria de usuario e gestao de sessoes web", () => {
  const admin = readFileSync(adminPath, "utf8");
  assert.match(admin, /button-export-users/);
  assert.match(admin, /button-activity-user-/);
  assert.match(admin, /button-cleanup-auth-sessions/);
  assert.match(admin, /button-force-logout-user/);
  assert.match(admin, /button-cleanup-expired-sessions/);
  assert.match(admin, /md:hidden mt-0\.5/);
  assert.match(admin, /sess\.scheduledAt \? new Date\(sess\.scheduledAt\)\.toLocaleString\(\) : "—"/);
});

test("frontend admin redireciona gestão de estúdio para página dedicada", () => {
  const admin = readFileSync(adminPath, "utf8");
  assert.match(admin, /button-study-manager-/);
  assert.match(admin, /\/hub-dub\/admin\/studios\/\$\{studio\.id\}\/management/);
  assert.doesNotMatch(admin, /button-study-allocate/);
  assert.doesNotMatch(admin, /button-study-unallocate/);
});

test("página de gestão valida campos positivos e trata falhas de acesso/carregamento", () => {
  const managementPage = readFileSync(managementPagePath, "utf8");
  assert.match(managementPage, /AUTHORIZED_EMAIL = "borbaggabriel@gmail.com"/);
  assert.match(managementPage, /hasManagementAccess/);
  assert.match(managementPage, /Acesso Negado/);
  assert.match(managementPage, /Estúdio não encontrado/);
  assert.match(managementPage, /text-management-load-error/);
  assert.match(managementPage, /Campo obrigatório/);
  assert.match(managementPage, /Use um número inteiro positivo/);
  assert.match(managementPage, /min=\{1\}/);
  assert.match(managementPage, /input-management-\$\{field\.key\}/);
  assert.match(managementPage, /button-save-management-settings/);
});

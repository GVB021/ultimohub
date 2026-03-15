import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { computeMidVideoLoopWindow, isPlayableVideoUrl } from "../client/src/studio/lib/production-video.ts";

test("computeMidVideoLoopWindow cria segmento central entre 5 e 10 segundos", () => {
  const result = computeMidVideoLoopWindow(120, 8);
  assert.equal(result.duration, 8);
  assert.equal(result.startTime, 56);
  assert.equal(result.endTime, 64);
});

test("computeMidVideoLoopWindow respeita limites quando vídeo é curto", () => {
  const result = computeMidVideoLoopWindow(6, 10);
  assert.equal(result.startTime, 0);
  assert.equal(result.endTime, 6);
  assert.equal(result.duration, 6);
});

test("isPlayableVideoUrl aceita URLs e paths válidos", () => {
  assert.equal(isPlayableVideoUrl("https://cdn.example.com/video.mp4"), true);
  assert.equal(isPlayableVideoUrl("/media/video.mp4"), true);
  assert.equal(isPlayableVideoUrl("blob:https://example.com/123"), true);
  assert.equal(isPlayableVideoUrl(""), false);
  assert.equal(isPlayableVideoUrl(null), false);
});

test("validação de performance do cálculo de segmento de vídeo", () => {
  const started = performance.now();
  for (let i = 0; i < 20000; i++) {
    const duration = 30 + (i % 3600);
    computeMidVideoLoopWindow(duration, 8);
  }
  const elapsed = performance.now() - started;
  assert.ok(elapsed < 120, `Cálculo de segmento está lento: ${elapsed.toFixed(2)}ms`);
});

test("sidebar e rotas não expõem Estúdio Virtual e Notificações", () => {
  const sidebarPath = path.resolve(process.cwd(), "client/src/studio/components/layout/app-sidebar.tsx");
  const appPath = path.resolve(process.cwd(), "client/src/studio/App.tsx");
  const sidebar = fs.readFileSync(sidebarPath, "utf8");
  const app = fs.readFileSync(appPath, "utf8");

  assert.equal(sidebar.includes("Estúdio Virtual"), false);
  assert.equal(sidebar.includes("notifications"), false);
  assert.equal(app.includes("<DawRoute />"), false);
  assert.equal(app.includes("component={Notifications}"), false);
  assert.equal(app.includes("path=\"/hub-dub/daw\""), true);
  assert.equal(app.includes("path=\"/hub-dub/studio/:studioId/notifications\""), true);
  assert.equal(app.includes("Redirect to=\"/hub-dub/studios\""), true);
});

test("dashboard remove toggle de animação e agenda completa", () => {
  const dashboardPath = path.resolve(process.cwd(), "client/src/studio/pages/dashboard.tsx");
  const dashboard = fs.readFileSync(dashboardPath, "utf8");
  assert.equal(dashboard.includes("Animações ON"), false);
  assert.equal(dashboard.includes("Animações OFF"), false);
  assert.equal(dashboard.includes("Ver agenda completa"), false);
  assert.equal(dashboard.includes("Mini Tutorial de Captação"), true);
  assert.equal(dashboard.includes("button-open-full-tutorial"), true);
});

test("páginas críticas não exibem rótulos de retorno legado", () => {
  const adminPath = path.resolve(process.cwd(), "client/src/studio/pages/admin.tsx");
  const roomPath = path.resolve(process.cwd(), "client/src/studio/pages/room.tsx");
  const admin = fs.readFileSync(adminPath, "utf8");
  const room = fs.readFileSync(roomPath, "utf8");
  assert.equal(admin.includes("Voltar aos Estudios"), false);
  assert.equal(room.includes("Voltar para Sessoes"), false);
});

test("roteador usa histórico do navegador para manter deep linking em refresh", () => {
  const studioRouterPath = path.resolve(process.cwd(), "client/src/studio/lib/memory-router.ts");
  const appPath = path.resolve(process.cwd(), "client/src/studio/App.tsx");
  const studioRouter = fs.readFileSync(studioRouterPath, "utf8");
  const app = fs.readFileSync(appPath, "utf8");
  assert.equal(studioRouter.includes("useSyncExternalStore"), true);
  assert.equal(studioRouter.includes("window.history.pushState"), true);
  assert.equal(studioRouter.includes("window.history.replaceState"), true);
  assert.equal(studioRouter.includes("window.addEventListener(\"popstate\""), true);
  assert.equal(app.includes("<Switch location={location}>"), true);
});

test("transição de páginas aplica blur progressivo e fade com espera", () => {
  const appPath = path.resolve(process.cwd(), "client/src/studio/App.tsx");
  const app = fs.readFileSync(appPath, "utf8");
  assert.equal(app.includes("<AnimatePresence mode=\"wait\""), true);
  assert.equal(app.includes("initial={{ opacity: 0, filter: \"blur(4px)\" }}"), true);
  assert.equal(app.includes("animate={{ opacity: 1, filter: \"blur(0px)\" }}"), true);
  assert.equal(app.includes("exit={{ opacity: 0, filter: \"blur(3px)\" }}"), true);
  assert.equal(app.includes("duration: 0.4"), true);
  assert.equal(app.includes("component={StudioManagementPage} params={params}"), true);
});

test("servidor entrega index.html para rotas SPA sem capturar API", () => {
  const staticPath = path.resolve(process.cwd(), "server/static.ts");
  const staticCode = fs.readFileSync(staticPath, "utf8");
  assert.equal(staticCode.includes("app.get(\"/{*path}\""), true);
  assert.equal(staticCode.includes("req.path.startsWith(\"/api/\")"), true);
  assert.equal(staticCode.includes("req.path.startsWith(\"/ws/\")"), true);
  assert.equal(staticCode.includes("accept.includes(\"text/html\")"), true);
});

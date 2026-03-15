import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const studioAdminPath = join(root, "client/src/studio/pages/studio-admin.tsx");
const routesPath = join(root, "server/routes.ts");

test("RecordingRoom cabeçalho usa botão PAINEL e remove ações antigas", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /PAINEL/);
  assert.doesNotMatch(room, /Trocar Estúdio/);
  assert.doesNotMatch(room, /button-room-logout/);
});

test("RecordingRoom expõe filtros e labels novos de rolagem", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /APENAS PERSONAGEM/);
  assert.match(room, /ROLAGEM AUTOMÁTICA/);
  assert.match(room, /ROLAGEM MANUAL/);
  assert.match(room, /toggle-scroll-mode/);
  assert.match(room, /Loop ativo/);
  assert.match(room, /button-room-recordings/);
  assert.match(room, /Gravações/);
});

test("Seleção de personagem usa lista simples sem busca e sem cadastro inline", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /button-character-selector/);
  assert.match(room, /Selecionar personagem/);
  assert.doesNotMatch(room, /Buscar personagem/);
  assert.doesNotMatch(room, /Cadastrar personagem/);
});

test("Studio Admin possui seletor de formato de timecode", () => {
  const studioAdmin = readFileSync(studioAdminPath, "utf8");
  assert.match(studioAdmin, /select-timecode-format/);
  assert.match(studioAdmin, /HH:MM:SS:MMM/);
  assert.match(studioAdmin, /HH:MM:SS:FF/);
});

test("API inclui endpoints de timecode por estúdio e auditoria de sessão", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /\/api\/studios\/:studioId\/timecode-format/);
  assert.match(routes, /\/api\/sessions\/:sessionId\/audit-events/);
  assert.match(routes, /\/api\/sessions\/:sessionId\/recordings/);
  assert.match(routes, /recordings\.access\.privileged/);
  assert.match(routes, /isPreferred: z\.coerce\.boolean\(\)\.optional\(\)/);
  assert.match(routes, /role === "master"/);
});

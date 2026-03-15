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
  assert.match(room, /Loop ativo/);
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
});

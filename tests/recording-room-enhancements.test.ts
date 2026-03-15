import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const studioAdminPath = join(root, "client/src/studio/pages/studio-admin.tsx");
const routesPath = join(root, "server/routes.ts");
const videoSyncPath = join(root, "server/video-sync.ts");

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

test("RecordingRoom aplica controle de acesso por perfil e exibe aba Liberar Texto", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /canViewPresenceForRole/);
  assert.match(room, /canReleaseTextForRole/);
  assert.match(room, /button-room-release-text/);
  assert.match(room, /Liberar Texto/);
  assert.match(room, /button-toggle-text-control-/);
});

test("RecordingRoom valida edição de timecode e histórico de alterações", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /\^\\d\{2\}:\[0-5\]\\d:\[0-5\]\\d\$/);
  assert.match(room, /Timecode inválido/);
  assert.match(room, /Última alteração:/);
  assert.match(room, /Salvar/);
  assert.match(room, /Cancelar/);
});

test("RecordingRoom usa websocket de sync e valida links de áudio", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /\/ws\/video-sync\?sessionId=/);
  assert.match(room, /validateTakeStreamLink/);
  assert.match(room, /Range: "bytes=0-1"/);
  assert.match(room, /audio controls/);
});

test("RecordingRoom aplica preroll de 3s e posroll adaptativo no loop", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /setPreRoll\(3\)/);
  assert.match(room, /secondNextLine\.start - nextLine\.start/);
  assert.match(room, /Loop incompleto/);
  assert.match(room, /customLoop.start \/ videoDuration/);
  assert.match(room, /customLoop.end \/ videoDuration/);
});

test("Websocket restringe concessão de controle de texto para dublador e aluno", () => {
  const videoSync = readFileSync(videoSyncPath, "utf8");
  assert.match(videoSync, /canReceiveTextControl/);
  assert.match(videoSync, /normalized === "dublador" \|\| normalized === "aluno"/);
  assert.match(videoSync, /text-control:grant-controller/);
  assert.match(videoSync, /text-control:revoke-controller/);
});

test("RecordingRoom aplica exclusão otimista de takes com rollback e animação", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /setOptimisticRemovingTakeIds/);
  assert.match(room, /queryClient\.setQueryData\(takesQueryKey/);
  assert.match(room, /queryClient\.setQueryData\(recordingsQueryKey/);
  assert.match(room, /opacity-0 -translate-y-2 scale-\[0\.98\]/);
  assert.match(room, /transition-all duration-300/);
  assert.match(room, /Falha ao descartar take/);
});

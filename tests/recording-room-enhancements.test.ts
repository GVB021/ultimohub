import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const studioAdminPath = join(root, "client/src/studio/pages/studio-admin.tsx");
const routesPath = join(root, "server/routes.ts");
const videoSyncPath = join(root, "server/video-sync.ts");
const dailyMeetPath = join(root, "client/src/studio/components/video/DailyMeetPanel.tsx");
const devicePanelPath = join(root, "client/src/studio/components/audio/DeviceSettingsPanel.tsx");

test("RecordingRoom cabeçalho usa botão PAINEL e remove ações antigas", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /PAINEL/);
  assert.doesNotMatch(room, /Trocar Estúdio/);
  assert.doesNotMatch(room, /button-room-logout/);
  assert.doesNotMatch(room, /setTakesPopupOpen/);
  assert.doesNotMatch(room, /Headphones/);
  assert.match(room, /button-mobile-open-shortcuts/);
  assert.match(room, /button-mobile-room-panel/);
  assert.match(room, /canAccessDashboard/);
});

test("RecordingRoom expõe filtros e labels novos de rolagem", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /Apenas Meu Personagem/);
  assert.match(room, /Ativar Rolagem Automática/);
  assert.match(room, /Desativar Rolagem Automática/);
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
  assert.match(routes, /\/api\/takes\/:id\/download-link/);
  assert.match(routes, /\/api\/takes\/:id\/discard/);
  assert.match(routes, /recordings\.access\.privileged/);
  assert.match(routes, /\[Recordings\] Fetch requested/);
  assert.match(routes, /\[Recordings\] Database fetch failure/);
  assert.match(routes, /SUPABASE_DOWNLOAD_URL_TTL_SECONDS/);
  assert.match(routes, /MAX_TAKE_FILE_SIZE_BYTES/);
  assert.match(routes, /checksumMd5/);
  assert.match(routes, /isPreferred: z\.coerce\.boolean\(\)\.optional\(\)/);
  assert.match(routes, /normalizeStudioRole/);
});

test("API normaliza permissões de exclusão de takes por papel de estúdio", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /canManageSessionTakes/);
  assert.match(routes, /map\(normalizeStudioRole\)/);
  assert.match(routes, /participantRole === "diretor"/);
  assert.match(routes, /participantRole === "studio_admin"/);
});

test("RecordingRoom aplica controle de acesso por perfil e exibe aba Liberar Texto", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /UI_ROLE_PERMISSIONS/);
  assert.match(room, /hasUiPermission/);
  assert.match(room, /resolveUiRole/);
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

test("RecordingRoom usa websocket de sync e pipeline robusto de áudio", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /\/ws\/video-sync\?sessionId=/);
  assert.match(room, /resolveTakePlayableUrl/);
  assert.match(room, /validateTakeAudioBlob/);
  assert.match(room, /caches\.open\("vhub_audio_takes_v1"\)/);
  assert.match(room, /controls\s+className="w-full h-8"/);
  assert.match(room, /\[Room\]\[Recordings\] iniciando leitura de takes/);
  assert.match(room, /Falha de conexão com o banco de áudio/);
  assert.match(room, /Mídia disponível/);
  assert.match(room, /Carregando mídia/);
  assert.match(room, /UI_ROLE_PERMISSIONS/);
  assert.match(room, /resolveUiRole/);
});

test("RecordingRoom aplica preroll de 3s e posroll adaptativo no loop", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /setPreRoll\(3\)/);
  assert.match(room, /secondNextLine\.start - nextLine\.start/);
  assert.match(room, /Loop incompleto/);
  assert.match(room, /customLoop.start \/ videoDuration/);
  assert.match(room, /customLoop.end \/ videoDuration/);
  assert.match(room, /loop-preparing/);
  assert.match(room, /loop-silence-window/);
  assert.match(room, /Preparando loop\.\.\. \(3s\)/);
  assert.match(room, /Silêncio entre loops\.\.\. \(3s\)/);
});

test("DailyMeetPanel aplica limites mobile e gesto de swipe para colapsar", () => {
  const daily = readFileSync(dailyMeetPath, "utf8");
  assert.match(daily, /targetHeightRatio = isLandscape \? 0.35 : 0.3/);
  assert.match(daily, /if \(delta > 35\) setIsMinimized\(true\)/);
  assert.match(daily, /if \(delta < -35\) setIsMinimized\(false\)/);
  assert.match(daily, /zIndexBase = 1150/);
});

test("Painel avançado de áudio exibe VU, lossless e seletor de saída simplificado", () => {
  const panel = readFileSync(devicePanelPath, "utf8");
  assert.match(panel, /Painel Avançado de Áudio/);
  assert.doesNotMatch(panel, /Testar Microfone \(5s\)/);
  assert.doesNotMatch(panel, /Teste de saída \(1kHz \/ 2s\)/);
  assert.match(panel, /setMeterDb/);
  assert.match(panel, /Lossless \(48kHz \/ 24-bit\)/);
  assert.match(panel, /Acesso ao microfone/);
  assert.match(panel, /Controle de dispositivos/);
  assert.match(panel, /vhub_audio_permission_consent/);
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
  assert.match(room, /invalidateQueries\(\{ queryKey: recordingsQueryKey, exact: false \}\)/);
  assert.match(room, /\/api\/takes\/\$\{takeId\}\/discard/);
  assert.match(room, /opacity-0 -translate-y-2 scale-\[0\.98\]/);
  assert.match(room, /transition-all duration-300/);
  assert.match(room, /Falha ao descartar take/);
});

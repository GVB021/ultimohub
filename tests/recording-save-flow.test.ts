import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const routesPath = join(root, "server/routes.ts");

test("flow de salvamento valida persistência antes de confirmar sucesso", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /Persistência inválida: resposta de take incompleta\./);
  assert.match(room, /Persistência inválida: take não encontrado na aba de gravações\./);
  assert.match(room, /upload-integrity-check/);
  assert.match(room, /authFetch\(`\/api\/sessions\/\$\{sessionId\}\/recordings`\)/);
});

test("flow libera novas gravações após salvar ou falhar envio", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /setRecordingStatus\("idle"\)/);
  assert.match(room, /setLastRecording\(null\)/);
  assert.match(room, /setQualityMetrics\(null\)/);
});

test("gravações expõem ações de reprodução e download sem refresh manual", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /button-play-recording-/);
  assert.match(room, /button-download-recording-/);
  assert.match(room, /recordingsPreviewAudioRef/);
});

test("endpoint recordings usa dados detalhados para lista consistente", () => {
  const routes = readFileSync(routesPath, "utf8");
  assert.match(routes, /getSessionTakesWithDetails\(req\.params\.sessionId\)/);
});

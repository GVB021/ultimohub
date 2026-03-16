import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const dailyPanelPath = join(root, "client/src/studio/components/video/DailyMeetPanel.tsx");

test("popup de voz e vídeo fica acessível e é montado fora do header", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /data-testid="button-room-panel"/);
  assert.match(room, /data-testid="button-room-voice-video-popup"/);
  assert.match(room, /data-testid="button-open-shortcuts"/);
  assert.match(room, /<DailyMeetPanel[\s\S]*open=\{dailyMeetOpen\}[\s\S]*onOpenChange=\{setDailyMeetOpen\}/);
});

test("layout principal desktop usa split para vídeo e roteiro", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /const \[desktopVideoTextSplit, setDesktopVideoTextSplit\] = useState/);
  assert.match(room, /data-testid="video-text-resizer"/);
  assert.match(room, /style=\{isMobile \? undefined : \{ height: `\$\{100 - desktopVideoTextSplit\}%` \}\}/);
});

test("DailyMeetPanel agora é um rodapé fixo com suporte a minimizar", () => {
  const dailyPanel = readFileSync(dailyPanelPath, "utf8");
  assert.match(dailyPanel, /className="fixed bottom-0 right-0 p-4 md:p-6"/);
  assert.match(dailyPanel, /data-testid="daily-meet-popup"/);
  assert.match(dailyPanel, /isMinimized \? "Chat Ativo" : "Voice & Video Chat"/);
});

test("texto sincronizado foi ampliado para legibilidade no desktop", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /isMobile \? "text-2xl sm:text-3xl" : "text-3xl md:text-5xl lg:text-6xl"/);
});

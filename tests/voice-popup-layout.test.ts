import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const dailyPanelPath = join(root, "client/src/studio/components/video/DailyMeetPanel.tsx");

test("DailyMeet sai do cabeçalho e fica embutido abaixo do vídeo no desktop", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /data-testid="button-room-panel"/);
  assert.match(room, /data-testid="button-open-shortcuts"/);
  assert.doesNotMatch(room, /data-testid="button-room-voice-video-popup"/);
  assert.match(room, /mode="embedded"/);
  assert.match(room, /height: `\$\{100 - desktopVideoTextSplit\}%`/);
});



test("DailyMeetPanel suporta modos floating e embedded", () => {
  const dailyPanel = readFileSync(dailyPanelPath, "utf8");
  assert.match(dailyPanel, /mode\?: "floating" \| "embedded"/);
  assert.match(dailyPanel, /mode === "embedded" \? "w-full h-full" : "fixed bottom-0 right-0 p-4 md:p-6"/);
  assert.match(dailyPanel, /data-testid="daily-meet-popup"/);
  assert.match(dailyPanel, /isMinimized \? "Chat Ativo" : "Voice & Video Chat"/);
});


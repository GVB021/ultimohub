import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const roomPath = join(root, "client/src/studio/pages/room.tsx");
const dailyPanelPath = join(root, "client/src/studio/components/video/DailyMeetPanel.tsx");

test("popup de voz e vídeo fica acessível no cabeçalho entre painel e atalhos", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /data-testid="button-room-panel"/);
  assert.match(room, /data-testid="button-room-voice-video-popup"/);
  assert.match(room, /data-testid="button-open-shortcuts"/);
  assert.match(room, /<DailyMeetPanel[\s\S]*open=\{dailyMeetOpen\}[\s\S]*onOpenChange=\{setDailyMeetOpen\}/);
});

test("layout principal desktop usa split 50\/50 com divisor arrastável", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /const \[desktopVideoTextSplit, setDesktopVideoTextSplit\] = useState\(50\)/);
  assert.match(room, /data-testid="video-text-resizer"/);
  assert.match(room, /setDesktopVideoTextSplit\(Math\.max\(32, Math\.min\(68, next\)\)\)/);
  assert.match(room, /style=\{isMobile \? \{ flex: 1 \} : \{ height: `\$\{desktopVideoTextSplit\}%` \}\}/);
});

test("popup ancorado ao cabeçalho com área de vídeo e texto redimensionável", () => {
  const dailyPanel = readFileSync(dailyPanelPath, "utf8");
  assert.match(dailyPanel, /className=\{`absolute top-full right-0 mt-2/);
  assert.match(dailyPanel, /data-testid="daily-meet-popup"/);
  assert.match(dailyPanel, /data-testid="daily-meet-resizer"/);
  assert.match(dailyPanel, /const \[splitPercent, setSplitPercent\] = useState\(50\)/);
  assert.match(dailyPanel, /setSplitPercent\(Math\.max\(32, Math\.min\(68, next\)\)\)/);
});

test("texto sincronizado foi ampliado para legibilidade no desktop", () => {
  const room = readFileSync(roomPath, "utf8");
  assert.match(room, /isMobile \? "text-2xl sm:text-3xl" : "text-3xl md:text-5xl lg:text-6xl"/);
});

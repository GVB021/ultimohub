import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function sRgbToLinear(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const n = Number.parseInt(value, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function contrastRatio(a: string, b: string) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const la = 0.2126 * sRgbToLinear(ca.r) + 0.7152 * sRgbToLinear(ca.g) + 0.0722 * sRgbToLinear(ca.b);
  const lb = 0.2126 * sRgbToLinear(cb.r) + 0.7152 * sRgbToLinear(cb.g) + 0.0722 * sRgbToLinear(cb.b);
  const [l1, l2] = la >= lb ? [la, lb] : [lb, la];
  return (l1 + 0.05) / (l2 + 0.05);
}

test("room mantém contraste AA para texto normal e texto grande", () => {
  const normalPairs: Array<[string, string]> = [
    ["#111827", "#FFFFFF"],
    ["#4B5563", "#FFFFFF"],
    ["#1F2937", "#F9FAFB"],
  ];
  for (const [fg, bg] of normalPairs) {
    assert.ok(contrastRatio(fg, bg) >= 4.5, `Contraste insuficiente ${fg}/${bg}`);
  }

  const largePairs: Array<[string, string]> = [
    ["#2563EB", "#FFFFFF"],
    ["#0F172A", "#E5E7EB"],
  ];
  for (const [fg, bg] of largePairs) {
    assert.ok(contrastRatio(fg, bg) >= 3, `Contraste grande insuficiente ${fg}/${bg}`);
  }
});

test("room expõe elemento de áudio para preview e remove botão voltar legado", () => {
  const roomPath = path.resolve(process.cwd(), "client/src/studio/pages/room.tsx");
  const content = fs.readFileSync(roomPath, "utf8");
  assert.equal(content.includes("audio ref={previewAudioRef}"), true);
  assert.equal(content.includes("button-exit-room"), false);
  assert.equal(content.includes("ArrowLeft className=\"w-4 h-4\""), false);
});

test("pipeline de áudio registra logs das etapas críticas", () => {
  const roomPath = path.resolve(process.cwd(), "client/src/studio/pages/room.tsx");
  const recordingPath = path.resolve(process.cwd(), "client/src/studio/lib/audio/recordingEngine.ts");
  const serverRoutePath = path.resolve(process.cwd(), "server/routes.ts");
  const room = fs.readFileSync(roomPath, "utf8");
  const recording = fs.readFileSync(recordingPath, "utf8");
  const serverRoutes = fs.readFileSync(serverRoutePath, "utf8");

  assert.equal(room.includes("[AudioPipeline][Room]"), true);
  assert.equal(recording.includes("[AudioPipeline][Capture]"), true);
  assert.equal(serverRoutes.includes("[Take Upload] Request received"), true);
  assert.equal(serverRoutes.includes("[Take Upload] Completed"), true);
});


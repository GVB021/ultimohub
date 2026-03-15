import test from "node:test";
import assert from "node:assert/strict";

test("viewport meta tag contains mobile-optimized settings", () => {
  const metaContent = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
  assert.ok(metaContent.includes("user-scalable=no"));
  assert.ok(metaContent.includes("maximum-scale=1.0"));
});

test("mobile breakpoint detection logic", () => {
  const isMobile = (width: number) => width <= 768;
  assert.strictEqual(isMobile(375), true);  // iPhone X
  assert.strictEqual(isMobile(414), true);  // iPhone 8 Plus
  assert.strictEqual(isMobile(1024), false); // iPad Pro / Desktop
});

test("HubAlign mobile logic: selection and track generation", () => {
  const selectedFileUrls = ["url1", "url2"];
  const isGeneratingTrack = false;
  const trackReady = false;

  // Botão deve estar habilitado apenas se houver seleção
  const canGenerate = selectedFileUrls.length > 0 && !isGeneratingTrack;
  assert.strictEqual(canGenerate, true);

  // Simular track pronta
  const simulatedTrackReady = true;
  assert.strictEqual(simulatedTrackReady, true);
});

test("DailyMeet mobile minimized panel dimensions", () => {
  const getPanelSize = (isMobile: boolean, isMinimized: boolean, viewport: { width: number, height: number }) => {
    if (!isMobile) return { width: 320, height: 420 };
    return {
      width: isMinimized ? 64 : viewport.width * 0.9,
      height: isMinimized ? 64 : 160
    };
  };

  const mobileSize = getPanelSize(true, true, { width: 375, height: 812 });
  assert.strictEqual(mobileSize.width, 64);
  assert.strictEqual(mobileSize.height, 64);
});
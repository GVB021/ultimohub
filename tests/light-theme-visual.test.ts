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

function walkFiles(root: string, out: string[]) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "dist", "build", ".git"].includes(entry.name)) continue;
      walkFiles(fullPath, out);
      continue;
    }
    out.push(fullPath);
  }
}

test("contraste de texto normal no tema claro atende WCAG 2.1 AA", () => {
  const pairs: Array<[string, string]> = [
    ["#111827", "#FFFFFF"],
    ["#6B7280", "#FFFFFF"],
    ["#FFFFFF", "#0071E3"],
    ["#111827", "#F9FAFB"],
  ];
  for (const [fg, bg] of pairs) {
    assert.ok(contrastRatio(fg, bg) >= 4.5, `Contraste insuficiente para ${fg} em ${bg}`);
  }
});

test("contraste de texto grande no tema claro atende WCAG 2.1 AA", () => {
  const pairs: Array<[string, string]> = [
    ["#0071E3", "#FFFFFF"],
    ["#3B82F6", "#F9FAFB"],
  ];
  for (const [fg, bg] of pairs) {
    assert.ok(contrastRatio(fg, bg) >= 3, `Contraste grande insuficiente para ${fg} em ${bg}`);
  }
});

test("código não mantém classes dark e toggles manuais de tema", () => {
  const srcRoot = path.resolve(process.cwd(), "client/src");
  const files: string[] = [];
  walkFiles(srcRoot, files);
  const codeFiles = files.filter((f) => /\.(ts|tsx|css)$/.test(f));
  for (const file of codeFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert.equal(content.includes("dark:"), false, `Classe dark encontrada em ${file}`);
  }
  const removedFiles = [
    path.resolve(process.cwd(), "client/src/components/nav/ThemeToggleButton.tsx"),
    path.resolve(process.cwd(), "client/src/studio/components/nav/ThemeToggleButton.tsx"),
    path.resolve(process.cwd(), "client/src/studio/components/thehub/ThemeToggleButton.tsx"),
    path.resolve(process.cwd(), "client/src/studio/components/mode-toggle.tsx"),
  ];
  for (const file of removedFiles) {
    assert.equal(fs.existsSync(file), false, `Arquivo de toggle ainda existe: ${file}`);
  }
});


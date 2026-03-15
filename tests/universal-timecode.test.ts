import test from "node:test";
import assert from "node:assert/strict";
import { formatTimecodeByFormat, parseUniversalTimecodeToSeconds } from "../client/src/studio/lib/timecode.ts";

test("parseUniversalTimecodeToSeconds converte HH:MM:SS", () => {
  assert.equal(parseUniversalTimecodeToSeconds("01:02:30"), 3750);
  assert.equal(parseUniversalTimecodeToSeconds("00:00:00"), 0);
  assert.equal(parseUniversalTimecodeToSeconds("10:00:05"), 36005);
});

test("parseUniversalTimecodeToSeconds converte SMPTE NDF HH:MM:SS:FF", () => {
  assert.equal(parseUniversalTimecodeToSeconds("01:02:30:15", 24), 3750.625);
  assert.equal(parseUniversalTimecodeToSeconds("00:00:10:12", 24), 10.5);
});

test("parseUniversalTimecodeToSeconds converte SMPTE DF HH:MM:SS;FF", () => {
  const seconds = parseUniversalTimecodeToSeconds("00:01:00;00", 29.97);
  assert.equal(seconds, 59.993);
});

test("parseUniversalTimecodeToSeconds converte MM:SS", () => {
  assert.equal(parseUniversalTimecodeToSeconds("02:30"), 150);
  assert.equal(parseUniversalTimecodeToSeconds("0:01"), 1);
  assert.equal(parseUniversalTimecodeToSeconds("59:59"), 3599);
});

test("parseUniversalTimecodeToSeconds converte SS.mmm", () => {
  assert.equal(parseUniversalTimecodeToSeconds("125.430"), 125.43);
  assert.equal(parseUniversalTimecodeToSeconds("0.001"), 0.001);
  assert.equal(parseUniversalTimecodeToSeconds("10.9999"), 11);
});

test("parseUniversalTimecodeToSeconds aceita segundos numéricos (retrocompatibilidade)", () => {
  assert.equal(parseUniversalTimecodeToSeconds("125"), 125);
  assert.equal(parseUniversalTimecodeToSeconds("125.4"), 125.4);
  assert.equal(parseUniversalTimecodeToSeconds("  125.400  "), 125.4);
});

test("parseUniversalTimecodeToSeconds valida entradas inválidas", () => {
  assert.throws(() => parseUniversalTimecodeToSeconds(""), /Timecode vazio/);
  assert.throws(() => parseUniversalTimecodeToSeconds("abc"), /Formato de timecode inválido/);
  assert.throws(() => parseUniversalTimecodeToSeconds("00:00:00:24", 24), /Frames excedem o FPS/);
  assert.throws(() => parseUniversalTimecodeToSeconds("00:60:00"), /Formato de timecode inválido/);
  assert.throws(() => parseUniversalTimecodeToSeconds("00:00:60"), /Formato de timecode inválido/);
  assert.throws(() => parseUniversalTimecodeToSeconds("00:00:00;30", 29.97), /Frames excedem o FPS nominal/);
  assert.throws(() => parseUniversalTimecodeToSeconds("00:00:00:00", 0), /FPS inválido/);
});

test("parseUniversalTimecodeToSeconds converte 10.000 linhas rápido", () => {
  const lines = Array.from({ length: 10_000 }, (_, i) => `00:00:${String(i % 60).padStart(2, "0")}:${String(i % 24).padStart(2, "0")}`);
  const start = process.hrtime.bigint();
  for (const tc of lines) {
    parseUniversalTimecodeToSeconds(tc, 24);
  }
  const end = process.hrtime.bigint();
  const elapsedMs = Number(end - start) / 1_000_000;
  assert.ok(elapsedMs < 100, `Conversão demorou ${elapsedMs.toFixed(2)}ms`);
});

test("formatTimecodeByFormat respeita formatos configuráveis", () => {
  assert.equal(formatTimecodeByFormat(3723.456, "HH:MM:SS"), "01:02:03");
  assert.equal(formatTimecodeByFormat(3723.456, "HH:MM:SS:MMM"), "01:02:03:456");
  assert.equal(formatTimecodeByFormat(3723.5, "HH:MM:SS:FF", 24), "01:02:03:12");
});

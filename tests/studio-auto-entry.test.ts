import test from "node:test";
import assert from "node:assert/strict";
import { decideStudioAutoEntry } from "../server/lib/studio-auto-entry.ts";

test("decideStudioAutoEntry redireciona quando há apenas um estúdio válido", () => {
  const decision = decideStudioAutoEntry([{ id: "studio-1" }]);
  assert.deepEqual(decision, { mode: "redirect", studioId: "studio-1" });
});

test("decideStudioAutoEntry mantém seleção quando há múltiplos estúdios", () => {
  const decision = decideStudioAutoEntry([{ id: "studio-1" }, { id: "studio-2" }]);
  assert.deepEqual(decision, { mode: "select" });
});

test("decideStudioAutoEntry mantém seleção quando não há estúdios", () => {
  const decision = decideStudioAutoEntry([]);
  assert.deepEqual(decision, { mode: "select" });
});

test("decideStudioAutoEntry retorna erro quando estúdio único não possui id", () => {
  const decision = decideStudioAutoEntry([{ id: "" }]);
  assert.equal(decision.mode, "error");
});


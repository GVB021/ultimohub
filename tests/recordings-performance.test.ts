import test from "node:test";
import assert from "node:assert/strict";
import { annotateTakeVersions } from "../server/lib/take-versioning.ts";

test("annotateTakeVersions processa 50+ gravações rapidamente", () => {
  const input = Array.from({ length: 80 }).map((_, idx) => ({
    id: `take-${idx}`,
    lineIndex: idx % 8,
    voiceActorId: `actor-${idx % 5}`,
    isPreferred: idx % 3 === 0,
    createdAt: new Date(1700000000000 + idx * 1000),
  }));
  const t0 = performance.now();
  const out = annotateTakeVersions(input);
  const elapsed = performance.now() - t0;
  assert.equal(out.length, 80);
  assert.ok(elapsed < 25, `Processamento demorou ${elapsed.toFixed(2)}ms`);
  assert.ok(out.every((item) => item.takeVersion >= 1));
});

import test from "node:test";
import assert from "node:assert/strict";
import { api } from "../shared/routes.ts";
import { resolveStudioAutoEntryTarget } from "../client/src/studio/lib/studio-auto-entry.ts";

test("contrato backend/frontend redireciona quando API retorna modo redirect", () => {
  const parsed = api.studios.autoEntry.responses[200].parse({
    mode: "redirect",
    studioId: "studio-123",
    target: "/hub-dub/studio/studio-123/dashboard",
    count: 1,
  });
  assert.equal(resolveStudioAutoEntryTarget(parsed), "/hub-dub/studio/studio-123/dashboard");
});

test("contrato backend/frontend mantém seleção quando API retorna modo select", () => {
  const parsed = api.studios.autoEntry.responses[200].parse({
    mode: "select",
    count: 2,
  });
  assert.equal(resolveStudioAutoEntryTarget(parsed), null);
});


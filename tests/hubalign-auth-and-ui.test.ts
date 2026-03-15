import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getEmailUsername, isHubAlignOwner, HUBALIGN_OWNER_USERNAME } from "../server/hubalign-routes.ts";

const appHeaderPath = "/Users/gabrielborba/Desktop/REP/THEHUB/client/src/components/nav/AppHeader.tsx";
const hubAlignPagePath = "/Users/gabrielborba/Desktop/REP/THEHUB/client/src/pages/hub-align.tsx";
const hubAlignRoutesPath = "/Users/gabrielborba/Desktop/REP/THEHUB/server/hubalign-routes.ts";

test("autorização identifica username correto via email", () => {
  assert.equal(getEmailUsername("borbaggabriel@gmail.com"), HUBALIGN_OWNER_USERNAME);
  assert.equal(getEmailUsername("BORBAGGABRIEL@corp.local"), HUBALIGN_OWNER_USERNAME);
  assert.equal(getEmailUsername("outro.usuario@corp.local"), "outro.usuario");
});

test("isHubAlignOwner libera apenas usuário esperado", () => {
  assert.equal(isHubAlignOwner({ email: "borbaggabriel@gmail.com" }), true);
  assert.equal(isHubAlignOwner({ displayName: "borbaggabriel" }), true);
  assert.equal(isHubAlignOwner({ email: "qualquer@dominio.com", displayName: "diretor" }), false);
});

test("header contém botão exclusivo centralizado do HubAlign", () => {
  const content = readFileSync(appHeaderPath, "utf8");
  assert.match(content, /button-exclusive-hubalign/);
  assert.match(content, /absolute left-1\/2 -translate-x-1\/2/);
  assert.match(content, /canAccessHubAlign = username === "borbaggabriel"/);
});

test("página HubAlign contém módulos de upload, tracks, dashboard e playback", () => {
  const content = readFileSync(hubAlignPagePath, "utf8");
  assert.match(content, /Upload e gerenciamento de dublagens/);
  assert.match(content, /Montagem de tracks e timeline/);
  assert.match(content, /Playback de pré-visualização/);
  assert.match(content, /grid grid-cols-1 md:grid-cols-4/);
});

test("rotas HubAlign implementam auditoria, versionamento e exportação", () => {
  const content = readFileSync(hubAlignRoutesPath, "utf8");
  assert.match(content, /HUBALIGN_ACCESS_GRANTED/);
  assert.match(content, /HUBALIGN_TRACK_VERSION_SAVED/);
  assert.match(content, /HUBALIGN_PROJECT_EXPORTED/);
  assert.match(content, /saveProjectBackup/);
});

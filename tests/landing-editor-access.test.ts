import test from "node:test";
import assert from "node:assert/strict";
import { canEditLandingTextByEmail } from "../client/src/lib/landing-editor-access.ts";

test("permite acesso ao editor para o email autorizado", () => {
  assert.equal(canEditLandingTextByEmail("borbaggabriel@gmail.com"), true);
});

test("permite acesso ignorando caixa e espaços", () => {
  assert.equal(canEditLandingTextByEmail("  BORBAGGABRIEL@GMAIL.COM  "), true);
});

test("nega acesso para email diferente", () => {
  assert.equal(canEditLandingTextByEmail("outro.usuario@gmail.com"), false);
});

test("nega acesso sem email disponível", () => {
  assert.equal(canEditLandingTextByEmail(null), false);
  assert.equal(canEditLandingTextByEmail(undefined), false);
  assert.equal(canEditLandingTextByEmail(""), false);
});


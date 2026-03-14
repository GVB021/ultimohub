import test from "node:test";
import assert from "node:assert/strict";
import { getHighestStudioRole, normalizePlatformRole, normalizeStudioRole, hasMinStudioRole, isPrivilegedStudioRole } from "../shared/roles.ts";

test("normalizePlatformRole handles aliases", () => {
  assert.equal(normalizePlatformRole("platformowner"), "platform_owner");
  assert.equal(normalizePlatformRole("platform_owner"), "platform_owner");
  assert.equal(normalizePlatformRole("user"), "user");
  assert.equal(normalizePlatformRole(undefined), "user");
});

test("normalizeStudioRole handles aliases", () => {
  assert.equal(normalizeStudioRole("adminstudio"), "studio_admin");
  assert.equal(normalizeStudioRole("engenheriodeaudio"), "engenheiro_audio");
  assert.equal(normalizeStudioRole("director"), "diretor");
  assert.equal(normalizeStudioRole("voice_actor"), "dublador");
  assert.equal(normalizeStudioRole(undefined), "aluno");
});

test("getHighestStudioRole returns the most privileged role", () => {
  assert.equal(getHighestStudioRole(["aluno", "dublador"]), "dublador");
  assert.equal(getHighestStudioRole(["engenheiro_audio", "diretor"]), "diretor");
  assert.equal(getHighestStudioRole(["adminstudio", "diretor"]), "studio_admin");
});

test("hasMinStudioRole enforces hierarchy", () => {
  assert.equal(hasMinStudioRole("dublador", "aluno"), true);
  assert.equal(hasMinStudioRole("aluno", "dublador"), false);
  assert.equal(hasMinStudioRole("engenheriodeaudio", "engenheiro_audio"), true);
});

test("isPrivilegedStudioRole matches privileged roles", () => {
  assert.equal(isPrivilegedStudioRole("aluno"), false);
  assert.equal(isPrivilegedStudioRole("dublador"), false);
  assert.equal(isPrivilegedStudioRole("engenheiro_audio"), true);
  assert.equal(isPrivilegedStudioRole("diretor"), true);
  assert.equal(isPrivilegedStudioRole("adminstudio"), true);
});

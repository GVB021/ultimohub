import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const supabaseLibPath = "/Users/gabrielborba/Desktop/REP/THEHUB/server/lib/supabase.ts";
const hubAlignRoutesPath = "/Users/gabrielborba/Desktop/REP/THEHUB/server/hubalign-routes.ts";

test("biblioteca Supabase expõe listagem e upload JSON para HubAlign", () => {
  const content = readFileSync(supabaseLibPath, "utf8");
  assert.match(content, /export async function uploadJsonToSupabaseStorage/);
  assert.match(content, /export async function listSupabaseStorageObjects/);
  assert.match(content, /storage\.object\.list/);
});

test("rotas HubAlign usam Supabase para listagem, upload e download", () => {
  const content = readFileSync(hubAlignRoutesPath, "utf8");
  assert.match(content, /listSupabaseStorageObjects/);
  assert.match(content, /uploadToSupabaseStorage/);
  assert.match(content, /downloadFromSupabaseStorage/);
  assert.match(content, /checkSupabaseConnection/);
});

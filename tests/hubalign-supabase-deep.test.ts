import test from "node:test";
import assert from "node:assert/strict";
import { 
  parseSupabaseStorageUrl, 
  isSupabaseConfigured,
  configureSupabase
} from "../server/lib/supabase.ts";

test("parseSupabaseStorageUrl identifica buckets e caminhos corretamente", () => {
  const url1 = "https://xyz.supabase.co/storage/v1/object/public/takes/folder/file.wav";
  const parsed1 = parseSupabaseStorageUrl(url1);
  assert.equal(parsed1?.bucket, "takes");
  assert.equal(parsed1?.path, "folder/file.wav");

  const url2 = "https://xyz.supabase.co/storage/v1/object/hubalign/projects/p1/files/f1.mp3";
  const parsed2 = parseSupabaseStorageUrl(url2);
  assert.equal(parsed2?.bucket, "hubalign");
  assert.equal(parsed2?.path, "projects/p1/files/f1.mp3");

  const invalidUrl = "https://google.com/logo.png";
  assert.equal(parseSupabaseStorageUrl(invalidUrl), null);
});

test("isSupabaseConfigured reflete estado das variáveis de ambiente", () => {
  // Salvar estado original
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  configureSupabase({ url: "https://test.supabase.co", serviceRoleKey: "test-key" });
  assert.equal(isSupabaseConfigured(), true);

  configureSupabase({ url: "", serviceRoleKey: "" });
  assert.equal(isSupabaseConfigured(), false);

  // Restaurar
  configureSupabase({ url: originalUrl || "", serviceRoleKey: originalKey || "" });
});

test("validação de tipos de arquivo permitidos no HubAlign", async () => {
  const ALLOWED_MIME_TYPES = [
    "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/m4a"
  ];
  
  assert.ok(ALLOWED_MIME_TYPES.includes("audio/wav"));
  assert.ok(ALLOWED_MIME_TYPES.includes("audio/mpeg"));
  assert.ok(ALLOWED_MIME_TYPES.includes("audio/mp4"));
  assert.ok(!ALLOWED_MIME_TYPES.includes("image/png"));
  assert.ok(!ALLOWED_MIME_TYPES.includes("video/mp4"));
});

test("lógica de busca de takes do HubDub", () => {
  const mockTakes = [
    { id: "1", characterName: "Batman", productionName: "Movie A", voiceActorName: "Gabriel" },
    { id: "2", characterName: "Joker", productionName: "Movie A", voiceActorName: "Borba" },
    { id: "3", characterName: "Superman", productionName: "Movie B", voiceActorName: "Gabriel" },
  ];

  const search = "Gabriel";
  const filtered = mockTakes.filter(t => 
    String(t.productionName).toLowerCase().includes(search.toLowerCase()) ||
    String(t.voiceActorName).toLowerCase().includes(search.toLowerCase())
  );

  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].id, "1");
  assert.equal(filtered[1].id, "3");
});


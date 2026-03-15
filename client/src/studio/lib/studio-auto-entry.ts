import { api } from "@shared/routes";

export type StudioAutoEntryResponse = ReturnType<typeof api.studios.autoEntry.responses[200]["parse"]>;

export function resolveStudioAutoEntryTarget(input: StudioAutoEntryResponse | null | undefined) {
  if (!input) return null;
  if (input.mode !== "redirect") return null;
  const target = String(input.target || "").trim();
  return target || `/hub-dub/studio/${input.studioId}/dashboard`;
}


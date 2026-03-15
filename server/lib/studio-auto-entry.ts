export type StudioAutoEntryDecision =
  | { mode: "redirect"; studioId: string }
  | { mode: "select" }
  | { mode: "error"; message: string };

export function decideStudioAutoEntry(studios: Array<{ id?: string | null }>): StudioAutoEntryDecision {
  if (studios.length !== 1) {
    return { mode: "select" };
  }

  const studioId = String(studios[0]?.id || "").trim();
  if (!studioId) {
    return { mode: "error", message: "Estudio unico sem identificador valido" };
  }

  return { mode: "redirect", studioId };
}


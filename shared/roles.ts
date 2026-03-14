export const PLATFORM_ROLES = ["platform_owner", "user"] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const STUDIO_ROLES = [
  "platform_owner",
  "studio_admin",
  "diretor",
  "engenheiro_audio",
  "dublador",
  "aluno",
] as const;
export type StudioRole = (typeof STUDIO_ROLES)[number];

export const STUDIO_ROLE_HIERARCHY: Record<StudioRole, number> = {
  platform_owner: 100,
  studio_admin: 80,
  diretor: 60,
  engenheiro_audio: 40,
  dublador: 20,
  aluno: 10,
};

const PLATFORM_ROLE_ALIASES: Record<string, PlatformRole> = {
  platformowner: "platform_owner",
  platform_owner: "platform_owner",
  owner: "platform_owner",
  user: "user",
};

const STUDIO_ROLE_ALIASES: Record<string, StudioRole> = {
  platformowner: "platform_owner",
  platform_owner: "platform_owner",
  studio_admin: "studio_admin",
  adminstudio: "studio_admin",
  diretor: "diretor",
  director: "diretor",
  teacher: "diretor",
  engenheiro_audio: "engenheiro_audio",
  engenheriodeaudio: "engenheiro_audio",
  audio_engineer: "engenheiro_audio",
  engineer: "engenheiro_audio",
  dublador: "dublador",
  actor: "dublador",
  voice_actor: "dublador",
  aluno: "aluno",
  student: "aluno",
};

export function normalizePlatformRole(role: unknown): PlatformRole {
  const key = String(role || "").trim().toLowerCase().replace(/\s+/g, "_");
  return PLATFORM_ROLE_ALIASES[key] ?? "user";
}

export function normalizeStudioRole(role: unknown): StudioRole {
  const key = String(role || "").trim().toLowerCase().replace(/\s+/g, "_");
  return STUDIO_ROLE_ALIASES[key] ?? "aluno";
}

export function getHighestStudioRole(roles: Array<string | null | undefined>): StudioRole {
  let best: StudioRole = "aluno";
  let bestLevel = STUDIO_ROLE_HIERARCHY[best];
  for (const r of roles) {
    const nr = normalizeStudioRole(r);
    const lvl = STUDIO_ROLE_HIERARCHY[nr] ?? 0;
    if (lvl > bestLevel) {
      best = nr;
      bestLevel = lvl;
    }
  }
  return best;
}

export function hasMinStudioRole(role: unknown, minRole: StudioRole) {
  const current = normalizeStudioRole(role);
  return (STUDIO_ROLE_HIERARCHY[current] ?? 0) >= (STUDIO_ROLE_HIERARCHY[minRole] ?? 0);
}

export function isPrivilegedStudioRole(role: unknown) {
  const r = normalizeStudioRole(role);
  return r === "platform_owner" || r === "studio_admin" || hasMinStudioRole(r, "engenheiro_audio");
}

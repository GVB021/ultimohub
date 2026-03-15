const LANDING_EDITOR_ALLOWED_EMAIL = "borbaggabriel@gmail.com";

function normalizeEmail(input: unknown) {
  return String(input ?? "").trim().toLowerCase();
}

export function canEditLandingTextByEmail(email: unknown) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return normalized === LANDING_EDITOR_ALLOWED_EMAIL;
}


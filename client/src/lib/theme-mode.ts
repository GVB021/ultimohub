const THEME_STORAGE_KEY = "vhub_theme_preference";

export type Theme = "light" | "dark" | "system";

export function getTheme(): Theme {
  return "light"; // Always light by default
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Check if we are in the Recording Room
  const isRecordingRoom = window.location.pathname.includes("/room");

  if (isRecordingRoom) {
    root.classList.add("dark");
    root.style.colorScheme = "dark";
    return;
  }

  root.classList.remove("dark");
  root.style.colorScheme = "light";
}

export function initThemeMode() {
  applyTheme("light");

  // Re-apply theme on navigation
  window.addEventListener("popstate", () => applyTheme("light"));
  
  // Custom event for internal navigation if using a router that doesn't trigger popstate
  window.addEventListener("locationchange", () => applyTheme("light"));
}

export function toggleTheme() {
  // Disabled for now as per requirements
  return "light";
}

const THEME_STORAGE_KEY = "vhub_theme_preference";

export type Theme = "light" | "dark" | "system";

export function getTheme(): Theme {
  return "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  // Check if we are in the Recording Room (Studio Room)
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
  const originalPushState = window.history.pushState;
  window.history.pushState = function(...args) {
    originalPushState.apply(this, args);
    applyTheme("light");
  };

  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    applyTheme("light");
  };

  window.addEventListener("popstate", () => applyTheme("light"));
}

export function toggleTheme(): Theme {
  // Disabled as per requirements: force light mode globally except Room
  return "light";
}

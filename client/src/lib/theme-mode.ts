export function initThemeMode() {
  const root = document.documentElement;
  const apply = (prefersDark: boolean) => {
    root.classList.remove("dark");
    root.dataset.systemTheme = prefersDark ? "dark" : "light";
    root.style.colorScheme = "light";
  };
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  apply(Boolean(media?.matches));
  if (media?.addEventListener) {
    media.addEventListener("change", (event) => apply(event.matches));
  }
}

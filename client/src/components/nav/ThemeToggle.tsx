import { Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { getTheme, toggleTheme, type Theme } from "@/lib/theme-mode";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  const handleToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <button
      onClick={handleToggle}
      className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
      aria-label={theme === "dark" ? "Alternar para modo claro" : "Alternar para modo escuro"}
      title={theme === "dark" ? "Modo Claro" : "Modo Escuro"}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}

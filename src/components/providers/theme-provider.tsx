"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
});

export function resolveTheme(theme: Theme): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // Load stored preference from API on mount
  useEffect(() => {
    fetch("/api/user/theme")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.theme) setThemeState(d.theme as Theme);
      })
      .catch(() => {});
  }, []);

  // Apply .dark class to <html> whenever theme state changes.
  // Persimmon CI-Contract §8: the light theme is the default and dark mode is
  // never switched on automatically. "system" (the stored default for users
  // who never chose) therefore resolves to light; only an explicit "dark"
  // selection activates the dark palette.
  useEffect(() => {
    const resolved = resolveTheme(theme);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    setResolvedTheme(resolved);
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    // Persist to API (fire-and-forget — UI updates immediately)
    fetch("/api/user/theme", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: t }),
    }).catch(() => {});
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

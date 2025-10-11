"use client";
import * as React from "react";
import { applyThemeSetting } from "@/lib/ui/theme";

const STORAGE_KEY = "app.generalSettings.v1";

export function useThemeSwitcher() {
  const [theme, setThemeState] = React.useState<"light" | "dark" | "system">("system");

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        applyThemeSetting("system");
        return;
      }
      const parsed = JSON.parse(raw) as { theme?: "light" | "dark" | "system" };
      const storedTheme = parsed.theme ?? "system";
      setThemeState(storedTheme);
      applyThemeSetting(storedTheme);
    } catch {
      applyThemeSetting("system");
    }
  }, []);

  const setTheme = React.useCallback((next: "light" | "dark" | "system") => {
    setThemeState(next);
    applyThemeSetting(next);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, theme: next }));
    } catch {
      // ignore persistence errors
    }
  }, []);

  return { theme, setTheme };
}

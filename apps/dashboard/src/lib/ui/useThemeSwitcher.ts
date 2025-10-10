"use client";
import * as React from "react";

export function useThemeSwitcher() {
  const [theme, setTheme] = React.useState<"light" | "dark" | "system">("system");

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
      root.removeAttribute("data-theme");
    } else {
      root.classList.toggle("dark", theme === "dark");
      root.setAttribute("data-theme", theme === "dark" ? "brand-dark" : "brand");
    }
  }, [theme]);

  return { theme, setTheme };
}

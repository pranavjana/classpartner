"use client";

import * as React from "react";

export function useCssVarColor(variable: string, fallback: string) {
  const [color, setColor] = React.useState(fallback);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const resolveColor = () => {
      const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
      if (!value) {
        setColor(fallback);
        return;
      }

      if (value.startsWith("#") || value.startsWith("rgb")) {
        setColor(value);
      } else {
        setColor(`hsl(${value})`);
      }
    };

    resolveColor();
    const observer = new MutationObserver(resolveColor);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const listener = () => resolveColor();
    if (media?.addEventListener) media.addEventListener("change", listener);
    else media?.addListener?.(listener);

    return () => {
      observer.disconnect();
      if (media?.removeEventListener) media.removeEventListener("change", listener);
      else media?.removeListener?.(listener);
    };
  }, [variable, fallback]);

  return color;
}

export function useIsDarkMode() {
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();

    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });

    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const listener = () => update();
    if (media?.addEventListener) media.addEventListener("change", listener);
    else media?.addListener?.(listener);

    return () => {
      observer.disconnect();
      if (media?.removeEventListener) media.removeEventListener("change", listener);
      else media?.removeListener?.(listener);
    };
  }, []);

  return isDark;
}

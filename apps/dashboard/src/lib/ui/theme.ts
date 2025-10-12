"use client";

import { useLayoutEffect } from "react";

export function applyAccentColor(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const normalized = normalizeHex(hex);
  const fallback = "#3b82f6";
  const colour = normalized ?? fallback;
  const foreground = getReadableText(colour);

  const accentVars: Record<string, string> = {
    "--primary": colour,
    "--primary-foreground": foreground,
    "--accent": colour,
    "--accent-foreground": foreground,
    "--sidebar-accent": colour,
    "--sidebar-accent-foreground": foreground,
    "--sidebar-primary": colour,
    "--sidebar-primary-foreground": foreground,
  };

  Object.entries(accentVars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function applyThemeSetting(theme: "system" | "light" | "dark") {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.dataset.theme = prefersDark ? "brand-dark" : "brand";
    return;
  }

  const isDark = theme === "dark";
  root.classList.toggle("dark", isDark);
  root.dataset.theme = isDark ? "brand-dark" : "brand";
}

export function useAccentColor(hex: string) {
  useLayoutEffect(() => {
    applyAccentColor(hex);
  }, [hex]);
}

function normalizeHex(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{3,6}$/.test(hex)) return null;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, hex[hex.length - 1]);
  return `#${full.slice(0, 6)}`;
}

function getReadableText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const luminance = 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  return luminance > 0.6 ? "#0f172a" : "#ffffff";
}

function linearize(channel: number) {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

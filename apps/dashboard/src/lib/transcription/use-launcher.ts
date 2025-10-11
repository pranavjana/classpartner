"use client";

import * as React from "react";

type LaunchOptions = {
  onLaunch?: () => void | Promise<void>;
  onFallback?: () => void;
};

export function useTranscriptionLauncher(options: LaunchOptions = {}) {
  const { onLaunch, onFallback } = options;
  const [launching, setLaunching] = React.useState(false);

  const launch = React.useCallback(async () => {
    if (launching) return;
    setLaunching(true);
    try {
      if (onLaunch) {
        await onLaunch();
        return;
      }

      type DesktopBridge = {
        openOverlay?: () => Promise<void> | void;
        startTranscription?: () => Promise<void> | void;
      };
      const desktop: DesktopBridge | undefined =
        typeof window !== "undefined"
          ? (window as unknown as { desktop?: DesktopBridge }).desktop
          : undefined;

      if (desktop?.openOverlay) {
        await desktop.openOverlay();
        await desktop.startTranscription?.();
        return;
      }

      if (onFallback) {
        onFallback();
        return;
      }

      alert("Please run the desktop app to start a transcription.");
    } catch (error) {
      console.error("Failed to launch new transcription:", error);
    } finally {
      setLaunching(false);
    }
  }, [launching, onLaunch, onFallback]);

  return { launch, launching };
}

// apps/dashboard/types/global.d.ts
export {};

declare global {
  interface DesktopAPI {
    openOverlay: () => Promise<void>;
    toggleOverlay?: () => Promise<void>;
    startTranscription?: () => Promise<{ success: boolean; message?: string; error?: string }>;
    stopTranscription?: () => Promise<{ success: boolean; message?: string; error?: string }>;
    openDashboard?: () => Promise<void>;
  }

  interface Window {
    desktop?: DesktopAPI;
  }
}

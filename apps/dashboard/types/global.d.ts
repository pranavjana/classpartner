// apps/dashboard/types/global.d.ts
export {};

declare global {
  interface DesktopAPI {
    openOverlay: () => Promise<void>;
    toggleOverlay?: () => Promise<void>;
    startTranscription?: (
      metadata?: { classId?: string | null; recordId?: string | null; title?: string | null }
    ) => Promise<{ success: boolean; message?: string; error?: string }>;
    stopTranscription?: () => Promise<{ success: boolean; message?: string; error?: string }>;
    openDashboard?: () => Promise<void>;
  }

  interface Window {
    desktop?: DesktopAPI;
    transcriptionEvents?: {
      onUpdate?: (
        callback: (payload: {
          id: string;
          summary?: string | null;
          keyPoints?: string[] | null;
          actionItems?: string[] | null;
        }) => void
      ) => (() => void) | void;
    };
  }
}

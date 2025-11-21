// Type definitions for Electron API exposed via preload script

export interface TranscriptionData {
  text: string;
  is_final: boolean;
  confidence?: number;
  id?: string;
  startMs?: number;
  endMs?: number;
}

export interface ConnectionQuality {
  quality: 'good' | 'fair' | 'poor';
  latency?: number;
}

export interface AIUpdate {
  summary?: string;
  actions?: Array<{
    title: string;
    owner?: string;
    due?: string;
  }>;
  keywords?: string[];
  ts?: number;
}

export interface TranscriptionStartResult {
  success: boolean;
  message?: string;
  error?: string;
  sessionId?: string;
}

declare global {
  interface Window {
    electronAPI: {
      closeWindow: () => Promise<void>;
      minimizeWindow: () => Promise<void>;
      toggleAlwaysOnTop: () => Promise<boolean>;
      isAlwaysOnTop: () => Promise<boolean>;
      getWindowBounds: () => Promise<{ width: number; height: number; x: number; y: number }>;
      resizeWindow: (width: number, height: number) => void;
      stopTranscription: () => Promise<{ success: boolean; message?: string; error?: string; sessionId?: string; stats?: any }>;
      sendAudioData: (data: number[]) => Promise<void>;
      onTranscriptionData: (callback: (data: TranscriptionData) => void) => void;
      onTranscriptionStatus: (callback: (status: string) => void) => void;
      onTranscriptionError: (callback: (error: { message: string; type?: string }) => void) => void;
      onTranscriptionConnected: (callback: () => void) => void;
      onTranscriptionDisconnected: (callback: () => void) => void;
      onConnectionQualityChange: (callback: (quality: ConnectionQuality) => void) => void;
      removeTranscriptionListeners: () => void;
    };
    transcription: {
      start: () => Promise<TranscriptionStartResult>;
    };
    ai: {
      availability: () => Promise<{ configured: boolean; provider?: string }>;
      selftest: () => Promise<{ success: boolean; error?: string; message?: string }>;
      onUpdate: (callback: (payload: AIUpdate) => void) => void;
      onLog: (callback: (logData: any) => void) => void;
      onError: (callback: (errorData: any) => void) => void;
    };
    api: {
      invoke: (channel: string, data?: any) => Promise<any>;
    };
    transcriptStorage: {
      exportTranscript: (sessionId: string, format: 'txt' | 'md' | 'json' | 'docx') => Promise<{
        success: boolean;
        content?: any;
        filename?: string;
        isBinary?: boolean;
        error?: string;
      }>;
    };
  }
}

export {};

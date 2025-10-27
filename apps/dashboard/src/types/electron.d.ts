type UnknownRecord = Record<string, unknown>;

interface TranscriptionStorageBridge {
  getCurrentSession: () => Promise<{ sessionId: string | null; classId?: string | null; recordId?: string | null; startedAt?: number | null }>;
  getFullTranscript: (sessionId: string) => Promise<{ success: boolean; transcript?: string; session?: UnknownRecord; error?: string }>;
  getSegmentWindow: (options: UnknownRecord) => Promise<{ success: boolean; segments?: UnknownRecord[]; session?: UnknownRecord; error?: string }>;
  exportTranscript: (sessionId: string, format: string) => Promise<{ success: boolean; content?: unknown; filename?: string; isBinary?: boolean; error?: string }>;
  getSessions: (limit?: number) => Promise<{ success: boolean; sessions?: UnknownRecord[]; error?: string }>;
  getStats: () => Promise<{ success: boolean; stats?: UnknownRecord; error?: string }>;
  listClasses: () => Promise<{ success: boolean; classes?: UnknownRecord[]; error?: string }>;
  saveClass: (payload: UnknownRecord) => Promise<{ success: boolean; class?: UnknownRecord; error?: string }>;
  deleteClass: (classId: string) => Promise<{ success: boolean; error?: string }>;
  archiveClass: (classId: string, archived: boolean) => Promise<{ success: boolean; class?: UnknownRecord; error?: string }>;
  listTranscriptions: (opts?: UnknownRecord) => Promise<{ success: boolean; records?: UnknownRecord[]; error?: string }>;
  saveTranscription: (payload: UnknownRecord) => Promise<{ success: boolean; record?: UnknownRecord; error?: string }>;
  getTranscription: (id: string) => Promise<{ success: boolean; record?: UnknownRecord; error?: string }>;
  deleteTranscription: (id: string) => Promise<{ success: boolean; error?: string }>;
}

interface ModelContextBridge {
  get: () => Promise<{ success: boolean; settings?: UnknownRecord; error?: string }>;
  save: (settings: UnknownRecord) => Promise<{ success: boolean; error?: string }>;
}

interface TranscriptionControlBridge {
  start?: (
    meta?: { classId?: string | null; recordId?: string | null; title?: string | null }
  ) => Promise<{ success: boolean; error?: string } | void> | void;
}

declare global {
  interface Window {
    transcriptStorage?: TranscriptionStorageBridge;
    modelContext?: ModelContextBridge;
    transcription?: TranscriptionControlBridge;
  }
}

export {};

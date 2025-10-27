import type { ClassItem } from "@/lib/classes/provider";
import type { CalendarEvent, TranscriptionRecord } from "@/lib/dashboard/provider";
import type {
  ClassDashboardDetail,
  ClassStats,
  Note,
  Permissions,
  Session,
} from "@/lib/types/class-dashboard";

// Default content seeding has been removed so the dashboard starts empty until
// real data is captured or synced in from the Electron bridge/local storage.

export const SEED_CLASS_IDS: string[] = [];
export const SEED_CLASS_SLUGS: string[] = [];
export const SEED_CLASSES: ClassItem[] = [];

export function createSeedEvents(): CalendarEvent[] {
  return [];
}

export function createSeedTranscriptions(): TranscriptionRecord[] {
  return [];
}

export const SEED_TRANSCRIPTION_IDS: string[] = [];

export function getClassDashboardDetail(classId: string): ClassDashboardDetail | undefined {
  void classId;
  return undefined;
}

export function getClassSessions(classId: string): Session[] {
  void classId;
  return [];
}

export function getClassNotes(classId: string): Note[] {
  void classId;
  return [];
}

export function getClassStats(classId: string): ClassStats | undefined {
  void classId;
  return undefined;
}

export function getClassPermissions(classId: string): Permissions | undefined {
  void classId;
  return undefined;
}

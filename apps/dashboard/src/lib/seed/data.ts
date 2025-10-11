import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import type { ClassItem } from "@/lib/classes/provider";
import type { CalendarEvent, CalendarEventType, TranscriptionRecord } from "@/lib/dashboard/provider";

type EventSeed = {
  id: string;
  title: string;
  description?: string;
  location?: string;
  type: CalendarEventType;
  classId?: string;
  allDay?: boolean;
  dayOffset: number;
  startTime?: string;
  endTime?: string;
};

type TranscriptSeed = {
  id: string;
  title: string;
  classId?: string;
  durationMinutes: number;
  wordCount: number;
  status: TranscriptionRecord["status"];
  summary?: string;
  tags?: string[];
  flagged?: boolean;
  daysAgo: number;
};

export const SEED_CLASSES: ClassItem[] = [
  {
    id: "ee2010",
    code: "EE2010",
    name: "Analogue Circuits",
    slug: "ee2010-analogue-circuits",
    transcriptions: 12,
  },
  {
    id: "cs3240",
    code: "CS3240",
    name: "Interaction Design",
    slug: "cs3240-interaction-design",
    transcriptions: 9,
  },
  {
    id: "hg1001",
    code: "HG1001",
    name: "Effective Communication",
    slug: "hg1001-effective-communication",
    transcriptions: 6,
  },
];

const EVENT_SEEDS: EventSeed[] = [
  {
    id: "evt-1",
    title: "EE2010 Lecture 7 — Op-amp stability",
    description: "Focus on Bode plots and gain margins.",
    location: "Engin LT5",
    type: "lecture",
    classId: "ee2010",
    dayOffset: 0,
    startTime: "14:00",
    endTime: "15:30",
  },
  {
    id: "evt-2",
    title: "CS3240 Lab 3 Review",
    description: "SQL joins practice session.",
    location: "COM2-04-02",
    type: "tutorial",
    classId: "cs3240",
    dayOffset: 1,
    startTime: "16:00",
    endTime: "17:00",
  },
  {
    id: "evt-3",
    title: "HG1001 Thesis Workshop",
    description: "Structure and storytelling for thesis writing.",
    location: "Humanities SR6",
    type: "meeting",
    classId: "hg1001",
    dayOffset: 2,
    startTime: "10:00",
    endTime: "12:00",
  },
  {
    id: "evt-4",
    title: "EE2010 Quiz 2 Deadline",
    description: "Submit via LumiNUS by midnight.",
    type: "assessment",
    classId: "ee2010",
    dayOffset: 4,
    allDay: true,
  },
];

const TRANSCRIPTION_SEEDS: TranscriptSeed[] = [
  {
    id: "tx-101",
    title: "EE2010 Lecture 6 — Frequency response",
    classId: "ee2010",
    durationMinutes: 85,
    wordCount: 12450,
    status: "completed",
    summary: "Covered gain/phase margins and Nyquist stability. Assigned Quiz 2 for next week.",
    tags: ["lecture", "stability"],
    daysAgo: 3,
  },
  {
    id: "tx-102",
    title: "CS3240 Lab 2 Debrief",
    classId: "cs3240",
    durationMinutes: 45,
    wordCount: 6300,
    status: "completed",
    summary: "Discussed common mistakes in Lab 2, refreshed SQL JOIN strategies and indexing tips.",
    tags: ["lab"],
    daysAgo: 2,
  },
  {
    id: "tx-103",
    title: "HG1001 Workshop Prep",
    classId: "hg1001",
    durationMinutes: 30,
    wordCount: 3100,
    status: "draft",
    summary: "Outline of workshop structure, feedback from previous session pending.",
    tags: ["planning"],
    flagged: true,
    daysAgo: 1,
  },
];

export function createSeedEvents(reference: Date = new Date()): CalendarEvent[] {
  const start = startOfDay(reference);
  return EVENT_SEEDS.map((seed) => {
    const eventDay = addDays(start, seed.dayOffset);
    const startISO = seed.allDay
      ? eventDay.toISOString()
      : timeToIso(eventDay, seed.startTime ?? "09:00");
    const endISO = seed.allDay
      ? addDays(eventDay, seed.endTime ? 0 : 0).toISOString()
      : timeToIso(eventDay, seed.endTime ?? seed.startTime ?? "10:00");

    return {
      id: seed.id,
      title: seed.title,
      description: seed.description,
      start: startISO,
      end: endISO,
      location: seed.location,
      type: seed.type,
      classId: seed.classId,
      allDay: seed.allDay,
    };
  });
}

export function createSeedTranscriptions(reference: Date = new Date()): TranscriptionRecord[] {
  return TRANSCRIPTION_SEEDS.map((seed) => ({
    id: seed.id,
    title: seed.title,
    createdAt: addDays(reference, -seed.daysAgo).toISOString(),
    durationMinutes: seed.durationMinutes,
    wordCount: seed.wordCount,
    status: seed.status,
    classId: seed.classId,
    summary: seed.summary,
    tags: seed.tags,
    flagged: seed.flagged,
  }));
}

export const SEED_TRANSCRIPTION_IDS = TRANSCRIPTION_SEEDS.map((seed) => seed.id);
export const SEED_CLASS_SLUGS = SEED_CLASSES.map((cls) => cls.slug);

function timeToIso(day: Date, time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number.parseInt(hourStr ?? "0", 10);
  const minute = Number.parseInt(minuteStr ?? "0", 10);
  return setMinutes(setHours(day, hour), minute).toISOString();
}

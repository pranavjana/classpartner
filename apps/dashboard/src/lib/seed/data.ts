import { addDays, setHours, setMinutes, startOfDay } from "date-fns";
import type { ClassItem } from "@/lib/classes/provider";
import type { CalendarEvent, CalendarEventType, TranscriptionRecord } from "@/lib/dashboard/provider";
import type {
  ClassDashboardDetail,
  ClassStats,
  Session,
  Note,
  Permissions,
} from "@/lib/types/class-dashboard";

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

const REFERENCE_DATE = startOfDay(new Date());

const CLASS_DASHBOARD_DATA: Record<string, ClassDashboardDetail> = {
  ee2010: {
    classInfo: {
      id: "ee2010",
      name: "EE2010 — Analogue Circuits",
      code: "EE2010",
      icon: "cpu",
      colour: "#2563eb",
      semester: "AY25/26 S1",
      createdAt: addDays(REFERENCE_DATE, -120).toISOString(),
      updatedAt: addDays(REFERENCE_DATE, -2).toISOString(),
      metadata: {
        instructor: "Assoc. Prof. Tan Wei",
        meetLink: "https://nus.zoom.us/j/123456789",
        defaultLanguage: "en",
        schedule: [
          { day: 1, start: "14:00", end: "16:00" },
          { day: 3, start: "10:00", end: "12:00" },
        ],
      },
    },
    stats: {
      totalMinutes: 9 * 60,
      sessionCount: 9,
      avgSessionMinutes: 60,
      lastSessionAt: addDays(REFERENCE_DATE, -1).toISOString(),
      weeklyTimeSeries: Array.from({ length: 8 }, (_, index) => {
        const weeksAgo = 7 - index;
        return {
          date: addDays(REFERENCE_DATE, -weeksAgo * 7).toISOString(),
          minutes: [240, 180, 220, 260, 200, 120, 160, 180][index],
        };
      }),
    },
    sessions: [
      {
        id: "tx-101",
        classId: "ee2010",
        title: "Lecture 6 — Frequency response",
        date: addDays(REFERENCE_DATE, -3).toISOString(),
        durationMinutes: 85,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -2).toISOString(),
        wordCount: 12450,
      },
      {
        id: "tx-104",
        classId: "ee2010",
        title: "Lecture 7 — Op-amp stability",
        date: addDays(REFERENCE_DATE, -1).toISOString(),
        durationMinutes: 92,
        status: "processing",
        lastEditedAt: addDays(REFERENCE_DATE, -1).toISOString(),
        wordCount: 0,
      },
      {
        id: "tx-105",
        classId: "ee2010",
        title: "Tutorial: Bode Plot Clinic",
        date: addDays(REFERENCE_DATE, -8).toISOString(),
        durationMinutes: 54,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -7).toISOString(),
        wordCount: 8200,
      },
      {
        id: "tx-106",
        classId: "ee2010",
        title: "Consultation — Lab prep",
        date: addDays(REFERENCE_DATE, -15).toISOString(),
        durationMinutes: 40,
        status: "failed",
        lastEditedAt: addDays(REFERENCE_DATE, -15).toISOString(),
      },
      {
        id: "tx-107",
        classId: "ee2010",
        title: "Lecture 5 — Feedback amplifiers",
        date: addDays(REFERENCE_DATE, -14).toISOString(),
        durationMinutes: 88,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -13).toISOString(),
        wordCount: 11820,
      },
    ],
    notes: [
      {
        id: "note-ee-1",
        classId: "ee2010",
        title: "Quiz 2 revision points",
        createdAt: addDays(REFERENCE_DATE, -6).toISOString(),
        pinned: true,
      },
      {
        id: "note-ee-2",
        classId: "ee2010",
        title: "Lab equipment checklist",
        createdAt: addDays(REFERENCE_DATE, -12).toISOString(),
        pinned: true,
      },
      {
        id: "note-ee-3",
        classId: "ee2010",
        title: "Op-amp troubleshooting tips",
        createdAt: addDays(REFERENCE_DATE, -20).toISOString(),
      },
    ],
    permissions: {
      canEdit: true,
      canDelete: true,
      canShare: true,
    },
  },
  cs3240: {
    classInfo: {
      id: "cs3240",
      name: "CS3240 — Interaction Design",
      code: "CS3240",
      icon: "palette",
      colour: "#f59e0b",
      semester: "AY25/26 S1",
      createdAt: addDays(REFERENCE_DATE, -140).toISOString(),
      updatedAt: addDays(REFERENCE_DATE, -3).toISOString(),
      metadata: {
        instructor: "Dr. Lim Xin",
        meetLink: "https://meet.google.com/design-team",
        defaultLanguage: "en",
        schedule: [{ day: 2, start: "09:00", end: "11:00" }],
      },
    },
    stats: {
      totalMinutes: 7 * 60,
      sessionCount: 7,
      avgSessionMinutes: 60,
      lastSessionAt: addDays(REFERENCE_DATE, -5).toISOString(),
      weeklyTimeSeries: Array.from({ length: 8 }, (_, index) => {
        const weeksAgo = 7 - index;
        return {
          date: addDays(REFERENCE_DATE, -weeksAgo * 7).toISOString(),
          minutes: [180, 140, 160, 190, 175, 150, 110, 95][index],
        };
      }),
    },
    sessions: [
      {
        id: "tx-102",
        classId: "cs3240",
        title: "Lab 2 Debrief",
        date: addDays(REFERENCE_DATE, -2).toISOString(),
        durationMinutes: 45,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -1).toISOString(),
        wordCount: 6300,
      },
      {
        id: "tx-201",
        classId: "cs3240",
        title: "Lecture — Usability testing",
        date: addDays(REFERENCE_DATE, -5).toISOString(),
        durationMinutes: 80,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -4).toISOString(),
        wordCount: 11200,
      },
      {
        id: "tx-202",
        classId: "cs3240",
        title: "Studio critique",
        date: addDays(REFERENCE_DATE, -9).toISOString(),
        durationMinutes: 65,
        status: "processing",
        lastEditedAt: addDays(REFERENCE_DATE, -9).toISOString(),
      },
      {
        id: "tx-203",
        classId: "cs3240",
        title: "Team meeting — Project Polaris",
        date: addDays(REFERENCE_DATE, -16).toISOString(),
        durationMinutes: 50,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -15).toISOString(),
        wordCount: 7200,
      },
    ],
    notes: [
      {
        id: "note-cs-1",
        classId: "cs3240",
        title: "User testing checklist",
        createdAt: addDays(REFERENCE_DATE, -7).toISOString(),
        pinned: true,
      },
      {
        id: "note-cs-2",
        classId: "cs3240",
        title: "Design sprint agenda",
        createdAt: addDays(REFERENCE_DATE, -14).toISOString(),
      },
    ],
    permissions: {
      canEdit: true,
      canDelete: true,
      canShare: true,
    },
  },
  hg1001: {
    classInfo: {
      id: "hg1001",
      name: "HG1001 — Effective Communication",
      code: "HG1001",
      icon: "message-circle",
      colour: "#10b981",
      semester: "AY25/26 S1",
      createdAt: addDays(REFERENCE_DATE, -90).toISOString(),
      updatedAt: addDays(REFERENCE_DATE, -10).toISOString(),
      metadata: {
        instructor: "Ms. Cheryl Goh",
        meetLink: "https://teams.microsoft.com/l/meetup-join/commms",
        defaultLanguage: "en",
        schedule: [{ day: 4, start: "13:00", end: "15:00" }],
      },
    },
    stats: {
      totalMinutes: 5 * 60,
      sessionCount: 5,
      avgSessionMinutes: 60,
      lastSessionAt: addDays(REFERENCE_DATE, -8).toISOString(),
      weeklyTimeSeries: Array.from({ length: 8 }, (_, index) => {
        const weeksAgo = 7 - index;
        return {
          date: addDays(REFERENCE_DATE, -weeksAgo * 7).toISOString(),
          minutes: [120, 100, 130, 140, 90, 80, 70, 60][index],
        };
      }),
    },
    sessions: [
      {
        id: "tx-103",
        classId: "hg1001",
        title: "Workshop Prep",
        date: addDays(REFERENCE_DATE, -1).toISOString(),
        durationMinutes: 30,
        status: "processing",
        lastEditedAt: addDays(REFERENCE_DATE, -1).toISOString(),
        wordCount: 3100,
      },
      {
        id: "tx-301",
        classId: "hg1001",
        title: "Lecture — Storytelling",
        date: addDays(REFERENCE_DATE, -8).toISOString(),
        durationMinutes: 75,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -7).toISOString(),
        wordCount: 9800,
      },
      {
        id: "tx-302",
        classId: "hg1001",
        title: "Peer review clinic",
        date: addDays(REFERENCE_DATE, -13).toISOString(),
        durationMinutes: 55,
        status: "ready",
        lastEditedAt: addDays(REFERENCE_DATE, -12).toISOString(),
        wordCount: 7600,
      },
    ],
    notes: [
      {
        id: "note-hg-1",
        classId: "hg1001",
        title: "Pitch outline",
        createdAt: addDays(REFERENCE_DATE, -11).toISOString(),
        pinned: true,
      },
      {
        id: "note-hg-2",
        classId: "hg1001",
        title: "Feedback rubric",
        createdAt: addDays(REFERENCE_DATE, -18).toISOString(),
      },
    ],
    permissions: {
      canEdit: true,
      canDelete: false,
      canShare: false,
    },
  },
};

export const SEED_CLASS_IDS = Object.keys(CLASS_DASHBOARD_DATA);
export const SEED_CLASS_SLUGS = SEED_CLASS_IDS;

export const SEED_CLASSES: ClassItem[] = SEED_CLASS_IDS.map((id) => {
  const detail = CLASS_DASHBOARD_DATA[id];
  return {
    id: detail.classInfo.id,
    code: detail.classInfo.code ?? detail.classInfo.id.toUpperCase(),
    name: detail.classInfo.name,
    slug: detail.classInfo.id,
    transcriptions: detail.stats.sessionCount,
  };
});

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

const SESSION_SUMMARIES: Record<string, string> = {
  "tx-101": "Covered gain/phase margins and Nyquist stability. Assigned Quiz 2 for next week.",
  "tx-104": "Live capture currently processing.",
  "tx-105": "Clarified bode plot drawing steps and provided practise questions.",
  "tx-107": "Reviewed feedback amplifier topologies and real-world stability concerns.",
  "tx-102": "Discussed common mistakes in Lab 2, refreshed SQL join strategies and indexing tips.",
  "tx-201": "Walked through usability testing toolkit and recruiting plan.",
  "tx-203": "Captured design critiques and follow-up tasks for Polaris sprint.",
  "tx-103": "Outlined workshop logistics and feedback from previous cohort.",
  "tx-301": "Storytelling techniques for persuasive presentations.",
  "tx-302": "Summarised peer review rubric and feedback themes.",
};

const SESSION_KEY_POINTS: Record<string, string[]> = {
  "tx-101": [
    "Derived the relationship between phase margin and loop stability.",
    "Walked through Nyquist plots for common amplifier configurations.",
    "Discussed practical compensation strategies ahead of Quiz 2.",
  ],
  "tx-105": [
    "Stepped through manual Bode plot construction with real values.",
    "Highlighted frequent mistakes in interpreting phase crossover.",
  ],
  "tx-201": [
    "Outlined the usability testing process adopted for Project Polaris.",
    "Shared interview scripts and screener templates for recruiting participants.",
    "Reviewed metrics to capture qualitative and quantitative insights.",
  ],
  "tx-203": [
    "Captured peer critique themes around navigation complexity.",
    "Identified accessibility adjustments for the next sprint.",
  ],
  "tx-302": [
    "Summarised feedback categories and how they map to rubric criteria.",
    "Recommended next iteration focus for group presentations.",
  ],
};

const SESSION_ACTION_ITEMS: Record<string, string[]> = {
  "tx-101": ["Complete Quiz 2 by Friday 5pm.", "Review lab note on Miller compensation circuits."],
  "tx-105": ["Submit revised Bode plot homework before the next tutorial."],
  "tx-201": ["Schedule two pilot usability tests by next Monday.", "Upload interviewer notes to the shared drive."],
  "tx-203": ["Prototype accessibility fixes for dark mode contrast issues."],
  "tx-302": ["Update presentation deck to address rubric feedback on audience engagement."],
};

const SESSION_CONTENT: Record<string, string> = {
  "tx-101": `Professor Tan opened with a recap of feedback concepts before diving into gain and phase margins. We derived the condition for closed-loop stability using Nyquist plots and compared it with Bode plot intuition. The class walked through a worked example of a two-stage op-amp, highlighting where the phase crosses -180° and how much margin remains. We ended by discussing compensation strategies and the expectations for Quiz 2.`,
  "tx-105": `Tutorial focused on manual Bode plot construction. We converted transfer functions into magnitude/phase components, plotted asymptotes, and corrected for slope changes. Students practised identifying crossover frequency and marking phase margin. The tutor flagged recurring mistakes, especially in translating radians to degrees.`,
  "tx-201": `Lecture covered the end-to-end usability testing toolkit for the studio project. Dr. Lim demonstrated how to write a recruiting screener, prepare consent forms, and structure interview guides. We watched clips from past sessions to identify observable behaviours and metrics worth capturing. Teams shared progress on their protocols and received quick feedback.`,
  "tx-203": `During the studio critique, each team presented their latest iteration of the Polaris interface. Peers provided feedback on navigation complexity, icon readability, and the experience of setting reminders. Several accessibility issues were surfaced, especially around colour contrast in dark mode. Action items were recorded for each team before the next sprint.`,
  "tx-302": `Workshop summarised feedback from the peer review round. We mapped comments back to rubric criteria and highlighted trends around storytelling, slide pacing, and visual clarity. The facilitator recommended concrete adjustments teams could make before their final presentations.`,
};

const CLASS_TAG_PRESETS: Record<string, string[]> = {
  ee2010: ["circuits", "analog", "engineering"],
  cs3240: ["design", "ux", "studio"],
  hg1001: ["communication", "presentation"],
};

export function createSeedTranscriptions(): TranscriptionRecord[] {
  return SEED_CLASS_IDS.flatMap((id) => {
    const detail = CLASS_DASHBOARD_DATA[id];
    return detail.sessions.map((session) => {
      const baseTags = CLASS_TAG_PRESETS[session.classId] ?? [];
      const titleTags = deriveTagsFromTitle(session.title);
      const allTags = Array.from(new Set([...baseTags, ...titleTags]));

      const status: TranscriptionRecord["status"] =
        session.status === "ready"
          ? "completed"
          : session.status === "processing"
          ? "in-progress"
          : "draft";

      const estimatedWordCount = session.wordCount ?? Math.round(session.durationMinutes * 130);

      return {
        id: session.id,
        title: session.title,
        createdAt: session.date,
        durationMinutes: session.durationMinutes,
        wordCount: estimatedWordCount,
        status,
        classId: session.classId,
        summary: SESSION_SUMMARIES[session.id],
        tags: allTags.length ? allTags : undefined,
        flagged: session.status === "failed",
        keyPoints: SESSION_KEY_POINTS[session.id],
        actionItems: SESSION_ACTION_ITEMS[session.id],
        content: SESSION_CONTENT[session.id],
      } satisfies TranscriptionRecord;
    });
  });
}

export const SEED_TRANSCRIPTION_IDS = createSeedTranscriptions().map((tx) => tx.id);

function timeToIso(day: Date, time: string): string {
  const [hourStr, minuteStr] = time.split(":");
  const hour = Number.parseInt(hourStr ?? "0", 10);
  const minute = Number.parseInt(minuteStr ?? "0", 10);
  return setMinutes(setHours(day, hour), minute).toISOString();
}

function deriveTagsFromTitle(title: string): string[] {
  const lower = title.toLowerCase();
  const tags: string[] = [];
  if (lower.includes("lecture")) tags.push("lecture");
  if (lower.includes("lab")) tags.push("lab");
  if (lower.includes("tutorial")) tags.push("tutorial");
  if (lower.includes("workshop")) tags.push("workshop");
  if (lower.includes("meeting")) tags.push("meeting");
  if (lower.includes("review")) tags.push("review");
  return tags;
}

export function getClassDashboardDetail(classId: string): ClassDashboardDetail | undefined {
  return CLASS_DASHBOARD_DATA[classId];
}

export function getClassSessions(classId: string): Session[] {
  return CLASS_DASHBOARD_DATA[classId]?.sessions ?? [];
}

export function getClassNotes(classId: string): Note[] {
  return CLASS_DASHBOARD_DATA[classId]?.notes ?? [];
}

export function getClassStats(classId: string): ClassStats | undefined {
  return CLASS_DASHBOARD_DATA[classId]?.stats;
}

export function getClassPermissions(classId: string): Permissions | undefined {
  return CLASS_DASHBOARD_DATA[classId]?.permissions;
}

"use client";

import * as React from "react";
import { isAfter, isBefore, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { createSeedEvents, createSeedTranscriptions } from "@/lib/seed/data";

export type CalendarEventType = "lecture" | "tutorial" | "lab" | "assessment" | "meeting" | "reminder";

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO string
  end: string; // ISO string
  location?: string;
  type: CalendarEventType;
  classId?: string;
  allDay?: boolean;
};

export type TranscriptionRecordStatus = "completed" | "in-progress" | "draft";

export type TranscriptSegment = {
  id: string;
  text: string;
  startMs?: number | null;
  endMs?: number | null;
};

export type TranscriptionRecord = {
  id: string;
  title: string;
  createdAt: string; // ISO string
  durationMinutes: number;
  wordCount: number;
  status: TranscriptionRecordStatus;
  classId?: string;
  summary?: string;
  tags?: string[];
  flagged?: boolean;
  content?: string;
  keyPoints?: string[];
  actionItems?: string[];
  segments?: TranscriptSegment[];
  fullText?: string; // NEW: Full transcript text
  sessionId?: string; // NEW: Link to SQLite session
};

type DashboardDataContextValue = {
  ready: boolean;
  events: CalendarEvent[];
  transcriptions: TranscriptionRecord[];
  activeRecordId: string | null;
  addEvent: (event: Omit<CalendarEvent, "id"> & { id?: string }) => string;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  addTranscription: (record: Omit<TranscriptionRecord, "id"> & { id?: string }) => string;
  updateTranscription: (
    id: string,
    patch: Partial<TranscriptionRecord> | ((prev: TranscriptionRecord) => TranscriptionRecord)
  ) => void;
  deleteTranscription: (id: string) => void;
  setActiveRecordId: (id: string | null) => void;
  upcomingEvents: (limit?: number) => CalendarEvent[];
  eventsOn: (day: Date) => CalendarEvent[];
  eventsBetween: (start: Date, end: Date) => CalendarEvent[];
  transcriptionsForClass: (classId: string) => TranscriptionRecord[];
  recentTranscriptions: (limit?: number) => TranscriptionRecord[];
};

const DASHBOARD_EVENTS_KEY = "cp_dashboard_events";
const DASHBOARD_TRANSCRIPTS_KEY = "cp_dashboard_transcriptions";
const DASHBOARD_ACTIVE_TRANSCRIPT_KEY = "cp_active_transcription";

const DashboardDataContext = React.createContext<DashboardDataContextValue | null>(null);

function withId(id?: string) {
  if (id) return id;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(16).slice(2)}`;
}

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const bridge = typeof window !== "undefined" ? window.transcriptStorage : undefined;
  const useBridge = Boolean(bridge);

  const [ready, setReady] = React.useState(false);
  const [events, setEvents] = React.useState<CalendarEvent[]>(() => createSeedEvents());
  const [transcriptions, setTranscriptions] = React.useState<TranscriptionRecord[]>(() =>
    useBridge ? [] : createSeedTranscriptions()
  );
  const [activeRecordId, setActiveRecordIdState] = React.useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(DASHBOARD_ACTIVE_TRANSCRIPT_KEY) ?? null;
    } catch {
      return null;
    }
  });

  React.useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      let storedEvents: CalendarEvent[] | null = null;
      let storedTranscriptions: TranscriptionRecord[] | null = null;
      let storedActive: string | null = null;

      if (typeof window !== "undefined") {
        try {
          const rawEvents = localStorage.getItem(DASHBOARD_EVENTS_KEY);
          if (rawEvents) storedEvents = JSON.parse(rawEvents);
        } catch {}

        try {
          const rawTranscriptions = localStorage.getItem(DASHBOARD_TRANSCRIPTS_KEY);
          if (rawTranscriptions) storedTranscriptions = JSON.parse(rawTranscriptions);
        } catch {}

        try {
          storedActive = localStorage.getItem(DASHBOARD_ACTIVE_TRANSCRIPT_KEY);
        } catch {}
      }

      if (storedEvents) setEvents(storedEvents);
      if (storedActive) setActiveRecordIdState(storedActive);

      if (useBridge && bridge) {
        try {
          // One-time migration: if localStorage has transcriptions with content, save them to SQLite
          // This ensures content is not lost when transitioning to SQLite as source of truth
          const migrationKey = "cp_transcription_migration_done";
          const migrationDone = localStorage.getItem(migrationKey) === "true";

          if (!migrationDone && storedTranscriptions?.length) {
            console.log("[DashboardDataProvider] Migrating", storedTranscriptions.length, "transcriptions to SQLite...");
            await Promise.all(
              storedTranscriptions.map((record) =>
                bridge
                  .saveTranscription(transcriptionRecordToBridgePayload(record))
                  .catch((error) => console.error("[DashboardDataProvider] Failed to migrate transcription", error))
              )
            );
            localStorage.setItem(migrationKey, "true");
            localStorage.removeItem(DASHBOARD_TRANSCRIPTS_KEY);
            console.log("[DashboardDataProvider] Migration complete");
          } else if (storedTranscriptions?.length) {
            // Migration already done, just clear old localStorage data
            localStorage.removeItem(DASHBOARD_TRANSCRIPTS_KEY);
          }

          const response = await bridge.listTranscriptions({ limit: 500 });
          let items: TranscriptionRecord[] =
            response?.success && Array.isArray(response.records)
              ? response.records.map((record) => mapBridgeTranscriptionRecord(record))
              : [];

          if (items.length === 0 && !storedTranscriptions?.length) {
            const seedRecords = createSeedTranscriptions();
            await Promise.all(
              seedRecords.map((record) =>
                bridge
                  .saveTranscription(transcriptionRecordToBridgePayload(record))
                  .catch((error) => console.error("[DashboardDataProvider] Failed to seed transcription", error))
              )
            );
            const seeded = await bridge.listTranscriptions({ limit: 500 });
            if (seeded?.success && Array.isArray(seeded.records)) {
              items = seeded.records.map((record) => mapBridgeTranscriptionRecord(record));
            }
          }

          if (!cancelled) {
            setTranscriptions(items);
          }
        } catch (error) {
          console.error("[DashboardDataProvider] Failed to load transcriptions from SQLite:", error);
          if (!cancelled) {
            setTranscriptions(storedTranscriptions ?? createSeedTranscriptions());
          }
        }
      } else {
        if (!cancelled) {
          setTranscriptions(storedTranscriptions ?? createSeedTranscriptions());
        }
      }

      if (!cancelled) {
        setReady(true);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [bridge, useBridge]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const eventsBridge = (window as unknown as {
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
    }).transcriptionEvents;

    if (!eventsBridge?.onUpdate) return;

    const unsubscribe = eventsBridge.onUpdate((payload) => {
      if (!payload?.id) return;
      setTranscriptions((prev) =>
        prev.map((record) =>
          record.id === payload.id
            ? {
                ...record,
                summary: payload.summary ?? record.summary,
                keyPoints: payload.keyPoints ?? record.keyPoints,
                actionItems: payload.actionItems ?? record.actionItems,
              }
            : record
        )
      );
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(DASHBOARD_EVENTS_KEY, JSON.stringify(events));
      if (!useBridge) {
        localStorage.setItem(DASHBOARD_TRANSCRIPTS_KEY, JSON.stringify(transcriptions));
      }
      if (activeRecordId) {
        localStorage.setItem(DASHBOARD_ACTIVE_TRANSCRIPT_KEY, activeRecordId);
      } else {
        localStorage.removeItem(DASHBOARD_ACTIVE_TRANSCRIPT_KEY);
      }
    } catch (error) {
      console.warn("Failed to persist dashboard data", error);
    }
  }, [events, transcriptions, activeRecordId, ready, useBridge]);

  const addEvent = React.useCallback(
    (payload: Omit<CalendarEvent, "id"> & { id?: string }) => {
      const id = withId(payload.id);
      setEvents((prev) => [...prev, { ...payload, id }]);
      return id;
    },
    []
  );

  const updateEvent = React.useCallback((id: string, patch: Partial<CalendarEvent>) => {
    setEvents((prev) => prev.map((evt) => (evt.id === id ? { ...evt, ...patch } : evt)));
  }, []);

  const deleteEvent = React.useCallback((id: string) => {
    setEvents((prev) => prev.filter((evt) => evt.id !== id));
  }, []);

  const addTranscription = React.useCallback(
    (payload: Omit<TranscriptionRecord, "id"> & { id?: string }) => {
      const id = withId(payload.id);
      const createdAt = payload.createdAt ?? new Date().toISOString();
      const record: TranscriptionRecord = {
        id,
        title: payload.title,
        createdAt,
        durationMinutes: payload.durationMinutes ?? 0,
        wordCount: payload.wordCount ?? 0,
        status: payload.status ?? "draft",
        classId: payload.classId,
        summary: payload.summary,
        tags: payload.tags,
        flagged: payload.flagged,
        content: payload.content,
        keyPoints: payload.keyPoints,
        actionItems: payload.actionItems,
        segments: payload.segments,
        fullText: payload.fullText,
        sessionId: payload.sessionId,
      };

      setTranscriptions((prev) => [record, ...prev.filter((tx) => tx.id !== id)]);

      if (useBridge && bridge) {
        bridge
          .saveTranscription(transcriptionRecordToBridgePayload(record))
          .then((res) => {
            if (res?.success && res.record) {
              const mapped = mapBridgeTranscriptionRecord(res.record);
              setTranscriptions((prev) =>
                prev.map((tx) => (tx.id === mapped.id ? { ...mapped, segments: tx.segments } : tx))
              );
            }
          })
          .catch((error) => console.error("[DashboardDataProvider] Failed to save transcription", error));
      }

      return id;
    },
    [bridge, useBridge]
  );

  const updateTranscription = React.useCallback(
    (
      id: string,
      patch: Partial<TranscriptionRecord> | ((prev: TranscriptionRecord) => TranscriptionRecord)
    ) => {
      let nextRecord: TranscriptionRecord | null = null;
      setTranscriptions((prev) =>
        prev.map((tx) => {
          if (tx.id !== id) return tx;
          const updated = typeof patch === "function" ? patch(tx) : { ...tx, ...patch };
          nextRecord = { ...updated };
          return updated;
        })
      );

      if (useBridge && bridge && nextRecord) {
        bridge
          .saveTranscription(transcriptionRecordToBridgePayload(nextRecord))
          .then((res) => {
            if (res?.success && res.record) {
              const mapped = mapBridgeTranscriptionRecord(res.record);
              setTranscriptions((prev) =>
                prev.map((tx) =>
                  tx.id === mapped.id
                    ? {
                        ...mapped,
                        segments: tx.segments ?? nextRecord?.segments,
                        fullText: tx.fullText ?? nextRecord?.fullText,
                      }
                    : tx
                )
              );
            }
          })
          .catch((error) => console.error("[DashboardDataProvider] Failed to update transcription", error));
      }
    },
    [bridge, useBridge]
  );

  const deleteTranscription = React.useCallback(
    (id: string) => {
      console.log("[DashboardDataProvider] deleteTranscription called with id:", id);
      console.log("[DashboardDataProvider] useBridge:", useBridge, "bridge:", !!bridge);

      setTranscriptions((prev) => prev.filter((tx) => tx.id !== id));
      setActiveRecordIdState((prev) => (prev === id ? null : prev));
      if (useBridge && bridge) {
        console.log("[DashboardDataProvider] Calling bridge.deleteTranscription...");
        bridge
          .deleteTranscription(id)
          .then((response) => {
            console.log("[DashboardDataProvider] bridge.deleteTranscription response:", response);
          })
          .catch((error) => console.error("[DashboardDataProvider] Failed to delete transcription", error));
      } else {
        console.warn("[DashboardDataProvider] No bridge available, only updating local state");
      }
    },
    [bridge, useBridge]
  );

  const setActiveRecordId = React.useCallback((id: string | null) => {
    setActiveRecordIdState(id);
  }, []);

  const upcomingEvents = React.useCallback(
    (limit = 5) => {
      const now = new Date();
      return [...events]
        .filter((evt) => isAfter(parseISO(evt.end), now) || isSameDay(parseISO(evt.start), now))
        .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime())
        .slice(0, limit);
    },
    [events]
  );

  const eventsOn = React.useCallback(
    (day: Date) => {
      return events.filter((evt) => {
        const start = parseISO(evt.start);
        const end = parseISO(evt.end);
        if (evt.allDay) {
          return isSameDay(start, day) || isSameDay(end, day);
        }
        return isSameDay(start, day) || isSameDay(end, day);
      });
    },
    [events]
  );

  const eventsBetween = React.useCallback(
    (start: Date, end: Date) => {
      return events.filter((evt) => {
        const evtStart = parseISO(evt.start);
        const evtEnd = parseISO(evt.end);
        return (
          isWithinInterval(evtStart, { start, end }) ||
          isWithinInterval(evtEnd, { start, end }) ||
          (isBefore(evtStart, start) && isAfter(evtEnd, end))
        );
      });
    },
    [events]
  );

  const transcriptionsForClass = React.useCallback(
    (classId: string) => transcriptions.filter((tx) => tx.classId === classId),
    [transcriptions]
  );

  const recentTranscriptions = React.useCallback(
    (limit = 5) =>
      [...transcriptions]
        .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime())
        .slice(0, limit),
    [transcriptions]
  );

  const value = React.useMemo<DashboardDataContextValue>(
    () => ({
      ready,
      events,
      transcriptions,
      activeRecordId,
      addEvent,
      updateEvent,
      deleteEvent,
      addTranscription,
      updateTranscription,
      deleteTranscription,
      setActiveRecordId,
      upcomingEvents,
      eventsOn,
      eventsBetween,
      transcriptionsForClass,
      recentTranscriptions,
    }),
    [
      addEvent,
      addTranscription,
      deleteEvent,
      deleteTranscription,
      events,
      eventsBetween,
      eventsOn,
      activeRecordId,
      ready,
      recentTranscriptions,
      setActiveRecordId,
      transcriptions,
      transcriptionsForClass,
      upcomingEvents,
      updateEvent,
      updateTranscription,
    ]
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData() {
  const ctx = React.useContext(DashboardDataContext);
  if (!ctx) throw new Error("useDashboardData must be used within a DashboardDataProvider");
  return ctx;
}

function transcriptionRecordToBridgePayload(record: TranscriptionRecord) {
  const createdAtMs = (() => {
    const parsed = Date.parse(record.createdAt);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  })();

  return {
    id: record.id,
    title: record.title,
    classId: record.classId ?? null,
    sessionId: record.sessionId ?? null,
    createdAt: createdAtMs,
    durationMinutes: record.durationMinutes ?? 0,
    wordCount: record.wordCount ?? 0,
    status: record.status,
    summary: record.summary ?? null,
    keyPoints: record.keyPoints ?? null,
    actionItems: record.actionItems ?? null,
    content: record.content ?? record.fullText ?? null,
    tags: record.tags ?? null,
    flagged: record.flagged ? 1 : 0,
  };
}

function mapBridgeTranscriptionRecord(raw: Record<string, unknown>): TranscriptionRecord {
  const createdAtIso = (() => {
    if (typeof raw.createdAt === "string") {
      return raw.createdAt;
    }
    if (typeof raw.createdAt === "number") {
      return new Date(raw.createdAt).toISOString();
    }
    return new Date().toISOString();
  })();

  const parseArray = (value: unknown): string[] | undefined => {
    if (!value) return undefined;
    if (Array.isArray(value)) return value.map((entry) => String(entry));
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry));
        }
      } catch {}
    }
    return undefined;
  };

  return {
    id: String(raw.id ?? ""),
    title: typeof raw.title === "string" ? raw.title : "Untitled transcription",
    createdAt: createdAtIso,
    durationMinutes:
      typeof raw.durationMinutes === "number"
        ? raw.durationMinutes
        : Number(raw.durationMinutes ?? 0),
    wordCount:
      typeof raw.wordCount === "number" ? raw.wordCount : Number(raw.wordCount ?? 0),
    status: (typeof raw.status === "string" ? raw.status : "draft") as TranscriptionRecordStatus,
    classId: typeof raw.classId === "string" ? raw.classId : undefined,
    summary: typeof raw.summary === "string" ? raw.summary : undefined,
    tags: parseArray(raw.tags),
    flagged: Boolean(raw.flagged),
    content: typeof raw.content === "string" ? raw.content : typeof raw.fullText === "string" ? raw.fullText : undefined,
    keyPoints: parseArray(raw.keyPoints),
    actionItems: parseArray(raw.actionItems),
    sessionId: typeof raw.sessionId === "string" ? raw.sessionId : undefined,
    fullText:
      typeof raw.content === "string"
        ? raw.content
        : typeof raw.fullText === "string"
        ? raw.fullText
        : undefined,
  };
}

export type { DashboardDataContextValue };

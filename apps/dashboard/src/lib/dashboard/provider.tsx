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
};

type DashboardDataContextValue = {
  ready: boolean;
  events: CalendarEvent[];
  transcriptions: TranscriptionRecord[];
  addEvent: (event: Omit<CalendarEvent, "id"> & { id?: string }) => string;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  addTranscription: (record: Omit<TranscriptionRecord, "id"> & { id?: string }) => string;
  updateTranscription: (id: string, patch: Partial<TranscriptionRecord>) => void;
  deleteTranscription: (id: string) => void;
  upcomingEvents: (limit?: number) => CalendarEvent[];
  eventsOn: (day: Date) => CalendarEvent[];
  eventsBetween: (start: Date, end: Date) => CalendarEvent[];
  transcriptionsForClass: (classId: string) => TranscriptionRecord[];
  recentTranscriptions: (limit?: number) => TranscriptionRecord[];
};

const DASHBOARD_EVENTS_KEY = "cp_dashboard_events";
const DASHBOARD_TRANSCRIPTS_KEY = "cp_dashboard_transcriptions";

const DashboardDataContext = React.createContext<DashboardDataContextValue | null>(null);

function withId(id?: string) {
  if (id) return id;
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(16).slice(2)}`;
}

export function DashboardDataProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [events, setEvents] = React.useState<CalendarEvent[]>(() => createSeedEvents());
  const [transcriptions, setTranscriptions] = React.useState<TranscriptionRecord[]>(() =>
    createSeedTranscriptions()
  );

  // Hydrate from localStorage
  React.useEffect(() => {
    try {
      const storedEvents = localStorage.getItem(DASHBOARD_EVENTS_KEY);
      const storedTranscriptions = localStorage.getItem(DASHBOARD_TRANSCRIPTS_KEY);
      if (storedEvents) setEvents(JSON.parse(storedEvents));
      if (storedTranscriptions) setTranscriptions(JSON.parse(storedTranscriptions));
    } catch (error) {
      console.warn("Failed to hydrate dashboard data", error);
    } finally {
      setReady(true);
    }
  }, []);

  // Persist whenever collections change
  React.useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(DASHBOARD_EVENTS_KEY, JSON.stringify(events));
      localStorage.setItem(DASHBOARD_TRANSCRIPTS_KEY, JSON.stringify(transcriptions));
    } catch (error) {
      console.warn("Failed to persist dashboard data", error);
    }
  }, [events, transcriptions, ready]);

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
      setTranscriptions((prev) => [{ ...payload, id }, ...prev]);
      return id;
    },
    []
  );

  const updateTranscription = React.useCallback((id: string, patch: Partial<TranscriptionRecord>) => {
    setTranscriptions((prev) => prev.map((tx) => (tx.id === id ? { ...tx, ...patch } : tx)));
  }, []);

  const deleteTranscription = React.useCallback((id: string) => {
    setTranscriptions((prev) => prev.filter((tx) => tx.id !== id));
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
      addEvent,
      updateEvent,
      deleteEvent,
      addTranscription,
      updateTranscription,
      deleteTranscription,
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
      ready,
      recentTranscriptions,
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

export type { DashboardDataContextValue };

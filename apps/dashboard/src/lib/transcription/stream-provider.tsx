"use client";

import * as React from "react";
import { differenceInMinutes } from "date-fns";
import { useDashboardData, type TranscriptSegment } from "@/lib/dashboard/provider";

type TranscriptionBridge = {
  onData?: (cb: (payload: unknown) => void) => (() => void) | void;
  onDisconnected?: (cb: () => void) => (() => void) | void;
};

type AIBridge = {
  onUpdate?: (cb: (payload: unknown) => void) => (() => void) | void;
};

function extractTranscriptPayload(payload: unknown) {
  const base = (payload ?? {}) as Record<string, unknown>;
  const channel = (base.channel ?? {}) as Record<string, unknown>;
  const alternativesRaw = Array.isArray(channel.alternatives)
    ? (channel.alternatives as Array<Record<string, unknown>>)
    : [];
  const primary = alternativesRaw[0] ?? {};

  const textCandidate =
    (typeof base.text === "string" && base.text) ||
    (typeof base.transcript === "string" && base.transcript) ||
    (typeof primary.transcript === "string" && primary.transcript) ||
    "";
  const trimmed = textCandidate.trim();

  const isFinal =
    base.is_final === true ||
    base.speech_final === true ||
    base.type === "final" ||
    (typeof primary.confidence === "number" && primary.confidence >= 0.99);

  const startMs =
    typeof base.startMs === "number"
      ? base.startMs
      : typeof base.start === "number"
      ? base.start * 1000
      : undefined;

  const endMs =
    typeof base.endMs === "number"
      ? base.endMs
      : typeof base.end === "number"
      ? base.end * 1000
      : undefined;

  const segmentId =
    (typeof base.id === "string" && base.id) ||
    (typeof primary.id === "string" && primary.id) ||
    `seg-${Date.now().toString(16)}`;

  return { trimmed, isFinal, startMs, endMs, segmentId };
}

type AiUpdatePayload =
  | {
      summary?: string;
      keyPoints?: string[] | string;
      actionItems?: string[] | string;
    }
  | {
      type?: string;
      data?: unknown;
    };

export function TranscriptionStreamProvider({ children }: React.PropsWithChildren) {
  const { activeRecordId, updateTranscription, setActiveRecordId } = useDashboardData();
  const bridge = typeof window !== "undefined" ? window.transcriptStorage : undefined;
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const sessionIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    sessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  React.useEffect(() => {
    let cancelled = false;
    const ensureSession = async () => {
      if (!activeRecordId || !bridge?.getCurrentSession) {
        setActiveSessionId(null);
        return;
      }
      try {
        const response = await bridge.getCurrentSession();
        if (cancelled) return;
        const sessionId: string | null = response?.sessionId ?? null;
        setActiveSessionId(sessionId);
        if (sessionId) {
          updateTranscription(activeRecordId, (prev) =>
            prev.sessionId === sessionId ? prev : { ...prev, sessionId }
          );
        }
      } catch (error) {
        console.warn("[TranscriptionStreamProvider] Failed to resolve current session", error);
      }
    };
    ensureSession();
    return () => {
      cancelled = true;
    };
  }, [activeRecordId, bridge, updateTranscription]);

  React.useEffect(() => {
    const transcription: TranscriptionBridge | undefined =
      typeof window !== "undefined"
        ? (window as unknown as { transcription?: TranscriptionBridge }).transcription
        : undefined;
    if (!transcription?.onData) return;

    const unsubscribe = transcription.onData((payload) => {
      if (!activeRecordId) return;
      const { trimmed, isFinal, startMs, endMs, segmentId } = extractTranscriptPayload(payload);
      if (!trimmed || !isFinal) return;

      updateTranscription(activeRecordId, (prev) => {
        const nextSegments: TranscriptSegment[] = [...(prev.segments ?? []), { id: segmentId, text: trimmed, startMs, endMs }];
        const content = prev.content ? `${prev.content}\n${trimmed}` : trimmed;
        const words = trimmed.split(/\s+/).filter(Boolean).length;
        const durationMinutes = (() => {
          if (typeof endMs === "number") {
            return Math.max(prev.durationMinutes ?? 0, Math.max(1, Math.round(endMs / 60000)));
          }
          if (prev.segments?.length) {
            const last = prev.segments[prev.segments.length - 1];
            if (last?.endMs) {
              return Math.max(prev.durationMinutes ?? 0, Math.max(1, Math.round(last.endMs / 60000)));
            }
          }
          return prev.durationMinutes ?? 0;
        })();

        return {
          ...prev,
          sessionId: prev.sessionId ?? sessionIdRef.current ?? prev.sessionId,
          content,
          fullText: content,
          segments: nextSegments,
          wordCount: (prev.wordCount ?? 0) + words,
          durationMinutes,
        };
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [activeRecordId, updateTranscription]);

  React.useEffect(() => {
    const aiBridge: AIBridge | undefined =
      typeof window !== "undefined" ? (window as unknown as { ai?: AIBridge }).ai : undefined;
    if (!aiBridge?.onUpdate) return;

    const unsubscribe = aiBridge.onUpdate((payload) => {
      if (!activeRecordId) return;
      const update = payload as AiUpdatePayload;

      updateTranscription(activeRecordId, (prev) => {
        const next = { ...prev };

        if ("summary" in update && typeof update.summary === "string" && update.summary.trim()) {
          next.summary = update.summary.trim();
        } else if ("type" in update && update.type === "summary" && typeof update.data === "string") {
          next.summary = update.data.trim();
        }

        const normalizeList = (value: unknown) => {
          if (!value) return undefined;
          if (Array.isArray(value)) {
            const list = value.map((item) => String(item).trim()).filter(Boolean);
            return list.length ? list : undefined;
          }
          const single = String(value).trim();
          return single ? [single] : undefined;
        };

        const keyPoints =
          ("keyPoints" in update && normalizeList(update.keyPoints)) ||
          ("type" in update && update.type === "key_points" ? normalizeList(update.data) : undefined);
        if (keyPoints) next.keyPoints = keyPoints;

        const actionItems =
          ("actionItems" in update && normalizeList(update.actionItems)) ||
          ("type" in update && update.type === "action_items" ? normalizeList(update.data) : undefined);
        if (actionItems) next.actionItems = actionItems;

        return next;
      });
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [activeRecordId, updateTranscription]);

  React.useEffect(() => {
    const transcription: TranscriptionBridge | undefined =
      typeof window !== "undefined"
        ? (window as unknown as { transcription?: TranscriptionBridge }).transcription
        : undefined;
    if (!transcription?.onDisconnected) return;

    const unsubscribe = transcription.onDisconnected?.(() => {
      if (!activeRecordId) return;
      const sessionId = sessionIdRef.current;
      const finalize = async () => {
        let fullTranscript: string | undefined;
        if (sessionId && bridge?.getFullTranscript) {
          try {
            const response = await bridge.getFullTranscript(sessionId);
            if (response?.success && typeof response.transcript === "string") {
              fullTranscript = response.transcript;
            }
          } catch (error) {
            console.warn("[TranscriptionStreamProvider] Failed to fetch full transcript", error);
          }
        }

        updateTranscription(activeRecordId, (prev) => ({
          ...prev,
          sessionId: sessionId ?? prev.sessionId,
          status: "completed",
          content: fullTranscript ?? prev.content,
          fullText: fullTranscript ?? prev.fullText ?? prev.content,
          summary:
            prev.summary ??
            (fullTranscript
              ? `${fullTranscript.split("\n").slice(0, 2).join(" ")}…`
              : prev.content
              ? `${prev.content.split("\n").slice(0, 2).join(" ")}…`
              : "Recording completed."),
          durationMinutes:
            prev.durationMinutes ||
            Math.max(1, differenceInMinutes(new Date(), new Date(prev.createdAt))),
        }));
        setActiveRecordId(null);
        setActiveSessionId(null);
      };
      void finalize();
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [activeRecordId, bridge, setActiveRecordId, updateTranscription]);

  return <>{children}</>;
}

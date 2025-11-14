"use client";

import * as React from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, BookmarkCheck, Flag, MapPin, PenLine, MessageSquare, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useDashboardData } from "@/lib/dashboard/provider";
import type { TranscriptionRecord } from "@/lib/dashboard/provider";
import { useClasses } from "@/lib/classes/provider";

interface QAInteraction {
  id: string;
  sessionId: string;
  recordId?: string;
  timestamp: number;
  question: string;
  answer: string;
  context?: string;
  markerMs?: number;
  metadata?: Record<string, unknown>;
}

const STATUS_OPTIONS = [
  { value: "completed", label: "Mark as completed" },
  { value: "in-progress", label: "Resume in overlay" },
  { value: "draft", label: "Save as draft" },
];

export default function TranscriptionDetailClient({ id }: { id: string }) {
  const { transcriptions, updateTranscription } = useDashboardData();
  const { classes } = useClasses();
  const cachedRecord = transcriptions.find((tx) => tx.id === id);

  const [record, setRecord] = React.useState<TranscriptionRecord | undefined>(cachedRecord);
  const [summary, setSummary] = React.useState(record?.summary ?? "");
  const [saving, setSaving] = React.useState(false);
  const [qaInteractions, setQaInteractions] = React.useState<QAInteraction[]>([]);
  const [loadingQA, setLoadingQA] = React.useState(true);
  const [loadingRecord, setLoadingRecord] = React.useState(true);

  // Load full transcription record with content
  React.useEffect(() => {
    async function loadFullRecord() {
      if (!id || typeof window === 'undefined') {
        setLoadingRecord(false);
        return;
      }

      try {
        const result = await window.transcriptStorage?.getTranscription(id);

        if (result?.success && result.record) {
          const fullRecord = result.record as TranscriptionRecord;
          console.log('[TranscriptionDetail] Loaded record:', {
            success: result.success,
            hasContent: Boolean(fullRecord.content),
            hasFullText: Boolean(fullRecord.fullText),
            segmentsCount: fullRecord.segments?.length ?? 0,
            sessionId: fullRecord.sessionId,
          });

          setRecord(fullRecord);
          setSummary(fullRecord.summary ?? "");
        } else {
          console.warn('[TranscriptionDetail] Failed to load, using cached record');
          // Fallback to cached record if bridge call fails
          setRecord(cachedRecord);
        }
      } catch (error) {
        console.error('[TranscriptionDetail] Failed to load full transcription:', error);
        setRecord(cachedRecord);
      } finally {
        setLoadingRecord(false);
      }
    }

    loadFullRecord();
  }, [id, cachedRecord]);

  // Load Q&A interactions
  React.useEffect(() => {
    async function loadQAInteractions() {
      if (!record?.sessionId || typeof window === 'undefined') {
        setLoadingQA(false);
        return;
      }

      try {
        const result = await window.transcriptStorage?.getQABySession(record.sessionId);
        if (result?.success && result.interactions) {
          setQaInteractions(result.interactions);
        }
      } catch (error) {
        console.error('Failed to load Q&A interactions:', error);
      } finally {
        setLoadingQA(false);
      }
    }

    loadQAInteractions();
  }, [record?.sessionId]);

  // Handle both ISO string and timestamp formats - must be before early returns
  const createdAt = React.useMemo(() => {
    const date = record?.createdAt || cachedRecord?.createdAt;
    if (!date) return new Date();

    // If it's a number (timestamp), convert directly
    if (typeof date === 'number') {
      return new Date(date);
    }

    // If it's a string, parse as ISO
    try {
      return parseISO(date);
    } catch {
      return new Date();
    }
  }, [record?.createdAt, cachedRecord?.createdAt]);

  const isLostRecap = record?.tags?.includes("lost-recap");
  const relatedRecaps = React.useMemo(() => {
    if (!record?.sessionId) return [];
    return transcriptions
      .filter(
        (tx) =>
          tx.id !== record.id &&
          tx.sessionId === record.sessionId &&
          tx.tags?.includes("lost-recap")
      )
      .map((entry) => ({
        entry,
        payload: parseLostRecapContent(entry),
      }))
      .filter(
        (item): item is { entry: TranscriptionRecord; payload: LostRecapPayload } =>
          Boolean(item.payload)
      )
      .sort((a, b) => (a.payload.markerMs ?? 0) - (b.payload.markerMs ?? 0));
  }, [record?.id, record?.sessionId, transcriptions]);

  const transcriptParagraphs = React.useMemo(() => {
    if (!record) return [];

    const textFromSegments = record.segments
      ?.map((segment) => segment.text?.trim())
      .filter(Boolean)
      .join(" ");

    const fullText = textFromSegments || record.content || record.fullText || "";
    return splitTextIntoParagraphs(fullText, 90);
  }, [record]);

  if (loadingRecord) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <h1 className="text-xl font-semibold">Loading transcription...</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please wait while we load the full transcript and details.
          </p>
        </div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
          <h1 className="text-xl font-semibold">Transcript not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The transcription you are looking for does not exist. It may have been removed.
          </p>
          <Button asChild className="mt-4">
            <Link href="/transcriptions">Back to all transcriptions</Link>
          </Button>
        </div>
      </div>
    );
  }

  const classInfo = record.classId ? classes.find((cls) => cls.id === record.classId) : undefined;
  const handleSave = async () => {
    setSaving(true);
    try {
      updateTranscription(record.id, {
        summary: summary.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (status: typeof record.status) => {
    updateTranscription(record.id, { status });
  };

  const toggleFlag = () => {
    updateTranscription(record.id, { flagged: !record.flagged });
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/transcriptions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to all
          </Link>
        </Button>
        <Badge variant="outline" className="text-xs capitalize">
          {record.status.replace("-", " ")}
        </Badge>
        {record.flagged ? (
          <Badge variant="destructive" className="text-xs">
            Needs attention
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="border-border">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-semibold">{record.title}</CardTitle>
            <CardDescription>
              Captured on {format(createdAt, "EEEE, dd MMM yyyy • h:mma")} {classInfo ? (
                <>
                  — linked to {" "}
                  <Link
                    href={`/classes/workspace?classId=${classInfo.id}`}
                    className="font-medium underline underline-offset-4"
                  >
                    {classInfo.code}
                  </Link>
                </>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Summary</h2>
                <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
                  <PenLine className="mr-2 h-4 w-4" />
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={8}
                placeholder="AI-generated summary will appear here automatically. You can also edit or add your own notes."
              />
            </section>

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Key points</h2>
              {record.keyPoints?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {record.keyPoints.map((point, index) => (
                    <li key={`${record.id}-kp-${index}`} className="rounded-md border border-border/60 bg-muted/20 p-2">
                      {point}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Key takeaways will appear here once the AI assistant finishes processing this transcript.
                </p>
              )}
            </section>

            <Separator />

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Action items</h2>
              {record.actionItems?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {record.actionItems.map((item, index) => (
                    <li key={`${record.id}-ai-${index}`} className="flex items-start gap-2">
                      <span>•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tasks, deadlines, and follow-ups will be listed once they are generated or added manually.
                </p>
              )}
            </section>

            <Separator />

            {qaInteractions.length > 0 && (
              <>
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Questions & Answers ({qaInteractions.length})
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Questions you asked during this transcription session
                  </p>
                  <div className="space-y-4">
                    {qaInteractions.map((qa) => (
                      <Card key={qa.id} className="border-border bg-muted/20">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <CardTitle className="text-sm font-semibold text-foreground">
                                Q: {qa.question}
                              </CardTitle>
                              <CardDescription className="mt-1 flex items-center gap-2 text-xs">
                                <Clock className="h-3 w-3" />
                                {qa.markerMs !== undefined ? formatMarkerClock(qa.markerMs) : format(new Date(qa.timestamp), "h:mma")}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="rounded-md border border-border/60 bg-background/50 p-3">
                            <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                              {qa.answer}
                            </p>
                          </div>
                          {qa.metadata?.relevantSegments !== undefined && (
                            <p className="text-xs text-muted-foreground">
                              Based on {String(qa.metadata.relevantSegments)} relevant segments
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
                <Separator />
              </>
            )}

            {loadingQA && (
              <>
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground animate-pulse" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Loading Q&A history...
                    </h2>
                  </div>
                </section>
                <Separator />
              </>
            )}

            {!isLostRecap && relatedRecaps.length ? (
              <>
                <section className="space-y-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    Moments of confusion
                  </h2>
                  <div className="space-y-3">
                    {relatedRecaps.map(({ entry: recap, payload }) => (
                      <div
                        key={recap.id}
                        className="rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">
                            Recap @ {formatMarkerClock(payload.markerMs)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs"
                            onClick={() => jumpToLostMoment(payload.markerMs, record.sessionId)}
                          >
                            Jump
                          </Button>
                        </div>
                        {payload.structured?.summary?.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                            {payload.structured.summary.slice(0, 3).map((item, idx) => (
                              <li key={`${recap.id}-sum-${idx}`}>{item}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Recap saved — open it from the overlay for full detail.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
                <Separator />
              </>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Full Transcript</h2>
              {(record.content || record.fullText || record.segments?.length) ? (
                <Card className="border-border">
                  <CardContent className="p-6">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <div className="max-h-[600px] overflow-y-auto pr-2 space-y-4">
                        {transcriptParagraphs.length > 0 ? (
                          transcriptParagraphs.map((paragraph, idx) => (
                            <p
                              key={`paragraph-${idx}`}
                              className="text-sm leading-relaxed text-foreground whitespace-pre-wrap"
                            >
                              {paragraph}
                            </p>
                          ))
                        ) : (
                          <p className="text-sm leading-relaxed text-foreground">
                            {record.content || record.fullText}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/40 p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    The full transcript will appear here once the transcription is complete.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    If you just finished recording, the content should appear within a few moments.
                  </p>
                </div>
              )}
            </section>
          </CardContent>
        </Card>

        </div>

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick actions</CardTitle>
              <CardDescription>Update the status or flag the session for review.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={record.status === option.value ? "default" : "outline"}
                  className="w-full justify-start gap-2"
                  onClick={() => handleStatusChange(option.value as typeof record.status)}
                >
                  <BookmarkCheck className="h-4 w-4" />
                  {option.label}
                </Button>
              ))}
              <Button variant={record.flagged ? "destructive" : "outline"} className="w-full justify-start gap-2" onClick={toggleFlag}>
                <Flag className="h-4 w-4" />
                {record.flagged ? "Clear follow-up flag" : "Mark for follow-up"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Metadata</CardTitle>
              <CardDescription>Key information pulled from the overlay session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Duration</span>
                <span className="font-medium">{formatDuration(record.durationMinutes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Word count</span>
                <span className="font-medium">{new Intl.NumberFormat("en-US").format(record.wordCount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Segments</span>
                <span className="font-medium">{record.segments?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Questions asked</span>
                <span className="font-medium">{qaInteractions.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Captured</span>
                <span className="font-medium">{format(createdAt, "MMM d, yyyy")}</span>
              </div>
              {classInfo ? (
                <div className="flex items-start justify-between gap-2">
                  <span>Linked class</span>
                  <Link href={`/classes/workspace?classId=${classInfo.id}`} className="flex items-center gap-1 text-primary">
                    <MapPin className="h-3.5 w-3.5" />
                    {classInfo.code}
                  </Link>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins} min`;
  if (mins === 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${hrs} hr ${mins} min`;
}

type LostRecapPayload = {
  markerMs?: number;
  flaggedAt?: number;
  structured?: {
    summary?: string[];
    prerequisites?: string[];
    steps?: string[];
  };
};

function parseLostRecapContent(record: TranscriptionRecord): LostRecapPayload | null {
  if (!record.content) return null;
  try {
    const parsed = JSON.parse(record.content) as LostRecapPayload & { type?: string };
    if (parsed && (parsed.type === "lost-recap" || parsed.markerMs !== undefined)) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function formatMarkerClock(ms?: number) {
  if (typeof ms !== "number" || ms < 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function jumpToLostMoment(markerMs?: number, sessionId?: string) {
  if (typeof window === "undefined" || typeof markerMs !== "number") return;
  const bus = (window as unknown as { bus?: { jumpTo?: (detail: unknown) => void } }).bus;
  bus?.jumpTo?.({ startMs: markerMs, sessionId });
}

function splitTextIntoParagraphs(text: string, wordsPerParagraph: number): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];

  const words = cleaned.split(" ");
  const paragraphs: string[] = [];
  let current: string[] = [];

  for (const word of words) {
    current.push(word);
    if (current.length >= wordsPerParagraph) {
      paragraphs.push(current.join(" "));
      current = [];
    }
  }

  if (current.length) {
    paragraphs.push(current.join(" "));
  }

  return paragraphs;
}
